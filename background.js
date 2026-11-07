// AdBlocker by Irvando.d.a — service worker
// Author: Irvando Demas Arifiandani (irvando.d.a) <irvando.d.a@gmail.com> — https://irvandoda.web.id

const RULESETS = ["ads", "security", "privacy"];
const IGNORED_RULE_MIN = 9000; // header-modification rules are not "blocks"
const DEFAULTS = {
  enabled: true,
  whitelist: [],
  blockThreats: true,
  blockTrackers: true,
  antiFingerprint: true,
  protectIP: true,
  blockThirdPartyCookies: false
};
const counts = new Map();
const countsReady = chrome.storage.session
  .get("counts")
  .then((s) => {
    for (const [k, v] of Object.entries(s.counts || {})) counts.set(Number(k), v);
  })
  .catch(() => {});

async function setPrivacy(setting, on, value) {
  try {
    if (on) await setting.set({ value, scope: "regular" });
    else await setting.clear({ scope: "regular" });
  } catch (_) {} // another extension/policy may control this setting
}

async function applySettings() {
  const s = await chrome.storage.sync.get(DEFAULTS);
  const want = {
    ads: s.enabled,
    security: s.enabled && s.blockThreats,
    privacy: s.enabled && s.blockTrackers
  };
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: RULESETS.filter((id) => want[id]),
    disableRulesetIds: RULESETS.filter((id) => !want[id])
  });
  const old = await chrome.declarativeNetRequest.getDynamicRules();
  const addRules = s.whitelist.length
    ? [{
        id: 1,
        priority: 10,
        action: { type: "allowAllRequests" },
        condition: { requestDomains: s.whitelist, resourceTypes: ["main_frame", "sub_frame"] }
      }]
    : [];
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: old.map((r) => r.id),
    addRules
  });

  // Browser-level privacy settings
  const p = chrome.privacy;
  if (p) {
    await setPrivacy(p.network.webRTCIPHandlingPolicy, s.enabled && s.protectIP, "default_public_interface_only");
    await setPrivacy(p.websites.hyperlinkAuditingEnabled, s.enabled && s.protectIP, false);
    await setPrivacy(p.websites.thirdPartyCookiesAllowed, s.enabled && s.blockThirdPartyCookies, false);
  }
}

async function persistCounts() {
  try {
    await chrome.storage.session.set({ counts: Object.fromEntries(counts) });
  } catch (_) {}
}

async function setCount(tabId, value) {
  await countsReady;
  if (value > 0) counts.set(tabId, value);
  else counts.delete(tabId);
  persistCounts();
  try {
    await chrome.action.setBadgeText({ tabId, text: value > 0 ? (value > 999 ? '999+' : String(value)) : '' });
  } catch (_) {}
}

async function bump(tabId, n = 1) {
  if (typeof tabId !== 'number' || tabId < 0) return;
  await countsReady;
  const { enabled } = await chrome.storage.sync.get({ enabled: true });
  if (!enabled) return;
  setCount(tabId, (counts.get(tabId) || 0) + n);
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.sync.set({ enabled: true, whitelist: [] });
  }
  await chrome.action.setBadgeBackgroundColor({ color: '#d93025' });
  applySettings();
});

chrome.runtime.onStartup.addListener(applySettings);

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === 'sync') applySettings();
});

// Network-level hits (only available for unpacked extensions).
chrome.declarativeNetRequest.onRuleMatchedDebug?.addListener((info) => {
  if (RULESETS.includes(info.rule.rulesetId) && info.rule.ruleId < IGNORED_RULE_MIN) bump(info.request.tabId);
});

// Hits reported by content scripts (popups blocked, YouTube ads skipped, elements hidden).
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === 'hit' && sender.tab) bump(sender.tab.id, Math.max(1, msg.n | 0));
});

// Reset the counter when a tab starts navigating to a new page.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' && changeInfo.url) setCount(tabId, 0);
});
chrome.tabs.onRemoved.addListener((tabId) => setCount(tabId, 0));
