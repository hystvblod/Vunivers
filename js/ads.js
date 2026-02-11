// VRealms - ads.js
// AdMob via Capacitor (community) - no import.
// API exposée: window.VRAds.showRewardedAd({placement}), window.VRAds.showInterstitial({placement})

(function () {
  "use strict";

  var Capacitor = (window.Capacitor || {});
  var AdMob = (Capacitor.Plugins && Capacitor.Plugins.AdMob) ? Capacitor.Plugins.AdMob : null;

  // ✅ IDs (tes vraies unités)
  var AD_UNIT_ID_INTERSTITIAL = "ca-app-pub-6837328794080297/8465879302";
  var AD_UNIT_ID_REWARDED     = "ca-app-pub-6837328794080297/8202263221";

  // Anti double-call
  var __busy = false;
  var __inited = false;

  // Flag utile si tu veux bloquer certains overlays pendant une pub
  window.__ads_active = false;

  function isNative() {
    try {
      if (window.Capacitor && typeof window.Capacitor.getPlatform === "function") {
        return window.Capacitor.getPlatform() !== "web";
      }
      if (Capacitor && typeof Capacitor.isNativePlatform === "function") return Capacitor.isNativePlatform();
    } catch (_) {}
    return false;
  }

  function getPersonalizedAdsGranted() {
    // Même logique que ton ancien fichier (simple + stable)
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

  function buildRequestOptions() {
    // npa: 1 = non-personnalisée, 0 = personnalisée
    return { npa: getPersonalizedAdsGranted() ? "0" : "1" };
  }

  async function ensureInit() {
    if (__inited) return true;
    __inited = true;

    if (!isNative() || !AdMob || !AdMob.initialize) {
      console.warn("[VRAds] AdMob non dispo (web ou plugin manquant).");
      return false;
    }

    try {
      await AdMob.initialize({
        requestTrackingAuthorization: false,
        initializeForTesting: false
      });
      console.log("[VRAds] init OK");
      return true;
    } catch (e) {
      console.warn("[VRAds] init failed:", e);
      return false;
    }
  }

  function waitOnce(eventName, timeoutMs) {
    return new Promise(function (resolve) {
      var done = false;
      var off = null;
      var t = setTimeout(function () {
        if (done) return;
        done = true;
        try { off && off.remove && off.remove(); } catch (_) {}
        resolve({ ok: false, reason: "timeout" });
      }, timeoutMs || 15000);

      try {
        off = AdMob.addListener(eventName, function (arg) {
          if (done) return;
          done = true;
          clearTimeout(t);
          try { off && off.remove && off.remove(); } catch (_) {}
          resolve({ ok: true, arg: arg });
        });
      } catch (_) {
        clearTimeout(t);
        resolve({ ok: false, reason: "no_listener" });
      }
    });
  }

  async function showRewardedInternal(placement) {
    if (!isNative() || !AdMob) return false;

    // Compat: certains plugins utilisent prepareRewardVideoAd/showRewardVideoAd
    if (!AdMob.prepareRewardVideoAd || !AdMob.showRewardVideoAd) {
      console.warn("[VRAds] Méthodes rewarded manquantes sur ce plugin.");
      return false;
    }

    // On considère "récompense validée" uniquement si on reçoit onRewarded
    var rewardedP = waitOnce("onRewarded", 45000);

    await AdMob.prepareRewardVideoAd({
      adId: AD_UNIT_ID_REWARDED,
      requestOptions: buildRequestOptions()
    });

    window.__ads_active = true;
    try {
      await AdMob.showRewardVideoAd();
    } catch (e) {
      window.__ads_active = false;
      return false;
    }

    // On attend la récompense (ou timeout)
    var res = await rewardedP;
    window.__ads_active = false;

    if (res.ok) {
      console.log("[VRAds] rewarded OK:", placement);
      return true;
    }
    return false;
  }

  async function showInterstitialInternal(placement) {
    if (!isNative() || !AdMob) return false;

    if (!AdMob.prepareInterstitial || !AdMob.showInterstitial) {
      console.warn("[VRAds] Méthodes interstitial manquantes sur ce plugin.");
      return false;
    }

    await AdMob.prepareInterstitial({
      adId: AD_UNIT_ID_INTERSTITIAL,
      requestOptions: buildRequestOptions()
    });

    window.__ads_active = true;
    try {
      await AdMob.showInterstitial();
      console.log("[VRAds] interstitial shown:", placement);
      return true;
    } catch (e) {
      return false;
    } finally {
      window.__ads_active = false;
      // précharge “soft” pour la prochaine
      try {
        setTimeout(function () {
          try { AdMob.prepareInterstitial({ adId: AD_UNIT_ID_INTERSTITIAL, requestOptions: buildRequestOptions() }); } catch (_) {}
        }, 1200);
      } catch (_) {}
    }
  }

  window.VRAds = {
    // (si tu changes les ids plus tard sans toucher au fichier)
    setAdUnits: function (cfg) {
      cfg = cfg || {};
      if (typeof cfg.rewarded === "string") AD_UNIT_ID_REWARDED = cfg.rewarded.trim();
      if (typeof cfg.interstitial === "string") AD_UNIT_ID_INTERSTITIAL = cfg.interstitial.trim();
    },

    showRewardedAd: async function (opts) {
      opts = opts || {};
      var placement = String(opts.placement || "generic");

      if (__busy) return false;
      __busy = true;
      try {
        var okInit = await ensureInit();
        if (!okInit) return false;
        return await showRewardedInternal(placement);
      } finally {
        __busy = false;
      }
    },

    showInterstitial: async function (opts) {
      opts = opts || {};
      var placement = String(opts.placement || "generic");

      if (__busy) return false;
      __busy = true;
      try {
        var okInit = await ensureInit();
        if (!okInit) return false;
        return await showInterstitialInternal(placement);
      } finally {
        __busy = false;
      }
    }
  };
})();
