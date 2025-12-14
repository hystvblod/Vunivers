// VRealms - engine/events-loader.js
// Charge la config d'univers + le deck (par univers) + les textes des cartes (par univers + langue).

(function () {
  const CONFIG_PATH = "data/universes";
  const DECKS_PATH = "data/decks";
  const CARDS_I18N_PATH = "data/i18n";

  const VREventsLoader = {
    async loadUniverseData(universeId, lang) {
      const configPromise = this._loadConfig(universeId);
      const deckPromise = this._loadDeck(universeId);
      const textsPromise = this._loadCardTexts(universeId, lang);

      const [config, deck, cardTexts] = await Promise.all([
        configPromise,
        deckPromise,
        textsPromise
      ]);

      return { config, deck, cardTexts };
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
      const res = await fetch(`${DECKS_PATH}/${universeId}.json`, { cache: "no-cache" });
      if (!res.ok) {
        throw new Error(
          `[VREventsLoader] Impossible de charger le deck: ${DECKS_PATH}/${universeId}.json`
        );
      }

      const deckJson = await res.json();

      // Supporte 2 formats :
      // 1) { "cards": [ ... ] }
      // 2) [ ... ] (array direct)
      const cards = Array.isArray(deckJson) ? deckJson : (deckJson?.cards || null);

      if (!Array.isArray(cards)) {
        throw new Error(
          `[VREventsLoader] Deck invalide pour ${universeId} (attendu array ou {cards:[]}).`
        );
      }
      return cards;
    },

    async _loadCardTexts(universeId, lang) {
      const res = await fetch(`${CARDS_I18N_PATH}/cards_${universeId}_${lang}.json`, {
        cache: "no-cache"
      });
      if (!res.ok) {
        throw new Error(
          `[VREventsLoader] Impossible de charger cards_${universeId}_${lang}.json`
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
  const DRAG_THRESHOLD = 60;

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

        // ✅ label par langue si dispo
        const label =
          cfg?.[`label_${this.lang}`] ||
          cfg?.label ||
          cfg?.id;

        if (labelEl) labelEl.textContent = label || "—";
        if (fillEl) fillEl.dataset.gaugeId = cfg.id;
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
        const gaugeId = fillEl.dataset.gaugeId || gaugesCfg[idx]?.id || null;
        if (!gaugeId) return;
        const val = window.VRState.getGaugeValue(gaugeId) ?? gaugesCfg[idx]?.start ?? 50;
        fillEl.style.width = `${val}%`;
      });

      const previewEls = document.querySelectorAll(".vr-gauge-preview");
      previewEls.forEach((previewEl) => (previewEl.style.width = "0%"));
    },

    showCard(cardLogic) {
      this.currentCardLogic = cardLogic;
      const texts = this.cardTextsDict?.[cardLogic.id];
      if (!texts) {
        console.error("[VRUIBinding] Textes introuvables pour la carte", cardLogic.id);
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
      // ✅ Seulement les 3 choix (A/B/C), pas le bouton "restart"
      const buttons = Array.from(
        document.querySelectorAll(".vr-choice-button[data-choice]")
      );

      buttons.forEach((btn) => {
        // Tap = valide
        btn.addEventListener("click", () => {
          const choiceId = btn.getAttribute("data-choice");
          if (!choiceId) return;
          if (!this.currentCardLogic) return;
          window.VREngine.applyChoice(this.currentCardLogic, choiceId);
        });

        // ✅ Swipe sur la cartouche = valide aussi le choix
        this._setupChoiceSwipe(btn);
      });

      // On garde aussi le swipe sur la carte scénario (A à gauche / C à droite)
      this._setupCardDrag();
    },

    _setupChoiceSwipe(btn) {
      const TH = 50;
      let startX = 0;
      let currentX = 0;
      let dragging = false;

      const getX = (e) => e.clientX || e.touches?.[0]?.clientX || 0;

      const onDown = (e) => {
        if (!this.currentCardLogic) return;
        dragging = true;
        startX = getX(e);
        currentX = startX;

        try { btn.setPointerCapture?.(e.pointerId); } catch (_) {}
        btn.classList.add("vr-choice-dragging");
      };

      const onMove = (e) => {
        if (!dragging) return;
        currentX = getX(e);
        const delta = currentX - startX;
        btn.style.transform = `translateX(${delta}px)`;
      };

      const onUp = () => {
        if (!dragging) return;
        dragging = false;

        const delta = currentX - startX;
        btn.classList.remove("vr-choice-dragging");
        btn.style.transform = "";

        if (Math.abs(delta) >= TH && this.currentCardLogic) {
          const choiceId = btn.getAttribute("data-choice");
          if (choiceId) window.VREngine.applyChoice(this.currentCardLogic, choiceId);
        }
      };

      btn.addEventListener("pointerdown", onDown);
      btn.addEventListener("pointermove", onMove);
      btn.addEventListener("pointerup", onUp);
      btn.addEventListener("pointercancel", onUp);

      btn.addEventListener("touchstart", (e) => onDown(e));
      btn.addEventListener("touchmove", (e) => onMove(e));
      btn.addEventListener("touchend", onUp);
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

      card.addEventListener("touchstart", (e) => onPointerDown(e.touches[0]));
      card.addEventListener("touchmove", (e) => onPointerMove(e.touches[0]));
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
          const d = this.currentCardLogic.choices[dragChoice].gaugeDelta?.[gaugeId];
          if (typeof d === "number") delta = d;
        }
        const previewVal = Math.max(0, Math.min(100, baseVal + delta));
        previewEl.style.width = `${previewVal}%`;
      });
    }
  };

  window.VRUIBinding = VRUIBinding;
})();


