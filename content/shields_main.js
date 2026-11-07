// AdBlocker by Irvando.d.a — Shields: anti-fingerprinting + malicious script (cryptominer) detection (MAIN world)
// Author: Irvando Demas Arifiandani (irvando.d.a) — https://irvandoda.web.id
(() => {
  if (window.__irvShields) return;
  window.__irvShields = true;

  const root = document.documentElement;
  const fpOn = () => !root.hasAttribute('data-irv-off') && !root.hasAttribute('data-irv-nofp');
  const thOn = () => !root.hasAttribute('data-irv-off') && !root.hasAttribute('data-irv-nothreat');
  const report = () => {
    try {
      document.dispatchEvent(new CustomEvent('irv-blocked'));
    } catch (_) {}
  };
  let fpReported = false;
  const reportFP = () => {
    if (!fpReported) {
      fpReported = true;
      report();
    }
  };

  // Per-page random seed: fingerprints differ on every load, so they cannot be used to re-identify you.
  const seed = crypto.getRandomValues(new Uint32Array(1))[0] | 1;
  const h = (n) => {
    let x = (n ^ seed) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    return (x ^ (x >>> 16)) >>> 0;
  };

  // ================= Anti-fingerprinting =================
  try {
    // ---- Canvas ----
    const ctx2d = new WeakSet();
    const realGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (type === '2d') ctx2d.add(this);
      return realGetContext.call(this, type, ...rest);
    };
    const realGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    const realToDataURL = HTMLCanvasElement.prototype.toDataURL;
    const realToBlob = HTMLCanvasElement.prototype.toBlob;

    const noisePixels = (d) => {
      for (let p = 0, n = d.length / 4; p < n; p++) {
        if ((h(p) & 15) === 0 && d[p * 4 + 3] !== 0) {
          d[p * 4] ^= 1;
          d[p * 4 + 1] ^= 1;
          d[p * 4 + 2] ^= 1;
        }
      }
    };

    const noisyCopy = (c) => {
      if (!ctx2d.has(c) || !c.width || !c.height || c.width * c.height > 16e6) return null;
      try {
        const t = document.createElement('canvas');
        t.width = c.width;
        t.height = c.height;
        const x = realGetContext.call(t, '2d');
        x.drawImage(c, 0, 0);
        const id = realGetImageData.call(x, 0, 0, t.width, t.height);
        noisePixels(id.data);
        x.putImageData(id, 0, 0);
        return t;
      } catch (_) {
        return null; // tainted canvas etc. → fall back to the real output
      }
    };

    CanvasRenderingContext2D.prototype.getImageData = function (...a) {
      const id = realGetImageData.apply(this, a);
      if (fpOn()) {
        try {
          noisePixels(id.data);
          reportFP();
        } catch (_) {}
      }
      return id;
    };
    HTMLCanvasElement.prototype.toDataURL = function (...a) {
      const c = fpOn() ? noisyCopy(this) : null;
      if (c) reportFP();
      return realToDataURL.apply(c || this, a);
    };
    HTMLCanvasElement.prototype.toBlob = function (...a) {
      const c = fpOn() ? noisyCopy(this) : null;
      if (c) reportFP();
      return realToBlob.apply(c || this, a);
    };

    // ---- Audio ----
    const touched = new WeakMap();
    const realGCD = AudioBuffer.prototype.getChannelData;
    AudioBuffer.prototype.getChannelData = function (ch) {
      const arr = realGCD.call(this, ch);
      if (fpOn()) {
        let done = touched.get(this);
        if (!done) touched.set(this, (done = new Set()));
        if (!done.has(ch)) {
          done.add(ch);
          for (let i = 0; i < arr.length; i += 100) arr[i] += (h(i) & 1 ? 1 : -1) * 1e-7;
          reportFP();
        }
      }
      return arr;
    };
    if (window.AnalyserNode) {
      const realFFD = AnalyserNode.prototype.getFloatFrequencyData;
      AnalyserNode.prototype.getFloatFrequencyData = function (arr) {
        realFFD.call(this, arr);
        if (fpOn()) for (let i = 0; i < arr.length; i++) arr[i] += (h(i) & 1 ? 1 : -1) * 1e-4;
      };
    }

    // ---- WebGL vendor / renderer ----
    for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!C) continue;
      const real = C.prototype.getParameter;
      C.prototype.getParameter = function (p) {
        if (fpOn()) {
          if (p === 37445) {
            reportFP();
            return 'Google Inc.';
          }
          if (p === 37446) return 'ANGLE (Generic Renderer)';
        }
        return real.call(this, p);
      };
    }

    // ---- Navigator ----
    const spoof = (proto, key, value) => {
      const d = Object.getOwnPropertyDescriptor(proto, key);
      try {
        Object.defineProperty(proto, key, {
          configurable: true,
          enumerable: true,
          get: function () {
            if (fpOn()) return value;
            return d && d.get ? d.get.call(this) : undefined;
          }
        });
      } catch (_) {}
    };
    spoof(Navigator.prototype, 'hardwareConcurrency', 4);
    spoof(Navigator.prototype, 'deviceMemory', 8);
    spoof(Navigator.prototype, 'doNotTrack', '1');
    spoof(Navigator.prototype, 'globalPrivacyControl', true);

    if (Navigator.prototype.getBattery) {
      const realBattery = Navigator.prototype.getBattery;
      Navigator.prototype.getBattery = function () {
        return fpOn()
          ? Promise.reject(new DOMException('Battery status is disabled', 'NotAllowedError'))
          : realBattery.call(this);
      };
    }
  } catch (_) {}

  // ================= Malicious script / cryptominer detection =================
  const MINER_RE =
    /(coinhive|coin-hive|authedmine|cryptoloot|crypto-loot|coinimp|jsecoin|webminepool|deepminer|minero\.cc|cryptonight|monerominer|stratum\+tcp|webmine\.pro|minemytraffic)/i;

  // Block WebSocket connections to mining pools.
  try {
    const RealWS = window.WebSocket;
    window.WebSocket = new Proxy(RealWS, {
      construct(target, args, newTarget) {
        if (thOn() && MINER_RE.test(String(args[0]))) {
          report();
          throw new DOMException('Blocked by AdBlocker by Irvando.d.a (cryptominer)', 'SecurityError');
        }
        return Reflect.construct(target, args, newTarget);
      }
    });
  } catch (_) {}

  // Neutralise well-known miner globals so their loaders crash instead of mining.
  for (const name of ['CoinHive', 'CryptoLoot', 'CoinImp', 'JSEcoin', 'deepMiner']) {
    try {
      Object.defineProperty(window, name, {
        configurable: true,
        get: () => undefined,
        set: () => {
          if (thOn()) report();
        }
      });
    } catch (_) {}
  }

  // Remove miner scripts as they are inserted (best-effort; network rules catch the rest).
  const checkScript = (s) => {
    if (!thOn()) return;
    const src = s.src || '';
    const txt = src ? '' : (s.textContent || '').slice(0, 200000);
    if (MINER_RE.test(src) || (txt && MINER_RE.test(txt))) {
      s.type = 'javascript/blocked';
      s.remove();
      report();
    }
  };
  const scan = (n) => {
    if (n.nodeType !== 1) return;
    if (n.tagName === 'SCRIPT') checkScript(n);
    else if (n.querySelectorAll) n.querySelectorAll('script').forEach(checkScript);
  };
  new MutationObserver((muts) => {
    for (const m of muts) m.addedNodes.forEach(scan);
  }).observe(root, { childList: true, subtree: true });

  // Drive-by downloads: programmatic click on <a download> without any user gesture.
  const realClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (
      thOn() &&
      this.hasAttribute('download') &&
      navigator.userActivation &&
      !navigator.userActivation.isActive
    ) {
      report();
      return;
    }
    return realClick.apply(this, arguments);
  };
})();
