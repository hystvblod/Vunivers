// js/onesignal.js
// OneSignal init (Capacitor + Cordova plugin)
// - Compatible API v5 (global OneSignal) + fallback v3 (window.plugins.OneSignal)
// - Links OneSignal user to Supabase uid when possible (external user id)
// ⚠️ This file is safe to ship in www. DO NOT put Firebase service account JSON here.

(function () {
  "use strict";

  const ONESIGNAL_APP_ID = "26703698-8c7c-46ee-9724-c22de4167a00";

  function _has(obj, path) {
    try {
      return path.split(".").reduce((o, k) => (o && k in o ? o[k] : undefined), obj) !== undefined;
    } catch (_) {
      return false;
    }
  }

  async function _getUidBestEffort() {
    try {
      if (window.VUserData && typeof window.VUserData.ensureAuth === "function") {
        const uid = await window.VUserData.ensureAuth();
        if (uid) return uid;
      }
    } catch (_) {}

    try {
      if (window.sb && window.sb.auth && typeof window.sb.auth.getUser === "function") {
        const r = await window.sb.auth.getUser();
        const uid = r?.data?.user?.id;
        if (uid) return uid;
      }
    } catch (_) {}

    return null;
  }

  async function _linkExternalUserId(setterFn) {
    try {
      const uid = await _getUidBestEffort();
      if (!uid) return;
      try {
        await setterFn(uid);
      } catch (_) {
        // some SDK methods are sync
        try { setterFn(uid); } catch (_) {}
      }
    } catch (_) {}
  }

  async function _initV5() {
    // onesignal-cordova-plugin v5 exposes a global `OneSignal`
    // Docs-style API:
    // OneSignal.initialize(appId)
    // OneSignal.Notifications.requestPermission(true)
    const OS = window.OneSignal;
    if (!OS || typeof OS.initialize !== "function") return false;

    OS.initialize(ONESIGNAL_APP_ID);

    if (_has(OS, "Notifications.requestPermission")) {
      try {
        OS.Notifications.requestPermission(true);
      } catch (_) {}
    }

    // v5: OS.login(externalId) is preferred, fallback to setExternalUserId if present
    await _linkExternalUserId(async (uid) => {
      if (typeof OS.login === "function") return OS.login(uid);
      if (typeof OS.setExternalUserId === "function") return OS.setExternalUserId(uid);
    });

    return true;
  }

  async function _initLegacyV3() {
    // older cordova plugin exposed window.plugins.OneSignal
    const OS = window.plugins && window.plugins.OneSignal;
    if (!OS) return false;

    if (typeof OS.setAppId === "function") {
      OS.setAppId(ONESIGNAL_APP_ID);
    }

    if (typeof OS.promptForPushNotificationsWithUserResponse === "function") {
      try {
        OS.promptForPushNotificationsWithUserResponse(function () {});
      } catch (_) {}
    }

    await _linkExternalUserId(async (uid) => {
      if (typeof OS.setExternalUserId === "function") return OS.setExternalUserId(uid);
    });

    return true;
  }

  async function initOneSignal() {
    // Only run on device (best-effort). On desktop web, cordova/OneSignal won't exist.
    try {
      const okV5 = await _initV5();
      if (okV5) return;
      await _initLegacyV3();
    } catch (_) {}
  }

  // Cordova/Capacitor: prefer deviceready
  document.addEventListener("deviceready", function () {
    initOneSignal();
  }, false);

  // Safety fallback (if deviceready doesn't fire for some reason)
  window.addEventListener("load", function () {
    setTimeout(initOneSignal, 1200);
  });
})();