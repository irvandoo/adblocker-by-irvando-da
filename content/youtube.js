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
  let adSince = 0;
  let recoveredFor = '';
  let stallSince = 0;
  let adEndedAt = 0;

  // Last-resort: reload the current video through the player API. The InnerTube
  // response is stripped of ads (youtube_main.js), so the reload starts clean.
  function recover(player, video) {
    const id = new URLSearchParams(location.search).get('v');
    if (!id || recoveredFor === id || typeof player.loadVideoById !== 'function') return;
    recoveredFor = id;
    try {
      video.playbackRate = 1;
      video.muted = false;
      player.loadVideoById({ videoId: id, startSeconds: 0 });
    } catch (_) {}
  }

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
        adSince = Date.now();
        hit();
      }
      document.querySelectorAll(SKIP_BUTTONS).forEach((b) => b.click());
      if (!video.muted) {
        video.muted = true;
        mutedByUs = true;
      }
      // Fast-forward only normal, finite ads. Seeking server-stitched (stream) ads
      // to the end leaves the player stuck on a black screen.
      if (isFinite(video.duration) && video.duration > 0 && video.duration < 120) {
        if (video.playbackRate !== 4) {
          video.playbackRate = 4;
          rateByUs = true;
        }
      }
      if (video.paused) video.play().catch(() => {});
      // Ad stuck for too long -> reload the real video.
      if (Date.now() - adSince > 5000) recover(player, video);
    } else {
      if (inAd) {
        inAd = false;
        adEndedAt = Date.now();
        if (video) {
          if (mutedByUs) video.muted = false;
          if (rateByUs) video.playbackRate = 1;
        }
        mutedByUs = false;
        rateByUs = false;
      }
      // Black screen / frozen after an ad: no ad UI, but video not progressing.
      if (video && adEndedAt && Date.now() - adEndedAt < 20000 && !video.ended && (video.paused || video.readyState < 3) && !video.seeking) {
        if (!stallSince) stallSince = Date.now();
        else if (Date.now() - stallSince > 4000) {
          if (video.paused) video.play().catch(() => {});
          if (Date.now() - stallSince > 8000 && location.pathname === '/watch') recover(player, video);
        }
      } else {
        stallSince = 0;
      }
    }
  }

  setInterval(tick, 250);
  new MutationObserver(tick).observe(root, { childList: true, subtree: true });

  // keep the data-irv-off flag in sync (generic.js also does this on every page)
})();
