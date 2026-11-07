// AdBlocker by Irvando.d.a — anti pop-up / pop-under / click-hijack (MAIN world)
// Author: Irvando Demas Arifiandani (irvando.d.a) — https://irvandoda.web.id
(() => {
  if (window.__irvAdblockGeneric) return;
  window.__irvAdblockGeneric = true;

  const root = document.documentElement;
  const off = () => root.hasAttribute('data-irv-off');
  const report = () => {
    try {
      document.dispatchEvent(new CustomEvent('irv-blocked'));
    } catch (_) {}
  };

  const AD_HOST =
    /(doubleclick|googlesyndication|adservice|popads|popcash|propellerads|propellerclick|exoclick|adsterra|juicyads|trafficjunky|clickadu|hilltopads|onclickads|adcash|revenuehits|zeroredirect|bidvertiser|popunder|adnxs|mgid|taboola|outbrain)/i;
  const INTERACTIVE =
    'a,button,input,select,textarea,label,summary,[role="button"],[role="link"],[role="menuitem"],[onclick]';

  const baseDomain = (h) => h.split('.').slice(-2).join('.');
  const isCrossOrigin = (url) => {
    try {
      const u = new URL(url, location.href);
      return baseDomain(u.hostname) !== baseDomain(location.hostname);
    } catch (_) {
      return false;
    }
  };

  // ---- track the last user gesture ----
  let gestureId = 0;
  let openedForGesture = -1;
  let lastTarget = null;
  const onGesture = (e) => {
    gestureId++;
    lastTarget = e.target instanceof Element ? e.target : null;
  };
  addEventListener('pointerdown', onGesture, true);
  addEventListener('keydown', onGesture, true);

  // ---- window.open ----
  const realOpen = window.open;
  const stub = () => ({
    closed: true,
    focus() {},
    blur() {},
    close() {},
    postMessage() {},
    document: { write() {}, writeln() {}, close() {}, open() {} },
    location: { href: '', assign() {}, replace() {} }
  });

  window.open = function (url, ...rest) {
    if (off()) return realOpen.call(this, url, ...rest);
    const u = String(url == null ? '' : url);
    const active = navigator.userActivation ? navigator.userActivation.isActive : true;
    let host = '';
    try {
      host = new URL(u, location.href).hostname;
    } catch (_) {}

    let block = false;
    if (!active) block = true; // popup without a real user gesture
    else if (AD_HOST.test(host)) block = true; // known ad network
    else if (openedForGesture === gestureId) block = true; // 2nd popup for same click
    else if (
      isCrossOrigin(u) &&
      (!lastTarget || !lastTarget.closest || !lastTarget.closest(INTERACTIVE))
    )
      block = true; // click on a non-interactive area opening a foreign site = hijack

    if (block) {
      report();
      return stub();
    }
    openedForGesture = gestureId;
    return realOpen.call(this, url, ...rest);
  };

  // ---- programmatic clicks on detached <a target=_blank> (classic pop-under trick) ----
  const realClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (!off() && !this.isConnected && this.target && this.target !== '_self' && isCrossOrigin(this.href)) {
      report();
      return;
    }
    return realClick.apply(this, arguments);
  };

  // ---- invisible full-screen click-hijack overlays ----
  function isHijackOverlay(el) {
    if (!(el instanceof Element) || el === root || el === document.body) return false;
    if (el.closest('a,button,input,select,textarea,video,audio,canvas')) return false;
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'absolute') return false;
    const r = el.getBoundingClientRect();
    if (r.width < innerWidth * 0.7 || r.height < innerHeight * 0.7) return false;
    if ((el.textContent || '').trim() !== '') return false;
    if (el.querySelector('img,video,canvas,svg,input,button,iframe')) return false;
    const bg = cs.backgroundColor;
    const transparentBg = bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent';
    return Number(cs.opacity) < 0.1 || (transparentBg && cs.backgroundImage === 'none');
  }

  const onClickCapture = (e) => {
    if (off()) return;
    if (isHijackOverlay(e.target)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      try {
        e.target.remove();
      } catch (_) {}
      report();
    }
  };
  addEventListener('pointerdown', onClickCapture, true);
  addEventListener('mousedown', onClickCapture, true);
  addEventListener('click', onClickCapture, true);
})();
