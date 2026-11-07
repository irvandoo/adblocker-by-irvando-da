// AdBlocker by Irvando.d.a — YouTube ad payload stripping (MAIN world, document_start)
// Author: Irvando Demas Arifiandani (irvando.d.a) — https://irvandoda.web.id
(() => {
  if (window.__irvAdblockYT) return;
  window.__irvAdblockYT = true;

  const root = document.documentElement;
  const off = () => root.hasAttribute('data-irv-off');

  const PLAYER_AD_KEYS = ['adPlacements', 'playerAds', 'adSlots', 'adBreakHeartbeatParams'];
  const AD_ITEM_KEYS = [
    'adSlotRenderer',
    'promotedSponsorRenderer',
    'promotedVideoRenderer',
    'compactPromotedVideoRenderer',
    'searchPyvRenderer',
    'displayAdRenderer',
    'bannerPromoRenderer',
    'inFeedAdLayoutRenderer',
    'statementBannerRenderer'
  ];

  function isAdItem(x) {
    if (!x || typeof x !== 'object') return false;
    for (const k of AD_ITEM_KEYS) if (k in x) return true;
    const c = x.richItemRenderer && x.richItemRenderer.content;
    if (c && typeof c === 'object') for (const k of AD_ITEM_KEYS) if (k in c) return true;
    return false;
  }

  function stripPlayer(o) {
    if (!o || typeof o !== 'object') return o;
    for (const k of PLAYER_AD_KEYS) if (k in o) delete o[k];
    if (o.playerResponse && typeof o.playerResponse === 'object') stripPlayer(o.playerResponse);
    return o;
  }

  function stripFeed(node, depth) {
    if (!node || typeof node !== 'object' || depth > 14) return;
    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i--) {
        if (isAdItem(node[i])) node.splice(i, 1);
        else stripFeed(node[i], depth + 1);
      }
      return;
    }
    for (const k in node) {
      const v = node[k];
      if (v && typeof v === 'object') stripFeed(v, depth + 1);
    }
  }

  function strip(o) {
    if (off() || !o || typeof o !== 'object') return o;
    try {
      stripPlayer(o);
      if ('responseContext' in o || 'contents' in o || 'onResponseReceivedActions' in o || 'onResponseReceivedCommands' in o) {
        stripFeed(o, 0);
      }
    } catch (_) {}
    return o;
  }

  // 1) Initial page data
  function trap(name) {
    let value;
    try {
      Object.defineProperty(window, name, {
        configurable: true,
        get: () => value,
        set: (v) => {
          value = strip(v);
        }
      });
    } catch (_) {}
  }
  trap('ytInitialPlayerResponse');
  trap('ytInitialData');

  // 2) JSON.parse (used for inline blobs and some XHR paths)
  const realParse = JSON.parse;
  JSON.parse = function (text, reviver) {
    const r = realParse.call(this, text, reviver);
    if (off() || !r || typeof r !== 'object') return r;
    if ('adPlacements' in r || 'playerAds' in r || 'adSlots' in r || ('playerResponse' in r) || 'responseContext' in r) {
      return strip(r);
    }
    return r;
  };

  // 3) fetch() to the InnerTube API
  const API = /\/youtubei\/v1\/(player|next|browse|search|reel\/reel_watch_sequence|get_watch)/;
  const realFetch = window.fetch;
  window.fetch = async function (input, init) {
    const res = await realFetch.call(this, input, init);
    try {
      if (off()) return res;
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
      if (!API.test(url)) return res;
      const data = await res.clone().json();
      const hadAds = data && ('adPlacements' in data || 'playerAds' in data || 'adSlots' in data);
      strip(data);
      const headers = new Headers(res.headers);
      headers.delete('content-length');
      const out = new Response(JSON.stringify(data), { status: res.status, statusText: res.statusText, headers });
      if (hadAds) document.dispatchEvent(new CustomEvent('irv-yt-stripped'));
      return out;
    } catch (_) {
      return res;
    }
  };
})();
