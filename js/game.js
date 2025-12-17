// VRealms - engine/ui-binding.js
// Fait le lien moteur ↔ interface (jauges, carte, choix + hint + swipe).

(function () {
  "use strict";

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

    // ✅ Mode “peek” (token) : autorise l’affichage de la preview réelle
    revealMode: false,

    // ✅ Animations (zoom +/-) sur jauges touchées
    _pulseAnims: new Map(),

    setRevealMode(flag) {
      this.revealMode = !!flag;
      // si on désactive, on enlève toute preview + hints
      if (!this.revealMode) {
        this._clearGaugePreview();
      }
      this._clearGaugeHints();
    },

    init(universeConfig, lang, cardTextsDict) {
      this.universeConfig = universeConfig;
      this.lang = lang || "fr";
      this.cardTextsDict = cardTextsDict || {};

      this._setupGaugeLabels();
      this._ensureGaugePreviewBars();
      this.updateGauges();
      this._setupChoiceButtons();

      // ✅ IMPORTANT : plus aucun swipe/clic sur la carte scénario
      // (on ne bind plus rien sur #vr-card-main)
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

        if (fillEl) fillEl.dataset.gaugeId = gaugeId;
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

      // ✅ par défaut, preview = 0 (on n’affiche pas l’impact sans token)
      this._clearGaugePreview();
    },

    _clearGaugePreview() {
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
      this._clearGaugeHints();
      if (!this.revealMode) this._clearGaugePreview();
    },

    _resetCardPosition() {
      const card = document.getElementById("vr-card-main");
      if (!card) return;
      card.style.transform = "";
      card.dataset.dragChoice = "";
    },

    _setupChoiceButtons() {
      const buttons = Array.from(
        document.querySelectorAll(".vr-choice-button[data-choice]")
      );

      buttons.forEach((btn) => {
        // ✅ clic = validation (principal)
        btn.addEventListener("click", () => {
          const choiceId = btn.getAttribute("data-choice");
          if (!choiceId) return;
          if (!this.currentCardLogic) return;
          this._clearGaugeHints();
          if (!this.revealMode) this._clearGaugePreview();
          window.VREngine.applyChoice(this.currentCardLogic, choiceId);
        });

        // ✅ swipe = validation aussi (secondaire)
        this._setupChoiceSwipe(btn);
      });
    },

    _setupChoiceSwipe(btn) {
      const TH = 70; // ✅ un peu plus haut => “plus de clic que de swipe”
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

        const choiceId = btn.getAttribute("data-choice");
        if (choiceId) this._hintGaugesForChoice(choiceId);
      };

      const onMove = (e) => {
        if (!dragging) return;
        currentX = getX(e);
        const delta = currentX - startX;

        btn.style.transform = `translateX(${delta}px)`;

        const choiceId = btn.getAttribute("data-choice");
        if (choiceId) {
          this._hintGaugesForChoice(choiceId);

          // ✅ seulement si token “peek” actif : on montre l’impact réel
          if (this.revealMode) this._updatePreviewFromChoice(choiceId);
          else this._clearGaugePreview();
        }
      };

      const onUp = () => {
        if (!dragging) return;
        dragging = false;

        const delta = currentX - startX;
        btn.classList.remove("vr-choice-dragging");
        btn.style.transform = "";

        this._clearGaugeHints();
        if (!this.revealMode) this._clearGaugePreview();

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

    _hintGaugesForChoice(choiceId) {
      const impacts = this._getImpactedGaugeIds(choiceId);
      const all = (this.universeConfig?.gauges || []).map(g => g.id);

      // active / inactive
      all.forEach((gid) => {
        this._setGaugePulse(gid, impacts.includes(gid));
      });
    },

    _getImpactedGaugeIds(choiceId) {
      const out = [];
      const logic = this.currentCardLogic;
      const deltas = logic?.choices?.[choiceId]?.gaugeDelta || null;
      if (!deltas || typeof deltas !== "object") return out;

      Object.entries(deltas).forEach(([gaugeId, d]) => {
        if (typeof d === "number" && d !== 0) out.push(gaugeId);
      });

      return out;
    },

    _setGaugePulse(gaugeId, active) {
      const el = document.querySelector(`.vr-gauge[data-gauge-id="${gaugeId}"]`);
      if (!el) return;

      const prev = this._pulseAnims.get(gaugeId);

      if (active) {
        if (prev) return; // déjà en cours
        try {
          el.style.willChange = "transform";
          const anim = el.animate(
            [
              { transform: "scale(1)" },
              { transform: "scale(1.06)" }
            ],
            {
              duration: 650,
              iterations: Infinity,
              direction: "alternate",
              easing: "ease-in-out"
            }
          );
          this._pulseAnims.set(gaugeId, anim);
        } catch (_) {
          // fallback silencieux (si animate() pas dispo)
          el.style.transform = "scale(1.04)";
        }
      } else {
        if (prev) {
          try { prev.cancel(); } catch (_) {}
          this._pulseAnims.delete(gaugeId);
        }
        el.style.transform = "";
        el.style.willChange = "";
      }
    },

    _clearGaugeHints() {
      const all = (this.universeConfig?.gauges || []).map(g => g.id);
      all.forEach((gid) => this._setGaugePulse(gid, false));
    },

    _updatePreviewFromChoice(choiceId) {
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
        const d = this.currentCardLogic?.choices?.[choiceId]?.gaugeDelta?.[gaugeId];
        if (typeof d === "number") delta = d;

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

      // ✅ SÉCURITÉ : si popup/overlay sont à l’intérieur de #view-game,
      // on les remonte dans <body> pour éviter toute règle CSS du type:
      // #view-game > * { position: relative; ... }
      try {
        const vg = document.getElementById("view-game");
        if (vg) {
          if (popup && vg.contains(popup)) document.body.appendChild(popup);
          if (overlay && vg.contains(overlay)) document.body.appendChild(overlay);
        }
      } catch (_) {}

      // --- A11y + Focus safe show/hide (évite l’avertissement aria-hidden) ---
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


// ✅✅✅ VRealms - VCoins UI + Actions (popup, pub=>+500 vcoins, shop)
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

      // ✅ SÉCURITÉ : si popup est dans #view-game, on la remonte dans <body>
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

      // clic hors popup => ferme
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

          if (action === "close") {
            closePopup();
            return;
          }

          if (action === "open_shop") {
            closePopup();
            try { window.location.href = "shop.html"; } catch (_) {}
            return;
          }

          if (action === "adcoins") {
            closePopup();

            // ✅ rewarded ad => +500 vcoins
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

    // ✅ init UI vcoins
    try { window.VRCoinUI?.init?.(); } catch (_) {}

    const universeId = localStorage.getItem("vrealms_universe") || "hell_king";
    if (window.VRGame && typeof window.VRGame.onUniverseSelected === "function") {
      window.VRGame.onUniverseSelected(universeId);
    }
  }

  document.addEventListener("DOMContentLoaded", initApp);
})();  