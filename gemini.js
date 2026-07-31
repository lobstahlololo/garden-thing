/* gemini.js · MicroGrow Gemini AI Plant Helper
 *
 * Loaded after the main inline script. Reads the Gemini API key from
 * <meta name="gemini-api-key"> (with fallback), and exposes
 * window.microgrowGemini.lookupPlant(name) for on-demand plant info.
 *
 * The API key is never logged or stored beyond the request; it lives in
 * the caller's environment var (GEMINI_API_KEY) injected into the meta tag.
 */
(function () {
  'use strict';

  const MODELS = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
  ];

  function getKey() {
    // 1) meta tag (Freebuff env-injection)
    const m = document.querySelector('meta[name="gemini-api-key"]');
    if (m && m.getAttribute('content')) return m.getAttribute('content').trim();
    // 2) window override (for debugging / manual set)
    if (window.__MICROGROW_GEMINI_KEY__) return window.__MICROGROW_GEMINI_KEY__;
    return null;
  }

  async function callGemini(prompt, key) {
    let lastErr = null;
    for (const model of MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
          }),
        });
        if (!resp.ok) {
          const body = await resp.text().catch(() => '');
          // 404 = model not available; try next. Otherwise throw.
          if (resp.status === 404) { lastErr = new Error('Model ' + model + ' not available'); continue; }
          throw new Error('Gemini HTTP ' + resp.status + (body ? ': ' + body.slice(0, 200) : ''));
        }
        const data = await resp.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Gemini returned an empty response.');
        return text;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('All Gemini models failed.');
  }

  function buildPrompt(plantName) {
    return `You are a master gardener and horticulturalist. Give concise, practical growing information for "${plantName}". Use exactly this format with emoji section headers. Keep each line under 120 characters. Be specific — don't use vague language like "depends on variety."

🌱 Description: One-line botanical description including plant family and growth habit.
☀️ Sun: Full sun / partial shade / full shade — be specific.
🌡️ Frost Tolerance: Tender / half-hardy / hardy — with a brief note.
📏 Spacing: Specific spacing (e.g. "18-24 inches apart").
📅 Planting Time: When to plant relative to last spring frost (e.g. "2 weeks after last frost").
⏱️ Days to Harvest: Approximate days from transplant or direct sow.
💧 Water: Watering needs — frequency and amount.
🪴 Soil: Preferred soil type and pH range.
💡 Key Tip: One especially useful growing tip unique to this plant.`;
  }

  // ---- Public API ----
  window.microgrowGemini = {
    /**
     * Look up growing info for a plant via Gemini.
     * @param {string} plantName  e.g. "Okra" or "Dragonfruit"
     * @returns {Promise<{ok:true, text:string, plantName:string}|{ok:false, error:string}>}
     */
    async lookupPlant(plantName) {
      const name = String(plantName || '').trim();
      if (!name) return { ok: false, error: 'Please enter a plant name.' };

      const key = getKey();
      if (!key) {
        return {
          ok: false,
          error: 'Gemini API key not configured. Add GEMINI_API_KEY to your environment vars (Keys panel) or set window.__MICROGROW_GEMINI_KEY__.',
        };
      }

      try {
        const text = await callGemini(buildPrompt(name), key);
        return { ok: true, text, plantName: name };
      } catch (e) {
        console.warn('[gemini] lookupPlant failed:', e && e.message);
        return { ok: false, error: (e && e.message) || 'Gemini API request failed. Check your key and try again.' };
      }
    },
  };
})();
