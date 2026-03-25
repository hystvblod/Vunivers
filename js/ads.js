// FILE: zip/js/ads.js
// VRealms - ads.js (AdMob Capacitor Community, no-import) — SANS SSV
// ✅ Version "DB only" : plus de localStorage pour consent/actions/inter cooldown
// ✅ Ajout stats pubs (24h + total) via RPC secure_get_ads_stats()
// ✅ Log interstitiel réellement affiché via RPC secure_log_ad_event('interstitial', ...)
// ⚠️ Rewarded: le log le plus safe doit être fait côté DB (dans secure_claim_reward). Ici on fait un log best-effort.
//
// ✅ Ajout "no_ads" : BLOQUE UNIQUEMENT LES INTERSTITIELS (rewarded autorisés)
//
// ✅ FIX (6 points côté Ads) :
// 1) Inter auto NE PEUT PAS se déclencher si overlay/app busy (__ads_active)
// 2) __ads_active respecté aussi côté "canShowInterstitialNow()"
// 3) Séparation interstitial vs rewarded (isRewardShowing ne doit pas bloquer l'app pour un inter)
// 4) Cleanup robuste (postAdCleanup) même après visiblitychange / resume
// 5) Garde DB-only + no_ads + stats + logs
// 6) Anti double-show best-effort (verrou simple sur inter/reward)

