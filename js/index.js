// VRealms - index.js : i18n + navigation de vues + choix d'univers

const VR_STORAGE_KEYS = {
  lang: "vrealms_lang",
  universe: "vrealms_universe"
};

const VR_DEFAULT_LANG = "fr";
const VR_I18N_PATH = "data/i18n";

// Charge un dictionnaire de langue
async function loadLocale(langCode) {
  try {
    const res = await fetch(`${VR_I18N_PATH}/ui_${langCode}.json`, { cache: "no-cache" });
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

// Résout une clé nested "a.b.c"
function resolveKey(dict, path) {
  return path.split(".").reduce((acc, part) => {
    if (acc && Object.prototype.hasOwnProperty.call(acc, part)) return acc[part];
    return undefined;
  }, dict);
}

// Applique les traductions à tous les [data-i18n]
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

// Vue SPA
function setView(viewId) {
  document.querySelectorAll(".vr-view").forEach((v) => v.classList.remove("vr-view-active"));
  const viewEl = document.getElementById(`view-${viewId}`);
  if (viewEl) {
    viewEl.classList.add("vr-view-active");
  }
}

// Setup nav boutons latéraux (profil / settings / shop)
function setupSideNav() {
  document.querySelectorAll("[data-view-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-view-target");
      if (!target) return;
      setView(target);
    });
  });

  // Logo renvoie à la home
  const logo = document.querySelector(".vr-logo");
  if (logo) {
    logo.addEventListener("click", () => setView("home"));
  }
}

// Gestion des univers : on sauvegarde et on passe à la vue jeu
function setupUniverseCards() {
  const cards = document.querySelectorAll(".vr-card[data-universe]");
  cards.forEach((card) => {
    card.addEventListener("click", () => {
      if (card.disabled) return;
      const universeId = card.getAttribute("data-universe");
      if (!universeId) return;

      localStorage.setItem(VR_STORAGE_KEYS.universe, universeId);

      // On laisse game.js initialiser le moteur
      setView("game");
      if (window.VRGame && typeof window.VRGame.onUniverseSelected === "function") {
        window.VRGame.onUniverseSelected(universeId);
      }
    });
  });
}

// Initialisation globale
async function initIndex() {
  const langSelect = document.getElementById("lang-select");
  const savedLang = localStorage.getItem(VR_STORAGE_KEYS.lang) || VR_DEFAULT_LANG;
  langSelect.value = savedLang;

  const dict = await loadLocale(savedLang);
  applyTranslations(dict);

  langSelect.addEventListener("change", async (e) => {
    const newLang = e.target.value;
    localStorage.setItem(VR_STORAGE_KEYS.lang, newLang);
    const newDict = await loadLocale(newLang);
    applyTranslations(newDict);
  });

  setupSideNav();
  setupUniverseCards();
}

document.addEventListener("DOMContentLoaded", initIndex);
