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

      return {
        config,
        deck,
        cardTexts
      };
    },

    async _loadConfig(universeId) {
      const res = await fetch(`${CONFIG_PATH}/${universeId}.config.json`, {
        cache: "no-cache"
      });
      if (!res.ok) {
        throw new Error(
          `[VREventsLoader] Impossible de charger la config univers ${universeId}`
        );
      }
      return res.json();
    },

    async _loadDeck(universeId) {
      const res = await fetch(DECK_PATH, { cache: "no-cache" });
      if (!res.ok) {
        throw new Error("[VREventsLoader] Impossible de charger deck_base.json");
      }
      const deckJson = await res.json();
      if (!deckJson || deckJson.universe !== universeId) {
        console.warn(
          "[VREventsLoader] Avertissement : universe du deck != universeId",
          deckJson?.universe,
          universeId
        );
      }
      return deckJson.cards || [];
    },

    async _loadTexts(lang) {
      // cards_fr.json, cards_en.json, etc.
      const res = await fetch(`${CARDS_I18N_PATH}/cards_${lang}.json`, {
        cache: "no-cache"
      });
      if (!res.ok) {
        throw new Error(
          `[VREventsLoader] Impossible de charger cards_${lang}.json`
        );
      }
      return res.json();
    }
  };

  window.VREventsLoader = VREventsLoader;
})();


// VRealms - engine/ui-binding.js
// Fait le lien moteur ↔ interface (jauges, carte, choix + preview + swipe).