// VRealms - engine/state.js
(function () {
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

  const VRState = {
    universeId: null,
    gauges: {},
    gaugeOrder: [],
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

    isAlive() { return this.alive; },
    getGaugeValue(id) { return this.gauges[id]; },

    applyDeltas(deltaMap) {
      if (!this.alive) return;

      Object.entries(deltaMap || {}).forEach(([gaugeId, delta]) => {
        const current = this.gauges[gaugeId] ?? 50;
        const next = clamp(current + delta, 0, 100);
        this.gauges[gaugeId] = next;
      });

      this.lastDeath = null;
      for (const gaugeId of Object.keys(this.gauges)) {
        const v = this.gauges[gaugeId];
        if (v <= 0) { this.alive = false; this.lastDeath = { gaugeId, direction: "down" }; break; }
        if (v >= 100) { this.alive = false; this.lastDeath = { gaugeId, direction: "up" }; break; }
      }
    },

    tickYear() { if (this.alive) this.reignYears += 1; },
    getReignYears() { return this.reignYears; },
    incrementCardsPlayed() { this.cardsPlayed += 1; },
    getLastDeath() { return this.lastDeath; }
  };

  window.VRState = VRState;
})();


// VRealms - engine/endings.js (dans game.js)
(function () {
  const ENDINGS_BASE_PATH = "data/i18n";
  const cache = new Map(); // key = universeId__lang

  async function loadEndings(universeId, lang) {
    const key = `${universeId}__${lang}`;
    if (cache.has(key)) return cache.get(key);

    const url = `${ENDINGS_BASE_PATH}/endings_${universeId}_${lang}.json`;
    const res = await fetch(url, { cache: "no-cache" });

    // Si le fichier n'existe pas, on ne crash pas : on met endings vides.
    if (!res.ok) {
      const empty = {};
      cache.set(key, empty);
      return empty;
    }

    const data = await res.json();
    const safe = data && typeof data === "object" ? data : {};
    cache.set(key, safe);
    return safe;
  }

  async function showEnding(universeConfig, lastDeath) {
    const overlay = document.getElementById("vr-ending-overlay");
    const titleEl = document.getElementById("ending-title");
    const textEl = document.getElementById("ending-text");

    if (!overlay || !titleEl || !textEl) return;

    const universeId =
      universeConfig?.id || localStorage.getItem("vrealms_universe") || "hell_king";
    const lang = localStorage.getItem("vrealms_lang") || "fr";

    const endings = await loadEndings(universeId, lang);

    const key = lastDeath?.gaugeId
      ? `${lastDeath.gaugeId}_${lastDeath.direction}`
      : "default";

    const ending = endings[key] || endings["default"];

    titleEl.textContent = ending?.title || "Fin du règne";
    textEl.textContent = ending?.text || "Votre règne s'achève ici.";

    overlay.classList.add("vr-ending-visible");
  }

  function hideEnding() {
    const overlay = document.getElementById("vr-ending-overlay");
    if (!overlay) return;
    overlay.classList.remove("vr-ending-visible");
  }

  window.VREndings = { showEnding, hideEnding };
})();


