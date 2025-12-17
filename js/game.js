// ===============================================
// VRealms - js/game.js (bundle complet)
// - Loader univers/decks/i18n
// - UI binding + swipe animé sur les choix (A/B/C)
// - State / Endings / Engine core
// - Popups Jeton & VCoins
// - VRGame + anti-retour navigateur (best-effort)
// ===============================================


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

  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

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

    // ✅ PEEK (15 décisions) — activé via popup jeton
    peekRemaining: 0,
    _peekChoiceActive: null,

    init(universeConfig, lang, cardTextsDict) {
      this.universeConfig = universeConfig;
      this.lang = lang || "fr";
      this.cardTextsDict = cardTextsDict || {};

      this.peekRemaining = 0;
      this._peekChoiceActive = null;
      try { document.body?.classList?.remove("vr-peek-mode"); } catch (_) {}

      this._setupGaugeLabels();
      this._ensureGaugePreviewBars();
      this.updateGauges();
      this._setupChoiceButtons(); // ✅ swipe sur A/B/C
    },

    enablePeek(steps) {
      const n = Math.max(0, Math.min(Number(steps || 0), 99));
      this.peekRemaining = n;
      try {
        if (n > 0) document.body.classList.add("vr-peek-mode");
        else document.body.classList.remove("vr-peek-mode");
      } catch (_) {}
    },

    _consumePeekDecision() {
      if (this.peekRemaining <= 0) return;
      this.peekRemaining = Math.max(0, this.peekRemaining - 1);
      if (this.peekRemaining <= 0) {
        this.peekRemaining = 0;
        this._clearPeek();
        try { document.body.classList.remove("vr-peek-mode"); } catch (_) {}
      }
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

        fillEl.style.setProperty("--vr-pct", `${val}%`);
      });

      // preview = 0 par défaut
      const previewEls = document.querySelectorAll(".vr-gauge-preview");
      previewEls.forEach((previewEl) =>
        previewEl.style.setProperty("--vr-pct", "0%")
      );

      this._clearPeekClasses();
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

      this._resetChoiceCards();
      this._clearPeek();
    },

    _resetChoiceCards() {
      const btns = document.querySelectorAll(".vr-choice-button[data-choice]");
      btns.forEach((b) => {
        b.style.transition = "";
        b.style.transform = "";
      });
    },

    _setupChoiceButtons() {
      const buttons = Array.from(
        document.querySelectorAll(".vr-choice-button[data-choice]")
      );

      buttons.forEach((btn) => {
        // swipe only
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
        });

        // ultra important: sinon le navigateur peut bouffer le geste
        try { btn.style.touchAction = "none"; } catch (_) {}

        this._setupSwipeOnChoiceCard(btn);
      });
    },

    _setupSwipeOnChoiceCard(btn) {
      const TH = 62;
      const ROT_MAX = 12;
      let startX = 0;
      let startY = 0;
      let lastX = 0;
      let lastY = 0;
      let dragging = false;
      let pointerId = null;

      const getPoint = (e) => {
        if (e.touches && e.touches[0]) {
          return { x: e.touches[0].clientX || 0, y: e.touches[0].clientY || 0 };
        }
        return { x: e.clientX || 0, y: e.clientY || 0 };
      };

      const setTransform = (dx) => {
        const w = Math.max(1, window.innerWidth || 360);
        const p = clamp(dx / (w * 0.45), -1, 1);
        const rot = p * ROT_MAX;
        btn.style.transform = `translateX(${dx}px) rotate(${rot}deg)`;
      };

      const animateBack = () => {
        btn.style.transition = "transform 180ms cubic-bezier(.2,.9,.2,1)";
        btn.style.transform = "translateX(0px) rotate(0deg)";
        window.setTimeout(() => { btn.style.transition = ""; }, 200);
      };

      const animateFlyOut = (dx, done) => {
        const dir = dx >= 0 ? 1 : -1;
        const outX = dir * (Math.max(window.innerWidth || 360, 360) * 1.2);

        btn.style.transition = "transform 220ms cubic-bezier(.2,.9,.2,1)";
        btn.style.transform = `translateX(${outX}px) rotate(${dir * ROT_MAX}deg)`;

        window.setTimeout(() => {
          btn.style.transition = "";
          btn.style.transform = "";
          done && done();
        }, 235);
      };

      const onDown = (e) => {
        if (!this.currentCardLogic) return;

        try { e.preventDefault(); } catch (_) {}
        try { e.stopPropagation(); } catch (_) {}

        dragging = true;
        const p = getPoint(e);
        startX = p.x;
        startY = p.y;
        lastX = p.x;
        lastY = p.y;

        pointerId = e.pointerId ?? null;
        try { if (pointerId != null) btn.setPointerCapture(pointerId); } catch (_) {}

        const choiceId = btn.getAttribute("data-choice");
        if (choiceId && this.peekRemaining > 0) {
          this._showPeekForChoice(choiceId);
        }
      };

      const onMove = (e) => {
        if (!dragging) return;

        try { e.preventDefault(); } catch (_) {}
        try { e.stopPropagation(); } catch (_) {}

        const p = getPoint(e);
        lastX = p.x;
        lastY = p.y;

        const dx = lastX - startX;
        const dy = lastY - startY;

        // si trop vertical, on réduit (sinon c'est “bizarre”)
        if (Math.abs(dy) > Math.abs(dx) * 1.25) {
          setTransform(dx * 0.25);
          return;
        }

        setTransform(dx);
      };

      const onUp = () => {
        if (!dragging) return;
        dragging = false;

        const dx = lastX - startX;

        this._clearPeek();

        if (Math.abs(dx) >= TH && this.currentCardLogic) {
          const choiceId = btn.getAttribute("data-choice");
          if (!choiceId) {
            animateBack();
            return;
          }

          animateFlyOut(dx, () => {
            try { window.VREngine.applyChoice(this.currentCardLogic, choiceId); } catch (_) {}
          });
        } else {
          animateBack();
        }
      };

      btn.addEventListener("pointerdown", onDown, { passive: false });
      btn.addEventListener("pointermove", onMove, { passive: false });
      btn.addEventListener("pointerup", onUp, { passive: true });
      btn.addEventListener("pointercancel", onUp, { passive: true });

      btn.addEventListener("touchstart", onDown, { passive: false });
      btn.addEventListener("touchmove", onMove, { passive: false });
      btn.addEventListener("touchend", onUp, { passive: true });
      btn.addEventListener("touchcancel", onUp, { passive: true });
    },

    _clearPeekClasses() {
      try {
        document.querySelectorAll(".vr-gauge").forEach((g) => {
          g.classList.remove("vr-peek-up");
          g.classList.remove("vr-peek-down");
        });
      } catch (_) {}
    },

    _clearPeek() {
      this._peekChoiceActive = null;

      const previewEls = document.querySelectorAll(".vr-gauge-preview");
      previewEls.forEach((previewEl) =>
        previewEl.style.setProperty("--vr-pct", "0%")
      );

      this._clearPeekClasses();
    },

    _showPeekForChoice(choiceId) {
      if (!this.currentCardLogic?.choices?.[choiceId]) return;

      this._peekChoiceActive = choiceId;

      const gaugesCfg = this.universeConfig?.gauges || [];
      const gaugeEls = document.querySelectorAll(".vr-gauge");
      const previewEls = document.querySelectorAll(".vr-gauge-preview");

      gaugeEls.forEach((g) => {
        g.classList.remove("vr-peek-up");
        g.classList.remove("vr-peek-down");
      });

      previewEls.forEach((previewEl, idx) => {
        const cfg = gaugesCfg[idx];
        if (!cfg) return;

        const gaugeId = cfg.id;

        const baseVal =
          window.VRState.getGaugeValue(gaugeId) ??
          this.universeConfig?.initialGauges?.[gaugeId] ??
          cfg.start ??
          50;

        const d = this.currentCardLogic.choices[choiceId]?.gaugeDelta?.[gaugeId];
        const delta = (typeof d === "number") ? d : 0;

        const previewVal = clamp(baseVal + delta, 0, 100);
        previewEl.style.setProperty("--vr-pct", `${previewVal}%`);

        const gaugeEl = gaugeEls[idx];
        if (gaugeEl) {
          if (delta > 0) gaugeEl.classList.add("vr-peek-up");
          else if (delta < 0) gaugeEl.classList.add("vr-peek-down");
        }
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


// VRealms - engine/endings.js
(function () {
  "use strict";

  const ENDINGS_BASE_PATH = "data/i18n";
  const cache = new Map(); // key = universeId__lang

  async function loadEndings(universeId, lang) {
    const key = `${universeId}__${lang}`;
    if (cache.has(key)) return cache.get(key);

    const urlNew = `${ENDINGS_BASE_PATH}/${lang}/endings_${universeId}.json`;
    const urlOld = `${ENDINGS_BASE_PATH}/endings_${universeId}_${lang}.json`;

    let res = await fetch(urlNew, { cache: "no-cache" });
    if (!res.ok) res = await fetch(urlOld, { cache: "no-cache" });

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
    const direction = lastDeath?.direction || null;

    const candidates = [];
    let value = null;
    if (direction === "down") value = "0";
    if (direction === "up") value = "100";

    if (gaugeId && direction) {
      candidates.push(`${gaugeId}_${direction}`);
    }
    if (gaugeId && value != null) {
      candidates.push(`${gaugeId}_${value}`);
      candidates.push(`end_${gaugeId}_${value}`);

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
      this.deck = Array.isArray(deck) ? deck : [];
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
      if (!Array.isArray(this.deck) || this.deck.length === 0) {
        console.error("[VREngine] Deck vide : impossible de piocher une carte.");
        return;
      }

      const candidates = this.deck.filter((c) => !this.recentCards.includes(c.id));
      let card = null;

      if (candidates.length > 0) {
        card = candidates[Math.floor(Math.random() * candidates.length)];
      } else {
        card = this.deck[Math.floor(Math.random() * this.deck.length)];
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

      window.VRState.gauges = deepClone(snap.gauges) || window.VRState.gauges;
      window.VRState.alive = true;
      window.VRState.lastDeath = null;
      window.VRState.reignYears = Number(snap.reignYears || 0);
      window.VRState.cardsPlayed = Number(snap.cardsPlayed || 0);

      this.recentCards = deepClone(snap.recentCards) || [];
      this.coinsStreak = Number(snap.coinsStreak || 0);

      if (window.VUserData?.setVcoins) window.VUserData.setVcoins(Number(snap.userVcoins || 0));
      else {
        const u = window.VUserData?.load?.() || {};
        u.vcoins = Number(snap.userVcoins || 0);
        window.VUserData?.save?.(u);
      }

      if (window.VRGame?.session) {
        window.VRGame.session.reignLength = Number(snap.sessionReignLength || 0);
      }

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

      this._pushHistorySnapshot(cardLogic);

      const choiceData = cardLogic.choices[choiceId];
      const deltas = choiceData.gaugeDelta || {};
      window.VRState.applyDeltas(deltas);

      this.coinsStreak += 1;

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

      try { window.VRUIBinding?._consumePeekDecision?.(); } catch (_) {}

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


// VRealms - Token UI + Actions (popup, pub=>jeton, jauge 50%, revenir -3, PEEK 15)
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

      // ✅ SÉCURITÉ : remonter popup/overlay dans <body>
      try {
        const vg = document.getElementById("view-game");
        if (vg) {
          if (popup && vg.contains(popup)) document.body.appendChild(popup);
          if (overlay && vg.contains(overlay)) document.body.appendChild(overlay);
        }
      } catch (_) {}

      const _showDialog = (el, focusEl) => {
        if (!el) return;
        try { el.removeAttribute("inert"); } catch (_) {}
        el.setAttribute("aria-hidden", "false");
        el.style.display = "flex";
        try { focusEl?.focus?.({ preventScroll: true }); } catch (_) {}
      };

      const _hideDialog = (el, focusBackEl) => {
        if (!el) return;
        const active = document.activeElement;
        if (active && el.contains(active)) {
          try { active.blur(); } catch (_) {}
          try { focusBackEl?.focus?.({ preventScroll: true }); } catch (_) {}
        }
        try { el.setAttribute("inert", ""); } catch (_) {}
        el.setAttribute("aria-hidden", "true");
        el.style.display = "none";
      };

      const openPopup = () => {
        if (this.selectMode) return;
        const first = popup?.querySelector?.("[data-token-action]");
        _showDialog(popup, first || btnJeton);
      };

      const closePopup = () => {
        _hideDialog(popup, btnJeton);
      };

      const openGaugeOverlay = () => {
        if (!overlay) return;
        _showDialog(overlay, cancelGaugeBtn || btnJeton);
      };

      const closeGaugeOverlay = () => {
        if (!overlay) return;
        _hideDialog(overlay, btnJeton);
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

      btnJeton.addEventListener("click", () => openPopup());

      popup.addEventListener("click", (e) => {
        if (e.target === popup) closePopup();
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          if (this.selectMode) stopSelectGauge50();
          closePopup();
        }
      });

      popup.querySelectorAll("[data-token-action]").forEach((el) => {
        el.addEventListener("click", async () => {
          const action = el.getAttribute("data-token-action");
          if (!action) return;

          if (action === "close") { closePopup(); return; }

          if (action === "adtoken" || action === "ad_token") {
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

          if (action === "peek15") {
            const canSpend = window.VUserData?.spendJetons?.(1);
            if (!canSpend) {
              toast(t("token.toast.no_tokens", "Tu n'as pas de jeton"));
              closePopup();
              return;
            }

            closePopup();
            try { window.VRUIBinding?.enablePeek?.(15); } catch (_) {}
            toast(t("token.toast.peek_on", "Peek activé : 15 prochaines décisions"));
            return;
          }

          if (action === "gauge50") {
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
            const canSpend = window.VUserData?.spendJetons?.(1);
            if (!canSpend) {
              toast(t("token.toast.no_tokens", "Tu n'as pas de jeton"));
              closePopup();
              return;
            }

            closePopup();

            const ok = window.VREngine?.undoChoices?.(3);
            if (!ok) {
              window.VUserData?.addJetons?.(1);
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

      if (cancelGaugeBtn) cancelGaugeBtn.addEventListener("click", () => stopSelectGauge50());
      if (overlay) overlay.addEventListener("click", (e) => { if (e.target === overlay) stopSelectGauge50(); });

      // ✅ FIX CRASH: gaugeId + typo gagueId corrigé
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


// VRealms - VCoins UI + Actions (popup, pub=>+500 vcoins, shop)
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

  const VRCoinUI = {
    init() {
      const btnVcoins = document.getElementById("btn-vcoins");
      const popup = document.getElementById("vr-coins-popup");
      if (!btnVcoins || !popup) return;

      try {
        const vg = document.getElementById("view-game");
        if (vg && popup && vg.contains(popup)) document.body.appendChild(popup);
      } catch (_) {}

      const _showDialog = (el, focusEl) => {
        if (!el) return;
        try { el.removeAttribute("inert"); } catch (_) {}
        el.setAttribute("aria-hidden", "false");
        el.style.display = "flex";
        try { focusEl?.focus?.({ preventScroll: true }); } catch (_) {}
      };

      const _hideDialog = (el, focusBackEl) => {
        if (!el) return;
        const active = document.activeElement;
        if (active && el.contains(active)) {
          try { active.blur(); } catch (_) {}
          try { focusBackEl?.focus?.({ preventScroll: true }); } catch (_) {}
        }
        try { el.setAttribute("inert", ""); } catch (_) {}
        el.setAttribute("aria-hidden", "true");
        el.style.display = "none";
      };

      const openPopup = () => {
        const first = popup?.querySelector?.("[data-coins-action]");
        _showDialog(popup, first || btnVcoins);
      };

      const closePopup = () => {
        _hideDialog(popup, btnVcoins);
      };

      btnVcoins.addEventListener("click", () => openPopup());

      popup.addEventListener("click", (e) => {
        if (e.target === popup) closePopup();
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closePopup();
      });

      popup.querySelectorAll("[data-coins-action]").forEach((el) => {
        el.addEventListener("click", async () => {
          const action = el.getAttribute("data-coins-action");
          if (!action) return;

          if (action === "close") { closePopup(); return; }

          if (action === "open_shop") {
            closePopup();
            try { window.location.href = "shop.html"; } catch (_) {}
            return;
          }

          if (action === "adcoins") {
            closePopup();

            const ok = await (window.VRAds?.showRewardedAd?.({ placement: "coins_500" }) || Promise.resolve(false));
            if (ok) {
              window.VUserData?.addVcoins?.(500);

              const u = window.VUserData?.load?.() || {};
              const kingName = document.getElementById("meta-king-name")?.textContent || "—";
              window.VRUIBinding?.updateMeta?.(
                kingName,
                window.VRState?.getReignYears?.() || 0,
                Number(u.vcoins || 0),
                Number(u.jetons || 0)
              );

              toast(t("coins.toast.reward_ok", "+500 pièces ajoutées"));
            } else {
              toast(t("coins.toast.reward_fail", "Pub indisponible"));
            }
            return;
          }
        });
      });
    }
  };

  window.VRCoinUI = VRCoinUI;
})();


// VRealms - game.js (VRGame + anti-retour navigateur)
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

    if (universeId) document.body.dataset.universe = universeId;
    else delete document.body.dataset.universe;

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

    // ✅ robustesse: stats peut être undefined
    user.stats = user.stats || { totalRuns: 0, bestReignLength: 0 };

    user.vcoins = Number(user.vcoins || 0) + Number(bonus || 0);
    user.stats.totalRuns = Number(user.stats.totalRuns || 0) + 1;
    if (Number(this.session.reignLength || 0) > Number(user.stats.bestReignLength || 0)) {
      user.stats.bestReignLength = Number(this.session.reignLength || 0);
    }
    window.VUserData.save(user);
  }
};


// ===== Init page jeu seule (game.html) =====
(function () {
  function setupNavigationGuards() {
    // 1) Anti "retour" via bouton back / geste back (best-effort)
    try {
      history.pushState({ vr_game: 1 }, "", location.href);
      history.pushState({ vr_game: 2 }, "", location.href);

      window.addEventListener("popstate", () => {
        try { history.pushState({ vr_game: 3 }, "", location.href); } catch (_) {}
      });
    } catch (_) {}

    // 2) Anti edge-swipe back (surtout Android/Chrome; iOS Safari reste partiellement non-bloquable)
    const EDGE = 18;
    const blockEdge = (e) => {
      try {
        const x = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
        if (typeof x === "number" && x <= EDGE) {
          e.preventDefault();
          e.stopPropagation();
        }
      } catch (_) {}
    };

    try { document.addEventListener("touchstart", blockEdge, { passive: false, capture: true }); } catch (_) {}
    try { document.addEventListener("pointerdown", blockEdge, { passive: false, capture: true }); } catch (_) {}

    // 3) Anti overscroll / pull-to-refresh (best-effort)
    try { document.documentElement.style.overscrollBehavior = "none"; } catch (_) {}
    try { document.body.style.overscrollBehavior = "none"; } catch (_) {}
  }

  async function initApp() {
    setupNavigationGuards();

    try {
      if (window.VRI18n && typeof window.VRI18n.initI18n === "function") {
        await window.VRI18n.initI18n();
      }
    } catch (e) {
      console.error("[VRealms] Erreur init i18n:", e);
    }

    try {
      if (window.VUserData && typeof window.VUserData.init === "function") {
        await window.VUserData.init();
      }
    } catch (_) {}

    const hasGameView = !!document.getElementById("view-game");
    if (!hasGameView) return;

    try { window.VRTokenUI?.init?.(); } catch (_) {}
    try { window.VRCoinUI?.init?.(); } catch (_) {}

    const universeId = localStorage.getItem("vrealms_universe") || "hell_king";
    if (window.VRGame && typeof window.VRGame.onUniverseSelected === "function") {
      window.VRGame.onUniverseSelected(universeId);
    }
  }

  document.addEventListener("DOMContentLoaded", initApp);
})();
