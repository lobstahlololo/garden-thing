#!/usr/bin/env python3
"""Freebuff preview helper: serve this static project on the injected PORT.

Freebuff's command runner does not perform POSIX shell expansion of $VAR
inside argv tokens, so we read PORT directly from os.environ here and exec
the stdlib HTTP server bound to 0.0.0.0 so Freebuff's proxy can reach it.
"""
import os
import sys

PORT = os.environ.get("PORT", "5173")
addr = ["--bind", "0.0.0.0", PORT]
print(f"[serve.py] starting http.server on 0.0.0.0:{PORT}", flush=True)
os.execvp(sys.executable, [sys.executable, "-m", "http.server", *addr])