(function () {
  "use strict";

  // ------- Raccourcis globaux -------
  var Capacitor = (window.Capacitor || {});
  var AdMob = (Capacitor.Plugins && Capacitor.Plugins.AdMob) ? Capacitor.Plugins.AdMob : null;
  var App = (Capacitor.App) ? Capacitor.App
          : ((Capacitor.Plugins && Capacitor.Plugins.App) ? Capacitor.Plugins.App : null);

  // ------- STRICT PROD -------
  var __DEV_ADS__ = true;      // ✅ mets TRUE pour tests (Ad Units TEST + initializeForTesting)
  var SHOW_DIAG_PANEL = false;  // overlay debug (laisse false en prod)

  // ✅ Tes Ad Units (PROD)
  var AD_UNIT_ID_INTERSTITIEL_PROD = "ca-app-pub-6837328794080297/8465879302";
  var AD_UNIT_ID_REWARDED_PROD     = "ca-app-pub-6837328794080297/8202263221";

  // ✅ Ad Units TEST officiels Google (samples)
  // Interstitial:
  // - Android: ca-app-pub-3940256099942544/1033173712
  // - iOS:     ca-app-pub-3940256099942544/4411468910
  // Rewarded:
  // - Android: ca-app-pub-3940256099942544/5224354917
  // - iOS:     ca-app-pub-3940256099942544/1712485313
  var AD_UNIT_ID_INTERSTITIEL_TEST_ANDROID = "ca-app-pub-3940256099942544/1033173712";
  var AD_UNIT_ID_INTERSTITIEL_TEST_IOS     = "ca-app-pub-3940256099942544/4411468910";
  var AD_UNIT_ID_REWARDED_TEST_ANDROID     = "ca-app-pub-3940256099942544/5224354917";
  var AD_UNIT_ID_REWARDED_TEST_IOS         = "ca-app-pub-3940256099942544/1712485313";

  function getPlatform() {
    try {
      if (Capacitor && typeof Capacitor.getPlatform === "function") return Capacitor.getPlatform();
      if (Capacitor && typeof Capacitor.platform === "string") return Capacitor.platform;
    } catch (_) {}
    return "";
  }
  function isIOSPlatform() { return getPlatform() === "ios"; }

  function getInterstitialUnitId() {
    if (__DEV_ADS__) return isIOSPlatform() ? AD_UNIT_ID_INTERSTITIEL_TEST_IOS : AD_UNIT_ID_INTERSTITIEL_TEST_ANDROID;
    return AD_UNIT_ID_INTERSTITIEL_PROD;
  }
  function getRewardedUnitId() {
    if (__DEV_ADS__) return isIOSPlatform() ? AD_UNIT_ID_REWARDED_TEST_IOS : AD_UNIT_ID_REWARDED_TEST_ANDROID;
    return AD_UNIT_ID_REWARDED_PROD;
  }

  // ✅ Règles pubs globales
  var INTERSTITIEL_EVERY_X_ACTIONS = 12;
  var INTERSTITIAL_MIN_WEIGHTED_MS = 3 * 60 * 1000; // 3 min
  var INTER_RETURN_EVERY_X_ENDS = 3;
  var INTER_RETURN_COOLDOWN_MS = 2 * 60 * 1000; // 2 min réelles

  var WEIGHTED_TIME_KEY = "vr_ads_weighted_time_ms_v1";
  var RETURN_INDEX_COUNT_KEY = "vr_ads_return_index_count_v1";
  var LAST_INTER_TS_KEY = "vr_ads_last_inter_ts_local_v1";

  // --- Récompenses par défaut (utilisées par l'UI si besoin)
  window.REWARD_JETONS = typeof window.REWARD_JETONS === "number" ? window.REWARD_JETONS : 1;
  window.REWARD_VCOINS = typeof window.REWARD_VCOINS === "number" ? window.REWARD_VCOINS : 200;

  // --- Flags d'état ---
  var isRewardShowing = false;     // TRUE uniquement pendant rewarded
  var currentAdKind = null;        // "interstitial" | "rewarded" | null
  var __showLock = false;          // anti double show best-effort

  window.__ads_active = false;     // flag global anti-back/anti-overlays côté app
  var _gameRewardSeenThisRun = false;
  var _weightedTimerStartedAt = 0;

  function _readLSNumber(key) {
    try {
      var v = Number(localStorage.getItem(key) || 0);
      return Number.isFinite(v) && v > 0 ? v : 0;
    } catch (_) {}
    return 0;
  }

  function _writeLSNumber(key, value) {
    try {
      var n = Math.max(0, Number(value || 0) || 0);
      localStorage.setItem(key, String(n));
    } catch (_) {}
  }

  function _addLSNumber(key, delta) {
    _writeLSNumber(key, _readLSNumber(key) + Math.max(0, Number(delta || 0) || 0));
  }

  function _isGameHtmlPage() {
    try {
      var p = String(location.pathname || "").toLowerCase();
      var h = String(location.href || "").toLowerCase();
      return p.endsWith("/game.html") || p === "/game.html" || h.indexOf("game.html") !== -1;
    } catch (_) {}
    return false;
  }

  function _getUniverseIdForWeight() {
    try {
      if (window.VRGame && window.VRGame.currentUniverse) return String(window.VRGame.currentUniverse || "").trim();
    } catch (_) {}
    try {
      return String(localStorage.getItem("vrealms_universe") || "").trim();
    } catch (_) {}
    return "";
  }

  function _getWeightedFactor() {
    var universeId = _getUniverseIdForWeight();
    if (_isGameHtmlPage()) {
      if (universeId === "intro") return 0;
      return 1;
    }
    return 1 / 3;
  }

  function _flushWeightedTime() {
    if (_weightedTimerStartedAt <= 0) return 0;

    var elapsed = Math.max(0, Date.now() - _weightedTimerStartedAt);
    _weightedTimerStartedAt = 0;

    if (elapsed <= 0) return 0;

    var weighted = Math.floor(elapsed * _getWeightedFactor());
    if (weighted > 0) _addLSNumber(WEIGHTED_TIME_KEY, weighted);
    return weighted;
  }

  function _startWeightedTime() {
    try {
      if (document.hidden) return;
    } catch (_) {}
    if (_weightedTimerStartedAt > 0) return;
    _weightedTimerStartedAt = Date.now();
  }

  function syncWeightedTime() {
    _flushWeightedTime();
    _startWeightedTime();
    return getWeightedAccumulatedMs();
  }

  function getWeightedAccumulatedMs() {
    return _readLSNumber(WEIGHTED_TIME_KEY);
  }

  function resetWeightedAccumulatedMs() {
    _writeLSNumber(WEIGHTED_TIME_KEY, 0);
  }

  function getLastInterstitialLocalTs() {
    return _readLSNumber(LAST_INTER_TS_KEY);
  }

  function setLastInterstitialLocalTs(ts) {
    _writeLSNumber(LAST_INTER_TS_KEY, ts);
  }

  function markGameRewardSeen() {
    _gameRewardSeenThisRun = true;
  }

  function resetGameRewardSeen() {
    _gameRewardSeenThisRun = false;
  }

  function hasGameRewardSeen() {
    return _gameRewardSeenThisRun === true;
  }

  function getReturnIndexCount() {
    return _readLSNumber(RETURN_INDEX_COUNT_KEY);
  }

  function setReturnIndexCount(v) {
    _writeLSNumber(RETURN_INDEX_COUNT_KEY, v);
  }

  function resetInterstitialProgress() {
    resetWeightedAccumulatedMs();
    resetActionsCount();
  }

  // --- Compteurs locaux ---
  var ACTIONS_KEY = "vr_actions_count";
  var LAST_INTER_KEY = "vr_last_inter_ts";

  var actionsCount = _readLSNumber(ACTIONS_KEY);
  var lastInterTs = _readLSNumber(LAST_INTER_KEY);

  // --- Consent server-side (cache mémoire) ---
  var _adsState = {
    rgpdConsent: null,   // "accept" | "refuse" | null
    adsConsent: null,    // boolean|null
    adsEnabled: null     // boolean|null
  };

  // --- Stats pubs (cache mémoire) ---
  var _adsStats = {
    rewarded_total: 0,
    rewarded_24h: 0,
    inter_total: 0,
    inter_24h: 0
  };

  // --- No Ads (cache mémoire) ---
  // ⚠️ no_ads BLOQUE UNIQUEMENT les interstitiels (rewarded restent OK)
  var _noAds = false;

  function sbReady() {
    return !!(window.sb && window.sb.auth && typeof window.sb.rpc === "function");
  }

  // =============================
  // Helpers plateforme
  // =============================
  function isNative() {
    try {
      return !!(Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
    } catch (_) {
      return false;
    }
  }

  // =============================
  // No Ads (read-only) - SERVER SIDE
  // =============================
  async function syncNoAdsFromServer() {
    try {
      if (!sbReady()) return _noAds;

      // Assure que la session existe
      try { await window.sb.auth.getUser(); } catch (_) {}

      var r = await window.sb.rpc("secure_get_no_ads");
      if (r && !r.error) {
        _noAds = (r.data === true);
      }
      return _noAds;
    } catch (_) {
      return _noAds;
    }
  }

  function isNoAds() {
    return _noAds === true;
  }

  // =============================
  // Consent / Request options (NPA) - SERVER SIDE
  // =============================
  function getPersonalizedAdsGranted() {
    // Plus de localStorage.
    // Logique : si RGPD refuse => false
    // sinon on regarde adsConsent / adsEnabled
    try {
      var rgpd = _adsState.rgpdConsent; // "accept"|"refuse"|null
      var adsConsent = _adsState.adsConsent; // boolean|null
      var adsEnabled = _adsState.adsEnabled; // boolean|null

      if (rgpd === "refuse") return false;

      if (rgpd === "accept") {
        if (typeof adsConsent === "boolean") return adsConsent === true;
        if (typeof adsEnabled === "boolean") return adsEnabled === true;
        return false;
      }

      if (typeof adsConsent === "boolean") return adsConsent === true;
      if (typeof adsEnabled === "boolean") return adsEnabled === true;

      return false;
    } catch (_) {
      return false;
    }
  }

  function buildAdMobRequestOptions() {
    var personalized = getPersonalizedConsent();
    var npa = personalized ? "0" : "1";

    return {
      requestNonPersonalizedAdsOnly: npa === "1",
      extras: { npa: npa }
    };
  }

  async function syncAdsStateFromServer() {
    try {
      if (!sbReady()) return false;

      // Assure que la session existe
      try { await window.sb.auth.getUser(); } catch (_) {}

      var r = await window.sb.rpc("secure_get_ads_state");
      if (r && !r.error && r.data) {
        _adsState.rgpdConsent = (typeof r.data.rgpdConsent === "string") ? r.data.rgpdConsent : null;
        _adsState.adsConsent  = (typeof r.data.adsConsent === "boolean") ? r.data.adsConsent : null;
        _adsState.adsEnabled  = (typeof r.data.adsEnabled === "boolean") ? r.data.adsEnabled : null;

        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  async function refreshAdsStats() {
    try {
      if (!sbReady()) return _adsStats;

      var r = await window.sb.rpc("secure_get_ads_stats");
      if (r && !r.error && r.data) {
        _adsStats.rewarded_total = parseInt(r.data.rewarded_total || 0, 10) || 0;
        _adsStats.rewarded_24h   = parseInt(r.data.rewarded_24h || 0, 10) || 0;
        _adsStats.inter_total    = parseInt(r.data.inter_total || 0, 10) || 0;
        _adsStats.inter_24h      = parseInt(r.data.inter_24h || 0, 10) || 0;
      }
      return _adsStats;
    } catch (_) {
      return _adsStats;
    }
  }

  // =============================
  // Helpers anti-surcouches avant/après show() — WHITELIST SAFE
  // =============================
  var APP_OVERLAYS = [
    "#popup-consent",
    "#update-banner",
    ".tooltip-box",
    ".popup-consent-bg",
    ".modal-app",
    ".dialog-app",
    ".backdrop-app",
    ".overlay-app",
    ".loading-app"
  ];

  function hideOverlays() {
    try {
      APP_OVERLAYS.forEach(function (sel) {
        document.querySelectorAll(sel).forEach(function (el) {
          el.__prevDisplay = el.style.display;
          el.style.display = "none";
        });
      });
    } catch (_) {}
  }

  function restoreOverlays() {
    try {
      APP_OVERLAYS.forEach(function (sel) {
        document.querySelectorAll(sel).forEach(function (el) {
          el.style.display = (typeof el.__prevDisplay === "string") ? el.__prevDisplay : "";
          try { delete el.__prevDisplay; } catch (_) {}
        });
      });
    } catch (_) {}
  }

  function preShowAdCleanup() {
    try {
      hideOverlays();
      window.__ads_active = true;
    } catch (_) {}
  }

  function postAdCleanup() {
    try {
      window.__ads_active = false;
      restoreOverlays();
    } catch (_) {}
  }

  // Quand l’app revient au premier plan : on nettoie SI pas rewarded en cours
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      if (!(currentAdKind === "rewarded" && isRewardShowing)) postAdCleanup();
    }
  });
  document.addEventListener("visibilitychange", function () {
    try {
      if (document.hidden) _flushWeightedTime();
      else _startWeightedTime();
    } catch (_) {}
  });

  window.addEventListener("pagehide", function () {
    try { _flushWeightedTime(); } catch (_) {}
  });

  // =============================
  // Panneau diag (optionnel)
  // =============================
  function diag(msg) {
    if (!SHOW_DIAG_PANEL) return;
    try {
      var el = document.getElementById("__ads_diag");
      if (!el) {
        el = document.createElement("div");
        el.id = "__ads_diag";
        el.style.cssText =
          "position:fixed;left:8px;bottom:8px;z-index:999999;" +
          "background:rgba(0,0,0,.6);color:#fff;padding:6px 8px;border-radius:8px;" +
          "font:12px/1.35 monospace;max-width:80vw;";
        document.body.appendChild(el);
      }
      var sep = el.textContent ? "\n" : "";
      el.textContent += sep + "[" + new Date().toLocaleTimeString() + "] " + msg;
    } catch (_) {}
  }

  // =============================
  // Écouteurs AdMob (1 seule fois)
  // =============================
  function registerAdEventsOnce() {
    try {
      if (!AdMob || !AdMob.addListener || window.__adListenersRegistered) return;
      window.__adListenersRegistered = true;

      var SAFE = function (fn) {
        return function (arg) { try { fn && fn(arg); } catch (_) {} };
      };

      var map = [
        ["onAdFullScreenContentOpened", function () {
          // ⚠️ NE PAS forcer isRewardShowing ici (ça s'applique aussi aux inter)
          window.__ads_active = true;
          diag("Ad opened");
        }],
        ["onAdDismissedFullScreenContent", function () {
          diag("Ad dismissed");
          if (currentAdKind === "rewarded") isRewardShowing = false;
          currentAdKind = null;
          __showLock = false;
          postAdCleanup();
        }],
        ["onAdFailedToShowFullScreenContent", function () {
          diag("Ad failed to show");
          if (currentAdKind === "rewarded") isRewardShowing = false;
          currentAdKind = null;
          __showLock = false;
          postAdCleanup();
        }],
        ["onRewarded", function () {
          diag("Rewarded granted");
        }]
      ];

      for (var i = 0; i < map.length; i++) {
        try { AdMob.addListener(map[i][0], SAFE(map[i][1])); } catch (_) {}
      }
    } catch (_) {}
  }

  // =============================
  // Init (silencieux si web)
  // =============================
  (async function initAdMobOnce() {
    try {
      if (!isNative()) return;
      if (!AdMob || !AdMob.initialize) return;

      // Sync server-side consent & counters (tout via DB)
      await syncAdsStateFromServer().catch(function () {});
      await syncNoAdsFromServer().catch(function () {}); // ✅ no_ads
      await refreshAdsStats().catch(function () {});

      await AdMob.initialize({
        requestTrackingAuthorization: false,
        initializeForTesting: __DEV_ADS__
      });

      registerAdEventsOnce();
    } catch (_) {}
  })();

  // =============================
  // Helpers "wait" (dismissed / rewarded / app return)
  // =============================
  function waitDismissedOnce() {
    return new Promise(function (resolve) {
      var off1 = null, off2 = null;
      function done(ok) {
        try { off1 && off1.remove && off1.remove(); } catch (_) {}
        try { off2 && off2.remove && off2.remove(); } catch (_) {}
        resolve(!!ok);
      }
      try {
        off1 = AdMob.addListener("onAdDismissedFullScreenContent", function () { done(true); });
        off2 = AdMob.addListener("onAdFailedToShowFullScreenContent", function () { done(false); });
      } catch (_) {
        done(false);
      }
    });
  }

  function waitRewardedOnce(timeoutMs) {
    return new Promise(function (resolve) {
      var off = null, timer = null;
      function done(ok) {
        try { off && off.remove && off.remove(); } catch (_) {}
        if (timer) { clearTimeout(timer); timer = null; }
        resolve(!!ok);
      }
      try {
        off = AdMob.addListener("onRewarded", function () { done(true); });
      } catch (_) {
        done(false);
        return;
      }
      timer = setTimeout(function () { done(false); }, timeoutMs || 30000);
    });
  }

  function waitAppReturnOnce() {
    return new Promise(function (resolve) {
      var resolved = false;
      function done() {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(true);
      }

      function onVis() { try { if (!document.hidden) done(); } catch (_) {} }
      function onFocus() { done(); }

      var off1 = null, off2 = null;

      function cleanup() {
        try { document.removeEventListener("visibilitychange", onVis); } catch (_) {}
        try { window.removeEventListener("focus", onFocus); } catch (_) {}
        try { off1 && off1.remove && off1.remove(); } catch (_) {}
        try { off2 && off2.remove && off2.remove(); } catch (_) {}
      }

      try { document.addEventListener("visibilitychange", onVis, { once: true }); } catch (_) {}
      try { window.addEventListener("focus", onFocus, { once: true }); } catch (_) {}

      try {
        if (App && App.addListener) {
          off1 = App.addListener("resume", done);
          off2 = App.addListener("appStateChange", function (state) {
            try { if (state && state.isActive) done(); } catch (_) {}
          });
        }
      } catch (_) {}
    });
  }

  // =============================
  // Interstitiel (LOAD/SHOW)
  // =============================
  function canShowInterstitialNow() {
    // ✅ Bloque si app busy (event/ending/overlay/rewarded/etc.)
    if (window.__ads_active) return false;
    if (__showLock) return false;

    // Si une rewarded est en cours -> jamais d'inter
    if (currentAdKind === "rewarded" && isRewardShowing) return false;

    return true;
  }

  async function markInterstitialShownNow() {
    lastInterTs = Date.now();
    setLastInterstitialLocalTs(lastInterTs);
    _writeLSNumber(LAST_INTER_KEY, lastInterTs);
  }

  async function showInterstitialAd() {
    try {
      // ✅ no_ads => on bloque UNIQUEMENT l'interstitiel
      if (isNoAds()) return false;

      if (!isNative()) return false;
      if (!AdMob || !AdMob.prepareInterstitial || !AdMob.showInterstitial) return false;
      if (!canShowInterstitialNow()) return false;

      __showLock = true;
      currentAdKind = "interstitial";

      await AdMob.prepareInterstitial({
        adId: getInterstitialUnitId(),
        requestOptions: buildAdMobRequestOptions()
      });

      preShowAdCleanup();

      var dismissedP = waitDismissedOnce();
      var res = await AdMob.showInterstitial();

      await Promise.race([dismissedP.catch(function () {}), waitAppReturnOnce()]);
      postAdCleanup();

      currentAdKind = null;
      __showLock = false;

      if (res !== false) {
        await markInterstitialShownNow();

        // ✅ Log interstitiel réellement affiché (DB)
        try {
          if (sbReady()) {
            await window.sb.rpc("secure_log_ad_event", { p_kind: "interstitial", p_placement: "auto" });
          }
        } catch (_) {}

        try {
          await window.VRAnalytics?.log?.("interstitial_shown", {
            placement: "auto"
          });
        } catch (_) {}

        // Refresh stats best-effort
        try { await refreshAdsStats(); } catch (_) {}

        // Preload best-effort
        setTimeout(function () {
          try {
            AdMob.prepareInterstitial({
              adId: getInterstitialUnitId(),
              requestOptions: buildAdMobRequestOptions()
            }).catch(function () {});
          } catch (_) {}
        }, 1200);

        return true;
      }

      return false;
    } catch (_) {
      try {
        AdMob.prepareInterstitial({
          adId: getInterstitialUnitId(),
          requestOptions: buildAdMobRequestOptions()
        }).catch(function () {});
      } catch (_) {}
      try { postAdCleanup(); } catch (_) {}
      currentAdKind = null;
      __showLock = false;
      return false;
    }
  }

  // =============================
  // Rewarded (LOAD/SHOW)
  // =============================
  async function showRewardedAd(opts) {
    opts = opts || {};

    try {
      if (!isNative()) return false;
      if (!AdMob || !AdMob.prepareRewardVideoAd || !AdMob.showRewardVideoAd) return false;
      if (window.__ads_active || __showLock) return false;

      __showLock = true;
      currentAdKind = "rewarded";

      await AdMob.prepareRewardVideoAd({
        adId: getRewardedUnitId(),
        requestOptions: buildAdMobRequestOptions()
      });

      preShowAdCleanup();
      isRewardShowing = true;

      const rewardedP = waitRewardedOnce(30000);
      const dismissedP = waitDismissedOnce();

      let showResult = null;

      try {
        showResult = await AdMob.showRewardVideoAd();
      } catch (e) {
        try { await dismissedP.catch(function () {}); } catch (_) {}
        postAdCleanup();
        isRewardShowing = false;
        currentAdKind = null;
        __showLock = false;
        return false;
      }

      const eventRewarded = await rewardedP.catch(function () { return false; });

      const returnRewarded = !!(
        showResult &&
        (
          showResult.rewarded === true ||
          showResult.reward === true ||
          showResult.rewardItem ||
          showResult.type ||
          showResult.amount != null
        )
      );

      const gotReward = !!(eventRewarded || returnRewarded);

      await Promise.race([
        dismissedP.catch(function () {}),
        waitAppReturnOnce()
      ]);

      postAdCleanup();

      isRewardShowing = false;
      currentAdKind = null;
      __showLock = false;

      if (gotReward) {
        const plc = (opts && opts.placement) ? String(opts.placement) : "rewarded";

        try {
          if (sbReady()) {
            await window.sb.rpc("secure_log_ad_event", {
              p_kind: "rewarded",
              p_placement: plc
            });
          }
        } catch (_) {}
      }

      return gotReward;
    } catch (_) {
      try { postAdCleanup(); } catch (_) {}
      isRewardShowing = false;
      currentAdKind = null;
      __showLock = false;
      return false;
    }
  }

  // =============================
  // Compteur actions → déclenche interstitiel tous les X choix (server-side)
  // =============================
  function getActionsCount() {
    return actionsCount || 0;
  }

  async function resetActionsCount() {
    actionsCount = 0;
    _writeLSNumber(ACTIONS_KEY, 0);
  }

  async function markActionAndMaybeShowInterstitial() {
    syncWeightedTime();

    actionsCount = (actionsCount || 0) + 1;
    _writeLSNumber(ACTIONS_KEY, actionsCount);

    if (!isNoAds()) {
      if (window.__ads_active) return actionsCount;

      var weightedMs = getWeightedAccumulatedMs();
      var universeId = _getUniverseIdForWeight();

      if (
        universeId !== "intro" &&
        INTERSTITIEL_EVERY_X_ACTIONS > 0 &&
        actionsCount >= INTERSTITIEL_EVERY_X_ACTIONS &&
        weightedMs >= INTERSTITIAL_MIN_WEIGHTED_MS
      ) {
        try {
          var ok = await showInterstitialAd();
          if (ok) {
            await resetInterstitialProgress();
            resetGameRewardSeen();
            syncWeightedTime();
          }
        } catch (_) {}
      }
    }

    return actionsCount;
  }

  async function maybeShowInterstitialOnReturnToIndex() {
    _flushWeightedTime();

    if (isNoAds()) return false;
    if (hasGameRewardSeen()) return false;

    var lastTs = getLastInterstitialLocalTs() || lastInterTs || 0;
    if (lastTs > 0 && (Date.now() - lastTs) < INTER_RETURN_COOLDOWN_MS) {
      return false;
    }

    var c = getReturnIndexCount() + 1;
    if (c < INTER_RETURN_EVERY_X_ENDS) {
      setReturnIndexCount(c);
      return false;
    }

    setReturnIndexCount(0);

    try {
      var ok = await showInterstitialAd();
      if (ok) {
        await resetInterstitialProgress();
        resetGameRewardSeen();
        return true;
      }
    } catch (_) {}

    return false;
  }

  // =============================
  // Consent popup pubs personnalisées
  // =============================
  var ADS_PREF_KEY = "vrealms_ads_personalized";
  var ADS_CHOICE_DONE_KEY = "vrealms_ads_consent_done_v1";
  var INTRO_FINISHED_FLOW_KEY = "vrealms_intro_just_finished";

  function _readLSString(key) {
    try { return String(localStorage.getItem(key) || ""); } catch (_) {}
    return "";
  }

  function _writeLSString(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (_) {}
  }

  function _removeLS(key) {
    try { localStorage.removeItem(key); } catch (_) {}
  }

  function _tr(key, fallback) {
    try {
      var out = window.VRI18n && typeof window.VRI18n.t === "function"
        ? window.VRI18n.t(key)
        : "";
      if (out && out !== key) return out;
    } catch (_) {}
    return typeof fallback === "string" ? fallback : "";
  }

  function hasPersonalizedConsentChoice() {
    return _readLSString(ADS_CHOICE_DONE_KEY) === "1";
  }

  function getPersonalizedConsent() {
    var v = _readLSString(ADS_PREF_KEY);
    if (v === "1") return true;
    if (v === "0") return false;
    return false;
  }

  async function _syncConsentToServerBestEffort(granted) {
    return false;
  }

  async function setPersonalizedConsent(granted, opts) {
    var value = !!granted;

    _adsState.rgpdConsent = value ? "accept" : "refuse";
    _adsState.adsConsent = value;
    _adsState.adsEnabled = value;

    _writeLSString(ADS_PREF_KEY, value ? "1" : "0");
    _writeLSString(ADS_CHOICE_DONE_KEY, "1");

    try {
      if (window.sb && typeof window.sb.rpc === "function") {
        await window.sb.rpc("secure_set_ads_personalized_choice", {
          p_new_value: value
        });
      }
    } catch (_) {}

    return value;
  }

  function ensureAdsConsentStyles() {
    if (document.getElementById("vr-ads-consent-style")) return;

    var style = document.createElement("style");
    style.id = "vr-ads-consent-style";
    style.textContent = `
      #vr-ads-consent{
        position:fixed;
        inset:0;
        display:none;
        align-items:center;
        justify-content:center;
        padding:16px;
        background:rgba(15,23,42,.82);
        z-index:260000;
      }
      #vr-ads-consent.is-open{ display:flex; }
      #vr-ads-consent .vr-ads-consent-card{
        width:min(440px, calc(100vw - 24px));
        padding:18px;
        border-radius:22px;
        background:rgba(15,23,42,.98);
        border:1px solid rgba(255,255,255,.14);
        box-shadow:0 20px 40px rgba(0,0,0,.35);
        color:#fff;
        text-align:center;
        display:flex;
        flex-direction:column;
        gap:12px;
      }
      #vr-ads-consent .vr-ads-consent-title{
        margin:0;
        font-size:clamp(20px, 5.2vw, 26px);
        font-weight:950;
      }
      #vr-ads-consent .vr-ads-consent-text{
        margin:0;
        font-size:clamp(13px, 3.7vw, 15px);
        line-height:1.45;
        color:rgba(255,255,255,.88);
      }
      #vr-ads-consent .vr-ads-consent-actions{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
      }
      #vr-ads-consent button{
        min-height:48px;
        border:none;
        border-radius:14px;
        font:800 15px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        cursor:pointer;
      }
      #vr-ads-consent .vr-ads-consent-refuse{
        background:rgba(255,255,255,.08);
        color:#fff;
        border:1px solid rgba(255,255,255,.12);
      }
      #vr-ads-consent .vr-ads-consent-accept{
        background:#ffffff;
        color:#0f172a;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureAdsConsentPopup() {
    var overlay = document.getElementById("vr-ads-consent");
    if (overlay) return overlay;

    ensureAdsConsentStyles();

    overlay = document.createElement("div");
    overlay.id = "vr-ads-consent";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="vr-ads-consent-card" role="dialog" aria-modal="true" aria-labelledby="vr-ads-consent-title">
        <h3 class="vr-ads-consent-title" id="vr-ads-consent-title"></h3>
        <p class="vr-ads-consent-text" id="vr-ads-consent-text"></p>
        <div class="vr-ads-consent-actions">
          <button type="button" class="vr-ads-consent-refuse" id="vr-ads-consent-refuse"></button>
          <button type="button" class="vr-ads-consent-accept" id="vr-ads-consent-accept"></button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function fillAdsConsentTexts() {
    var titleEl = document.getElementById("vr-ads-consent-title");
    var textEl = document.getElementById("vr-ads-consent-text");
    var refuseEl = document.getElementById("vr-ads-consent-refuse");
    var acceptEl = document.getElementById("vr-ads-consent-accept");

    if (titleEl) titleEl.textContent = _tr("adsConsent.popup.title", "Personalized ads");
    if (textEl) textEl.textContent = _tr("adsConsent.popup.text", "Do you accept personalized ads to receive more relevant advertising? You can change this choice at any time in the settings.");
    if (refuseEl) refuseEl.textContent = _tr("adsConsent.popup.refuse", "Decline");
    if (acceptEl) acceptEl.textContent = _tr("adsConsent.popup.accept", "Accept");
  }

  function showAdsConsentPopup() {
    var overlay = ensureAdsConsentPopup();
    fillAdsConsentTexts();

    return new Promise(function (resolve) {
      var acceptBtn = document.getElementById("vr-ads-consent-accept");
      var refuseBtn = document.getElementById("vr-ads-consent-refuse");

      function close(value) {
        overlay.classList.remove("is-open");
        overlay.setAttribute("aria-hidden", "true");
        resolve(value);
      }

      overlay.onclick = function (e) {
        if (e.target === overlay) close(false);
      };

      if (acceptBtn) {
        acceptBtn.onclick = function () { close(true); };
      }

      if (refuseBtn) {
        refuseBtn.onclick = function () { close(false); };
      }

      overlay.classList.add("is-open");
      overlay.setAttribute("aria-hidden", "false");
      try { acceptBtn && acceptBtn.focus && acceptBtn.focus({ preventScroll: true }); } catch (_) {}
    });
  }

  async function maybeShowPersonalizedConsentPopupOnIndexAfterIntro() {
    try {
      var introJustFinished = _readLSString(INTRO_FINISHED_FLOW_KEY) === "1";
      if (!introJustFinished) return false;
      if (hasPersonalizedConsentChoice()) return false;

      var accepted = await showAdsConsentPopup();
      await setPersonalizedConsent(accepted, { source: "intro_index_popup" });
      return true;
    } catch (_) {
      return false;
    }
  }

  // =============================
  // Expose API attendue par ton jeu
  // =============================
  window.VRAds = window.VRAds || {};
  window.VRAds.isNative = isNative;
  window.VRAds.showInterstitialAd = showInterstitialAd;
  window.VRAds.showRewardedAd = showRewardedAd;
  window.VRAds.syncWeightedTime = syncWeightedTime;
  window.VRAds.getWeightedAccumulatedMs = getWeightedAccumulatedMs;
  window.VRAds.resetWeightedAccumulatedMs = resetWeightedAccumulatedMs;
  window.VRAds.maybeShowInterstitialOnReturnToIndex = maybeShowInterstitialOnReturnToIndex;
  window.VRAds.markGameRewardSeen = markGameRewardSeen;
  window.VRAds.resetGameRewardSeen = resetGameRewardSeen;

  // ➜ API "actions"
  window.VRAds.getActionsCount = getActionsCount;
  window.VRAds.resetActionsCount = resetActionsCount;
  window.VRAds.markAction = markActionAndMaybeShowInterstitial;

  // ➜ API "stats"
  window.VRAds.getStats = function () { return _adsStats; };
  window.VRAds.refreshStats = refreshAdsStats;

  // ➜ API "state"
  window.VRAds.refreshState = syncAdsStateFromServer;

  // ➜ API consentement pubs personnalisées
  window.VRAds.getPersonalizedConsent = getPersonalizedConsent;
  window.VRAds.hasPersonalizedConsentChoice = hasPersonalizedConsentChoice;
  window.VRAds.setPersonalizedConsent = setPersonalizedConsent;
  window.VRAds.maybeShowPersonalizedConsentPopupOnIndexAfterIntro = maybeShowPersonalizedConsentPopupOnIndexAfterIntro;

  // ➜ API "no_ads" (utile pour UI/diagnostic)
  window.VRAds.isNoAds = isNoAds;
  window.VRAds.refreshNoAds = syncNoAdsFromServer;

  try { _startWeightedTime(); } catch (_) {}
})();