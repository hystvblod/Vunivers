// VRealms - engine/events-loader.js
// Charge la config d'univers + le deck (par univers) + les textes des cartes (par univers + langue).

(function () {
  "use strict";

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
      const url = `${DECKS_PATH}/${universeId}.json`;
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) {
        throw new Error(`[VREventsLoader] Impossible de charger le deck: ${url}`);
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
      // ✅ NOUVEAU FORMAT : data/i18n/<lang>/cards_<universeId>.json
      const urlNew = `${CARDS_I18N_PATH}/${lang}/cards_${universeId}.json`;

      // ✅ FALLBACK ANCIEN FORMAT : data/i18n/cards_<universeId>_<lang>.json
      const urlOld = `${CARDS_I18N_PATH}/cards_${universeId}_${lang}.json`;

      let res = await fetch(urlNew, { cache: "no-cache" });
      if (!res.ok) {
        res = await fetch(urlOld, { cache: "no-cache" });
      }
      if (!res.ok) {
        throw new Error(
          `[VREventsLoader] Impossible de charger ${urlNew} (ou fallback ${urlOld})`
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
  "use strict";

  const DRAG_THRESHOLD = 60;

  const VRUIBinding = {
    updateMeta(kingName, years, coins, tokens) {
      const kingEl = document.getElementById("meta-king-name");
      const yearsEl = document.getElementById("meta-years");
      const coinsEl = document.getElementById("meta-coins");
      const tokensEl = document.getElementById("meta-tokens");

      if (kingEl) kingEl.textContent = kingName || "—";
      if (yearsEl) yearsEl.textContent = String(years || 0);
      if (coinsEl) coinsEl.textContent = String(coins || 0);
      if (tokensEl) tokensEl.textContent = String(tokens || 0);
    },

    universeConfig: null,
    lang: "fr",
    currentCardLogic: null,
    cardTextsDict: null,

    init(universeConfig, lang, cardTextsDict) {
      this.universeConfig = universeConfig;
      this.lang = lang || "fr";
      this.cardTextsDict = cardTextsDict || {};

      this._setupGaugeLabels();
      this._ensureGaugePreviewBars();
      this.updateGauges();
      this._setupChoiceButtons();
    },

    _setupGaugeLabels() {
      const gaugesCfg = this.universeConfig?.gauges || [];
      const gaugeEls = document.querySelectorAll(".vr-gauge");
      const universeId = this.universeConfig?.id || "unknown";

      gaugeEls.forEach((el, idx) => {
        const labelEl = el.querySelector(".vr-gauge-label");
        const fillEl = el.querySelector(".vr-gauge-fill");
        const cfg = gaugesCfg[idx];
        if (!cfg) return;

        const gaugeId = cfg.id;

        // ✅ i18n prioritaire: gauges.<universeId>.<gaugeId>
        const i18nKey = `gauges.${universeId}.${gaugeId}`;
        const translated =
          window.VRI18n && typeof window.VRI18n.t === "function"
            ? window.VRI18n.t(i18nKey)
            : null;

        const label =
          (translated && translated !== i18nKey ? translated : null) ||
          cfg?.[`label_${this.lang}`] ||
          cfg?.label ||
          cfg?.id;

        if (labelEl) labelEl.textContent = label || "—";

        // ✅ id pour lire la valeur
        if (fillEl) fillEl.dataset.gaugeId = gaugeId;

        // ✅ crucial pour le CSS: .vr-gauge[data-gauge-id="souls"] etc.
        el.dataset.gaugeId = gaugeId;
      });
    },

    _ensureGaugePreviewBars() {
      const gaugeEls = document.querySelectorAll(".vr-gauge");
      gaugeEls.forEach((el) => {
        let preview = el.querySelector(".vr-gauge-preview");
        if (!preview) {
          preview = document.createElement("div");
          preview.className = "vr-gauge-preview";
          preview.style.setProperty("--vr-pct", "0%");
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

        const val =
          window.VRState.getGaugeValue(gaugeId) ??
          this.universeConfig?.initialGauges?.[gaugeId] ??
          gaugesCfg[idx]?.start ??
          50;

        // ✅ CSS fait la découpe via clip-path avec --vr-pct (ex: 50%)
        fillEl.style.setProperty("--vr-pct", `${val}%`);
      });

      // preview = 0 par défaut (sera mis à jour pendant le drag)
      const previewEls = document.querySelectorAll(".vr-gauge-preview");
      previewEls.forEach((previewEl) =>
        previewEl.style.setProperty("--vr-pct", "0%")
      );
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
      if (choiceAEl) choiceAEl.textContent = texts.choices?.A || "";
      if (choiceBEl) choiceBEl.textContent = texts.choices?.B || "";
      if (choiceCEl) choiceCEl.textContent = texts.choices?.C || "";

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
        const baseVal =
          window.VRState.getGaugeValue(gaugeId) ??
          this.universeConfig?.initialGauges?.[gaugeId] ??
          cfg.start ??
          50;

        let delta = 0;
        if (dragChoice && this.currentCardLogic?.choices?.[dragChoice]) {
          const d = this.currentCardLogic.choices[dragChoice].gaugeDelta?.[gaugeId];
          if (typeof d === "number") delta = d;
        }

        const previewVal = Math.max(0, Math.min(100, baseVal + delta));
        previewEl.style.setProperty("--vr-pct", `${previewVal}%`);
      });
    }
  };

  window.VRUIBinding = VRUIBinding;
})();


// VRealms - engine/state.js
(function () {
  "use strict";

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
        this.gauges[g.id] = universeConfig?.initialGauges?.[g.id] ?? g.start ?? 50;
        this.gaugeOrder.push(g.id);
      });
    },

    isAlive() { return this.alive; },
    getGaugeValue(id) { return this.gauges[id]; },

    setGaugeValue(id, val) {
      this.gauges[id] = clamp(Number(val ?? 50), 0, 100);
      this.lastDeath = null;
      this.alive = true;
    },

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
  "use strict";

  const ENDINGS_BASE_PATH = "data/i18n";
  const cache = new Map(); // key = universeId__lang

  async function loadEndings(universeId, lang) {
    const key = `${universeId}__${lang}`;
    if (cache.has(key)) return cache.get(key);

    // ✅ NOUVEAU FORMAT : data/i18n/<lang>/endings_<universeId>.json
    const urlNew = `${ENDINGS_BASE_PATH}/${lang}/endings_${universeId}.json`;

    // ✅ FALLBACK ANCIEN FORMAT : data/i18n/endings_<universeId>_<lang>.json
    const urlOld = `${ENDINGS_BASE_PATH}/endings_${universeId}_${lang}.json`;

    let res = await fetch(urlNew, { cache: "no-cache" });
    if (!res.ok) res = await fetch(urlOld, { cache: "no-cache" });

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

    const gaugeId = lastDeath?.gaugeId || null;
    const direction = lastDeath?.direction || null; // "down" (0) ou "up" (100)

    const candidates = [];
    let value = null;
    if (direction === "down") value = "0";
    if (direction === "up") value = "100";

    if (gaugeId && direction) {
      // format simple
      candidates.push(`${gaugeId}_${direction}`);
    }
    if (gaugeId && value != null) {
      // autres formats (compat)
      candidates.push(`${gaugeId}_${value}`);
      candidates.push(`end_${gaugeId}_${value}`);

      // scan : ex. "hk_end_souls_0" (préfixe variable selon univers)
      const esc = String(gaugeId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const reEnd = new RegExp(`(^|_)end_${esc}_${value}$`);
      for (const k of Object.keys(endings || {})) {
        if (reEnd.test(k)) candidates.push(k);
      }
    }

    candidates.push("default");

    let ending = null;
    for (const k of candidates) {
      if (k && endings && endings[k]) { ending = endings[k]; break; }
    }

    // i18n fallback (si présent)
    const t = (key) => {
      try {
        const out = window.VRI18n?.t?.(key);
        if (out && out !== key) return out;
      } catch (_) {}
      return null;
    };

    titleEl.textContent = ending?.title || t("game.ending.title") || "Fin du règne";
    textEl.textContent =
      ending?.text || ending?.body || t("game.ending.body") || "Votre règne s'achève ici.";

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
  "use strict";

  const RECENT_MEMORY_SIZE = 4;
  const BASE_COINS_PER_CARD = 5;
  const STREAK_STEP = 10;
  const STREAK_BONUS = 25;
  const HISTORY_MAX = 30;

  const HELL_KING_DYNASTIES = ["Lucifer","Belzebuth","Lilith","Asmodée","Mammon","Baal","Astaroth","Abaddon"];

  function getDynastyName(reignIndex) {
    const baseName = HELL_KING_DYNASTIES[reignIndex % HELL_KING_DYNASTIES.length];
    const number = Math.floor(reignIndex / HELL_KING_DYNASTIES.length) + 1;
    return `${baseName} ${number}`;
  }

  function deepClone(obj) {
    try { return JSON.parse(JSON.stringify(obj)); } catch (_) { return obj; }
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

    history: [],

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
      this.history = [];

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

      const u = window.VUserData?.load?.() || {};
      const coins = Number(u.vcoins || 0);
      const tokens = Number(u.jetons || 0);

      window.VRUIBinding.updateMeta(kingName, years, coins, tokens);
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

    _pushHistorySnapshot(cardLogic) {
      const u = window.VUserData?.load?.() || {};
      const snap = {
        cardId: cardLogic?.id || null,
        gauges: deepClone(window.VRState.gauges),
        alive: true,
        lastDeath: null,
        reignYears: window.VRState.reignYears,
        cardsPlayed: window.VRState.cardsPlayed,
        recentCards: deepClone(this.recentCards),
        coinsStreak: this.coinsStreak,
        userVcoins: Number(u.vcoins || 0),
        sessionReignLength: Number(window.VRGame?.session?.reignLength || 0)
      };
      this.history.push(snap);
      if (this.history.length > HISTORY_MAX) this.history.shift();
    },

    undoChoices(steps) {
      const n = Math.max(1, Math.min(Number(steps || 1), 10));
      if (!this.history.length) return false;

      let snap = null;
      for (let i = 0; i < n; i++) {
        if (!this.history.length) break;
        snap = this.history.pop();
      }
      if (!snap) return false;

      // restore state
      window.VRState.gauges = deepClone(snap.gauges) || window.VRState.gauges;
      window.VRState.alive = true;
      window.VRState.lastDeath = null;
      window.VRState.reignYears = Number(snap.reignYears || 0);
      window.VRState.cardsPlayed = Number(snap.cardsPlayed || 0);

      this.recentCards = deepClone(snap.recentCards) || [];
      this.coinsStreak = Number(snap.coinsStreak || 0);

      // restore coins (cache local) + future hook supabase via VUserData
      if (window.VUserData?.setVcoins) window.VUserData.setVcoins(Number(snap.userVcoins || 0));
      else {
        const u = window.VUserData?.load?.() || {};
        u.vcoins = Number(snap.userVcoins || 0);
        window.VUserData?.save?.(u);
      }

      if (window.VRGame?.session) {
        window.VRGame.session.reignLength = Number(snap.sessionReignLength || 0);
      }

      // restore current card = cardId of snapshot
      const card = this.deck.find(c => c.id === snap.cardId) || this.currentCardLogic;
      if (card) {
        this.currentCardLogic = card;
        window.VRUIBinding.showCard(card);
      }

      window.VRUIBinding.updateGauges();

      const kingName = getDynastyName(this.reignIndex - 1);
      const u2 = window.VUserData?.load?.() || {};
      window.VRUIBinding.updateMeta(
        kingName,
        window.VRState.getReignYears(),
        Number(u2.vcoins || 0),
        Number(u2.jetons || 0)
      );

      return true;
    },

    applyChoice(cardLogic, choiceId) {
      if (!cardLogic || !cardLogic.choices || !cardLogic.choices[choiceId]) return;

      // ✅ snapshot AVANT application (pour “revenir en arrière”)
      this._pushHistorySnapshot(cardLogic);

      const choiceData = cardLogic.choices[choiceId];
      const deltas = choiceData.gaugeDelta || {};
      window.VRState.applyDeltas(deltas);

      this.coinsStreak += 1;

      // ✅ VCoins => via VUserData (cache local + hook supabase)
      if (window.VUserData?.addVcoins) {
        window.VUserData.addVcoins(BASE_COINS_PER_CARD);
        if (this.coinsStreak > 0 && this.coinsStreak % STREAK_STEP === 0) {
          window.VUserData.addVcoins(STREAK_BONUS);
        }
      } else {
        const user = window.VUserData.load();
        user.vcoins += BASE_COINS_PER_CARD;
        if (this.coinsStreak > 0 && this.coinsStreak % STREAK_STEP === 0) {
          user.vcoins += STREAK_BONUS;
        }
        window.VUserData.save(user);
      }

      window.VRGame?.onCardResolved?.();
      window.VRState.tickYear();

      const years = window.VRState.getReignYears();
      const kingName = getDynastyName(this.reignIndex - 1);
      const userAfter = window.VUserData?.load?.() || {};
      window.VRUIBinding.updateMeta(
        kingName,
        years,
        Number(userAfter.vcoins || 0),
        Number(userAfter.jetons || 0)
      );
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


// VRealms - Token UI + Actions (popup, pub=>jeton, jauge 50%, revenir -3)
(function () {
  "use strict";

  function t(key, fallback) {
    try {
      const out = window.VRI18n?.t?.(key);
      if (out && out !== key) return out;
    } catch (_) {}
    return fallback || key;
  }

  function toast(msg) {
    try {
      if (typeof window.showToast === "function") return window.showToast(msg);
    } catch (_) {}

    try {
      const id = "__vr_toast";
      let el = document.getElementById(id);
      if (!el) {
        el = document.createElement("div");
        el.id = id;
        el.style.cssText =
          "position:fixed;left:50%;bottom:12%;transform:translateX(-50%);" +
          "background:rgba(0,0,0,.85);color:#fff;padding:10px 14px;border-radius:12px;" +
          "font:14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;" +
          "z-index:2147483647;max-width:84vw;text-align:center";
        document.body.appendChild(el);
      }
      el.textContent = String(msg || "");
      el.style.opacity = "1";
      clearTimeout(el.__t1); clearTimeout(el.__t2);
      el.__t1 = setTimeout(() => { el.style.transition = "opacity .25s"; el.style.opacity = "0"; }, 2200);
      el.__t2 = setTimeout(() => { try { el.remove(); } catch (_) {} }, 2600);
    } catch (_) {}
  }

  const VRTokenUI = {
    selectMode: false,

    init() {
      const btnJeton = document.getElementById("btn-jeton");
      const popup = document.getElementById("vr-token-popup");
      const overlay = document.getElementById("vr-token-gauge-overlay");
      const cancelGaugeBtn = document.getElementById("btn-cancel-gauge-select");
      const gaugesRow = document.getElementById("vr-gauges-row");

      if (!btnJeton || !popup) return;

      const openPopup = () => {
        if (this.selectMode) return;
        popup.setAttribute("aria-hidden", "false");
        popup.style.display = "flex";
      };

      const closePopup = () => {
        popup.setAttribute("aria-hidden", "true");
        popup.style.display = "none";
      };

      const openGaugeOverlay = () => {
        if (!overlay) return;
        overlay.setAttribute("aria-hidden", "false");
        overlay.style.display = "flex";
      };

      const closeGaugeOverlay = () => {
        if (!overlay) return;
        overlay.setAttribute("aria-hidden", "true");
        overlay.style.display = "none";
      };

      const startSelectGauge50 = () => {
        this.selectMode = true;
        document.body.classList.add("vr-token-select-mode");
        closePopup();
        openGaugeOverlay();
        toast(t("token.toast.select_gauge", "Choisis une jauge à remettre à 50%"));
      };

      const stopSelectGauge50 = () => {
        this.selectMode = false;
        document.body.classList.remove("vr-token-select-mode");
        closeGaugeOverlay();
      };

      btnJeton.addEventListener("click", () => {
        openPopup();
      });

      // click hors popup => ferme (si clic sur fond .vr-popup)
      popup.addEventListener("click", (e) => {
        if (e.target === popup) closePopup();
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          if (this.selectMode) stopSelectGauge50();
          closePopup();
        }
      });

      // actions popup
      popup.querySelectorAll("[data-token-action]").forEach((el) => {
        el.addEventListener("click", async () => {
          const action = el.getAttribute("data-token-action");
          if (!action) return;

          if (action === "close") {
            closePopup();
            return;
          }

          // ✅ compat: accepte "adtoken" (nouveau) et "ad_token" (ancien)
          if (action === "adtoken" || action === "ad_token") {
            // ✅ pub rewarded => +1 jeton
            closePopup();

            const ok = await (window.VRAds?.showRewardedAd?.({ placement: "token" }) || Promise.resolve(false));
            if (ok) {
              window.VUserData?.addJetons?.(1);
              const u = window.VUserData?.load?.() || {};
              const kingName = document.getElementById("meta-king-name")?.textContent || "—";
              window.VRUIBinding?.updateMeta?.(
                kingName,
                window.VRState?.getReignYears?.() || 0,
                Number(u.vcoins || 0),
                Number(u.jetons || 0)
              );
              toast(t("token.toast.reward_ok", "+1 jeton ajouté"));
            } else {
              toast(t("token.toast.reward_fail", "Pub indisponible"));
            }
            return;
          }

          if (action === "gauge50") {
            // ✅ mode sélection jauge (on consomme 1 jeton au moment du clic sur jauge)
            const u = window.VUserData?.load?.() || {};
            if (Number(u.jetons || 0) <= 0) {
              toast(t("token.toast.no_tokens", "Tu n'as pas de jeton"));
              closePopup();
              return;
            }
            startSelectGauge50();
            return;
          }

          if (action === "back3") {
            // ✅ consomme 1 jeton puis undo 3, sinon on rembourse
            const canSpend = window.VUserData?.spendJetons?.(1);
            if (!canSpend) {
              toast(t("token.toast.no_tokens", "Tu n'as pas de jeton"));
              closePopup();
              return;
            }

            closePopup();

            const ok = window.VREngine?.undoChoices?.(3);
            if (!ok) {
              window.VUserData?.addJetons?.(1); // rembourse
              toast(t("token.toast.undo_fail", "Impossible de revenir en arrière"));
            } else {
              toast(t("token.toast.undo_done", "Retour -3 effectué"));
            }
            return;
          }

          if (action === "back_menu") {
            closePopup();
            try { window.location.href = "index.html"; } catch (_) {}
            return;
          }
        });
      });

      // annuler sélection jauge
      if (cancelGaugeBtn) {
        cancelGaugeBtn.addEventListener("click", () => stopSelectGauge50());
      }
      if (overlay) {
        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) stopSelectGauge50();
        });
      }

      // clic sur une jauge => set 50 + consomme 1 jeton
      if (gaugesRow) {
        gaugesRow.addEventListener("click", (e) => {
          if (!this.selectMode) return;

          const gaugeEl = e.target?.closest?.(".vr-gauge");
          if (!gaugeEl) return;

          const gaugeId = gaugeEl.dataset.gaugeId;
          if (!gaugeId) return;

          const spent = window.VUserData?.spendJetons?.(1);
          if (!spent) {
            toast(t("token.toast.no_tokens", "Tu n'as pas de jeton"));
            stopSelectGauge50();
            return;
          }

          window.VRState?.setGaugeValue?.(gaugeId, 50);
          window.VRUIBinding?.updateGauges?.();

          const u = window.VUserData?.load?.() || {};
          const kingName = document.getElementById("meta-king-name")?.textContent || "—";
          window.VRUIBinding?.updateMeta?.(
            kingName,
            window.VRState?.getReignYears?.() || 0,
            Number(u.vcoins || 0),
            Number(u.jetons || 0)
          );

          toast(t("token.toast.gauge_set_50", "Jauge remise à 50%"));
          stopSelectGauge50();
        });
      }
    }
  };

  window.VRTokenUI = VRTokenUI;
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

    // ✅ pour CSS mapping jauges + fonds
    if (universeId) document.body.dataset.universe = universeId;
    else delete document.body.dataset.universe;

    // ✅ OPTION B: supprime TOUTES les classes vr-bg-* (zéro maintenance)
    Array.from(viewGame.classList).forEach((cls) => {
      if (cls.startsWith("vr-bg-")) viewGame.classList.remove(cls);
    });

    if (universeId) viewGame.classList.add(`vr-bg-${universeId}`);
  },

  onCardResolved() {
    this.session.reignLength += 1;
    if (window.VUserData?.addVcoins) window.VUserData.addVcoins(1);
    else {
      const user = window.VUserData.load();
      user.vcoins += 1;
      window.VUserData.save(user);
    }
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

    // ✅ Sync user (cache local + futur Supabase) sans casser si pas prêt
    try {
      if (window.VUserData && typeof window.VUserData.init === "function") {
        await window.VUserData.init();
      }
    } catch (_) {}

    const hasGameView = !!document.getElementById("view-game");
    if (!hasGameView) return;

    // ✅ init UI jetons
    try { window.VRTokenUI?.init?.(); } catch (_) {}

    const universeId = localStorage.getItem("vrealms_universe") || "hell_king";
    if (window.VRGame && typeof window.VRGame.onUniverseSelected === "function") {
      window.VRGame.onUniverseSelected(universeId);
    }
  }

  document.addEventListener("DOMContentLoaded", initApp);
})();