(function () {
  const DRAG_THRESHOLD = 60; // px pour valider un choix

  const VRUIBinding = {
    updateMeta(kingName, years, coins) {
      const kingEl = document.getElementById("meta-king-name");
      const yearsEl = document.getElementById("meta-years");
      const coinsEl = document.getElementById("meta-coins");

      if (kingEl) kingEl.textContent = kingName || "—";
      if (yearsEl) yearsEl.textContent = (years || 0) + " ans";
      if (coinsEl) coinsEl.textContent = (coins || 0) + " VCoins";
    },

    universeConfig: null,
    lang: "fr",
    currentCardLogic: null,
    cardTextsDict: null,

    init(universeConfig, lang, cardTextsDict) {
      this.universeConfig = universeConfig;
      this.lang = lang;
      this.cardTextsDict = cardTextsDict;

      this._setupGaugeLabels();
      this._ensureGaugePreviewBars();
      this.updateGauges();
      this._setupChoiceButtons();
    },

    _setupGaugeLabels() {
      const gaugesCfg = this.universeConfig?.gauges || [];
      const gaugeEls = document.querySelectorAll(".vr-gauge");

      gaugeEls.forEach((el, idx) => {
        const labelEl = el.querySelector(".vr-gauge-label");
        const fillEl = el.querySelector(".vr-gauge-fill");
        const cfg = gaugesCfg[idx];

        if (!cfg) return;
        if (labelEl) {
          labelEl.textContent = cfg.label || cfg.id;
        }
        if (fillEl) {
          fillEl.dataset.gaugeId = cfg.id;
        }
      });
    },

    _ensureGaugePreviewBars() {
      const gaugeEls = document.querySelectorAll(".vr-gauge");
      gaugeEls.forEach((el) => {
        let preview = el.querySelector(".vr-gauge-preview");
        if (!preview) {
          preview = document.createElement("div");
          preview.className = "vr-gauge-preview";
          preview.style.width = "0%";
          el.querySelector(".vr-gauge-frame")?.appendChild(preview);
        }
      });
    },

    updateGauges() {
      const gaugesCfg = this.universeConfig?.gauges || [];
      const fillEls = document.querySelectorAll(".vr-gauge-fill");

      fillEls.forEach((fillEl, idx) => {
        const gaugeId =
          fillEl.dataset.gaugeId || gaugesCfg[idx]?.id || null;
        if (!gaugeId) return;
        const val =
          window.VRState.getGaugeValue(gaugeId) ?? gaugesCfg[idx]?.start ?? 50;
        fillEl.style.width = `${val}%`;
      });

      // reset preview
      const previewEls = document.querySelectorAll(".vr-gauge-preview");
      previewEls.forEach((previewEl) => {
        previewEl.style.width = "0%";
      });
    },

    showCard(cardLogic) {
      this.currentCardLogic = cardLogic;
      const texts = this.cardTextsDict?.[cardLogic.id];
      if (!texts) {
        console.error(
          "[VRUIBinding] Textes introuvables pour la carte",
          cardLogic.id
        );
        return;
      }

      const titleEl = document.getElementById("card-title");
      const bodyEl = document.getElementById("card-text");
      const choiceAEl = document.getElementById("choice-A");
      const choiceBEl = document.getElementById("choice-B");
      const choiceCEl = document.getElementById("choice-C");

      if (titleEl) titleEl.textContent = texts.title || "";
      if (bodyEl) bodyEl.textContent = texts.body || "";
      if (choiceAEl) choiceAEl.textContent = texts.choices?.A || "Choix A";
      if (choiceBEl) choiceBEl.textContent = texts.choices?.B || "Choix B";
      if (choiceCEl) choiceCEl.textContent = texts.choices?.C || "Choix C";

      this._resetCardPosition();
    },

    _resetCardPosition() {
      const card = document.getElementById("vr-card-main");
      if (!card) return;
      card.style.transform = "";
      card.dataset.dragChoice = "";
    },

    _setupChoiceButtons() {
      const buttons = document.querySelectorAll(".vr-choice-button");
      buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const choiceId = btn.getAttribute("data-choice");
          if (!choiceId) return;
          if (!this.currentCardLogic) return;
          window.VREngine.applyChoice(this.currentCardLogic, choiceId);
        });
      });

      this._setupCardDrag();
    },

    _setupCardDrag() {
      const card = document.getElementById("vr-card-main");
      if (!card) return;

      let startX = 0;
      let currentX = 0;
      let dragging = false;

      const onPointerDown = (e) => {
        dragging = true;
        startX = e.clientX || e.touches?.[0]?.clientX || 0;
        currentX = startX;
        card.setPointerCapture?.(e.pointerId || 1);
        card.classList.add("vr-card-dragging");
      };

      const onPointerMove = (e) => {
        if (!dragging) return;
        const x = e.clientX || e.touches?.[0]?.clientX || 0;
        const delta = x - startX;
        currentX = x;

        card.style.transform = `translateX(${delta}px) rotate(${delta * 0.05}deg)`;

        const dragChoice =
          delta > DRAG_THRESHOLD ? "C" : delta < -DRAG_THRESHOLD ? "A" : "";

        card.dataset.dragChoice = dragChoice;
        this._updatePreviewFromDrag(dragChoice);
      };

      const onPointerUp = () => {
        if (!dragging) return;
        dragging = false;

        const delta = currentX - startX;
        const dragChoice =
          delta > DRAG_THRESHOLD ? "C" : delta < -DRAG_THRESHOLD ? "A" : "";

        card.classList.remove("vr-card-dragging");
        card.style.transform = "";
        card.dataset.dragChoice = "";

        this._updatePreviewFromDrag("");

        if (dragChoice && this.currentCardLogic) {
          window.VREngine.applyChoice(this.currentCardLogic, dragChoice);
        }
      };

      card.addEventListener("pointerdown", onPointerDown);
      card.addEventListener("pointermove", onPointerMove);
      card.addEventListener("pointerup", onPointerUp);
      card.addEventListener("pointercancel", onPointerUp);
      card.addEventListener("pointerleave", onPointerUp);

      card.addEventListener("touchstart", (e) => {
        onPointerDown(e.touches[0]);
      });
      card.addEventListener("touchmove", (e) => {
        onPointerMove(e.touches[0]);
      });
      card.addEventListener("touchend", onPointerUp);
    },

    _updatePreviewFromDrag(dragChoice) {
      const gaugesCfg = this.universeConfig?.gauges || [];
      const previewEls = document.querySelectorAll(".vr-gauge-preview");
      previewEls.forEach((previewEl, idx) => {
        const cfg = gaugesCfg[idx];
        if (!cfg) return;
        const gaugeId = cfg.id;
        const baseVal = window.VRState.getGaugeValue(gaugeId) ?? cfg.start ?? 50;

        let delta = 0;
        if (dragChoice && this.currentCardLogic?.choices?.[dragChoice]) {
          const d =
            this.currentCardLogic.choices[dragChoice].gaugeDelta?.[gaugeId];
          if (typeof d === "number") {
            delta = d;
          }
        }
        const previewVal = Math.max(0, Math.min(100, baseVal + delta));
        previewEl.style.width = `${previewVal}%`;
      });
    }
  };

  window.VRUIBinding = VRUIBinding;
})();


// VRealms - engine/state.js
// Gère l'état de la partie : jauges, univers, vie/mort.

