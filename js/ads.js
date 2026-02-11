// FILE: zip/js/ads.js
// VRealms - ads.js (AdMob Capacitor Community, no-import) — SANS SSV
(function () {
  "use strict";

  // ------- Raccourcis globaux -------
  var Capacitor = (window.Capacitor || {});
  var AdMob = (Capacitor.Plugins && Capacitor.Plugins.AdMob) ? Capacitor.Plugins.AdMob : null;
  var App = (Capacitor.App) ? Capacitor.App
          : ((Capacitor.Plugins && Capacitor.Plugins.App) ? Capacitor.Plugins.App : null);

  // ------- STRICT PROD -------
  var __DEV_ADS__ = false;      // true pour tests locaux
  var SHOW_DIAG_PANEL = false;  // overlay debug (laisse false en prod)

  // ✅ Tes Ad Units (PROD)
  var AD_UNIT_ID_INTERSTITIEL = "ca-app-pub-6837328794080297/8465879302";
  var AD_UNIT_ID_REWARDED     = "ca-app-pub-6837328794080297/8202263221";

  // ✅ Règle interstitiel : 1 pub tous les 7 choix (cumul global)
  var INTERSTITIEL_EVERY_X_ACTIONS = 8;
  var INTER_COOLDOWN_MS = 0; // anti-spam (0 = off)

  // --- Récompenses par défaut (utilisées par l'UI si besoin)
  window.REWARD_JETONS = typeof window.REWARD_JETONS === "number" ? window.REWARD_JETONS : 1;
  window.REWARD_VCOINS = typeof window.REWARD_VCOINS === "number" ? window.REWARD_VCOINS : 200;

  // --- Flags d'état ---
  var isRewardShowing = false;
  window.__ads_active = false; // flag global anti-back/anti-overlays côté app

  // --- Compteurs persistés (interstitiels) ---
  var ACTIONS_KEY = "vr_actions_count";
  var LAST_INTER_KEY = "vr_last_inter_ts";
  var actionsCount = parseInt(localStorage.getItem(ACTIONS_KEY) || "0", 10);
  var lastInterTs = parseInt(localStorage.getItem(LAST_INTER_KEY) || "0", 10);

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
  // Consent / Request options (NPA)
  // =============================
  function getPersonalizedAdsGranted() {
    var rgpd = localStorage.getItem("rgpdConsent"); // "accept"|"refuse"|null
    var adsConsent = (localStorage.getItem("adsConsent") || "").toLowerCase();
    var adsEnabled = (localStorage.getItem("adsEnabled") || "").toLowerCase();

    if (rgpd === "refuse") return false;
    if (rgpd === "accept") {
      if (adsConsent) return adsConsent === "yes";
      if (adsEnabled) return adsEnabled === "true";
      return false;
    }
    if (adsConsent) return adsConsent === "yes";
    if (adsEnabled) return adsEnabled === "true";
    return false;
  }

  function buildAdMobRequestOptions() {
    // npa: "1" => non-personnalisées, "0" => personnalisées
    return { npa: getPersonalizedAdsGranted() ? "0" : "1" };
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

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      if (!isRewardShowing) postAdCleanup();
    }
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
          isRewardShowing = true;
          window.__ads_active = true;
          diag("Ad opened");
        }],
        ["onAdDismissedFullScreenContent", function () {
          diag("Ad dismissed");
          isRewardShowing = false;
          postAdCleanup();
        }],
        ["onAdFailedToShowFullScreenContent", function () {
          diag("Ad failed to show");
          isRewardShowing = false;
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

      await AdMob.initialize({
        requestTrackingAuthorization: false,
        initializeForTesting: __DEV_ADS__
      });

      registerAdEventsOnce();
    } catch (_) {}
  })();

  // =============================
  // Helpers "wait" (ouvert / dismissed / rewarded)
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
    if (!INTER_COOLDOWN_MS) return true;
    var now = Date.now();
    return (now - lastInterTs) >= INTER_COOLDOWN_MS;
  }

  function markInterstitialShownNow() {
    lastInterTs = Date.now();
    localStorage.setItem(LAST_INTER_KEY, String(lastInterTs));
  }

  async function showInterstitialAd() {
    try {
      if (!isNative()) return false;
      if (!AdMob || !AdMob.prepareInterstitial || !AdMob.showInterstitial) return false;
      if (!canShowInterstitialNow()) return false;

      await AdMob.prepareInterstitial({
        adId: AD_UNIT_ID_INTERSTITIEL,
        requestOptions: buildAdMobRequestOptions()
      });

      preShowAdCleanup();

      var dismissedP = waitDismissedOnce();
      var res = await AdMob.showInterstitial();

      await Promise.race([dismissedP.catch(function () {}), waitAppReturnOnce()]);
      postAdCleanup();

      if (res !== false) {
        markInterstitialShownNow();
        // Preload best-effort
        setTimeout(function () {
          try {
            AdMob.prepareInterstitial({
              adId: AD_UNIT_ID_INTERSTITIEL,
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
          adId: AD_UNIT_ID_INTERSTITIEL,
          requestOptions: buildAdMobRequestOptions()
        }).catch(function () {});
      } catch (_) {}
      try { postAdCleanup(); } catch (_) {}
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

      await AdMob.prepareRewardVideoAd({
        adId: AD_UNIT_ID_REWARDED,
        requestOptions: buildAdMobRequestOptions()
      });

      preShowAdCleanup();
      isRewardShowing = true;

      var rewardedP = waitRewardedOnce(30000);
      var dismissedP = waitDismissedOnce();

      var showPromise = AdMob.showRewardVideoAd();

      var gotReward = await rewardedP;
      await Promise.race([dismissedP.catch(function () {}), waitAppReturnOnce()]);
      postAdCleanup();

      try { await showPromise; } catch (_) {}
      isRewardShowing = false;

      return !!gotReward;
    } catch (_) {
      try { postAdCleanup(); } catch (_) {}
      isRewardShowing = false;
      return false;
    }
  }

  // =============================
  // Compteur actions → déclenche interstitiel tous les 7 choix
  // =============================
  function getActionsCount() {
    actionsCount = parseInt(localStorage.getItem(ACTIONS_KEY) || "0", 10) || 0;
    return actionsCount;
  }

  function resetActionsCount() {
    actionsCount = 0;
    localStorage.setItem(ACTIONS_KEY, "0");
  }

  async function markActionAndMaybeShowInterstitial() {
    // Incrémente puis vérifie (pub APRES le 7e choix)
    actionsCount = (parseInt(localStorage.getItem(ACTIONS_KEY) || "0", 10) || 0) + 1;
    localStorage.setItem(ACTIONS_KEY, String(actionsCount));

    if (INTERSTITIEL_EVERY_X_ACTIONS > 0 && (actionsCount % INTERSTITIEL_EVERY_X_ACTIONS) === 0) {
      try { await showInterstitialAd(); } catch (_) {}
    }
    return actionsCount;
  }

  // =============================
  // Expose API attendue par ton jeu
  // =============================
  window.VRAds = window.VRAds || {};
  window.VRAds.isNative = isNative;
  window.VRAds.showInterstitialAd = showInterstitialAd;
  window.VRAds.showRewardedAd = showRewardedAd;

  // ➜ nouvelle API "action"
  window.VRAds.getActionsCount = getActionsCount;
  window.VRAds.resetActionsCount = resetActionsCount;
  window.VRAds.markAction = markActionAndMaybeShowInterstitial;

})();
