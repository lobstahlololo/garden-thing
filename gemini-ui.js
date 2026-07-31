/* gemini-ui.js · MicroGrow Gemini AI Plant Helper — UI wiring
 *
 * Loaded after gemini.js. Wires the Gemini card's input, button,
 * and result panel in the dashboard.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  function wire() {
    var input  = $('geminiPlantInput');
    var btn    = $('geminiLookupBtn');
    var status = $('geminiStatus');
    var result = $('geminiResult');
    var label  = $('geminiResultLabel');
    var body   = $('geminiResultBody');
    if (!input || !btn) return;

    function esc(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c];
      });
    }

    function setStatus(msg, kind) {
      if (!status) return;
      status.textContent = msg;
      var color = kind === 'ok' ? 'text-moss-700' : kind === 'err' ? 'text-red-600' : kind === 'warn' ? 'text-clay-700' : 'text-bark-600';
      status.className = 'text-[11px] mt-2 min-h-[1em] font-medium ' + color;
    }

    function renderResult(plantName, text) {
      if (!result || !body || !label) return;
      label.textContent = '\uD83C\uDF31 ' + esc(plantName);
      var lines = text.split('\n'), html = '';
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) { html += '<div class="h-1.5"></div>'; continue; }
        // Bold lines that start with an emoji + label
        var isHeader = /^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}][^:]*:/.test(line);
        html += isHeader
          ? '<p class="font-semibold text-bark-900">' + esc(line) + '</p>'
          : '<p class="text-bark-800">' + esc(line) + '</p>';
      }
      body.innerHTML = html;
      result.classList.remove('hidden');
      result.style.opacity = '0';
      result.style.transform = 'translateY(6px)';
      result.style.transition = 'opacity .3s ease, transform .3s ease';
      requestAnimationFrame(function () {
        result.style.opacity = '1';
        result.style.transform = 'translateY(0)';
      });
    }

    async function doLookup() {
      var plantName = input.value.trim();
      if (!plantName) { setStatus('\u26A0\uFE0F Enter a plant name first.', 'warn'); return; }

      // Wait for gemini.js to load (deferred)
      if (!window.microgrowGemini) {
        setStatus('\u23F3 Loading Gemini helper\u2026', 'info');
        var waited = 0;
        while (!window.microgrowGemini && waited < 5000) {
          await new Promise(function (r) { setTimeout(r, 100); });
          waited += 100;
        }
        if (!window.microgrowGemini) {
          setStatus('\u274C Gemini helper failed to load. Check your network.', 'err');
          return;
        }
      }

      btn.disabled = true;
      setStatus('\uD83D\uDD0D Asking Gemini about "' + esc(plantName) + '"\u2026', 'info');

      try {
        var r = await window.microgrowGemini.lookupPlant(plantName);
        btn.disabled = false;
        if (!r.ok) { setStatus('\u274C ' + r.error, 'err'); return; }
        setStatus('\u2713 Got growing info for ' + esc(plantName) + '.', 'ok');
        renderResult(plantName, r.text);
      } catch (e) {
        btn.disabled = false;
        setStatus('\u274C ' + (e && e.message || 'unknown'), 'err');
      }
    }

    btn.addEventListener('click', doLookup);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doLookup();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