(function () {
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

  const VRState = {
    universeId: null,
    gauges: {},     // ex: { souls: 50, legions: 50, order: 50, surface: 50 }
    gaugeOrder: [], // ex: ["souls", "legions", "order", "surface"]
    alive: false,
    lastDeath: null,
    reignYears: 0,
    cardsPlayed: 0,

    initUniverse(universeConfig) {
      this.universeId = universeConfig.id;
      this.gauges = {};
      this.gaugeOrder = [];
      this.alive = true;
      this.lastDeath = null;
      this.reignYears = 0;
      this.cardsPlayed = 0;

      (universeConfig.gauges || []).forEach((g) => {
        this.gauges[g.id] = g.start ?? 50;
        this.gaugeOrder.push(g.id);
      });
    },

    isAlive() {
      return this.alive;
    },

    getGaugeValue(id) {
      return this.gauges[id];
    },

    applyDeltas(deltaMap) {
      if (!this.alive) return;

      Object.entries(deltaMap || {}).forEach(([gaugeId, delta]) => {
        const current = this.gauges[gaugeId] ?? 50;
        const next = clamp(current + delta, 0, 100);
        this.gauges[gaugeId] = next;
      });

      // Vérifie la mort ET enregistre la cause
      this.lastDeath = null;
      for (const gaugeId of Object.keys(this.gauges)) {
        const v = this.gauges[gaugeId];
        if (v <= 0) {
          this.alive = false;
          this.lastDeath = { gaugeId, direction: "down" };
          break;
        }
        if (v >= 100) {
          this.alive = false;
          this.lastDeath = { gaugeId, direction: "up" };
          break;
        }
      }
    },

    tickYear() {
      if (!this.alive) return;
      this.reignYears += 1;
    },

    getReignYears() {
      return this.reignYears;
    },

    getCardsPlayed() {
      return this.cardsPlayed;
    },

    incrementCardsPlayed() {
      this.cardsPlayed += 1;
    },

    getLastDeath() {
      return this.lastDeath;
    }
  };

  window.VRState = VRState;
})();


// VRealms - engine/endings.js
// Affiche une fin en fonction de la jauge qui a explosé (0 ou 100).

(function () {
  const ENDINGS_I18N_PATH = "data/i18n/endings_fr.json";

  let endingsData = null;

  async function loadEndings() {
    if (endingsData) return endingsData;
    const res = await fetch(ENDINGS_I18N_PATH, { cache: "no-cache" });
    if (!res.ok) {
      console.warn("[VREndings] Impossible de charger endings_fr.json");
      endingsData = {};
      return endingsData;
    }
    endingsData = await res.json();
    return endingsData;
  }

  async function showEnding(universeConfig, lastDeath) {
    const overlay = document.getElementById("vr-ending-overlay");
    const titleEl = document.getElementById("ending-title");
    const textEl = document.getElementById("ending-text");

    if (!overlay || !titleEl || !textEl) {
      console.error("[VREndings] Éléments de fin manquants dans le DOM");
      return;
    }

    const data = await loadEndings();
    const universeEndings = data[universeConfig.id] || {};
    const key = lastDeath?.gaugeId
      ? `${lastDeath.gaugeId}_${lastDeath.direction}`
      : "default";
    const ending = universeEndings[key] || universeEndings["default"];

    if (!ending) {
      titleEl.textContent = "Fin du règne";
      textEl.textContent =
        "Votre règne s'achève ici. Les légendes se chargeront de raconter le reste.";
    } else {
      titleEl.textContent = ending.title || "Fin du règne";
      textEl.textContent = ending.text || "";
    }

    overlay.classList.add("vr-ending-visible");
  }

  function hideEnding() {
    const overlay = document.getElementById("vr-ending-overlay");
    if (!overlay) return;
    overlay.classList.remove("vr-ending-visible");
  }

  window.VREndings = {
    showEnding,
    hideEnding
  };
})();


// VRealms - engine/engine-core.js
// Moteur : init univers, tirer des cartes, appliquer les choix, gérer roi/temps/VCoins.

