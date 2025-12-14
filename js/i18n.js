(function () {
  "use strict";

  // i18n runtime state
  let _vrCurrentLang = "fr";
  let _vrCurrentDict = {};

  const VR_DEFAULT_LANG = "fr";
  const VR_STORAGE_KEYS = { LANG: "vr_lang" };

  function normalizeLang(lang) {
    const l = (lang || "").toString().trim().toLowerCase();
    return l || VR_DEFAULT_LANG;
  }

  function getI18nPaths() {
    const forced = (window.VR_I18N_PATH && String(window.VR_I18N_PATH).trim()) || "";
    const paths = [];
    if (forced) paths.push(forced);

    // Fallbacks (marche si tes JSON sont dans data/i18n OU i18n)
    paths.push("data/i18n", "i18n");

    // unique
    return [...new Set(paths.filter(Boolean))];
  }

  async function loadJSON(path) {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error(`i18n fetch failed: ${path} (${res.status})`);
    return await res.json();
  }

  function resolveKey(obj, key) {
    if (!obj || !key) return null;
    const parts = key.split(".");
    let cur = obj;
    for (const p of parts) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p];
      else return null;
    }
    return cur;
  }

  function applyTranslations(dict) {
    // texte simple
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const val = resolveKey(dict, key);
      if (typeof val === "string") el.textContent = val;
    });

    // placeholders
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      const val = resolveKey(dict, key);
      if (typeof val === "string") el.setAttribute("placeholder", val);
    });

    // title (tooltips)
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      const val = resolveKey(dict, key);
      if (typeof val === "string") el.setAttribute("title", val);
    });

    // aria-label (accessibilité)
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      const val = resolveKey(dict, key);
      if (typeof val === "string") el.setAttribute("aria-label", val);
    });
  }

  async function loadLocale(lang) {
    const l = normalizeLang(lang);
    const paths = getI18nPaths();

    let lastErr = null;
    for (const base of paths) {
      const url = `${base}/${l}.json`;
      try {
        return await loadJSON(url);
      } catch (e) {
        lastErr = e;
      }
    }

    console.warn("[VRI18n] Aucun JSON trouvé pour", l, "dans", paths, lastErr);
    return {};
  }

  function getLocalLang() {
    // 1) userData.lang si dispo
    try {
      if (window.VUserData && typeof window.VUserData.load === "function") {
        const u = window.VUserData.load();
        if (u && u.lang) return normalizeLang(u.lang);
      }
    } catch (_) {}

    // 2) localStorage vr_lang
    try {
      const fromLS = localStorage.getItem(VR_STORAGE_KEYS.LANG);
      if (fromLS) return normalizeLang(fromLS);
    } catch (_) {}

    return VR_DEFAULT_LANG;
  }

  function setLocalLang(lang) {
    const l = normalizeLang(lang);

    // localStorage
    try {
      localStorage.setItem(VR_STORAGE_KEYS.LANG, l);
    } catch (_) {}

    // userData.lang
    try {
      if (window.VUserData && typeof window.VUserData.load === "function" && typeof window.VUserData.save === "function") {
        const u = window.VUserData.load();
        window.VUserData.save({ ...u, lang: l });
      }
    } catch (_) {}

    return l;
  }

  async function saveLangRemoteIfAvailable(lang) {
    const l = normalizeLang(lang);
    try {
      if (window.VRRemoteStore && typeof window.VRRemoteStore.saveLang === "function") {
        await window.VRRemoteStore.saveLang(l);
      }
    } catch (e) {
      console.warn("[VRI18n] saveLang remote failed", e);
    }
  }

  async function initI18n() {
    const lang = getLocalLang();
    const translations = await loadLocale(lang);

    _vrCurrentLang = normalizeLang(lang);
    _vrCurrentDict = translations || {};

    applyTranslations(_vrCurrentDict);
    document.documentElement.lang = _vrCurrentLang;
  }

  async function setLang(lang, options = {}) {
    const l = setLocalLang(lang);
    const translations = await loadLocale(l);

    _vrCurrentLang = l;
    _vrCurrentDict = translations || {};

    applyTranslations(_vrCurrentDict);
    document.documentElement.lang = _vrCurrentLang;

    if (options.persistRemote) {
      await saveLangRemoteIfAvailable(_vrCurrentLang);
    }
    return _vrCurrentLang;
  }

  window.VRI18n = {
    // public API
    initI18n,
    setLang,
    getLang() {
      return _vrCurrentLang;
    },
    t(key) {
      if (!key) return "";
      const v = resolveKey(_vrCurrentDict || {}, key);
      return typeof v === "string" ? v : "";
    },

    // exposed helpers (debug)
    applyTranslations,
    resolveKey,
    getI18nPaths,
    VR_DEFAULT_LANG,
    VR_STORAGE_KEYS
  };

  // Backward compatible alias (used by older scripts)
  window.i18nGet = (key) => window.VRI18n.t(key);

  // auto-init
  function boot() {
    initI18n().catch(console.warn);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
