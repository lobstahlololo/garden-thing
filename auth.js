/* auth.js · Supabase email/password wrapper for MicroGrow
 *
 * Loaded after the Supabase JS CDN script in index.html.
 * Reads the project URL + anon key from <meta name="supabase-url"> and
 * <meta name="supabase-anon-key"> (Freebuff injects these from the env
 * store at request time).
 *
 * Exposes window.microgrowAuth with: signUp, signIn, signOut, resetPassword,
 * onEvent. Events: auth-event / initial-session / error / missing-config /
 * missing-lib.
 *
 * Anti-enumeration: signUp returns a generic "check your email" status
 * whether or not the email already exists, so an attacker can't probe
 * for known accounts.
 */
(function () {
  'use strict';

  const listeners = [];

  function emit(evt) {
    listeners.forEach((fn) => {
      try { fn(evt); } catch (e) { console.error('[microgrowAuth listener]', e); }
    });
  }

  window.microgrowAuth = {
    ready: false,
    _client: null,

    onEvent(fn) {
      listeners.push(fn);
      return () => {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    },

    async signUp({ email, password }) {
      if (!this._client) throw new Error('Auth not initialized');
      const { data, error } = await this._client.auth.signUp({ email, password });
      if (error) {
        // Anti-enumeration: any "already registered" variant
        // returns the same generic success shape.
        if (/already|exists|registered/i.test(error.message)) {
          return { ok: true, needsEmailConfirmation: true };
        }
        return { ok: false, error: error.message };
      }
      return {
        ok: true,
        needsEmailConfirmation: !data.session,
        user: data.user && data.user.email,
      };
    },

    async signIn({ email, password }) {
      if (!this._client) throw new Error('Auth not initialized');
      const { data, error } = await this._client.auth.signInWithPassword({ email, password });
      if (error) {
        // Both "Invalid login" and "Email not confirmed" share a path;
        // the UI shows the raw message (Supabase doesn't consider this
        // enumeration because the caller already supplied the email).
        return { ok: false, error: error.message };
      }
      return { ok: true, user: data.user && data.user.email, session: data.session };
    },

    async signOut() {
      if (!this._client) throw new Error('Auth not initialized');
      const { error } = await this._client.auth.signOut();
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },

    async resetPassword({ email }) {
      if (!this._client) throw new Error('Auth not initialized');
      const redirectTo = window.location.origin + window.location.pathname;
      const { error } = await this._client.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) return { ok: false, error: error.message };
      return { ok: true, message: 'Check your email for a password reset link.' };
    },
  };

  function init() {
    const url = (document.querySelector('meta[name="supabase-url"]') || {}).content || '';
    const key = (document.querySelector('meta[name="supabase-anon-key"]') || {}).content || '';
    if (!url || !key) {
      emit({
        kind: 'missing-config',
        message: 'Supabase URL or anon key not configured. See SUPABASE_SETUP.md.',
      });
      return;
    }
    if (!window.supabase || !window.supabase.createClient) {
      emit({
        kind: 'missing-lib',
        message: 'Supabase JS library failed to load. Check your CSP and network.',
      });
      return;
    }

    const client = window.supabase.createClient(url, key, {
      auth: {
        persistSession: true,       // stores JWT in localStorage so refresh keeps you signed in
        autoRefreshToken: true,
        detectSessionInUrl: true,    // picks up ?access_token= from email-confirm / reset links
        storageKey: 'microgrow.auth',
      },
    });
    window.microgrowAuth._client = client;
    window.microgrowAuth.ready = true;

    // Tell sync.js (if loaded) about the client
    if (window.microgrowSync && window.microgrowSync.setSupabase) {
      window.microgrowSync.setSupabase(client);
    }

    client.auth.onAuthStateChange((event, session) => {
      emit({ kind: 'auth-event', event, session });
    });

    client.auth.getSession().then(({ data, error }) => {
      if (error) {
        emit({ kind: 'error', message: error.message });
      } else {
        emit({ kind: 'initial-session', session: data.session });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