(function () {
  const RECENT_MEMORY_SIZE = 4; // éviter de revoir 4 cartes de suite
  const BASE_COINS_PER_CARD = 5;
  const STREAK_STEP = 10;       // bonus tous les 10 choix d'affilée
  const STREAK_BONUS = 25;

  // Dynasties pour l'univers Roi des Enfers
  const HELL_KING_DYNASTIES = [
    "Lucifer",
    "Belzebuth",
    "Lilith",
    "Asmodée",
    "Mammon",
    "Baal",
    "Astaroth",
    "Abaddon"
  ];

  function getDynastyName(reignIndex) {
    const baseName =
      HELL_KING_DYNASTIES[reignIndex % HELL_KING_DYNASTIES.length];
    const number = Math.floor(reignIndex / HELL_KING_DYNASTIES.length) + 1;
    return `${baseName} ${number}`;
  }

  const VREngine = {
    universeId: null,
    universeConfig: null,
    deck: [],
    cardTextsDict: {},
    currentCardLogic: null,
    recentCards: [],
    reignIndex: 0,
    coinsStreak: 0,
    lang: "fr",

    async init(universeId, lang) {
      this.universeId = universeId;
      this.lang = lang || "fr";

      const { config, deck, cardTexts } =
        await window.VREventsLoader.loadUniverseData(universeId, this.lang);

      this.universeConfig = config;
      this.deck = deck || [];
      this.cardTextsDict = cardTexts || {};
      this.recentCards = [];
      this.reignIndex = 0;
      this.coinsStreak = 0;

      window.VRState.initUniverse(this.universeConfig);
      window.VRUIBinding.init(this.universeConfig, this.lang, this.cardTextsDict);

      this._startNewReign();
    },

    _startNewReign() {
      this.reignIndex += 1;
      window.VRState.alive = true;
      window.VRState.reignYears = 0;
      window.VRState.cardsPlayed = 0;

      const kingName = getDynastyName(this.reignIndex - 1);
      const years = window.VRState.getReignYears();
      const user = window.VUserData.load();
      const coins = user.vcoins;

      window.VRUIBinding.updateMeta(kingName, years, coins);
      this._nextCard();
    },

    _nextCard() {
      if (!window.VRState.isAlive()) {
        this._handleDeath();
        return;
      }

      const candidates = this.deck.filter(
        (c) => !this.recentCards.includes(c.id)
      );

      let card =
        candidates[Math.floor(Math.random() * candidates.length)];
      if (!card) {
        const cardIds = this.deck.map((c) => c.id);
        const randomId = cardIds[Math.floor(Math.random() * cardIds.length)];
        card = this.deck.find((c) => c.id === randomId);
      }

      if (!card) {
        console.error("[VREngine] Aucune carte disponible.");
        return;
      }

      this.currentCardLogic = card;
      this._rememberCard(card.id);
      window.VRState.incrementCardsPlayed();
      window.VRUIBinding.showCard(card);
    },

    _rememberCard(cardId) {
      this.recentCards.push(cardId);
      if (this.recentCards.length > RECENT_MEMORY_SIZE) {
        this.recentCards.shift();
      }
    },

    applyChoice(cardLogic, choiceId) {
      if (!cardLogic || !cardLogic.choices || !cardLogic.choices[choiceId]) {
        console.error("[VREngine] Choix invalide:", cardLogic, choiceId);
        return;
      }

      const choiceData = cardLogic.choices[choiceId];

      const deltas = choiceData.gaugeDelta || {};
      window.VRState.applyDeltas(deltas);

      this.coinsStreak += 1;
      const user = window.VUserData.load();
      user.vcoins += BASE_COINS_PER_CARD;
      if (this.coinsStreak > 0 && this.coinsStreak % STREAK_STEP === 0) {
        user.vcoins += STREAK_BONUS;
      }
      window.VUserData.save(user);

      window.VRGame?.onCardResolved?.();

      window.VRState.tickYear();

      const years = window.VRState.getReignYears();
      const kingName = getDynastyName(this.reignIndex - 1);
      const userAfter = window.VUserData.load();
      const coinsAfter = userAfter.vcoins;
      window.VRUIBinding.updateMeta(kingName, years, coinsAfter);
      window.VRUIBinding.updateGauges();

      if (!window.VRState.isAlive()) {
        this._handleDeath();
      } else {
        this._nextCard();
      }
    },

    async _handleDeath() {
      const lastDeath = window.VRState.getLastDeath();
      const user = window.VUserData.load();

      window.VRGame?.onRunEnded?.();

      await window.VREndings.showEnding(this.universeConfig, lastDeath);

      const btn = document.getElementById("ending-restart-btn");
      if (btn) {
        btn.onclick = () => {
          window.VREndings.hideEnding();
          this._startNewReign();
        };
      }

      this.coinsStreak = 0;
    }
  };

  window.VREngine = VREngine;
})();


// VRealms - game.js
// Relie l'univers choisi au moteur et gère les hooks VCoins.

