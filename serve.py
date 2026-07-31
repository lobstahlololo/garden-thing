#!/usr/bin/env python3
"""MicroGrow dev server.

Reads .env.local then .env from the workspace, substitutes Supabase
project credentials into <meta name="supabase-url"> and
<meta name="supabase-anon-key"> at request time, and serves the result on
the Freebuff-injected PORT (bound to 0.0.0.0).

Why this exists:
  Freebuff's preview proxy does not template-rewrite the served HTML even
  when a `data-injected-by="freebuff-env:..."` marker is present, so the
  `<meta>` tags in index.html would otherwise reach the browser with empty
  `content=""`. That makes auth.js bail before creating the Supabase client
  ("Auth not initialized"). Instead, we read the values that Freebuff writes
  to .env.local (or its legacy .env), and substitute them into the served
  bytes on every `GET /` and `GET /*/index.html` request.

Everything else (auth.js, sync.js, wildlife.js, fonts, images) passes
through to the stdlib http.server.
"""
import html
import http.server
import os
import socketserver
import sys
from pathlib import Path
from urllib.parse import urlparse

WORK = Path(__file__).resolve().parent
PORT = int(os.environ.get("PORT", "5173"))


# ---------------------------------------------------------------------------
# .env parser
# ---------------------------------------------------------------------------
def load_env():
    """Parse .env.local, then .env (later overrides earlier), return {K:V}.

    Supports: comments (# ...), blank lines, optional `export ` prefix, and
    surrounding single or double quotes around the value. Unknown lines and
    read errors are silently skipped. Empty values are still returned (the
    caller decides whether to treat them as missing).
    """
    out = {}
    for fname in (".env.local", ".env"):
        path = WORK / fname
        if not path.exists():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        for raw in text.splitlines():
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if line.lower().startswith("export "):
                line = line[7:].lstrip()
            if "=" not in line:
                continue
            k, v = line.split("=", 1)
            k = k.strip()
            v = v.strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in ('"', "'"):
                v = v[1:-1]
            if k:
                out[k] = v
    return out


# ---------------------------------------------------------------------------
# Meta-tag substitution (only for the two Supabase tags)
# ---------------------------------------------------------------------------
def _substitute_meta(data: bytes, name: str, value: str) -> bytes:
    """Substitute the empty/placeholder content of <meta name="<name>"> with
    the (HTML-escaped) value. No-op if value is empty."""
    if not value:
        return data
    escaped = html.escape(value, quote=True)
    # Fast path: substitute the exact empty-marker shape we ship in index.html
    exact = (
        f'<meta name="{name}" content="" '
        f'data-injected-by="freebuff-env:{name.upper()}" />'
    ).encode()
    if exact in data:
        return data.replace(
            exact,
            f'<meta name="{name}" content="{escaped}" '
            f'data-injected-by="freebuff-env:{name.upper()}" />'.encode(),
            1,
        )
    # Fallback: any existing <meta name="<name>" content="..."> regardless
    # of the marker, just rewrite the trailing content.
    opener = f'<meta name="{name}" content="'.encode()
    idx = data.find(opener)
    if idx < 0:
        return data
    attr_start = idx + len(opener)
    attr_end = data.find(b'"', attr_start)
    if attr_end < 0:
        return data
    return data[:attr_start] + escaped.encode() + data[attr_end:]


# ---------------------------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------------------------
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WORK), **kwargs)

    def do_GET(self):
        path = urlparse(self.path).path
        if path in ("/", "/index.html") or path.endswith("/index.html"):
            self._serve_index()
            return
        return super().do_GET()

    def _serve_index(self):
        target = WORK / "index.html"
        if not target.exists():
            self.send_error(404, "index.html missing")
            return
        env = load_env()
        data = target.read_bytes()
        data = _substitute_meta(data, "supabase-url", env.get("SUPABASE_URL", ""))
        data = _substitute_meta(data, "supabase-anon-key", env.get("SUPABASE_ANON_KEY", ""))
        body = data
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        sys.stdout.write("[serve.py] " + (fmt % args) + "\n")
        sys.stdout.flush()


# ---------------------------------------------------------------------------
# Boot
# ---------------------------------------------------------------------------
def main() -> None:
    addr = ("0.0.0.0", PORT)
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    httpd = socketserver.ThreadingTCPServer(addr, Handler)
    print(f"[serve.py] starting on 0.0.0.0:{PORT} (cwd={WORK})", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("[serve.py] shutting down", flush=True)


if __name__ == "__main__":
    main()
