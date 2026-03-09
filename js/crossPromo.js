(function () {
  "use strict";

  const STORAGE_KEY = "vuniverse_crosspromo_state";
  const MAX_SHOW_PER_GAME = 3;
  const GLOBAL_COOLDOWN_MS = 24 * 60 * 60 * 1000;
  const SESSION_POPUP_KEY = "vuniverse_crosspromo_session_shown";
  const REWARD_AMOUNT = 400;

  const APPS = {
    vblocks: {
      id: "vblocks",
      packageName: "com.vboldstudio.vblocks",
      iosScheme: "vblocks://",
      storeUrlAndroid: "https://play.google.com/store/apps/details?id=com.vboldstudio.vblocks",
      storeUrlIOS: "https://apps.apple.com/app/idXXXXXXXXXX",
      icon: "assets/img/crosspromo/vblocks_cover.webp",
      shots: [
        "assets/img/crosspromo/vblocks_01.webp",
        "assets/img/crosspromo/vblocks_02.webp"
      ],
      titleKey: "crosspromo.apps.vblocks.name",
      descKey: "crosspromo.apps.vblocks.store_desc",
      popup1TitleKey: "crosspromo.apps.vblocks.popup1.title",
      popup1BodyKey: "crosspromo.apps.vblocks.popup1.body",
      popup2TitleKey: "crosspromo.apps.vblocks.popup2.title",
      popup2BodyKey: "crosspromo.apps.vblocks.popup2.body",
      popup3TitleKey: "crosspromo.apps.vblocks.popup3.title",
      popup3BodyKey: "crosspromo.apps.vblocks.popup3.body"
    },
    vchronicles: {
      id: "vchronicles",
      packageName: "com.vboldstudio.vchronicles",
      iosScheme: "vchronicles://",
      storeUrlAndroid: "https://play.google.com/store/apps/details?id=com.vboldstudio.vchronicles",
      storeUrlIOS: "https://apps.apple.com/app/idYYYYYYYYYY",
      icon: "assets/img/crosspromo/vchronicles_cover.webp",
      shots: [
        "assets/img/crosspromo/vchronicles_01.webp",
        "assets/img/crosspromo/vchronicles_02.webp"
      ],
      titleKey: "crosspromo.apps.vchronicles.name",
      descKey: "crosspromo.apps.vchronicles.store_desc",
      popup1TitleKey: "crosspromo.apps.vchronicles.popup1.title",
      popup1BodyKey: "crosspromo.apps.vchronicles.popup1.body",
      popup2TitleKey: "crosspromo.apps.vchronicles.popup2.title",
      popup2BodyKey: "crosspromo.apps.vchronicles.popup2.body",
      popup3TitleKey: "crosspromo.apps.vchronicles.popup3.title",
      popup3BodyKey: "crosspromo.apps.vchronicles.popup3.body"
    }
  };

  function t(key, fallback, vars) {
    let out = "";
    try {
      if (window.VRI18n && typeof window.VRI18n.t === "function") {
        out = window.VRI18n.t(key) || "";
      }
    } catch (_) {}

    if (!out) out = fallback || "";

    if (vars && out) {
      Object.keys(vars).forEach((k) => {
        out = out.split("{" + k + "}").join(String(vars[k]));
      });
    }

    return out;
  }

  function isNativeApp() {
    try {
      return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    } catch (_) {
      return false;
    }
  }

  function getPlatform() {
    try {
      if (!window.Capacitor || !window.Capacitor.getPlatform) return "web";
      return window.Capacitor.getPlatform();
    } catch (_) {
      return "web";
    }
  }

  function isAndroid() {
    return getPlatform() === "android";
  }

  function isIOS() {
    return getPlatform() === "ios";
  }

  function defaultGameState() {
    return {
      shownCount: 0,
      dismissedCount: 0,
      rewardClaimed: false,
      installedDetected: false,
      clickedStore: false,
      pendingInstallCheck: false,
      lastShownAt: 0
    };
  }

  function defaultState() {
    return {
      globalLastShownAt: 0,
      apps: {
        vblocks: defaultGameState(),
        vchronicles: defaultGameState()
      }
    };
  }

  function safeParse(raw) {
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  function normalizeGameState(src) {
    const s = src && typeof src === "object" ? src : {};
    return {
      shownCount: Math.max(0, Number(s.shownCount || 0) || 0),
      dismissedCount: Math.max(0, Number(s.dismissedCount || 0) || 0),
      rewardClaimed: !!s.rewardClaimed,
      installedDetected: !!s.installedDetected,
      clickedStore: !!s.clickedStore,
      pendingInstallCheck: !!s.pendingInstallCheck,
      lastShownAt: Math.max(0, Number(s.lastShownAt || 0) || 0)
    };
  }

  function readState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();

      const parsed = safeParse(raw);
      if (!parsed || typeof parsed !== "object") return defaultState();

      return {
        globalLastShownAt: Math.max(0, Number(parsed.globalLastShownAt || 0) || 0),
        apps: {
          vblocks: normalizeGameState(parsed.apps?.vblocks),
          vchronicles: normalizeGameState(parsed.apps?.vchronicles)
        }
      };
    } catch (_) {
      return defaultState();
    }
  }

  function writeState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function markSessionPopupShown() {
    try { sessionStorage.setItem(SESSION_POPUP_KEY, "1"); } catch (_) {}
  }

  function hasSessionPopupShown() {
    try { return sessionStorage.getItem(SESSION_POPUP_KEY) === "1"; } catch (_) { return false; }
  }

  function now() {
    return Date.now();
  }

  function hasGlobalCooldownPassed(state) {
    return (now() - (state.globalLastShownAt || 0)) >= GLOBAL_COOLDOWN_MS;
  }

  function canStillShowForGame(gameState) {
    if (gameState.rewardClaimed) return false;
    if (gameState.installedDetected) return false;
    if (gameState.dismissedCount >= MAX_SHOW_PER_GAME) return false;
    if (gameState.shownCount >= MAX_SHOW_PER_GAME) return false;
    return true;
  }

  async function canOpenTargetApp(app) {
    if (!isNativeApp()) return false;

    try {
      const AppLauncher = window.Capacitor?.Plugins?.AppLauncher;
      if (!AppLauncher || typeof AppLauncher.canOpenUrl !== "function") return false;

      if (isAndroid()) {
        const res = await AppLauncher.canOpenUrl({ url: app.packageName });
        return !!res?.value;
      }

      if (isIOS()) {
        const res = await AppLauncher.canOpenUrl({ url: app.iosScheme });
        return !!res?.value;
      }

      return false;
    } catch (_) {
      return false;
    }
  }

  async function openTargetApp(app) {
    try {
      const AppLauncher = window.Capacitor?.Plugins?.AppLauncher;
      if (!AppLauncher || typeof AppLauncher.openUrl !== "function") return false;

      if (isAndroid()) {
        const res = await AppLauncher.openUrl({ url: app.packageName });
        return !!res?.completed;
      }

      if (isIOS()) {
        const res = await AppLauncher.openUrl({ url: app.iosScheme });
        return !!res?.completed;
      }

      return false;
    } catch (_) {
      return false;
    }
  }

  function getStoreUrl(app) {
    if (isIOS()) return app.storeUrlIOS;
    return app.storeUrlAndroid;
  }

  function openStore(app) {
    const url = getStoreUrl(app);
    if (!url) return;
    window.location.href = url;
  }

  async function refreshInstalledStatus(appId) {
    const app = APPS[appId];
    if (!app) return false;

    const state = readState();
    const installed = await canOpenTargetApp(app);

    state.apps[appId].installedDetected = installed;
    writeState(state);

    return installed;
  }

  async function claimRewardIfEligible(appId) {
    const state = readState();
    const row = state.apps[appId];
    if (!row) return false;
    if (row.rewardClaimed) return false;
    if (!row.pendingInstallCheck) return false;
    if (!row.installedDetected) return false;

    row.rewardClaimed = true;
    row.pendingInstallCheck = false;
    row.clickedStore = false;
    writeState(state);

    try {
      if (window.VUserData?.addVcoinsAsync) {
        await window.VUserData.addVcoinsAsync(REWARD_AMOUNT);
      } else if (window.VUserData?.addVcoins) {
        await window.VUserData.addVcoins(REWARD_AMOUNT);
      }
    } catch (_) {}

    showRewardToast(appId);
    return true;
  }

  function showRewardToast(appId) {
    const appKey = appId === "vblocks"
      ? "crosspromo.apps.vblocks.name"
      : "crosspromo.apps.vchronicles.name";

    const appName = t(appKey, appId);
    const msg = t("crosspromo.reward_granted", "", { app: appName, amount: REWARD_AMOUNT });

    const el = document.createElement("div");
    el.style.cssText = [
      "position:fixed",
      "left:50%",
      "bottom:24px",
      "transform:translateX(-50%)",
      "z-index:200000",
      "padding:12px 16px",
      "border-radius:16px",
      "background:rgba(12,18,30,.94)",
      "border:1px solid rgba(255,255,255,.14)",
      "color:#fff",
      "font-weight:900",
      "font-size:14px",
      "box-shadow:0 14px 30px rgba(0,0,0,.34)"
    ].join(";");

    el.textContent = msg;
    document.body.appendChild(el);

    setTimeout(() => {
      try { el.remove(); } catch (_) {}
    }, 2800);
  }

  function setPendingStoreClick(appId) {
    const state = readState();
    const row = state.apps[appId];
    if (!row) return;

    row.clickedStore = true;
    row.pendingInstallCheck = true;
    writeState(state);
  }

  function registerDismiss(appId) {
    const state = readState();
    const row = state.apps[appId];
    if (!row) return;

    row.dismissedCount += 1;
    writeState(state);
  }

  function registerShown(appId) {
    const state = readState();
    const row = state.apps[appId];
    if (!row) return;

    row.shownCount += 1;
    row.lastShownAt = now();
    state.globalLastShownAt = now();
    writeState(state);
    markSessionPopupShown();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function buildPopupRoot() {
    let root = document.getElementById("vr-crosspromo-popup");
    if (root) return root;

    root = document.createElement("div");
    root.id = "vr-crosspromo-popup";
    root.style.cssText = [
      "position:fixed",
      "inset:0",
      "display:none",
      "align-items:center",
      "justify-content:center",
      "padding:18px",
      "z-index:200000",
      "background:rgba(0,0,0,.56)",
      "backdrop-filter:blur(6px)",
      "-webkit-backdrop-filter:blur(6px)"
    ].join(";");

    root.innerHTML = [
      '<div style="position:relative;width:min(520px, calc(100vw - 32px));padding:16px;border-radius:22px;background:rgba(10,16,28,.96);border:1px solid rgba(255,255,255,.12);box-shadow:0 16px 40px rgba(0,0,0,.3);">',
      '  <button id="vr-crosspromo-close" type="button" style="position:absolute;top:12px;right:12px;width:38px;height:38px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:#fff;font-size:20px;font-weight:900;" aria-label="close">×</button>',
      '  <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">',
      '    <img id="vr-crosspromo-cover" src="" alt="" style="width:72px;height:72px;border-radius:18px;object-fit:cover;border:1px solid rgba(255,255,255,.14);" />',
      '    <div>',
      '      <div id="vr-crosspromo-appname" style="font-size:13px;font-weight:900;opacity:.86;"></div>',
      '      <div id="vr-crosspromo-title" style="margin-top:4px;font-size:20px;line-height:1.1;font-weight:950;color:#fff;"></div>',
      '    </div>',
      '  </div>',
      '  <div id="vr-crosspromo-body" style="font-size:14px;line-height:1.42;color:rgba(255,255,255,.92);margin-bottom:14px;"></div>',
      '  <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);width:max-content;">',
      '    <img src="assets/img/ui/vcoins.webp" alt="" style="width:18px;height:18px;object-fit:contain;" />',
      '    <span id="vr-crosspromo-reward-value" style="font-size:13px;font-weight:900;color:#fff;"></span>',
      '  </div>',
      '  <div style="display:grid;grid-template-columns:1fr;gap:10px;">',
      '    <button id="vr-crosspromo-primary" type="button" style="min-height:52px;border-radius:16px;border:1px solid rgba(122,167,255,.34);background:rgba(122,167,255,.24);color:#fff;font-weight:900;"></button>',
      '    <button id="vr-crosspromo-secondary" type="button" style="min-height:50px;border-radius:16px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:#fff;font-weight:900;"></button>',
      '  </div>',
      '</div>'
    ].join("");

    document.body.appendChild(root);
    return root;
  }

  function getPopupText(app, popupIndex) {
    if (popupIndex === 1) {
      return {
        title: t(app.popup1TitleKey, ""),
        body: t(app.popup1BodyKey, "")
      };
    }
    if (popupIndex === 2) {
      return {
        title: t(app.popup2TitleKey, ""),
        body: t(app.popup2BodyKey, "")
      };
    }
    return {
      title: t(app.popup3TitleKey, ""),
      body: t(app.popup3BodyKey, "")
    };
  }

  async function openPromoPopup(appId, popupIndex) {
    const app = APPS[appId];
    if (!app) return false;

    const state = readState();
    const row = state.apps[appId];

    if (!canStillShowForGame(row)) return false;
    if (hasSessionPopupShown()) return false;
    if (!hasGlobalCooldownPassed(state)) return false;

    const isInstalled = await refreshInstalledStatus(appId);
    if (isInstalled) return false;

    const popupText = getPopupText(app, popupIndex);
    registerShown(appId);

    const root = buildPopupRoot();
    const cover = document.getElementById("vr-crosspromo-cover");
    const appName = document.getElementById("vr-crosspromo-appname");
    const title = document.getElementById("vr-crosspromo-title");
    const body = document.getElementById("vr-crosspromo-body");
    const rewardValue = document.getElementById("vr-crosspromo-reward-value");
    const primary = document.getElementById("vr-crosspromo-primary");
    const secondary = document.getElementById("vr-crosspromo-secondary");
    const closeBtn = document.getElementById("vr-crosspromo-close");

    cover.src = app.icon;
    appName.textContent = t(app.titleKey, "");
    title.textContent = popupText.title;
    body.textContent = popupText.body;
    rewardValue.textContent = String(REWARD_AMOUNT);
    primary.textContent = t("crosspromo.cta_install", "");
    secondary.textContent = t("crosspromo.cta_later", "");

    function closePopup() {
      root.style.display = "none";
    }

    primary.onclick = function () {
      setPendingStoreClick(appId);
      closePopup();
      openStore(app);
    };

    secondary.onclick = function () {
      registerDismiss(appId);
      closePopup();
    };

    closeBtn.onclick = function () {
      registerDismiss(appId);
      closePopup();
    };

    root.onclick = function (e) {
      if (e.target === root) {
        registerDismiss(appId);
        closePopup();
      }
    };

    root.style.display = "flex";
    return true;
  }

  function chooseLowVcoinsOffer() {
    const state = readState();
    const vb = state.apps.vblocks;
    const vc = state.apps.vchronicles;

    const vbOk = canStillShowForGame(vb);
    const vcOk = canStillShowForGame(vc);

    if (!vbOk && !vcOk) return null;
    if (vbOk && !vcOk) return { appId: "vblocks", popupIndex: 1 };
    if (!vbOk && vcOk) return { appId: "vchronicles", popupIndex: 1 };

    return vb.shownCount <= vc.shownCount
      ? { appId: "vblocks", popupIndex: 1 }
      : { appId: "vchronicles", popupIndex: 1 };
  }

  function chooseIdleOffer() {
    const state = readState();
    const vb = state.apps.vblocks;
    const vc = state.apps.vchronicles;

    const vbOk = canStillShowForGame(vb);
    const vcOk = canStillShowForGame(vc);

    if (!vbOk && !vcOk) return null;
    if (vbOk && !vcOk) return { appId: "vblocks", popupIndex: 3 };
    if (!vbOk && vcOk) return { appId: "vchronicles", popupIndex: 3 };

    return vb.shownCount <= vc.shownCount
      ? { appId: "vblocks", popupIndex: 3 }
      : { appId: "vchronicles", popupIndex: 3 };
  }

  async function maybeShowPopupFromContext(context) {
    if (!context) return false;

    if (context === "low_vcoins") {
      const offer = chooseLowVcoinsOffer();
      if (!offer) return false;
      return openPromoPopup(offer.appId, offer.popupIndex);
    }

    if (context === "post_game_stress") {
      return openPromoPopup("vblocks", 2);
    }

    if (context === "post_game_dark") {
      return openPromoPopup("vchronicles", 2);
    }

    if (context === "idle_index") {
      const offer = chooseIdleOffer();
      if (!offer) return false;
      return openPromoPopup(offer.appId, offer.popupIndex);
    }

    return false;
  }

  async function bootRewardChecks() {
    await refreshInstalledStatus("vblocks");
    await refreshInstalledStatus("vchronicles");

    await claimRewardIfEligible("vblocks");
    await claimRewardIfEligible("vchronicles");
  }

  async function renderStorePage() {
    const host = document.getElementById("vr-crosspromo-grid");
    if (!host) return;

    const ids = ["vblocks", "vchronicles"];
    const rows = [];

    for (const id of ids) {
      const app = APPS[id];
      const installed = await refreshInstalledStatus(id);
      const actionLabel = installed
        ? t("crosspromo.cta_open", "")
        : t("crosspromo.cta_install", "");

      rows.push([
        '<article class="vr-crosspromo-card">',
        '  <div class="vr-crosspromo-hero">',
        '    <span class="vr-crosspromo-badge">' + escapeHtml(t("crosspromo.badge", "")) + '</span>',
        '    <img src="' + escapeHtml(app.icon) + '" alt="" draggable="false" />',
        '  </div>',
        '  <div class="vr-crosspromo-content">',
        '    <div class="vr-crosspromo-head">',
        '      <h2 class="vr-crosspromo-name">' + escapeHtml(t(app.titleKey, "")) + '</h2>',
        '      <div class="vr-crosspromo-reward">',
        '        <img src="assets/img/ui/vcoins.webp" alt="" draggable="false" />',
        '        <span>' + escapeHtml(String(REWARD_AMOUNT)) + '</span>',
        '      </div>',
        '    </div>',
        '    <p class="vr-crosspromo-desc">' + escapeHtml(t(app.descKey, "")) + '</p>',
        '    <div class="vr-crosspromo-gallery">',
        '      <div class="vr-crosspromo-shot"><img src="' + escapeHtml(app.shots[0]) + '" alt="" draggable="false" /></div>',
        '      <div class="vr-crosspromo-shot"><img src="' + escapeHtml(app.shots[1]) + '" alt="" draggable="false" /></div>',
        '    </div>',
        '    <div class="vr-crosspromo-actions">',
        '      <button class="vr-crosspromo-btn primary" type="button" data-crosspromo-action="' + escapeHtml(id) + '">' + escapeHtml(actionLabel) + '</button>',
        '      <button class="vr-crosspromo-btn" type="button" data-crosspromo-later="' + escapeHtml(id) + '">' + escapeHtml(t("crosspromo.cta_later", "")) + '</button>',
        '    </div>',
        '  </div>',
        '</article>'
      ].join(""));
    }

    host.innerHTML = rows.join("");

    host.querySelectorAll("[data-crosspromo-action]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-crosspromo-action");
        const app = APPS[id];
        if (!app) return;

        const installed = await refreshInstalledStatus(id);
        if (installed) {
          await openTargetApp(app);
          return;
        }

        setPendingStoreClick(id);
        openStore(app);
      });
    });

    host.querySelectorAll("[data-crosspromo-later]").forEach((btn) => {
      btn.addEventListener("click", () => {
        history.back();
      });
    });
  }

  async function bootIndexPopupFlow() {
    const context = sessionStorage.getItem("vr_crosspromo_context") || "";
    if (context) {
      sessionStorage.removeItem("vr_crosspromo_context");
      await maybeShowPopupFromContext(context);
      return;
    }

    await maybeShowPopupFromContext("idle_index");
  }

  function exposeApi() {
    window.VRCrossPromo = {
      maybeShowPopupFromContext,
      refreshInstalledStatus,
      claimRewardIfEligible,
      async openOrInstall(appId) {
        const app = APPS[appId];
        if (!app) return false;

        const installed = await refreshInstalledStatus(appId);
        if (installed) {
          return openTargetApp(app);
        }

        setPendingStoreClick(appId);
        openStore(app);
        return true;
      }
    };
  }

  document.addEventListener("DOMContentLoaded", async function () {
    exposeApi();

    try {
      const lang = window.VUserData?.getLang?.() || "fr";
      if (window.VRI18n && typeof window.VRI18n.initI18n === "function") {
        await window.VRI18n.initI18n(lang);
      }
    } catch (_) {}

    await bootRewardChecks();
    await renderStorePage();

    const pathname = String(window.location.pathname || "");
    const isIndex = pathname.endsWith("/index.html") || pathname.endsWith("index.html") || pathname === "/" || pathname === "";
    if (isIndex) {
      await bootIndexPopupFlow();
    }
  });
})();