window.VRGame = {
  currentUniverse: null,
  session: {
    reignLength: 0
  },

  async onUniverseSelected(universeId) {
    this.currentUniverse = universeId;
    this.session.reignLength = 0;

    // Applique le fond d'univers (CSS)
    this.applyUniverseBackground(universeId);

    const lang = localStorage.getItem("vrealms_lang") || "fr";

    try {
      await window.VREngine.init(universeId, lang);
    } catch (e) {
      console.error("[VRGame] Erreur init moteur:", e);
    }
  },

  applyUniverseBackground(universeId) {
    const viewGame = document.getElementById("view-game");
    if (!viewGame) return;

    viewGame.classList.remove(
      "vr-bg-hell_king",
      "vr-bg-heaven_king",
      "vr-bg-medieval_king",
      "vr-bg-western_president",
      "vr-bg-mega_corp_ceo",
      "vr-bg-new_world_explorer",
      "vr-bg-vampire_lord"
    );

    if (universeId) {
      viewGame.classList.add(`vr-bg-${universeId}`);
    }
  },

  onCardResolved() {
    this.session.reignLength += 1;
    const user = window.VUserData.load();
    user.vcoins += 1; // 1 VCoin par choix
    window.VUserData.save(user);
    console.log("[VRGame] Carte résolue, VCoins =", user.vcoins);
  },

  onRunEnded() {
    const bonus = this.session.reignLength;
    const user = window.VUserData.load();
    user.vcoins += bonus;
    user.stats.totalRuns += 1;
    if (this.session.reignLength > user.stats.bestReignLength) {
      user.stats.bestReignLength = this.session.reignLength;
    }
    window.VUserData.save(user);
    console.log("[VRGame] Fin de run - bonus VCoins:", bonus, "total =", user.vcoins);
  }
};


// ===== Navigation & initialisation (SANS SPA, pages séparées) =====

(function () {
  // 1) Boutons header (profil/settings/shop) => navigation page par page
  function bindHeaderButtons() {
    const btnProfile = document.getElementById("btn-profile");
    const btnSettings = document.getElementById("btn-settings");
    const btnShop = document.getElementById("btn-shop");

    // Tu peux changer les noms de pages si besoin
    if (btnProfile) btnProfile.addEventListener("click", () => (window.location.href = "profile.html"));
    if (btnSettings) btnSettings.addEventListener("click", () => (window.location.href = "settings.html"));
    if (btnShop) btnShop.addEventListener("click", () => (window.location.href = "shop.html"));
  }

  // 2) Sur index.html : clic univers => stocke + redirige vers game.html
  function setupUniverseCards_NoSPA() {
    const cards = document.querySelectorAll(".vr-card[data-universe]");
    if (!cards.length) return;

    cards.forEach((card) => {
      card.addEventListener("click", () => {
        if (card.disabled) return;

        const universeId = card.getAttribute("data-universe");
        if (!universeId) return;

        // Sauvegarde l'univers
        if (window.VR_STORAGE_KEYS) {
          localStorage.setItem(window.VR_STORAGE_KEYS.universe, universeId);
        } else {
          localStorage.setItem("vrealms_universe", universeId);
        }

        // ✅ plus de SPA : on va sur la page de jeu
        window.location.href = "game.html";
      });
    });
  }

  // 3) Sur game.html : on démarre directement le jeu avec l’univers stocké
  async function initGamePageIfPresent() {
    const hasGameView = !!document.getElementById("view-game");
    if (!hasGameView) return;

    // force le mode game (au cas où)
    document.body.classList.add("vr-body-game");

    let universeId = "hell_king";
    if (window.VR_STORAGE_KEYS) {
      universeId =
        localStorage.getItem(window.VR_STORAGE_KEYS.universe) || "hell_king";
    } else {
      universeId = localStorage.getItem("vrealms_universe") || "hell_king";
    }

    if (window.VRGame && typeof window.VRGame.onUniverseSelected === "function") {
      window.VRGame.onUniverseSelected(universeId);
    }
  }

  async function initApp() {
    // i18n : charge le dictionnaire et applique les textes
    try {
      if (window.VRI18n && typeof window.VRI18n.initI18n === "function") {
        await window.VRI18n.initI18n();
      }
    } catch (e) {
      console.error("[VRealms] Erreur init i18n:", e);
    }

    bindHeaderButtons();
    setupUniverseCards_NoSPA();
    initGamePageIfPresent();
  }

  document.addEventListener("DOMContentLoaded", initApp);
})();
