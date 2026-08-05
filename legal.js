/* legal.js · MicroGrow — Privacy Policy + Terms & Conditions modals
 *
 * Self-contained: builds both modal overlays, injects a scoped <style>
 * block, and wires open/close via delegated click listeners on
 * [data-open-modal="privacy"|"terms"]. Styling uses the app's CSS
 * variables (--canvas-*, --ink*, --accent) so the modals follow the
 * light/dark theme automatically.
 *
 * Exposes window.microgrowLegal.open(kind) for programmatic use.
 */
(function () {
  'use strict';

  var CONTACT_URL = 'https://github.com/lobstahlololo/garden-thing';
  var EFFECTIVE_DATE = 'August 5, 2026';

  /* ============================================================
     Scoped styles — theme-aware via the app's CSS variables
     ============================================================ */
  var STYLE =
    '.mg-root{position:fixed;inset:0;z-index:120;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(7,12,9,.62);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);}' +
    '.mg-root.mg-open{display:flex;}' +
    '.mg-root .mg-backdrop{position:absolute;inset:0;cursor:pointer;}' +
    '.mg-dialog{position:relative;width:min(680px,100%);max-height:min(84vh,900px);display:flex;flex-direction:column;background:var(--canvas-2,#162119);color:var(--ink,#172B1E);border:1px solid rgba(232,226,206,.14);border-radius:20px;box-shadow:0 24px 80px -24px rgba(0,0,0,.6),0 2px 12px -4px rgba(0,0,0,.35);overflow:hidden;opacity:0;transform:translateY(12px) scale(.985);transition:opacity .28s ease,transform .28s cubic-bezier(.2,.7,.2,1);}' +
    '.mg-open .mg-dialog{opacity:1;transform:translateY(0) scale(1);}' +
    '.mg-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:20px 24px 14px;border-bottom:1px solid rgba(107,85,48,.22);background:linear-gradient(180deg,rgba(232,226,206,.06),rgba(232,226,206,0));}' +
    '.mg-eyebrow{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--ink-2,#6B5530);font-weight:500;}' +
    '.mg-head h1{font-family:"Fraunces",Georgia,serif;font-size:clamp(1.15rem,3vw,1.45rem);font-weight:700;line-height:1.15;margin-top:4px;}' +
    '.mg-sub{font-size:12px;color:var(--ink-2,#6B5530);margin-top:4px;}' +
    '.mg-x{flex:none;width:34px;height:34px;border-radius:9999px;display:inline-flex;align-items:center;justify-content:center;background:var(--canvas-1,#EEF1E8);border:1px solid rgba(107,85,48,.28);color:var(--ink-2,#6B5530);font-size:15px;line-height:1;cursor:pointer;transition:transform .18s ease,color .18s ease,border-color .18s ease,background .18s ease;}' +
    '.mg-x:hover{color:var(--accent,#C8442A);border-color:var(--accent,#C8442A);transform:rotate(90deg);}' +
    '.mg-body{overflow-y:auto;padding:20px 24px 24px;}' +
    '.mg-body::-webkit-scrollbar{width:10px;}' +
    '.mg-body::-webkit-scrollbar-thumb{background:rgba(107,85,48,.32);border-radius:8px;border:2px solid transparent;background-clip:content-box;}' +
    '.mg-body::-webkit-scrollbar-track{background:transparent;}' +
    '.mg-sec{margin-top:22px;}' +
    '.mg-sec:first-child{margin-top:0;}' +
    '.mg-sec h2{font-family:"Fraunces",Georgia,serif;font-size:1.02rem;font-weight:600;color:var(--ink,#172B1E);display:flex;align-items:baseline;gap:9px;}' +
    '.mg-sec h2 .n{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:.72rem;font-weight:500;letter-spacing:.06em;color:var(--accent,#C8442A);}' +
    '.mg-sec p{font-size:.875rem;line-height:1.7;margin-top:7px;color:var(--ink,#172B1E);}' +
    '.mg-sec ul{margin:8px 0 0;padding-left:20px;}' +
    '.mg-sec li{font-size:.875rem;line-height:1.65;margin-top:5px;}' +
    '.mg-sec a{color:var(--accent,#C8442A);text-decoration:underline;text-underline-offset:2px;}' +
    '.mg-sec a:hover{filter:brightness(1.15);}' +
    '.mg-sec strong{font-weight:600;}' +
    '.mg-sec .mg-chip{display:inline-block;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11px;padding:2px 8px;border-radius:9999px;background:rgba(232,226,206,.08);border:1px solid rgba(107,85,48,.25);color:var(--ink-2,#6B5530);vertical-align:1px;}' +
    '.mg-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:13px 24px;border-top:1px solid rgba(107,85,48,.22);background:rgba(232,226,206,.04);}' +
    '.mg-foot-note{font-size:11px;color:var(--ink-2,#6B5530);}' +
    '.mg-btn{display:inline-flex;align-items:center;gap:8px;padding:9px 18px;border-radius:12px;font-size:13px;font-weight:600;font-family:"Geist",system-ui,sans-serif;background:var(--accent,#C8442A);color:#FBF8F0;border:1px solid transparent;cursor:pointer;transition:transform .15s ease,box-shadow .2s ease,filter .2s ease;}' +
    '.mg-btn:hover{filter:brightness(1.08);transform:translateY(-1px);box-shadow:0 10px 22px -10px rgba(200,68,42,.6);}' +
    '.mg-btn:active{transform:translateY(0) scale(.98);}' +
    '.mg-btn:focus-visible,.mg-x:focus-visible{outline:2px solid var(--accent,#C8442A);outline-offset:2px;}' +
    '@media (prefers-reduced-motion:reduce){.mg-dialog{transition:none}.mg-x{transition:none}}';

  /* ============================================================
     Content
     ============================================================ */
  function link(url, label) {
    return '<a href="' + url + '" target="_blank" rel="noopener">' + label + '</a>';
  }

  var PRIVACY_SECTIONS = [
    {
      h: 'Who we are',
      body:
        '<p>MicroGrow is a free, open-source gardening tool that turns your local weather, yard conditions, and your own preferences into hyper-local planting guidance. It is maintained as a hobby project by the operators of ' + link(CONTACT_URL, 'the garden-thing repository') + '.</p>',
    },
    {
      h: 'What we collect — signed out',
      body:
        '<p><strong>Nothing.</strong> If you use MicroGrow without creating an account, we store nothing on any server: no cookies, no localStorage, no analytics, no tracking pixels, no fingerprinting. Everything you type is processed in your browser to produce your garden plan, and it is gone the moment you leave.</p>',
    },
    {
      h: 'What we collect — if you create an account',
      body:
        '<p>Accounts are optional. If you sign up, we collect only what the service needs to remember your setup:</p>' +
        '<ul>' +
        '<li><strong>Your email address and password</strong> — handled by ' + link('https://supabase.com/', 'Supabase Auth') + '. Passwords are stored hashed; we never see or store your plaintext password.</li>' +
        '<li><strong>Your yard profile</strong> — topography, surrounding infrastructure, and soil type.</li>' +
        '<li><strong>Your last queried location</strong>, plus a <strong>history of locations you have queried</strong> (the text you typed and, where we could resolve it, the place name and coordinates).</li>' +
        '<li><strong>Custom crops</strong> you add to your planting table.</li>' +
        '</ul>' +
        '<p>Your browser also keeps a session token (<span class="mg-chip">JWT</span>) in localStorage so you stay signed in across visits. It is not your password and never leaves the app except to authenticate with our auth provider.</p>',
    },
    {
      h: 'Why we collect it',
      body:
        '<p>So your garden plan, location, and custom crops are the same on every device and survive a page refresh — nothing more. We do not sell your data, use it for advertising, or share it with anyone for their own purposes.</p>',
    },
    {
      h: 'Third-party services and what they see',
      body:
        '<p>To produce live data, the app sends requests to the services below when you use the relevant feature:</p>' +
        '<ul>' +
        '<li>' + link('https://open-meteo.com/', 'Open-Meteo') + ' — geocoding, weather forecast, and air quality. Receives the location text or coordinates you type.</li>' +
        '<li>' + link('https://www.inaturalist.org/', 'iNaturalist') + ' — wildlife observations near your location. Receives your approximate coordinates.</li>' +
        '<li>' + link('https://supabase.com/', 'Supabase') + ' — authentication and your per-user database (only when signed in). Access is scoped by row-level security to your own rows.</li>' +
        '<li>' + link('https://ai.google.dev/', 'Google Gemini') + ' — the AI plant helper. Receives only the plant name you type.</li>' +
        '<li>Google Fonts — loads the font files; a standard browser request.</li>' +
        '</ul>' +
        '<p>Each provider operates under its own privacy policy, and we send each one the least information needed for the feature to work.</p>',
    },
    {
      h: 'How we protect your data',
      body:
        '<p>All traffic runs over HTTPS. Your account data lives in Supabase under row-level security, which means each account can read and write only its own rows. Passwords are hashed by the auth provider before storage. We follow a principle of least data: we store only what the app needs to function.</p>',
    },
    {
      h: 'Retention and deletion',
      body:
        '<p>We keep your account data for as long as your account exists. You can request deletion at any time — open an issue in ' + link(CONTACT_URL, 'the repository') + ' and we will remove your profiles, yards, query history, and custom crops. One-off location and plant queries sent to Open-Meteo, iNaturalist, or Gemini are not retained by us beyond the moment of the request.</p>',
    },
    {
      h: 'Your rights',
      body:
        '<p>Depending on where you live (for example, under the GDPR or the CCPA), you may have rights to access, correct, export, or delete your personal data, and to withdraw consent. To exercise any of these, contact us via the repository and we will act on it promptly.</p>',
    },
    {
      h: 'Children',
      body:
        '<p>MicroGrow is not directed at children under 13 (or the minimum age set by your local law), and we do not knowingly collect personal information from children.</p>',
    },
    {
      h: 'Changes to this policy',
      body:
        '<p>If we change how we handle your data, we will update this page and revise the effective date. Significant changes will be called out in the repository. Continued use after a change means you accept the updated policy.</p>',
    },
    {
      h: 'Contact',
      body:
        '<p>Questions, deletion requests, or concerns? Open an issue at ' + link(CONTACT_URL, 'github.com/lobstahlololo/garden-thing') + ' — that is the fastest way to reach us.</p>',
    },
  ];

  var TERMS_SECTIONS = [
    {
      h: 'Acceptance of these terms',
      body:
        '<p>By accessing or using MicroGrow, you agree to be bound by these Terms &amp; Conditions and our <a href="#" data-open-modal="privacy">Privacy Policy</a>. If you do not agree, please do not use the service.</p>',
    },
    {
      h: 'The service',
      body:
        '<p>MicroGrow is a free web tool that estimates localized growing calendars, frost dates, planting schedules, wildlife information, and plant guidance based on the location and yard conditions you provide. The service is provided as-is for personal, non-commercial gardening use.</p>',
    },
    {
      h: 'Not professional advice',
      body:
        '<p>The information you receive is general, educational guidance for home gardeners. It is not a substitute for advice from your local agricultural extension office, a professional horticulturist, or the instructions on your seed packets. You are responsible for the gardening decisions you make — and for checking local conditions before planting.</p>',
    },
    {
      h: 'No warranty',
      body:
        '<p>The service is provided “as is” and “as available”, without warranties of any kind — including accuracy, reliability, or availability. Weather forecasts, wildlife data, and AI-generated content can be wrong, delayed, or incomplete. We do not guarantee that planting on a given date will succeed.</p>',
    },
    {
      h: 'Accounts and security',
      body:
        '<p>Accounts are optional. If you create one, you are responsible for keeping your credentials secure and for the accuracy of the information you provide. Do not share your account, and let us know if you believe it has been compromised.</p>',
    },
    {
      h: 'Acceptable use',
      body:
        '<p>Please use the service reasonably. You agree not to: scrape or hammer the service in ways that degrade it for others, attempt to access other users’ data or the underlying systems, or use the service for any unlawful purpose.</p>',
    },
    {
      h: 'Third-party services',
      body:
        '<p>MicroGrow relies on third-party services — Open-Meteo, iNaturalist, Supabase, and Google Gemini — to provide live data and AI features. Their own terms of service and privacy policies apply to their respective services, and we are not responsible for their operation.</p>',
    },
    {
      h: 'AI-generated content',
      body:
        '<p>The AI plant helper produces content with generative AI, which can make mistakes or state confidently incorrect things. Always verify AI answers against a reliable gardening source before acting on them.</p>',
    },
    {
      h: 'Intellectual property',
      body:
        '<p>The source code of MicroGrow is open source and lives in ' + link(CONTACT_URL, 'the repository') + '. Content generated for you within the service (such as AI answers) is provided for your personal use.</p>',
    },
    {
      h: 'Limitation of liability',
      body:
        '<p>To the maximum extent permitted by law, the operators of MicroGrow are not liable for any damages arising out of or related to your use of the service — including lost or damaged crops, reliance on data, or interruption of service.</p>',
    },
    {
      h: 'Termination',
      body:
        '<p>You may stop using MicroGrow at any time. We may suspend or disable access for misuse of the service. If any provision of these terms is found unenforceable, the remaining provisions stay in effect.</p>',
    },
    {
      h: 'Changes to these terms',
      body:
        '<p>We may update these terms from time to time and will revise the effective date at the top. Continued use of the service after changes means you accept the updated terms.</p>',
    },
    {
      h: 'Contact',
      body:
        '<p>Questions about these terms? Open an issue at ' + link(CONTACT_URL, 'github.com/lobstahlololo/garden-thing') + '.</p>',
    },
  ];

  /* ============================================================
     Modal construction
     ============================================================ */
  var lastFocused = null;
  var current = null;

  function renderSections(list) {
    return list
      .map(function (sec, i) {
        return (
          '<section class="mg-sec">' +
          '<h2><span class="n">' + String(i + 1).padStart(2, '0') + '</span>' + sec.h + '</h2>' +
          sec.body +
          '</section>'
        );
      })
      .join('');
  }

  function buildModal(kind) {
    var isPrivacy = kind === 'privacy';
    var id = 'mg-modal-' + kind;
    var title = isPrivacy ? 'Privacy Policy' : 'Terms &amp; Conditions';
    var sections = isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS;

    var root = document.createElement('div');
    root.className = 'mg-root';
    root.id = id;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', id + '-title');
    root.innerHTML =
      '<div class="mg-backdrop" data-mg-close aria-hidden="true"></div>' +
      '<div class="mg-dialog">' +
        '<div class="mg-head">' +
          '<div>' +
            '<div class="mg-eyebrow">' + (isPrivacy ? 'MicroGrow · Policy' : 'MicroGrow · Agreement') + '</div>' +
            '<h1 id="' + id + '-title">' + title + '</h1>' +
            '<div class="mg-sub">Effective ' + EFFECTIVE_DATE + ' · Free &amp; open-source</div>' +
          '</div>' +
          '<button type="button" class="mg-x" data-mg-close aria-label="Close ' + title.replace(/&amp;/g, '&') + '" title="Close (Esc)">✕</button>' +
        '</div>' +
        '<div class="mg-body">' + renderSections(sections) + '</div>' +
        '<div class="mg-foot">' +
          '<span class="mg-foot-note">Questions? Open an issue in <a href="' + CONTACT_URL + '" target="_blank" rel="noopener">the repository</a>.</span>' +
          '<button type="button" class="mg-btn" data-mg-close>Got it</button>' +
        '</div>' +
      '</div>';

    return root;
  }

  function getFocusables(dialog) {
    return Array.prototype.slice.call(
      dialog.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')
    ).filter(function (el) { return el.offsetParent !== null || el === document.activeElement; });
  }

  function openModal(kind) {
    var root = document.getElementById('mg-modal-' + kind);
    if (!root) return;
    if (current) closeModal();
    lastFocused = document.activeElement;
    current = root;
    root.classList.add('mg-open');
    root.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    var closeBtn = root.querySelector('.mg-x');
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    if (!current) return;
    var root = current;
    current = null;
    root.classList.remove('mg-open');
    root.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocused && lastFocused.focus) lastFocused.focus();
    lastFocused = null;
  }

  /* ============================================================
     Wiring
     ============================================================ */
  function init() {
    if (document.getElementById('mg-modal-privacy')) return; // already built

    var style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);

    document.body.appendChild(buildModal('privacy'));
    document.body.appendChild(buildModal('terms'));

    // Delegated trigger listener: [data-open-modal="privacy"|"terms"]
    document.addEventListener('click', function (e) {
      var trigger = e.target.closest && e.target.closest('[data-open-modal]');
      if (trigger) {
        var kind = trigger.getAttribute('data-open-modal');
        if (kind === 'privacy' || kind === 'terms') {
          e.preventDefault();
          openModal(kind);
          return;
        }
      }
      if (e.target.closest('[data-mg-close]')) {
        closeModal();
        return;
      }
      if (e.target.classList && e.target.classList.contains('mg-root')) {
        closeModal();
        return;
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeModal(); return; }
      if (e.key !== 'Tab' || !current) return;
      // Light focus trap inside the open dialog
      var focusables = getFocusables(current.querySelector('.mg-dialog'));
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    window.microgrowLegal = { open: openModal, close: closeModal };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
