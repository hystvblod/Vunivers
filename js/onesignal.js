// js/onesignal.js
(function () {
  "use strict";

  const ONESIGNAL_APP_ID = "26703698-8c7c-46ee-9724-c22de4167a00";

  let __bootStarted = false;
  let __initialized = false;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getOneSignalInstance() {
    try {
      if (window.plugins && window.plugins.OneSignal) return window.plugins.OneSignal;
      if (window.OneSignal) return window.OneSignal;
    } catch (_) {}
    return null;
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
    const OS = getOneSignalInstance();
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
    if (__initialized) return true;

    const OS = getOneSignalInstance();
    if (!OS) return false;

    try {
      if (typeof OS.initialize === "function") {
        OS.initialize(ONESIGNAL_APP_ID);
      } else if (typeof OS.setAppId === "function") {
        OS.setAppId(ONESIGNAL_APP_ID);
      } else {
        return false;
      }

      __initialized = true;
      await syncExternalId();
      return true;
    } catch (_) {
      return false;
    }
  }

  async function bootOneSignal() {
    if (__bootStarted) return __initialized;
    __bootStarted = true;

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

  async function requestPushPermission(openSettingsIfDenied) {
    await bootOneSignal();

    const OS = getOneSignalInstance();
    if (!OS) return false;

    try {
      if (OS.Notifications && typeof OS.Notifications.requestPermission === "function") {
        return await OS.Notifications.requestPermission(!!openSettingsIfDenied);
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

  window.VROneSignal = {
    boot: bootOneSignal,
    requestPushPermission: requestPushPermission,
    syncExternalId: syncExternalId,
    isReady: function () {
      return __initialized;
    }
  };

  document.addEventListener("deviceready", bootOneSignal, false);
  document.addEventListener("resume", syncExternalId, false);
})();