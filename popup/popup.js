// AdBlocker by Irvando.d.a — popup
// Author: Irvando Demas Arifiandani (irvando.d.a) — https://irvandoda.web.id
const $ = (id) => document.getElementById(id);

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let host = '';
  try {
    const u = new URL(tab.url);
    if (/^https?:$/.test(u.protocol)) host = u.hostname.replace(/^www\./, '');
  } catch (_) {}

  const state = await chrome.storage.sync.get({ enabled: true, whitelist: [] });
  const isListed = () => state.whitelist.some((d) => host === d || host.endsWith('.' + d));

  function render() {
    $('global').checked = state.enabled;
    $('host').textContent = host || '(halaman ini)';
    $('site').checked = !isListed();
    $('site').disabled = !host || !state.enabled;
    $('hint').textContent = !state.enabled
      ? 'Blokir dimatikan di semua situs.'
      : isListed()
        ? 'Situs ini di-whitelist. Muat ulang halaman untuk menerapkan.'
        : '';
  }

  async function renderCount() {
    const s = await chrome.storage.session.get('counts');
    $('count').textContent = (s.counts && s.counts[tab.id]) || 0;
  }

  $('global').addEventListener('change', async (e) => {
    state.enabled = e.target.checked;
    await chrome.storage.sync.set({ enabled: state.enabled });
    render();
  });

  $('site').addEventListener('change', async (e) => {
    if (!host) return;
    if (e.target.checked) state.whitelist = state.whitelist.filter((d) => !(host === d || host.endsWith('.' + d)));
    else if (!isListed()) state.whitelist.push(host);
    await chrome.storage.sync.set({ whitelist: state.whitelist });
    render();
  });

  // ---- Shields toggles ----
  const SHIELD_DEFAULTS = {
    blockThreats: true,
    blockTrackers: true,
    antiFingerprint: true,
    protectIP: true,
    blockThirdPartyCookies: false
  };
  const shield = await chrome.storage.sync.get(SHIELD_DEFAULTS);
  document.querySelectorAll('[data-opt]').forEach((el) => {
    el.checked = !!shield[el.dataset.opt];
    el.addEventListener('change', () => chrome.storage.sync.set({ [el.dataset.opt]: el.checked }));
  });

  // ---- Footprint cleaning ----
  const DATA_TYPES = {
    cache: true,
    cacheStorage: true,
    cookies: true,
    localStorage: true,
    indexedDB: true,
    serviceWorkers: true
  };
  $('cleanSite').addEventListener('click', async () => {
    const out = $('cleanResult');
    if (!host) {
      out.textContent = 'Buka sebuah situs (http/https) dulu.';
      return;
    }
    try {
      await chrome.browsingData.remove({ origins: [new URL(tab.url).origin] }, DATA_TYPES);
      out.textContent = `Cookie, cache & data penyimpanan ${host} dihapus. Muat ulang halaman.`;
    } catch (e) {
      out.textContent = 'Gagal membersihkan: ' + e.message;
    }
  });
  $('cleanAll').addEventListener('click', async () => {
    const out = $('cleanResult');
    if (!confirm('Hapus cookie, cache, data situs, riwayat & data formulir dari 1 jam terakhir di SEMUA situs? Kamu akan logout dari banyak situs.')) return;
    try {
      await chrome.browsingData.remove(
        { since: Date.now() - 60 * 60 * 1000 },
        { ...DATA_TYPES, history: true, formData: true }
      );
      out.textContent = 'Jejak 1 jam terakhir dibersihkan.';
    } catch (e) {
      out.textContent = 'Gagal membersihkan: ' + e.message;
    }
  });

  const PROVIDERS = {
    cloudflare: {
      name: "Cloudflare (1.1.1.1)",
      template: "https://cloudflare-dns.com/dns-query",
      json: "https://cloudflare-dns.com/dns-query"
    },
    google: {
      name: "Google (8.8.8.8)",
      template: "https://dns.google/dns-query",
      json: "https://dns.google/resolve"
    }
  };

  const saved = await chrome.storage.sync.get({ dnsProvider: "cloudflare" });
  $("dnsProvider").value = PROVIDERS[saved.dnsProvider] ? saved.dnsProvider : "cloudflare";
  $("dnsProvider").addEventListener("change", (e) => chrome.storage.sync.set({ dnsProvider: e.target.value }));

  $("dnsEnable").addEventListener("click", async () => {
    const p = PROVIDERS[$("dnsProvider").value];
    try {
      await navigator.clipboard.writeText(p.template);
    } catch (_) {}
    chrome.tabs.create({ url: "chrome://settings/security" });
    $("dnsResult").textContent =
      "Di halaman yang terbuka: aktifkan \"Gunakan DNS aman\" → pilih \"" + p.name + "\". " +
      "Atau pilih \"Kustom\" dan tempel: " + p.template + " (sudah disalin).";
  });

  async function dohQuery(p, name, type) {
    const r = await fetch(p.json + "?name=" + encodeURIComponent(name) + "&type=" + type, {
      headers: { accept: "application/dns-json" },
      cache: "no-store"
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  async function resolveVia(p, name) {
    try {
      const [a, aaaa] = await Promise.all([dohQuery(p, name, "A"), dohQuery(p, name, "AAAA")]);
      const ips = [...(a.Answer || []), ...(aaaa.Answer || [])].filter((x) => x.type === 1 || x.type === 28).map((x) => x.data);
      return ips.length ? p.name + ": " + ips.slice(0, 3).join(", ") : p.name + ": tidak ada alamat (status " + a.Status + ")";
    } catch (e) {
      return p.name + ": gagal (" + e.message + ")";
    }
  }

  $("dnsTest").addEventListener("click", async () => {
    const out = $("dnsResult");
    if (!host) {
      out.textContent = "Buka sebuah situs (http/https) dulu.";
      return;
    }
    out.textContent = "Memeriksa " + host + " ...";
    const results = await Promise.all(Object.values(PROVIDERS).map((p) => resolveVia(p, host)));
    out.textContent = host + "\n" + results.join("\n") +
      "\nJika hasil normal tapi situs tetap tidak terbuka, DNS bawaan/ISP kamu yang memblokir: aktifkan Secure DNS di atas.";
    out.style.whiteSpace = "pre-line";
  });

  render();
  renderCount();
  chrome.storage.session.onChanged.addListener(renderCount);
})();
