(function () {
  "use strict";

  // i18n runtime state (for tooltips + UI text)
  let _vrCurrentLang = "fr";
  let _vrCurrentDict = {};

  const VR_I18N_PATH = "i18n"; // dossier
  const VR_DEFAULT_LANG = "fr";

  const VR_STORAGE_KEYS = {
    LANG: "vr_lang"
  };

  async function loadJSON(path) {
    const res = await fetch(path);
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
  }

  async function loadLocale(lang) {
    const l = lang || VR_DEFAULT_LANG;
    return await loadJSON(`${VR_I18N_PATH}/${l}.json`);
  }

  async function initI18n() {
    let lang = localStorage.getItem(VR_STORAGE_KEYS.LANG) || VR_DEFAULT_LANG;
    const translations = await loadLocale(lang);
    _vrCurrentLang = lang || "fr";
    _vrCurrentDict = translations || {};
    applyTranslations(_vrCurrentDict);
    document.documentElement.lang = _vrCurrentLang;
  }

  window.VRI18n = {
    loadLocale,
    applyTranslations,
    resolveKey,
    initI18n,
    VR_I18N_PATH,
    VR_DEFAULT_LANG,
    VR_STORAGE_KEYS,
    // Translate a key using the currently loaded dictionary
    t(key) {
      if (!key) return "";
      const v = resolveKey(_vrCurrentDict || {}, key);
      return typeof v === "string" ? v : "";
    },
    getLang() {
      return _vrCurrentLang;
    }
  };

  // Backward compatible alias (used by older tooltip scripts)
  window.i18nGet = (key) => window.VRI18n.t(key);
})();
