(function () {
  "use strict";

  // === CONFIG ===
  const BASE_PATH = "data/ui";
  const DEFAULT_LANG = "en";
  const STORAGE_KEY = "vuniverse_lang";
  const LEGACY_STORAGE_KEY = "vrealms_lang";

  // ✅ on ne charge PLUS "cards" / "endings" ici
  // (les cartes et les fins sont chargées par le moteur: events-loader + VREndings)
  const UI_BUNDLES = ["ui"];

  let _lang = DEFAULT_LANG;
  let _dict = {};

  function normalizeLang(raw) {
    const s0 = String(raw || "").trim().toLowerCase();
    if (!s0) return DEFAULT_LANG;

    if (s0 === "pt-br" || s0 === "ptbr") return "ptbr";
    if (s0 === "pt-pt" || s0 === "pt_pt") return "pt";
    if (s0 === "jp" || s0 === "ja-jp") return "ja";
    if (s0 === "kr" || s0 === "ko-kr") return "ko";
    if (s0 === "in" || s0 === "id-id") return "id";

    const base = s0.split(/[-_]/)[0];
    if (base === "pt" && (s0.includes("br") || s0.includes("ptbr"))) return "ptbr";
    return base || DEFAULT_LANG;
  }

  function deepMerge(target, source) {
    if (!source || typeof source !== "object") return target;
    for (const k of Object.keys(source)) {
      const sv = source[k];
      const tv = target[k];
      if (sv && typeof sv === "object" && !Array.isArray(sv)) {
        target[k] = deepMerge(tv && typeof tv === "object" ? tv : {}, sv);
      } else {
        target[k] = sv;
      }
    }
    return target;
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`i18n fetch failed: ${url} (${res.status})`);
    return res.json();
  }

async function tryLoadUiBundle(bundle, lang) {
  // ✅ nouveau format voulu : data/ui/ui_fr.json
  const urlNew = `${BASE_PATH}/${bundle}_${lang}.json`;

  // ✅ fallback anciens formats pendant la transition
  const urlOld1 = `data/i18n/${lang}/${bundle}.json`;
  const urlOld2 = `data/i18n/${bundle}_${lang}.json`;

  try {
    return await fetchJson(urlNew);
  } catch (_) {
    try {
      return await fetchJson(urlOld1);
    } catch (__) {
      try {
        return await fetchJson(urlOld2);
      } catch (___) {
        return null;
      }
    }
  }
}

  async function loadUi(lang) {
    const l = normalizeLang(lang);

    // 1) tente la langue demandée
    const out = {};
    for (const b of UI_BUNDLES) {
      const j = await tryLoadUiBundle(b, l);
      if (j) deepMerge(out, j);
    }

    // 2) fallback sur fr si rien n’a chargé
    if (Object.keys(out).length === 0 && l !== DEFAULT_LANG) {
      for (const b of UI_BUNDLES) {
        const j = await tryLoadUiBundle(b, DEFAULT_LANG);
        if (j) deepMerge(out, j);
      }
      return { dict: out, lang: DEFAULT_LANG };
    }

    return { dict: out, lang: l };
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
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const val = resolveKey(dict, key);
      if (typeof val === "string") el.textContent = val;
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      const val = resolveKey(dict, key);
      if (typeof val === "string") el.setAttribute("placeholder", val);
    });

    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      const val = resolveKey(dict, key);
      if (typeof val === "string") el.setAttribute("title", val);
    });

    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      const val = resolveKey(dict, key);
      if (typeof val === "string") el.setAttribute("aria-label", val);
    });
  }

  function detectDeviceLang() {
    try {
      const list = Array.isArray(navigator.languages) && navigator.languages.length
        ? navigator.languages
        : [navigator.language];

      for (const cand of list) {
        const l = normalizeLang(cand);
        if (l) return l;
      }
    } catch (_) {}

    return DEFAULT_LANG;
  }

  function getSavedLang() {
    try {
      if (window.VUserData?.load) {
        const u = window.VUserData.load();
        if (u && u.lang) return normalizeLang(u.lang);
      }
    } catch (_) {}

    try {
      const ls1 = localStorage.getItem(STORAGE_KEY);
      if (ls1) return normalizeLang(ls1);
    } catch (_) {}

    try {
      const ls2 = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (ls2) return normalizeLang(ls2);
    } catch (_) {}

    const detected = detectDeviceLang();
    try { localStorage.setItem(STORAGE_KEY, detected); } catch (_) {}
    try { localStorage.setItem(LEGACY_STORAGE_KEY, detected); } catch (_) {}
    return detected;
  }

  function saveLangLocal(lang) {
    const l = normalizeLang(lang);

    try { localStorage.setItem(STORAGE_KEY, l); } catch (_) {}
    try { localStorage.setItem(LEGACY_STORAGE_KEY, l); } catch (_) {}

    try {
      if (window.VUserData?.load && window.VUserData?.save) {
        const u = window.VUserData.load();
        window.VUserData.save({ ...u, lang: l });
      }
    } catch (_) {}

    return l;
  }

  async function initI18n() {
    const wanted = getSavedLang();
    const { dict, lang } = await loadUi(wanted);

    _lang = lang || wanted || DEFAULT_LANG;
    _dict = dict || {};

    applyTranslations(_dict);
    document.documentElement.lang = _lang;

    return _lang;
  }

  async function setLang(lang) {
    const l = saveLangLocal(lang);
    const { dict, lang: resolvedLang } = await loadUi(l);

    _lang = resolvedLang || l;
    _dict = dict || {};

    applyTranslations(_dict);
    document.documentElement.lang = _lang;

    // hook remote (plus tard)
    try {
      if (window.VRRemoteStore?.setLang) await window.VRRemoteStore.setLang(_lang);
    } catch (e) {
      console.warn("[VRI18n] saveLang remote failed", e);
    }

    return _lang;
  }

  window.VRI18n = {
    initI18n,
    setLang,
    getLang: () => _lang,
    t: (key) => {
      const v = resolveKey(_dict, key);
      return typeof v === "string" ? v : "";
    }
  };

  // auto init
  function boot() {
    initI18n().catch(console.warn);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
