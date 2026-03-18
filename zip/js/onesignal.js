// js/onesignal.js
(function () {
  "use strict";

  const ONESIGNAL_APP_ID = "26703698-8c7c-46ee-9724-c22de4167a00";

  const K_PROMPT_SHOWN = "vr_os_native_prompt_shown_v1";
  const K_PENDING_INDEX_PROMPT = "vr_os_pending_index_prompt_v1";
  const K_REAL_GAME_THIS_RUN = "vr_os_real_game_this_run_v1";

  let bootStarted = false;
  let initialized = false;
  let indexPromptStarted = false;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getOS() {
    try {
      if (window.OneSignal) return window.OneSignal;
      if (window.plugins && window.plugins.OneSignal) return window.plugins.OneSignal;
    } catch (_) {}
    return null;
  }

  function isNative() {
    try {
      if (window.Capacitor && typeof window.Capacitor.isNativePlatform === "function") {
        return !!window.Capacitor.isNativePlatform();
      }
      if (window.cordova) return true;
    } catch (_) {}
    return false;
  }

  function isIndexPage() {
    try {
      const p = String(window.location.pathname || "").toLowerCase();
      return p.endsWith("/index.html") || p.endsWith("index.html") || p === "/" || p === "";
    } catch (_) {
      return false;
    }
  }

  function lsGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function lsSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {}
  }

  function lsDel(key) {
    try { localStorage.removeItem(key); } catch (_) {}
  }

  function ssGet(key) {
    try { return sessionStorage.getItem(key); } catch (_) { return null; }
  }

  function ssSet(key, value) {
    try { sessionStorage.setItem(key, value); } catch (_) {}
  }

  function ssDel(key) {
    try { sessionStorage.removeItem(key); } catch (_) {}
  }

  function hasShownPrompt() {
    return lsGet(K_PROMPT_SHOWN) === "1";
  }

  function hasPendingIndexPrompt() {
    return lsGet(K_PENDING_INDEX_PROMPT) === "1";
  }

  function hasRealGameThisRun() {
    return ssGet(K_REAL_GAME_THIS_RUN) === "1";
  }

  async function getUidBestEffort() {
    try {
      if (window.VUserData && typeof window.VUserData.ensureAuth === "function") {
        const uid = await window.VUserData.ensureAuth();
        if (uid) return uid;
      }
    } catch (_) {}

    try {
      if (window.sb && window.sb.auth && typeof window.sb.auth.getUser === "function") {
        const res = await window.sb.auth.getUser();
        const uid = res?.data?.user?.id;
        if (uid) return uid;
      }
    } catch (_) {}

    return null;
  }

  async function syncExternalId() {
    const OS = getOS();
    if (!OS) return false;

    const uid = await getUidBestEffort();
    if (!uid) return false;

    try {
      if (typeof OS.login === "function") {
        await OS.login(uid);
        return true;
      }
    } catch (_) {}

    try {
      if (typeof OS.setExternalUserId === "function") {
        await OS.setExternalUserId(uid);
        return true;
      }
    } catch (_) {}

    return false;
  }

  async function initOneSignal() {
    if (initialized) return true;

    const OS = getOS();
    if (!OS) return false;

    try {
      if (typeof OS.initialize === "function") {
        OS.initialize(ONESIGNAL_APP_ID);
      } else if (typeof OS.setAppId === "function") {
        OS.setAppId(ONESIGNAL_APP_ID);
      } else {
        return false;
      }

      initialized = true;
      await syncExternalId();
      return true;
    } catch (_) {
      return false;
    }
  }

  async function bootOneSignal() {
    if (bootStarted) return initialized;
    bootStarted = true;

    if (!isNative()) return false;

    try {
      if (window.__VR_BOOT_READY) {
        await Promise.race([window.__VR_BOOT_READY, sleep(3000)]);
      }
    } catch (_) {}

    for (let i = 0; i < 20; i++) {
      const ok = await initOneSignal();
      if (ok) return true;
      await sleep(400);
    }

    return false;
  }

  async function requestNativePermission() {
    await bootOneSignal();

    const OS = getOS();
    if (!OS) return false;

    try {
      if (OS.Notifications && typeof OS.Notifications.requestPermission === "function") {
        return await OS.Notifications.requestPermission(false);
      }
    } catch (_) {}

    try {
      if (typeof OS.promptForPushNotificationsWithUserResponse === "function") {
        return await new Promise((resolve) => {
          OS.promptForPushNotificationsWithUserResponse(function (accepted) {
            resolve(!!accepted);
          });
        });
      }
    } catch (_) {}

    return false;
  }

  function markRealGamePlayed() {
    ssSet(K_REAL_GAME_THIS_RUN, "1");
  }

  function clearRealGamePlayed() {
    ssDel(K_REAL_GAME_THIS_RUN);
  }

  function preparePromptOnNextIndex() {
    if (hasShownPrompt()) return false;
    if (!hasRealGameThisRun()) return false;

    lsSet(K_PENDING_INDEX_PROMPT, "1");
    return true;
  }

  async function maybePromptOnIndexAfterGameReturn() {
    if (indexPromptStarted) return false;
    indexPromptStarted = true;

    if (!isIndexPage()) return false;
    if (!hasPendingIndexPrompt()) return false;
    if (hasShownPrompt()) {
      lsDel(K_PENDING_INDEX_PROMPT);
      clearRealGamePlayed();
      return false;
    }

    lsDel(K_PENDING_INDEX_PROMPT);
    clearRealGamePlayed();
    lsSet(K_PROMPT_SHOWN, "1");

    try {
      await requestNativePermission();
      return true;
    } catch (_) {
      return false;
    }
  }

  function bindGameReturnHook() {
    document.addEventListener("click", function (e) {
      try {
        const link = e.target && e.target.closest ? e.target.closest('a[href="index.html"]') : null;
        if (!link) return;
        preparePromptOnNextIndex();
      } catch (_) {}
    }, true);
  }

  window.VROneSignal = {
    boot: bootOneSignal,
    syncExternalId: syncExternalId,
    requestNativePermission: requestNativePermission,
    markRealGamePlayed: markRealGamePlayed,
    clearRealGamePlayed: clearRealGamePlayed,
    preparePromptOnNextIndex: preparePromptOnNextIndex,
    maybePromptOnIndexAfterGameReturn: maybePromptOnIndexAfterGameReturn,
    isReady: function () {
      return initialized;
    }
  };

  document.addEventListener("deviceready", async function () {
    await bootOneSignal();
    bindGameReturnHook();
    await maybePromptOnIndexAfterGameReturn();
  }, false);

  document.addEventListener("resume", function () {
    syncExternalId();
  }, false);

  window.addEventListener("load", async function () {
    bindGameReturnHook();
    await maybePromptOnIndexAfterGameReturn();
  }, false);
})();