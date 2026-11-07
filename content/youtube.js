// AdBlocker by Irvando.d.a — YouTube ad skipper / anti-adblock-wall remover (isolated world)
// Author: Irvando Demas Arifiandani (irvando.d.a) — https://irvandoda.web.id
(() => {
  const root = document.documentElement;
  const off = () => root.hasAttribute('data-irv-off');

  const SKIP_BUTTONS = [
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    '.ytp-skip-ad-button',
    '.ytp-ad-skip-button-container button'
  ].join(',');
  const CLOSE_BUTTONS = '.ytp-ad-overlay-close-button, .ytp-ad-overlay-slot .close-button';
  const WALL = 'ytd-enforcement-message-view-model, #enforcement-message-container';

  let mutedByUs = false;
  let rateByUs = false;
  let inAd = false;

  const hit = (n = 1) => {
    try {
      chrome.runtime.sendMessage({ type: 'hit', n });
    } catch (_) {}
  };
  document.addEventListener('irv-yt-stripped', () => !off() && hit());

  function tick() {
    if (off()) return;
    const player = document.querySelector('#movie_player');
    const video = document.querySelector('video.html5-main-video') || document.querySelector('video');

    // anti-adblock wall
    const wall = document.querySelector(WALL);
    if (wall) {
      wall.remove();
      document.querySelectorAll('tp-yt-iron-overlay-backdrop, ytd-popup-container tp-yt-paper-dialog').forEach((n) => {
        if (n.matches('tp-yt-iron-overlay-backdrop') || /ad block|pemblokir iklan|adblock/i.test(n.textContent || '')) n.remove();
      });
      document.body && (document.body.style.overflow = '');
      if (video && video.paused) video.play().catch(() => {});
      hit();
    }

    if (!player) return;

    // overlay (banner on video) close buttons
    document.querySelectorAll(CLOSE_BUTTONS).forEach((b) => b.click());

    const adShowing =
      player.classList.contains('ad-showing') ||
      player.classList.contains('ad-interrupting') ||
      !!document.querySelector('.ytp-ad-player-overlay, .ytp-ad-player-overlay-layout');

    if (adShowing && video) {
      if (!inAd) {
        inAd = true;
        hit();
      }
      document.querySelectorAll(SKIP_BUTTONS).forEach((b) => b.click());
      if (!video.muted) {
        video.muted = true;
        mutedByUs = true;
      }
      if (video.playbackRate !== 16) {
        video.playbackRate = 16;
        rateByUs = true;
      }
      if (isFinite(video.duration) && video.duration > 0 && video.currentTime < video.duration - 0.1) {
        video.currentTime = video.duration;
      }
      if (video.paused) video.play().catch(() => {});
    } else if (inAd) {
      inAd = false;
      if (video) {
        if (mutedByUs) video.muted = false;
        if (rateByUs) video.playbackRate = 1;
      }
      mutedByUs = false;
      rateByUs = false;
    }
  }

  setInterval(tick, 250);
  new MutationObserver(tick).observe(root, { childList: true, subtree: true });

  // keep the data-irv-off flag in sync (generic.js also does this on every page)
})();
