// AdBlocker by Irvando.d.a — generic content script (isolated world)
// Author: Irvando Demas Arifiandani (irvando.d.a) — https://irvandoda.web.id
(() => {
  const root = document.documentElement;

  // Cosmetic selectors for common ad containers (kept conservative to avoid breaking sites).
  const SELECTORS = [
    'ins.adsbygoogle',
    '[id^="google_ads_"]',
    '[id^="div-gpt-ad"]',
    '[id^="taboola-"]',
    '[id^="outbrain"]',
    '[data-ad-slot]',
    '[data-google-query-id]',
    '.adsbygoogle',
    '.adsbox',
    '.ad-banner',
    '.ad-container',
    '.advert',
    '.advertisement',
    '.sponsored-ad',
    '#ad-banner',
    'iframe[src*="doubleclick.net"]',
    'iframe[src*="googlesyndication.com"]',
    'iframe[src*="adservice.google"]',
    'iframe[src*="popads"]',
    'iframe[src*="exoclick"]',
    'iframe[src*="propellerads"]',
    'a[href*="doubleclick.net/"]'
  ];

  const style = document.createElement('style');
  style.id = 'irv-adblock-style';
  style.textContent =
    'html:not([data-irv-off]) :is(' + SELECTORS.join(',') + '){display:none!important;visibility:hidden!important}';
  root.appendChild(style);

  const topHost = (() => {
    try {
      const origins = location.ancestorOrigins;
      const top = origins && origins.length ? origins[origins.length - 1] : location.href;
      return new URL(top).hostname;
    } catch (_) {
      return location.hostname;
    }
  })();

  function isWhitelisted(list) {
    const h = topHost.replace(/^www\./, '');
    return list.some((d) => h === d || h.endsWith('.' + d));
  }

  const DEFAULTS = { enabled: true, whitelist: [], blockThreats: true, antiFingerprint: true };

  function setFlag(name, on) {
    if (on) root.setAttribute(name, '');
    else root.removeAttribute(name);
  }

  function applyState(s) {
    setFlag('data-irv-off', !s.enabled || isWhitelisted(s.whitelist || []));
    setFlag('data-irv-nofp', !s.antiFingerprint);
    setFlag('data-irv-nothreat', !s.blockThreats);
  }

  try {
    chrome.storage.sync.get(DEFAULTS, applyState);
    chrome.storage.onChanged.addListener(() => chrome.storage.sync.get(DEFAULTS, applyState));
  } catch (_) {}

  // --- Counter: hidden elements + blocked popups reported from the MAIN-world script ---
  const seen = new WeakSet();
  let pending = 0;
  let timer = null;

  function flush() {
    timer = null;
    if (!pending) return;
    const n = pending;
    pending = 0;
    try {
      chrome.runtime.sendMessage({ type: 'hit', n });
    } catch (_) {}
  }
  function queue(n) {
    if (root.hasAttribute('data-irv-off')) return;
    pending += n;
    if (!timer) timer = setTimeout(flush, 800);
  }

  document.addEventListener('irv-blocked', () => queue(1));

  const selectorText = SELECTORS.join(',');
  function scan() {
    let fresh = 0;
    try {
      document.querySelectorAll(selectorText).forEach((el) => {
        if (!seen.has(el)) {
          seen.add(el);
          fresh++;
        }
      });
    } catch (_) {}
    if (fresh) queue(fresh);
  }

  let scanTimer = null;
  const obs = new MutationObserver(() => {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      scan();
    }, 1000);
  });
  const start = () => {
    scan();
    obs.observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