// VRealms - engine/engine-core.js
(function () {
  const RECENT_MEMORY_SIZE = 4;
  const BASE_COINS_PER_CARD = 5;
  const STREAK_STEP = 10;
  const STREAK_BONUS = 25;

  const HELL_KING_DYNASTIES = ["Lucifer","Belzebuth","Lilith","Asmodée","Mammon","Baal","Astaroth","Abaddon"];

  function getDynastyName(reignIndex) {
    const baseName = HELL_KING_DYNASTIES[reignIndex % HELL_KING_DYNASTIES.length];
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
      if (!window.VRState.isAlive()) return;

      const candidates = this.deck.filter((c) => !this.recentCards.includes(c.id));
      let card = candidates[Math.floor(Math.random() * candidates.length)];

      if (!card) {
        const cardIds = this.deck.map((c) => c.id);
        const randomId = cardIds[Math.floor(Math.random() * cardIds.length)];
        card = this.deck.find((c) => c.id === randomId);
      }
      if (!card) return;

      this.currentCardLogic = card;
      this._rememberCard(card.id);
      window.VRState.incrementCardsPlayed();
      window.VRUIBinding.showCard(card);
    },

    _rememberCard(cardId) {
      this.recentCards.push(cardId);
      if (this.recentCards.length > RECENT_MEMORY_SIZE) this.recentCards.shift();
    },

    applyChoice(cardLogic, choiceId) {
      if (!cardLogic || !cardLogic.choices || !cardLogic.choices[choiceId]) return;

      const choiceData = cardLogic.choices[choiceId];
      const deltas = choiceData.gaugeDelta || {};
      window.VRState.applyDeltas(deltas);

      this.coinsStreak += 1;
      const user = window.VUserData.load();
      user.vcoins += BASE_COINS_PER_CARD;
      if (this.coinsStreak > 0 && this.coinsStreak % STREAK_STEP === 0) user.vcoins += STREAK_BONUS;
      window.VUserData.save(user);

      window.VRGame?.onCardResolved?.();
      window.VRState.tickYear();

      const years = window.VRState.getReignYears();
      const kingName = getDynastyName(this.reignIndex - 1);
      const userAfter = window.VUserData.load();
      window.VRUIBinding.updateMeta(kingName, years, userAfter.vcoins);
      window.VRUIBinding.updateGauges();

      if (!window.VRState.isAlive()) this._handleDeath();
      else this._nextCard();
    },

    async _handleDeath() {
      const lastDeath = window.VRState.getLastDeath();
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
window.VRGame = {
  currentUniverse: null,
  session: { reignLength: 0 },

  async onUniverseSelected(universeId) {
    this.currentUniverse = universeId;
    this.session.reignLength = 0;

    this.applyUniverseBackground(universeId);

    const lang = localStorage.getItem("vrealms_lang") || "fr";
    try { await window.VREngine.init(universeId, lang); }
    catch (e) { console.error("[VRGame] Erreur init moteur:", e); }
  },

  applyUniverseBackground(universeId) {
    const viewGame = document.getElementById("view-game");
    if (!viewGame) return;

    // ✅ pour CSS variables univers
    if (universeId) document.body.dataset.universe = universeId;
    else delete document.body.dataset.universe;

    // legacy classes (on garde)
    viewGame.classList.remove(
      "vr-bg-hell_king","vr-bg-heaven_king","vr-bg-medieval_king",
      "vr-bg-western_president","vr-bg-mega_corp_ceo","vr-bg-new_world_explorer","vr-bg-vampire_lord"
    );
    if (universeId) viewGame.classList.add(`vr-bg-${universeId}`);
  },

  onCardResolved() {
    this.session.reignLength += 1;
    const user = window.VUserData.load();
    user.vcoins += 1;
    window.VUserData.save(user);
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
  }
};


// ===== Init page jeu seule (game.html) =====
(function () {
  async function initApp() {
    try {
      if (window.VRI18n && typeof window.VRI18n.initI18n === "function") {
        await window.VRI18n.initI18n();
      }
    } catch (e) {
      console.error("[VRealms] Erreur init i18n:", e);
    }

    const hasGameView = !!document.getElementById("view-game");
    if (!hasGameView) return;

    const universeId = localStorage.getItem("vrealms_universe") || "hell_king";
    if (window.VRGame && typeof window.VRGame.onUniverseSelected === "function") {
      window.VRGame.onUniverseSelected(universeId);
    }
  }

  document.addEventListener("DOMContentLoaded", initApp);
})();
