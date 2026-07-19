/* wildlife.js — MicroGrow wildlife integration
 * Loaded after the main inline script.
 * Monkey-patches window.computeMods and window.render so the existing app shell
 * surfaces iNaturalist data through the dashboard without touching the main file.
 * Assumes window.state / window.els / window.NUSIANCE_SPECIES are exported by the
 * main script (they will be — see the small str_replace at refreshLocation call). */
(function () {
  const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

  function classifyWildlifeLocal(tallies) {
    const threats = []; const beneficials = []; let totalNuisanceObs = 0; let weightedPressure = 0;
    if (!tallies || !window.NUSIANCE_SPECIES) return { threats, beneficials, totalNuisanceObs, pressureIndex: 0 };
    for (const [key, count] of Object.entries(tallies)) {
      const spec = window.NUSIANCE_SPECIES[key];
      if (!spec || count <= 0) continue;
      const enriched = { key, count, ...spec };
      if (spec.severity === 'beneficial') beneficials.push(enriched);
      else {
        threats.push(enriched);
        totalNuisanceObs += count;
        const w = { critical: 1.0, high: 0.7, medium: 0.4, low: 0.15 }[spec.severity] || 0.3;
        weightedPressure += w * Math.log2(1 + count);
      }
    }
    threats.sort((a, b) => (SEV_ORDER[a.severity] - SEV_ORDER[b.severity]) || (b.count - a.count));
    beneficials.sort((a, b) => b.count - a.count);
    return { threats, beneficials, totalNuisanceObs, pressureIndex: Math.min(1, weightedPressure / 6) };
  }

  window.threatBorder   = function (sev) { return ({ critical: 'border-red-400', high: 'border-clay-300', medium: 'border-clay-200', low: 'border-bark-200' }[sev] || 'border-bark-200'); };
  window.threatBg       = function (sev) { return ({ critical: 'bg-red-50', high: 'bg-clay-50', medium: 'bg-bark-50', low: 'bg-bark-50' }[sev] || 'bg-bark-50'); };
  window.threatToneBg   = function (sev) { return ({ critical: 'bg-red-100', high: 'bg-clay-100', medium: 'bg-clay-100', low: 'bg-bark-100' }[sev] || 'bg-bark-100'); };
  window.threatToneFg   = function (sev) { return ({ critical: 'text-red-800', high: 'text-clay-800', medium: 'text-clay-700', low: 'text-bark-700' }[sev] || 'text-bark-700'); };

  window.renderWildlife = function (mod) {
    const els = window.els; if (!els) return;
    const state = window.state || {};
    const w = mod && mod.wildlife;
    if (!w) {
      if (state.wildlifeErr) {
        els.wildlifeHeadline.textContent = '\u26A0\uFE0F Wildlife data unavailable';
        els.wildlifeSummary.textContent = `iNaturalist hasn't responded. ${state.wildlifeErr}.`;
      } else {
        els.wildlifeHeadline.textContent = 'Awaiting observations\u2026';
        els.wildlifeSummary.textContent = 'iNaturalist within 25 mi, last 90 days, against curated global garden-pest list.';
      }
      els.wildlifeCount.textContent = '\u2014';
      els.wildlifeRiskBadge.classList.add('hidden');
      els.wildlifeThreats.innerHTML = ''; els.wildlifeBeneficials.innerHTML = ''; els.wildlifeFootnote.textContent = '';
      return;
    }
    els.wildlifeCount.textContent = w.fetched.toLocaleString();
    const top = w.threats.slice(0, 5);
    const loc = (state.geo && state.geo.name) || 'this location';
    const ws = w.windowStart || '';
    if (w.threats.length === 0 && w.beneficials.length === 0) {
      els.wildlifeHeadline.textContent = '\uD83D\uDC3E Quiet \u2014 no curated species nearby';
      els.wildlifeSummary.textContent = `${w.fetched.toLocaleString()} observations within 25 mi of ${loc} since ${ws}, but none matched the curated list.`;
      els.wildlifeRiskBadge.classList.add('hidden');
    } else if (w.threats.length === 0) {
      els.wildlifeHeadline.textContent = '\uD83C\uDF1F Beneficial-only pressure';
      els.wildlifeSummary.textContent = `No curated pests near ${loc} since ${ws}. ${w.beneficials.length} beneficial species observed.`;
      els.wildlifeRiskBadge.classList.add('hidden');
    } else {
      const lead = top[0];
      els.wildlifeHeadline.textContent = `\uD83D\uDC3E ${w.threats.length} pest species \u00B7 top: ${lead.emoji} ${lead.common}`;
      els.wildlifeSummary.textContent = `${w.totalNuisanceObs} pest-pressure records near ${loc} since ${ws}. Pressure index ${(w.pressureIndex * 100).toFixed(0)}%.`;
      els.wildlifeRiskBadge.textContent = `Pressure ${(w.pressureIndex * 100).toFixed(0)}%`;
      els.wildlifeRiskBadge.className = `text-[11px] mt-2 px-2.5 py-1 rounded-full inline-block font-medium ${window.threatToneBg(lead.severity)} ${window.threatToneFg(lead.severity)}`;
      els.wildlifeRiskBadge.classList.remove('hidden');
    }
    els.wildlifeThreats.innerHTML = top.length ? top.map((t) => `
      <div class="rounded-xl border ${window.threatBorder(t.severity)} ${window.threatBg(t.severity)} p-3.5">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-start gap-2.5 min-w-0">
            <div class="text-2xl leading-none shrink-0">${t.emoji}</div>
            <div class="min-w-0">
              <p class="font-semibold text-bark-900 text-sm">${t.common}</p>
              <p class="text-xs text-bark-700 mt-0.5">${t.summary}</p>
            </div>
          </div>
          <div class="text-right shrink-0">
            <p class="text-[11px] text-bark-600">${t.count} record${t.count > 1 ? 's' : ''}</p>
            <span class="text-[11px] mt-1 inline-block px-2 py-0.5 rounded-full ${window.threatToneBg(t.severity)} ${window.threatToneFg(t.severity)} font-medium uppercase tracking-wider">${t.severity}</span>
          </div>
        </div>
        <ul class="mt-2.5 ml-1 text-xs text-bark-800 space-y-1">
          ${t.fixes.map((f) => '<li class="flex gap-1.5"><span class="text-moss-600 shrink-0">\u203A</span><span>' + f + '</span></li>').join('')}
        </ul>
      </div>
    `).join('') : `<p class="text-sm text-bark-600 italic p-3 rounded-xl bg-bark-50">\uD83C\uDF3F No curated pests near ${loc} in the last 90 days \u2014 relax and plant freely.</p>`;
    const benign = w.beneficials;
    els.wildlifeBeneficials.innerHTML = benign.length ? `
      <div class="mt-1 pt-4 border-t border-bark-100">
        <p class="text-[11px] uppercase tracking-wider text-moss-700 font-semibold">\uD83C\uDF1F Beneficial wildlife nearby</p>
        <div class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          ${benign.slice(0, 4).map((b) => `
            <div class="p-2.5 rounded-lg bg-moss-50 border border-moss-200">
              <p class="text-sm font-semibold text-bark-900"><span class="mr-1">${b.emoji}</span>${b.common} <span class="text-bark-600 font-normal">\u00D7 ${b.count}</span></p>
              <p class="text-xs text-bark-700 mt-0.5">${b.summary}</p>
            </div>`).join('')}
        </div>
      </div>
    ` : '';
    els.wildlifeFootnote.textContent = `Source: iNaturalist observations within 25 mi since ${ws}. Severity is a curated global garden-pressure heuristic, not a scientific threat assessment.`;
  };

  const __origComputeMods = window.computeMods;
  window.computeMods = function (st) {
    const mod = __origComputeMods(st);
    if (st.wildlife && st.wildlife.tallies) {
      const wc = classifyWildlifeLocal(st.wildlife.tallies);
      mod.wildlife = { ...wc, fetched: st.wildlife.fetched, total: st.wildlife.total, windowStart: st.wildlife.windowStart };
      const crit = wc.threats.filter((t) => t.severity === 'critical' || t.severity === 'high');
      if (crit.length) {
        mod.scoreChips.unshift({
          emoji: '\uD83D\uDC3E',
          label: `Wildlife \u00B7 ${crit.length} active threat${crit.length > 1 ? 's' : ''}`,
          tone: crit.some((t) => t.severity === 'critical') ? 'cool' : 'mild',
          sub: crit.slice(0, 2).map((t) => t.common.split(' /')[0]).join(', '),
        });
      } else if (wc.beneficials.length) {
        mod.scoreChips.unshift({
          emoji: '\uD83C\uDF1F',
          label: `Wildlife \u00B7 ${wc.beneficials.length} ally`,
          tone: 'mild',
          sub: wc.beneficials.slice(0, 2).map((t) => t.common.split(' /')[0]).join(', '),
        });
      }
      for (const t of wc.threats.slice(0, 2)) {
        const tone = t.severity === 'critical' ? 'alert' : t.severity === 'high' ? 'warn' : 'mild';
        mod.alerts.unshift({
          icon: t.emoji, tone,
          title: `Pest pressure \u00B7 ${t.common} (${t.count} recent record${t.count > 1 ? 's' : ''})`,
          body: `${t.summary} ${t.fixes.slice(0, 2).map((f) => '\u203A ' + f).join('  ')}`,
        });
      }
    }
    return mod;
  };

  const __origRender = window.render;
  window.render = function () {
    __origRender();
    if (window.state && window.computeMods && window.renderWildlife) {
      window.renderWildlife(window.computeMods(window.state));
    }
  };

  // Trigger a re-render once fetchWildlife data has populated state.
  const checkReady = setInterval(function () {
    if (window.state && window.state.weather && window.state.wildlife !== undefined) {
      clearInterval(checkReady);
      window.render();
    }
  }, 250);
})();
