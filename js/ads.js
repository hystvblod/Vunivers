// VRealms - ads.js
// Implémentation robuste (Capacitor AdMob si dispo) + fallback stub navigateur.

(function () {
  "use strict";

  // ✅ À REMPLIR quand tu les as (AdMob > Blocs d'annonces)
  const AD_UNITS = {
    appIdAndroid: "ca-app-pub-6837328794080297~5780104273",
    rewardedAndroid: "",     // ex: ca-app-pub-xxxx/yyyy
    interstitialAndroid: ""  // ex: ca-app-pub-xxxx/yyyy
  };

  let _initDone = false;
  let _busy = false;

  function _getCapacitorAdMob() {
    try {
      const cap = window.Capacitor;
      if (!cap || !cap.Plugins) return null;
      // Plusieurs plugins exposent "AdMob"
      return cap.Plugins.AdMob || null;
    } catch (_) {
      return null;
    }
  }

  async function _ensureInit() {
    if (_initDone) return true;

    const AdMob = _getCapacitorAdMob();
    if (!AdMob) {
      console.warn("[VRAds] Capacitor AdMob plugin non détecté (mode navigateur).");
      _initDone = true;
      return false;
    }

    try {
      // Selon plugin : initialize() ou initialize({ ... })
      if (typeof AdMob.initialize === "function") {
        await AdMob.initialize({
          initializeForTesting: false,
          // certains plugins acceptent requestTrackingAuthorization (iOS)
        });
      } else if (typeof AdMob.init === "function") {
        await AdMob.init();
      }

      _initDone = true;
      console.log("[VRAds] init OK");
      return true;
    } catch (e) {
      console.warn("[VRAds] init failed:", e);
      _initDone = true; // on évite boucle
      return false;
    }
  }

  function _hasUnit(id) {
    return typeof id === "string" && id.trim().length > 0;
  }

  function _platformAndroid() {
    try {
      return !!window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === "android";
    } catch (_) {
      return false;
    }
  }

  function _getUnits() {
    // (si tu ajoutes iOS plus tard, on étendra)
    return {
      rewarded: AD_UNITS.rewardedAndroid,
      interstitial: AD_UNITS.interstitialAndroid
    };
  }

  async function _showRewardedNative(placement) {
    const AdMob = _getCapacitorAdMob();
    if (!AdMob) return { ok: false, reason: "no_plugin" };

    const units = _getUnits();
    if (!_hasUnit(units.rewarded)) return { ok: false, reason: "missing_rewarded_unit" };

    // Compat multi-plugins :
    // - showRewardVideoAd({ adId })
    // - showRewarded({ adId })
    // - prepareRewardVideoAd({ adId }) + showRewardVideoAd()
    try {
      // 1) prepare (si existe)
      if (typeof AdMob.prepareRewardVideoAd === "function") {
        await AdMob.prepareRewardVideoAd({ adId: units.rewarded });
      } else if (typeof AdMob.prepareRewarded === "function") {
        await AdMob.prepareRewarded({ adId: units.rewarded });
      } else if (typeof AdMob.prepareRewardedAd === "function") {
        await AdMob.prepareRewardedAd({ adId: units.rewarded });
      }

      // 2) show
      if (typeof AdMob.showRewardVideoAd === "function") {
        await AdMob.showRewardVideoAd();
      } else if (typeof AdMob.showRewarded === "function") {
        await AdMob.showRewarded();
      } else if (typeof AdMob.showRewardedAd === "function") {
        await AdMob.showRewardedAd();
      } else {
        // certains plugins font showRewarded({ adId })
        if (typeof AdMob.showRewarded === "function") {
          await AdMob.showRewarded({ adId: units.rewarded });
        } else {
          return { ok: false, reason: "no_rewarded_method" };
        }
      }

      // Beaucoup de plugins ne renvoient pas "reward granted" en résultat direct.
      // On fait simple : si la pub a pu s'afficher sans throw → ok.
      console.log("[VRAds] Rewarded shown:", placement);
      return { ok: true };
    } catch (e) {
      console.warn("[VRAds] Rewarded failed:", e);
      return { ok: false, reason: "show_failed" };
    }
  }

  async function _showInterstitialNative(placement) {
    const AdMob = _getCapacitorAdMob();
    if (!AdMob) return { ok: false, reason: "no_plugin" };

    const units = _getUnits();
    if (!_hasUnit(units.interstitial)) return { ok: false, reason: "missing_interstitial_unit" };

    try {
      // prepare
      if (typeof AdMob.prepareInterstitial === "function") {
        await AdMob.prepareInterstitial({ adId: units.interstitial });
      } else if (typeof AdMob.prepareInterstitialAd === "function") {
        await AdMob.prepareInterstitialAd({ adId: units.interstitial });
      }

      // show
      if (typeof AdMob.showInterstitial === "function") {
        await AdMob.showInterstitial();
      } else if (typeof AdMob.showInterstitialAd === "function") {
        await AdMob.showInterstitialAd();
      } else {
        // certains plugins font showInterstitial({ adId })
        if (typeof AdMob.showInterstitial === "function") {
          await AdMob.showInterstitial({ adId: units.interstitial });
        } else {
          return { ok: false, reason: "no_interstitial_method" };
        }
      }

      console.log("[VRAds] Interstitial shown:", placement);
      return { ok: true };
    } catch (e) {
      console.warn("[VRAds] Interstitial failed:", e);
      return { ok: false, reason: "show_failed" };
    }
  }

  window.VRAds = {
    setAdUnits({ rewardedAndroid, interstitialAndroid } = {}) {
      if (typeof rewardedAndroid === "string") AD_UNITS.rewardedAndroid = rewardedAndroid.trim();
      if (typeof interstitialAndroid === "string") AD_UNITS.interstitialAndroid = interstitialAndroid.trim();
    },

    async showRewardedAd({ placement = "generic" } = {}) {
      if (_busy) return false;
      _busy = true;
      try {
        await _ensureInit();

        // En navigateur : stub propre
        const AdMob = _getCapacitorAdMob();
        if (!AdMob) {
          console.log("[VRAds] (stub) rewarded:", placement);
          return false;
        }

        const res = await _showRewardedNative(placement);
        return !!res.ok;
      } finally {
        _busy = false;
      }
    },

    async showInterstitial({ placement = "generic" } = {}) {
      if (_busy) return false;
      _busy = true;
      try {
        await _ensureInit();

        const AdMob = _getCapacitorAdMob();
        if (!AdMob) {
          console.log("[VRAds] (stub) interstitial:", placement);
          return false;
        }

        const res = await _showInterstitialNative(placement);
        return !!res.ok;
      } finally {
        _busy = false;
      }
    }
  };
})();
