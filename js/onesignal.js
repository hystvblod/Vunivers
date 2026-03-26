// js/onesignal.js
(function () {
  "use strict";

  const ONESIGNAL_APP_ID = "26703698-8c7c-46ee-9724-c22de4167a00";

  const K_PROMPT_SHOWN = "vr_os_native_prompt_shown_v1";
  const K_PENDING_INDEX_PROMPT = "vr_os_pending_index_prompt_v1";
  const K_REAL_GAME_THIS_RUN = "vr_os_real_game_this_run_v1";

  let initialized = false;
  let bootPromise = null;
  let indexPromptStarted = false;
  let gameReturnHookBound = false;

  function t(key, fallback) {
    try {
      const out = window.VRI18n?.t?.(key);
      if (out && out !== key) return out;
    } catch (_) {}
    return typeof fallback === "string" ? fallback : "";
  }

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
    if (initialized) return true;
    if (!isNative()) return false;
    if (bootPromise) return bootPromise;

    bootPromise = (async function () {
      try {
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
      } finally {
        if (!initialized) {
          bootPromise = null;
        }
      }
    })();

    return bootPromise;
  }

  async function requestNativePermission() {
    const bootOk = await bootOneSignal();
    if (!bootOk) {
      console.warn("[OneSignal] bootOneSignal() failed");
      return { attempted: false, accepted: false };
    }

    const OS = getOS();
    if (!OS) {
      console.warn("[OneSignal] getOS() returned null");
      return { attempted: false, accepted: false };
    }

    try {
      if (OS.Notifications && typeof OS.Notifications.requestPermission === "function") {
        const accepted = await OS.Notifications.requestPermission(true);
        console.log("[OneSignal] Native permission result:", accepted);
        return { attempted: true, accepted: !!accepted };
      }
    } catch (e) {
      console.warn("[OneSignal] Notifications.requestPermission failed", e);
    }

    try {
      if (typeof OS.promptForPushNotificationsWithUserResponse === "function") {
        const accepted = await new Promise((resolve) => {
          OS.promptForPushNotificationsWithUserResponse(function (ok) {
            resolve(!!ok);
          });
        });
        console.log("[OneSignal] Legacy native permission result:", accepted);
        return { attempted: true, accepted: !!accepted };
      }
    } catch (e) {
      console.warn("[OneSignal] Legacy prompt failed", e);
    }

    console.warn("[OneSignal] No native permission API available");
    return { attempted: false, accepted: false };
  }

  function ensurePrePromptStyles() {
    if (document.getElementById("vr-os-preprompt-style")) return;

    const style = document.createElement("style");
    style.id = "vr-os-preprompt-style";
    style.textContent = `
      #vr-os-preprompt{ position:fixed; inset:0; display:none; align-items:center; justify-content:center; padding:16px; background:rgba(15,23,42,.84); z-index:250000; }
      #vr-os-preprompt.is-open{ display:flex; }
      #vr-os-preprompt .vr-os-preprompt-card{ width:min(420px, calc(100vw - 24px)); padding:18px; border-radius:22px; background:rgba(15,23,42,.98); border:1px solid rgba(255,255,255,.14); box-shadow:0 20px 40px rgba(0,0,0,.35); color:#fff; text-align:center; display:flex; flex-direction:column; gap:12px; }
      #vr-os-preprompt .vr-os-preprompt-title{ margin:0; font-size:clamp(20px, 5.2vw, 26px); font-weight:950; }
      #vr-os-preprompt .vr-os-preprompt-text{ margin:0; font-size:clamp(13px, 3.7vw, 15px); line-height:1.4; color:rgba(255,255,255,.88); }
      #vr-os-preprompt .vr-os-preprompt-actions{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
      #vr-os-preprompt button{ min-height:48px; border:none; border-radius:14px; font:800 15px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; cursor:pointer; }
      #vr-os-preprompt .vr-os-preprompt-accept{ background:#ffffff; color:#0f172a; }
      #vr-os-preprompt .vr-os-preprompt-cancel{ background:rgba(255,255,255,.08); color:#fff; border:1px solid rgba(255,255,255,.12); }
    `;
    document.head.appendChild(style);
  }

  function ensurePrePrompt() {
    let overlay = document.getElementById("vr-os-preprompt");
    if (overlay) return overlay;

    ensurePrePromptStyles();

    overlay = document.createElement("div");
    overlay.id = "vr-os-preprompt";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="vr-os-preprompt-card" role="dialog" aria-modal="true">
        <h3 class="vr-os-preprompt-title" id="vr-os-preprompt-title"></h3>
        <p class="vr-os-preprompt-text" id="vr-os-preprompt-text"></p>
        <div class="vr-os-preprompt-actions">
          <button type="button" class="vr-os-preprompt-cancel" id="vr-os-preprompt-cancel"></button>
          <button type="button" class="vr-os-preprompt-accept" id="vr-os-preprompt-accept"></button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function fillPrePromptTexts() {
    const titleEl = document.getElementById("vr-os-preprompt-title");
    const textEl = document.getElementById("vr-os-preprompt-text");
    const cancelEl = document.getElementById("vr-os-preprompt-cancel");
    const acceptEl = document.getElementById("vr-os-preprompt-accept");

    if (titleEl) titleEl.textContent = t("onesignal.popup.title", "Rester informé");
    if (textEl) textEl.textContent = t("onesignal.popup.text", "Autoriser les notifications pour recevoir les nouveautés et les récompenses importantes.");
    if (cancelEl) cancelEl.textContent = t("onesignal.popup.cancel", "Plus tard");
    if (acceptEl) acceptEl.textContent = t("onesignal.popup.accept", "Autoriser");
  }

  function showPrePrompt() {
    const overlay = ensurePrePrompt();
    fillPrePromptTexts();

    return new Promise((resolve) => {
      const acceptBtn = document.getElementById("vr-os-preprompt-accept");
      const cancelBtn = document.getElementById("vr-os-preprompt-cancel");

      const close = (accepted) => {
        overlay.classList.remove("is-open");
        overlay.setAttribute("aria-hidden", "true");
        resolve(!!accepted);
      };

      overlay.onclick = (e) => {
        if (e.target === overlay) close(false);
      };

      if (acceptBtn) acceptBtn.onclick = () => close(true);
      if (cancelBtn) cancelBtn.onclick = () => close(false);

      overlay.classList.add("is-open");
      overlay.setAttribute("aria-hidden", "false");

      try {
        acceptBtn?.focus?.({ preventScroll: true });
      } catch (_) {}
    });
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
    if (!isIndexPage()) return false;
    if (!hasPendingIndexPrompt()) return false;

    if (hasShownPrompt()) {
      lsDel(K_PENDING_INDEX_PROMPT);
      clearRealGamePlayed();
      return false;
    }

    indexPromptStarted = true;

    try {
      const result = await requestNativePermission();

      lsDel(K_PENDING_INDEX_PROMPT);
      clearRealGamePlayed();
      indexPromptStarted = false;

      if (!result || !result.attempted) {
        return false;
      }

      lsSet(K_PROMPT_SHOWN, "1");
      return !!result.accepted;
    } catch (e) {
      console.warn("[OneSignal] maybePromptOnIndexAfterGameReturn failed", e);
      lsDel(K_PENDING_INDEX_PROMPT);
      clearRealGamePlayed();
      indexPromptStarted = false;
      return false;
    }
  }

  function bindGameReturnHook() {
    if (gameReturnHookBound) return;
    gameReturnHookBound = true;

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
    showPrePrompt: showPrePrompt,
    isReady: function () {
      return initialized;
    }
  };

  document.addEventListener("deviceready", async function () {
    bindGameReturnHook();
    await bootOneSignal();
  }, false);

  document.addEventListener("resume", function () {
    syncExternalId();
  }, false);

  window.addEventListener("load", function () {
    bindGameReturnHook();
  }, false);
})();