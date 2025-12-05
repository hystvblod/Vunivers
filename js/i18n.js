// VRealms - i18n.js
// Gère les textes d'interface (UI) et la langue active.

(function () {
  const VR_I18N_PATH = "data/i18n";
  const VR_DEFAULT_LANG = "fr";

  const VR_STORAGE_KEYS = {
    lang: "vrealms_lang",
    universe: "vrealms_universe"
  };

  async function loadLocale(langCode) {
    try {
      const res = await fetch(`${VR_I18N_PATH}/ui_${langCode}.json`, {
        cache: "no-cache"
      });
      if (!res.ok) throw new Error("i18n not found");
      return await res.json();
    } catch (e) {
      console.error("Erreur i18n", e);
      if (langCode !== VR_DEFAULT_LANG) {
        return loadLocale(VR_DEFAULT_LANG);
      }
      return {};
    }
  }

  function resolveKey(dict, path) {
    return path.split(".").reduce((acc, part) => {
      if (acc && Object.prototype.hasOwnProperty.call(acc, part)) return acc[part];
      return undefined;
    }, dict);
  }

  function applyTranslations(dict) {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      const text = resolveKey(dict, key);
      if (typeof text === "string") {
        el.textContent = text;
      }
    });
  }

  async function initI18n() {
    const langSelect = document.getElementById("lang-select");
    const savedLang =
      localStorage.getItem(VR_STORAGE_KEYS.lang) || VR_DEFAULT_LANG;

    if (langSelect) {
      langSelect.value = savedLang;
    }

    const dict = await loadLocale(savedLang);
    applyTranslations(dict);

    if (langSelect) {
      langSelect.addEventListener("change", async (e) => {
        const newLang = e.target.value;
        localStorage.setItem(VR_STORAGE_KEYS.lang, newLang);
        const newDict = await loadLocale(newLang);
        applyTranslations(newDict);
      });
    }

    return savedLang;
  }

  window.VRI18n = {
    loadLocale,
    applyTranslations,
    resolveKey,
    initI18n,
    VR_I18N_PATH,
    VR_DEFAULT_LANG,
    VR_STORAGE_KEYS
  };

  window.VR_STORAGE_KEYS = VR_STORAGE_KEYS;
  window.VR_DEFAULT_LANG = VR_DEFAULT_LANG;
})();
