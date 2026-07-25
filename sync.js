/* sync.js · MicroGrow ↔ Supabase sync layer
 *
 * Loaded after auth.js. Two responsibilities:
 *   1. On SIGNED_IN, fetch the user's profile / yard / query history /
 *      custom crops and hydrate window.state.
 *   2. Write-through the user's mutations, debounced, to the four tables.
 *
 * Public surface on window.microgrowSync (called from index.html inline script):
 *   - saveYardSettings({ topography, infrastructure, soil })
 *   - logQuery(rawQuery, resolvedLabel, latitude, longitude)
 *   - addCustomCrop({ name, emoji, kind, offset_days })
 *   - deleteCustomCrop(id)
 *
 * All write methods are no-ops when the user is not signed in.
 * The queue is in-memory only \u2014 no localStorage, so refresh on the same
 * machine without re-auth still loses queued writes (rarely a real
 * problem since debounce windows are < 1.5 s).
 */
(function () {
  'use strict';

  let _supabase = null;
  let _session = null;
  let _state = null;
  let _els = null;

  const queue = {
    profile: null,    // { last_location_query, baseline_last_frost, baseline_first_frost }
    yard: null,       // { topography, infrastructure, soil }
    queries: [],      // [{ raw_query, resolved_label, latitude, longitude }]
    customCrops: [],  // [{ op: 'insert'|'delete', ... }]
  };
  const timers = {};

  function flush(kind, delay) {
    if (delay == null) delay = 600;
    clearTimeout(timers[kind]);
    timers[kind] = setTimeout(() => doFlush(kind), delay);
  }

  async function doFlush(kind) {
    if (!_supabase || !_session) return;
    const uid = _session.user.id;

    try {
      if (kind === 'profile' && queue.profile) {
        const p = queue.profile; queue.profile = null;
        const { error } = await _supabase.from('profiles').update({
          last_location_query: p.last_location_query,
          baseline_last_frost: p.baseline_last_frost,
          baseline_first_frost: p.baseline_first_frost,
          updated_at: new Date().toISOString(),
        }).eq('user_id', uid);
        if (error) console.warn('[sync] profile update failed:', error.message);
      }

      if (kind === 'yard' && queue.yard) {
        const y = queue.yard; queue.yard = null;
        const { data: existing } = await _supabase
          .from('yard_profiles')
          .select('id')
          .eq('user_id', uid)
          .eq('is_default', true)
          .maybeSingle();

        if (existing) {
          const { error } = await _supabase.from('yard_profiles').update({
            topography: y.topography,
            infrastructure: y.infrastructure,
            soil: y.soil,
          }).eq('id', existing.id);
          if (error) console.warn('[sync] yard update failed:', error.message);
        } else {
          const { error } = await _supabase.from('yard_profiles').insert({
            user_id: uid,
            topography: y.topography,
            infrastructure: y.infrastructure,
            soil: y.soil,
            is_default: true,
            name: 'My Yard',
          });
          if (error) console.warn('[sync] yard insert failed:', error.message);
        }
      }

      if (kind === 'queries' && queue.queries.length) {
        const rows = queue.queries.splice(0);
        const { error } = await _supabase.from('query_history').insert(
          rows.map((r) => ({ user_id: uid, ...r }))
        );
        if (error) console.warn('[sync] query log failed:', error.message);
      }

      if (kind === 'customCrops' && queue.customCrops.length) {
        const ops = queue.customCrops.splice(0);
        for (const op of ops) {
          if (op.op === 'insert') {
            const { error } = await _supabase.from('custom_crops').insert({
              user_id: uid, ...op.data,
            });
            if (error) console.warn('[sync] crop insert failed:', error.message);
          } else if (op.op === 'delete') {
            const { error } = await _supabase.from('custom_crops').delete()
              .eq('id', op.id)
              .eq('user_id', uid);
            if (error) console.warn('[sync] crop delete failed:', error.message);
          }
        }
      }
    } catch (e) {
      console.warn('[sync] flush error:', e && e.message);
    }
  }

  async function loadProfile(session) {
    const uid = session.user.id;
    const [profileR, yardR, cropsR, queriesR] = await Promise.all([
      _supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle(),
      _supabase.from('yard_profiles').select('*')
        .eq('user_id', uid).eq('is_default', true).maybeSingle(),
      _supabase.from('custom_crops').select('*').eq('user_id', uid)
        .order('created_at', { ascending: false }).limit(20),
      _supabase.from('query_history').select('*').eq('user_id', uid)
        .order('queried_at', { ascending: false }).limit(20),
    ]);

    if (profileR.error) console.warn('[sync] profile load:', profileR.error.message);
    if (yardR.error)    console.warn('[sync] yard load:',    yardR.error.message);
    if (cropsR.error)   console.warn('[sync] crops load:',   cropsR.error.message);
    if (queriesR.error) console.warn('[sync] queries load:', queriesR.error.message);

    return {
      profile: profileR.data || null,
      yard:    yardR.data    || null,
      crops:   cropsR.data   || [],
      queries: queriesR.data || [],
    };
  }

  window.microgrowSync = {
    ready: false,
    session: null,

    setSupabase(client) { _supabase = client; },
    setStateRefs(state, els) { _state = state; _els = els; },

    async handleSignedIn(session) {
      _session = session;
      this.session = session;
      if (!_supabase || !_state) return;

      try {
        const data = await loadProfile(session);

        // Hydrate state without firing a write-through (set internal flag)
        this.ready = true;

        const patch = {};
        if (data.yard) {
          if (data.yard.topography)     patch.topography = data.yard.topography;
          if (data.yard.infrastructure) patch.infrastructure = data.yard.infrastructure;
          if (data.yard.soil)          patch.soil = data.yard.soil;
        }
        if (data.profile && data.profile.last_location_query && _els && _els.locInput) {
          _els.locInput.value = data.profile.last_location_query;
        }

        // Display-only data: stash so the render layer can pick it up
        patch.userCustomCrops  = data.crops;
        patch.userRecentQueries = data.queries.map((q) => ({
          rawQuery:  q.raw_query,
          label:     q.resolved_label,
          lat:       q.latitude,
          lon:       q.longitude,
          queriedAt: q.queried_at,
        }));

        Object.assign(_state, patch);
        if (typeof window.render === 'function') window.render();
      } catch (e) {
        console.warn('[sync] on SIGNED_IN failed:', e && e.message);
      }
    },

    handleSignedOut() {
      this.ready = false;
      this.session = null;
      _session = null;
    },

    // ---- public write-through methods -------------------------------------

    saveYardSettings({ topography, infrastructure, soil }) {
      if (!this.ready) return;
      queue.yard = { topography, infrastructure, soil };
      flush('yard', 500);
    },

    logQuery(rawQuery, resolvedLabel, latitude, longitude) {
      if (!this.ready) return;
      queue.queries.push({
        raw_query: String(rawQuery || '').slice(0, 200),
        resolved_label: String(resolvedLabel || '').slice(0, 200),
        latitude:  typeof latitude  === 'number' ? latitude  : null,
        longitude: typeof longitude === 'number' ? longitude : null,
      });
      queue.profile = {
        ...(queue.profile || {}),
        last_location_query: String(rawQuery || '').slice(0, 200),
      };
      flush('queries', 1500);
      flush('profile', 1500);
    },

    addCustomCrop({ name, emoji, kind, offset_days }) {
      if (!this.ready) return;
      queue.customCrops.push({
        op: 'insert',
        data: {
          name: String(name || '').slice(0, 80),
          emoji: String(emoji || '').slice(0, 8),
          kind: String(kind || 'warm'),
          offset_days: Number(offset_days) || 0,
        },
      });
      flush('customCrops', 500);
    },

    deleteCustomCrop(id) {
      if (!this.ready) return;
      queue.customCrops.push({ op: 'delete', id });
      flush('customCrops', 500);
    },
  };

  // Wire up to auth.js once both are loaded.
  function wireAuth() {
    if (!window.microgrowAuth) { setTimeout(wireAuth, 60); return; }
    window.microgrowAuth.onEvent((evt) => {
      if (evt.kind !== 'auth-event' && evt.kind !== 'initial-session') return;
      if ((evt.event === 'SIGNED_IN' || (evt.kind === 'initial-session' && evt.session))
          && window.microgrowSync.setSupabase) {
        window.microgrowSync.setSupabase(window.microgrowAuth._client);
      }
      const sess = evt.session || null;
      if (evt.event === 'SIGNED_IN' || (evt.kind === 'initial-session' && sess)) {
        window.microgrowSync.handleSignedIn(sess);
      } else if (evt.event === 'SIGNED_OUT') {
        window.microgrowSync.handleSignedOut();
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireAuth);
  } else {
    wireAuth();
  }
})();
