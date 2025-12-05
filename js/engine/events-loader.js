// VRealms - engine/events-loader.js
// Charge la config d'univers + les cartes + les textes.

(function () {
  const CONFIG_PATH = "data/universes";
  const DECK_PATH = "data/deck_base.json";
  const CARDS_I18N_PATH = "data/i18n";

  const VREventsLoader = {
    async loadUniverseData(universeId, lang) {
      const configPromise = this._loadConfig(universeId);
      const deckPromise = this._loadDeck(universeId);
      const textsPromise = this._loadTexts(lang);

      const [config, deck, cardTexts] = await Promise.all([
        configPromise,
        deckPromise,
        textsPromise
      ]);

      return { config, deck, cardTexts };
    },

    async _loadConfig(universeId) {
      try {
        const res = await fetch(`${CONFIG_PATH}/${universeId}.config.json`, {
          cache: "no-cache"
        });
        if (!res.ok) throw new Error("config not found");
        const cfg = await res.json();
        if (!cfg || !Array.isArray(cfg.gauges)) {
          throw new Error("config invalid");
        }
        return cfg;
      } catch (e) {
        console.warn("[VREventsLoader] Config manquante pour", universeId, e);
        return null;
      }
    },

    async _loadDeck(universeId) {
      try {
        const res = await fetch(DECK_PATH, { cache: "no-cache" });
        if (!res.ok) throw new Error("deck not found");
        const data = await res.json();
        const cards = Array.isArray(data.cards) ? data.cards : [];
        return cards.filter((c) => c.universe === universeId);
      } catch (e) {
        console.warn("[VREventsLoader] Deck manquant ou invalide", e);
        return [];
      }
    },

    async _loadTexts(lang) {
      try {
        const res = await fetch(`${CARDS_I18N_PATH}/cards_${lang}.json`, {
          cache: "no-cache"
        });
        if (!res.ok) throw new Error("cards i18n not found");
        const data = await res.json();
        return data || {};
      } catch (e) {
        console.warn("[VREventsLoader] Textes de cartes manquants pour", lang, e);
        return {};
      }
    }
  };

  window.VREventsLoader = VREventsLoader;
})();
