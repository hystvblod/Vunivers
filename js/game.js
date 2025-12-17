// VRealms - game.js
// Fichier unique : loader + state + ui-binding + endings + engine + UI jetons/vcoins + init page

// ------------------------------
// VRealms - engine/events-loader.js
// ------------------------------
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
          `[VREventsLoader] Config introuvable pour univers '${universeId}' (${res.status})`
        );
      }
      return res.json();
    },

    async _loadDeck(universeId) {
      const res = await fetch(`${DECKS_PATH}/${universeId}.deck.json`, {
        cache: "no-cache"
      });
      if (!res.ok) {
        throw new Error(
          `[VREventsLoader] Deck introuvable pour univers '${universeId}' (${res.status})`
        );
      }
      return res.json();
    },

    async _loadCardTexts(universeId, lang) {
      // ✅ structure attendue: data/i18n/<lang>/<universeId>.cards.json
      const res = await fetch(
        `${CARDS_I18N_PATH}/${lang}/${universeId}.cards.json`,
        { cache: "no-cache" }
      );
      if (!res.ok) {
        throw new Error(
          `[VREventsLoader] Textes cartes introuvables pour univers '${universeId}' lang '${lang}' (${res.status})`
        );
      }
      return res.json();
    }
  };

  window.VREventsLoader = VREventsLoader;
})();


// ------------------------------
// VRealms - state.js
// ------------------------------
(function () {
  "use strict";

  const STORAGE_KEY = "vrealms_state";

  // ✅ clamp
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const VRState = {
    _state: null,

    init(universeConfig) {
      // state par défaut
      this._state = {
        universeId: universeConfig?.id || null,
        reignYears: 0,
        gauges: {},
        alive: true,
        lastDeath: null,
        history: [] // { cardId, choiceId, effects, snapshotBefore }
      };

      // init gauges
      const initGauges = universeConfig?.initialGauges || {};
      Object.keys(initGauges).forEach((gid) => {
        this._state.gauges[gid] = clamp(Number(initGauges[gid] || 50), 0, 100);
      });

      this.save();
    },

    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (!obj || typeof obj !== "object") return null;
        this._state = obj;
        return this._state;
      } catch (_) {
        return null;
      }
    },

    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this._state));
      } catch (_) {}
    },

    reset(universeConfig) {
      this.init(universeConfig);
    },

    getUniverseId() {
      return this._state?.universeId || null;
    },

    isAlive() {
      return !!this._state?.alive;
    },

    getReignYears() {
      return Number(this._state?.reignYears || 0);
    },

    setReignYears(n) {
      this._state.reignYears = Math.max(0, Number(n || 0));
      this.save();
    },

    incYears(delta) {
      this._state.reignYears = Math.max(
        0,
        Number(this._state.reignYears || 0) + Number(delta || 0)
      );
      this.save();
    },

    getGaugeValue(gaugeId) {
      return this._state?.gauges?.[gaugeId];
    },

    setGaugeValue(gaugeId, value) {
      if (!this._state.gauges) this._state.gauges = {};
      this._state.gauges[gaugeId] = clamp(Number(value || 0), 0, 100);
      this.save();
    },

    applyGaugeDelta(gaugeId, delta) {
      const cur = Number(this.getGaugeValue(gaugeId) ?? 50);
      this.setGaugeValue(gaugeId, cur + Number(delta || 0));
    },

    kill(deathInfo) {
      this._state.alive = false;
      this._state.lastDeath = deathInfo || { reason: "unknown" };
      this.save();
    },

    revive() {
      this._state.alive = true;
      this._state.lastDeath = null;
      this.save();
    },

    getLastDeath() {
      return this._state?.lastDeath || null;
    },

    pushHistory(entry) {
      if (!this._state.history) this._state.history = [];
      this._state.history.push(entry);
      this.save();
    },

    popHistory() {
      if (!this._state.history || !this._state.history.length) return null;
      const v = this._state.history.pop();
      this.save();
      return v;
    },

    historyLength() {
      return this._state?.history?.length || 0;
    }
  };

  window.VRState = VRState;
})();


// ------------------------------
// VRealms - ui-binding.js
// ------------------------------
(function () {
  "use strict";

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const VRUIBinding = {
    universeConfig: null,
    cardTextsDict: null,
    currentCardLogic: null,

    // Peek (preview) : nombre de previews restantes
    peekRemaining: 0,
    _peekActive: false,
    _peekChoiceId: null,
    _gaugeBlinkAnims: new Map(), // gaugeId -> Animation

    init(universeConfig, cardTextsDict) {
      this.universeConfig = universeConfig;
      this.cardTextsDict = cardTextsDict;
      this.currentCardLogic = null;

      this._setupChoiceButtons();
      this.updateMeta(
        universeConfig?.kingName || "—",
        window.VRState.getReignYears(),
        window.VUserData?.load?.()?.vcoins || 0,
        window.VUserData?.load?.()?.jetons || 0
      );
      this._setupGaugeLabels();
      this.updateGauges();
      this._clearPeekUI();
    },

    updateMeta(kingName, years, vcoins, jetons) {
      const nameEl = document.getElementById("meta-king-name");
      const yearsEl = document.getElementById("meta-years");
      const coinsEl = document.getElementById("meta-coins");
      const tokensEl = document.getElementById("meta-tokens");

      if (nameEl) nameEl.textContent = kingName ?? "—";
      if (yearsEl) yearsEl.textContent = String(years ?? 0);
      if (coinsEl) coinsEl.textContent = String(vcoins ?? 0);
      if (tokensEl) tokensEl.textContent = String(jetons ?? 0);
    },

    _setupGaugeLabels() {
      const gaugesCfg = this.universeConfig?.gauges || [];
      const gaugeEls = Array.from(document.querySelectorAll(".vr-gauge"));
      gaugeEls.forEach((gaugeEl, idx) => {
        const labelEl = gaugeEl.querySelector(".vr-gauge-label");
        const cfg = gaugesCfg[idx];
        if (!cfg) return;

        const lang = localStorage.getItem("vrealms_lang") || "fr";
        const label = lang === "fr" ? cfg.label_fr : cfg.label_en;
        if (labelEl) labelEl.textContent = label || "";

        // On stocke l'id de jauge sur l'élément pour le mode sélection jeton
        gaugeEl.dataset.gaugeId = cfg.id || "";
      });
    },

    updateGauges() {
      const gaugeEls = Array.from(document.querySelectorAll(".vr-gauge"));
      const gaugesCfg = this.universeConfig?.gauges || [];

      gaugeEls.forEach((gaugeEl, idx) => {
        const cfg = gaugesCfg[idx];
        if (!cfg) return;

        const gaugeId = cfg.id;
        const fillEl = gaugeEl.querySelector(".vr-gauge-fill");
        if (!fillEl) return;

        const val =
          window.VRState.getGaugeValue(gaugeId) ??
          this.universeConfig?.initialGauges?.[gaugeId] ??
          cfg?.start ??
          50;

        fillEl.style.setProperty("--vr-pct", `${val}%`);
      });

      // preview = 0 par défaut
      const previewEls = document.querySelectorAll(".vr-gauge-preview");
      previewEls.forEach((previewEl) =>
        previewEl.style.setProperty("--vr-pct", "0%")
      );
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
      if (choiceAEl) choiceAEl.textContent = texts.choices?.A || "";
      if (choiceBEl) choiceBEl.textContent = texts.choices?.B || "";
      if (choiceCEl) choiceCEl.textContent = texts.choices?.C || "";

      this._resetChoiceButtonsVisual();
      this._clearPeekUI();
    },

    // ------------------------------
    // CHOIX : click + swipe (pro)
    // ------------------------------
    _setupChoiceButtons() {
      // ✅ Seulement les 3 choix (A/B/C)
      const buttons = Array.from(
        document.querySelectorAll(".vr-choice-button[data-choice]")
      );

      buttons.forEach((btn) => {
        // Tap = valide (fallback desktop)
        btn.addEventListener("click", (e) => {
          // si on vient de drag, on ignore le click
          if (btn.__vr_dragged) {
            btn.__vr_dragged = false;
            return;
          }
          const choiceId = btn.getAttribute("data-choice");
          if (!choiceId) return;
          if (!this.currentCardLogic) return;
          window.VREngine.applyChoice(this.currentCardLogic, choiceId);
        });

        this._setupChoiceSwipe(btn);
      });

      // ✅ IMPORTANT : on ne met PLUS le swipe sur la carte scénario
    },

    _setupChoiceSwipe(btn) {
      // feel : seuil + vitesse
      const TH = 70;
      const VELOCITY_TH = 0.7; // px/ms

      let pointerId = null;
      let startX = 0;
      let startY = 0;
      let lastX = 0;
      let lastT = 0;
      let dragging = false;
      let started = false;

      const onDown = (e) => {
        if (!this.currentCardLogic) return;

        // ignore multi touch / non primaire
        if (e.pointerType && e.isPrimary === false) return;

        pointerId = e.pointerId ?? "touch";
        dragging = true;
        started = false;
        startX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
        startY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
        lastX = startX;
        lastT = performance.now();

        btn.__vr_dragged = false;

        try {
          btn.setPointerCapture?.(e.pointerId);
        } catch (_) {}

        // coupe le scroll pendant le drag
        try {
          e.preventDefault?.();
        } catch (_) {}

        btn.classList.add("vr-choice-dragging");
        btn.style.willChange = "transform";
      };

      const onMove = (e) => {
        if (!dragging) return;

        const x = e.clientX ?? e.touches?.[0]?.clientX ?? lastX;
        const y = e.clientY ?? e.touches?.[0]?.clientY ?? startY;

        const dx = x - startX;
        const dy = y - startY;

        // on déclenche seulement si mouvement assez clair horizontal
        if (!started) {
          if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
          if (Math.abs(dy) > Math.abs(dx)) {
            // mouvement vertical -> on annule (laisser page gérer si besoin)
            this._resetOneChoice(btn, true);
            dragging = false;
            started = false;
            pointerId = null;
            return;
          }
          started = true;
        }

        btn.__vr_dragged = true;
        try {
          e.preventDefault?.();
        } catch (_) {}

        // visuel pro : translate + tilt
        this._applyChoiceDragVisual(btn, dx);

        // peek (si activé)
        const choiceId = btn.getAttribute("data-choice");
        if (choiceId && this.peekRemaining > 0 && this.currentCardLogic) {
          this._showPeekForChoice(this.currentCardLogic, choiceId, dx);
        } else {
          this._clearPeekUI();
        }

        lastX = x;
        lastT = performance.now();
      };

      const onUp = (e) => {
        if (!dragging) return;
        dragging = false;

        const x = e.clientX ?? e.changedTouches?.[0]?.clientX ?? lastX;
        const dx = x - startX;

        const now = performance.now();
        const dt = Math.max(1, now - lastT);
        const velocity = (x - lastX) / dt; // px/ms

        btn.classList.remove("vr-choice-dragging");

        // décision
        const shouldCommit =
          Math.abs(dx) >= TH || Math.abs(velocity) >= VELOCITY_TH;

        if (shouldCommit && this.currentCardLogic) {
          const choiceId = btn.getAttribute("data-choice");
          if (!choiceId) {
            this._resetOneChoice(btn);
            this._clearPeekUI();
            return;
          }

          // animation sortie
          const dir = dx >= 0 ? 1 : -1;
          const offX = dir * (window.innerWidth * 0.9);

          btn.style.transition = "transform 220ms ease, opacity 220ms ease";
          btn.style.transform = `translateX(${offX}px) rotate(${dir * 10}deg)`;
          btn.style.opacity = "0.0";

          // consume peek if active
          if (this.peekRemaining > 0) {
            this.peekRemaining = Math.max(0, this.peekRemaining - 1);
          }

          // verrouille vite pour éviter double apply
          this._disableChoiceButtons(true);

          window.setTimeout(() => {
            // reset visuel avant d'afficher prochaine carte
            this._resetOneChoice(btn);
            this._clearPeekUI();

            window.VREngine.applyChoice(this.currentCardLogic, choiceId);
            this._disableChoiceButtons(false);
          }, 230);
        } else {
          this._resetOneChoice(btn);
          this._clearPeekUI();
        }
      };

      // pointer events (principal)
      btn.addEventListener("pointerdown", onDown, { passive: false });
      btn.addEventListener("pointermove", onMove, { passive: false });
      btn.addEventListener("pointerup", onUp, { passive: true });
      btn.addEventListener("pointercancel", onUp, { passive: true });

      // fallback touch (certains webviews)
      btn.addEventListener(
        "touchstart",
        (ev) => onDown(ev),
        { passive: false }
      );
      btn.addEventListener(
        "touchmove",
        (ev) => onMove(ev),
        { passive: false }
      );
      btn.addEventListener(
        "touchend",
        (ev) => onUp(ev),
        { passive: true }
      );
      btn.addEventListener(
        "touchcancel",
        (ev) => onUp(ev),
        { passive: true }
      );
    },

    _applyChoiceDragVisual(btn, dx) {
      const max = 160;
      const clamped = clamp(dx, -max, max);
      const rot = clamp(clamped / 18, -10, 10);
      const scale = 1 - Math.min(0.06, Math.abs(clamped) / 2000);
      btn.style.transition = "none";
      btn.style.opacity = "1";
      btn.style.transform = `translateX(${clamped}px) rotate(${rot}deg) scale(${scale})`;
    },

    _resetOneChoice(btn, fast) {
      btn.style.willChange = "";
      btn.style.opacity = "";
      btn.style.transition = fast ? "" : "transform 180ms ease, opacity 180ms ease";
      btn.style.transform = "";
      window.setTimeout(() => {
        btn.style.transition = "";
      }, 220);
    },

    _resetChoiceButtonsVisual() {
      const buttons = Array.from(
        document.querySelectorAll(".vr-choice-button[data-choice]")
      );
      buttons.forEach((b) => this._resetOneChoice(b, true));
    },

    _disableChoiceButtons(disabled) {
      const buttons = Array.from(
        document.querySelectorAll(".vr-choice-button[data-choice]")
      );
      buttons.forEach((b) => {
        if (disabled) b.setAttribute("disabled", "disabled");
        else b.removeAttribute("disabled");
      });
    },

    // ------------------------------
    // Peek (preview) : jauges + clignotement
    // ------------------------------
    enablePeek(count) {
      this.peekRemaining = Math.max(0, Number(count || 0));
      this._peekActive = this.peekRemaining > 0;
      this._peekChoiceId = null;
      this._clearPeekUI();
    },

    _showPeekForChoice(cardLogic, choiceId, dx) {
      if (!cardLogic || !choiceId) return;

      const effects = cardLogic.effects?.[choiceId] || {};
      const gaugesCfg = this.universeConfig?.gauges || [];
      const gaugeEls = Array.from(document.querySelectorAll(".vr-gauge"));

      // ramp de preview selon la distance
      const maxDx = 160;
      const k = clamp(Math.abs(dx) / maxDx, 0, 1);

      // reset anims
      this._stopAllGaugeBlink();

      gaugeEls.forEach((gaugeEl, idx) => {
        const cfg = gaugesCfg[idx];
        if (!cfg) return;

        const gid = cfg.id;
        const previewEl = gaugeEl.querySelector(".vr-gauge-preview");
        if (!previewEl) return;

        const delta = Number(effects[gid] || 0);
        const previewPct = Math.round(delta * k);

        previewEl.style.setProperty("--vr-pct", `${Math.abs(previewPct)}%`);

        // sens (si tu as CSS pour ça)
        gaugeEl.classList.remove("vr-peek-up", "vr-peek-down");
        if (delta > 0) gaugeEl.classList.add("vr-peek-up");
        if (delta < 0) gaugeEl.classList.add("vr-peek-down");

        // clignote si delta non nul
        if (delta !== 0) {
          this._blinkGauge(gaugeEl, gid, delta);
        }
      });

      this._peekChoiceId = choiceId;
      this._peekActive = true;
    },

    _clearPeekUI() {
      const gaugeEls = Array.from(document.querySelectorAll(".vr-gauge"));
      gaugeEls.forEach((gaugeEl) => {
        gaugeEl.classList.remove("vr-peek-up", "vr-peek-down");
        const previewEl = gaugeEl.querySelector(".vr-gauge-preview");
        if (previewEl) previewEl.style.setProperty("--vr-pct", "0%");
        // reset outline/boxShadow if we set it
        gaugeEl.style.outline = "";
        gaugeEl.style.outlineOffset = "";
        gaugeEl.style.boxShadow = "";
      });
      this._stopAllGaugeBlink();
      this._peekChoiceId = null;
    },

    _blinkGauge(gaugeEl, gaugeId, delta) {
      // web animations (pas besoin de CSS)
      try {
        const existing = this._gaugeBlinkAnims.get(gaugeId);
        if (existing) {
          try { existing.cancel(); } catch (_) {}
          this._gaugeBlinkAnims.delete(gaugeId);
        }

        // style léger + lisible
        const glow = delta > 0
          ? ["0 0 0 0 rgba(0,0,0,0)", "0 0 0 3px rgba(40,200,120,0.45)", "0 0 0 0 rgba(0,0,0,0)"]
          : ["0 0 0 0 rgba(0,0,0,0)", "0 0 0 3px rgba(220,60,60,0.45)", "0 0 0 0 rgba(0,0,0,0)"];

        const anim = gaugeEl.animate(
          [
            { boxShadow: glow[0], transform: "translateZ(0)" },
            { boxShadow: glow[1], transform: "translateZ(0)" },
            { boxShadow: glow[2], transform: "translateZ(0)" }
          ],
          { duration: 420, iterations: 2 }
        );
        this._gaugeBlinkAnims.set(gaugeId, anim);
      } catch (_) {
        // fallback (sans animation)
        try {
          gaugeEl.style.outline = delta > 0 ? "2px solid rgba(40,200,120,0.55)" : "2px solid rgba(220,60,60,0.55)";
          gaugeEl.style.outlineOffset = "2px";
        } catch (_) {}
      }
    },

    _stopAllGaugeBlink() {
      try {
        for (const [gid, anim] of this._gaugeBlinkAnims.entries()) {
          try { anim.cancel(); } catch (_) {}
          this._gaugeBlinkAnims.delete(gid);
        }
      } catch (_) {}
    }
  };

  window.VRUIBinding = VRUIBinding;
})();


// ------------------------------
// VRealms - endings.js
// ------------------------------
(function () {
  "use strict";

  const VREndings = {
    async showEnding(universeConfig, lastDeath) {
      const overlay = document.getElementById("vr-ending-overlay");
      const titleEl = document.getElementById("ending-title");
      const textEl = document.getElementById("ending-text");

      if (!overlay || !titleEl || !textEl) return;

      const lang = localStorage.getItem("vrealms_lang") || "fr";
      const endings = universeConfig?.endings || [];
      let ending = null;

      // find matching ending by death reason/gauge
      if (lastDeath?.endingId) {
        ending = endings.find((e) => e.id === lastDeath.endingId);
      }

      if (!ending && lastDeath?.gaugeId) {
        ending = endings.find((e) => e.gaugeId === lastDeath.gaugeId);
      }

      // fallback first
      if (!ending) ending = endings[0];

      const title = lang === "fr" ? ending?.title_fr : ending?.title_en;
      const text = lang === "fr" ? ending?.text_fr : ending?.text_en;

      titleEl.textContent = title || "";
      textEl.textContent = text || "";

      overlay.style.display = "flex";
      overlay.classList.add("vr-ending-show");
      return true;
    },

    hideEnding() {
      const overlay = document.getElementById("vr-ending-overlay");
      if (!overlay) return;
      overlay.classList.remove("vr-ending-show");
      overlay.style.display = "none";
    }
  };

  window.VREndings = VREndings;
})();


// ------------------------------
// VRealms - engine-core.js
// ------------------------------
(function () {
  "use strict";

  function pickRandom(arr) {
    if (!arr || !arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  const VREngine = {
    universeConfig: null,
    deck: null,
    cardTexts: null,
    currentCardId: null,
    coinsStreak: 0,

    async init(universeId, lang) {
      const { config, deck, cardTexts } =
        await window.VREventsLoader.loadUniverseData(universeId, lang);

      this.universeConfig = config;
      this.deck = deck;
      this.cardTexts = cardTexts;

      // state
      const loaded = window.VRState.load();
      if (!loaded || loaded.universeId !== universeId) {
        window.VRState.init(config);
      } else {
        // ensure gauges exist
        const initGauges = config?.initialGauges || {};
        Object.keys(initGauges).forEach((gid) => {
          if (window.VRState.getGaugeValue(gid) == null) {
            window.VRState.setGaugeValue(gid, initGauges[gid]);
          }
        });
      }

      // ui
      window.VRUIBinding.init(config, cardTexts);

      // run
      this._startNewReign();
    },

    _startNewReign() {
      window.VRState.reset(this.universeConfig);
      window.VRState.revive();
      this.coinsStreak = 0;

      const user = window.VUserData?.load?.() || { vcoins: 0, jetons: 0 };
      const kingName = this.universeConfig?.kingName || "—";

      window.VRUIBinding.updateMeta(
        kingName,
        window.VRState.getReignYears(),
        Number(user.vcoins || 0),
        Number(user.jetons || 0)
      );
      window.VRUIBinding.updateGauges();

      this._nextCard();
    },

    _nextCard() {
      const all = this.deck?.cards || [];
      const cardId = pickRandom(all);
      if (!cardId) return;

      this.currentCardId = cardId;
      const logic = this.deck?.logic?.[cardId];
      if (!logic) {
        console.error("[VREngine] Logic manquant pour", cardId);
        return;
      }

      // show
      window.VRUIBinding.showCard(logic);
    },

    applyChoice(cardLogic, choiceId) {
      if (!window.VRState.isAlive()) return;

      const effects = cardLogic.effects?.[choiceId] || {};
      const snapshotBefore = {
        reignYears: window.VRState.getReignYears(),
        gauges: {}
      };

      // snapshot gauges
      const gaugesCfg = this.universeConfig?.gauges || [];
      gaugesCfg.forEach((g) => {
        snapshotBefore.gauges[g.id] = window.VRState.getGaugeValue(g.id) ?? 50;
      });

      // apply effects
      const yearsDelta = Number(effects.years || 0);
      if (yearsDelta) window.VRState.incYears(yearsDelta);

      gaugesCfg.forEach((g) => {
        const delta = Number(effects[g.id] || 0);
        if (delta) window.VRState.applyGaugeDelta(g.id, delta);
      });

      // history
      window.VRState.pushHistory({
        cardId: cardLogic.id,
        choiceId,
        effects,
        snapshotBefore
      });

      // game loop stats/vcoins
      window.VRGame?.onCardResolved?.();

      // ui update
      const userAfter = window.VUserData?.load?.() || {};
      const kingName =
        document.getElementById("meta-king-name")?.textContent || "—";
      window.VRUIBinding.updateMeta(
        kingName,
        window.VRState.getReignYears(),
        Number(userAfter.vcoins || 0),
        Number(userAfter.jetons || 0)
      );
      window.VRUIBinding.updateGauges();

      // death check (0 or 100 on any gauge)
      let deathGauge = null;
      gaugesCfg.forEach((g) => {
        const v = window.VRState.getGaugeValue(g.id);
        if (v <= 0 || v >= 100) deathGauge = g.id;
      });

      if (deathGauge) {
        window.VRState.kill({ gaugeId: deathGauge, reason: "gauge_limit" });
        this._handleDeath();
        return;
      }

      this._nextCard();
    },

    undoChoices(count) {
      const n = Math.max(1, Number(count || 1));
      if (window.VRState.historyLength() < 1) return false;

      let undone = 0;
      for (let i = 0; i < n; i++) {
        const entry = window.VRState.popHistory();
        if (!entry) break;

        // restore snapshot
        const snap = entry.snapshotBefore;
        if (snap) {
          window.VRState.setReignYears(snap.reignYears || 0);
          const gaugesCfg = this.universeConfig?.gauges || [];
          gaugesCfg.forEach((g) => {
            const v = snap.gauges?.[g.id];
            if (v != null) window.VRState.setGaugeValue(g.id, v);
          });
        }
        undone++;
      }

      // ui
      const userAfter = window.VUserData?.load?.() || {};
      const kingName =
        document.getElementById("meta-king-name")?.textContent || "—";
      window.VRUIBinding.updateMeta(
        kingName,
        window.VRState.getReignYears(),
        Number(userAfter.vcoins || 0),
        Number(userAfter.jetons || 0)
      );
      window.VRUIBinding.updateGauges();

      // revive if needed
      window.VRState.revive();

      // show a new card
      this._nextCard();
      return undone > 0;
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


// ------------------------------
// VRealms - Token UI + Actions
// popup, pub=>jeton, jauge 50%, revenir -3, peek (15)
// ------------------------------
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
          "background:rgba(0,0,0,85);color:#fff;padding:10px 14px;border-radius:12px;" +
          "font:14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;" +
          "z-index:2147483647;max-width:84vw;text-align:center";
        document.body.appendChild(el);
      }
      el.textContent = String(msg || "");
      el.style.opacity = "1";
      clearTimeout(el.__t1);
      clearTimeout(el.__t2);
      el.__t1 = setTimeout(() => {
        el.style.transition = "opacity .25s";
        el.style.opacity = "0";
      }, 2200);
      el.__t2 = setTimeout(() => {
        try {
          el.remove();
        } catch (_) {}
      }, 2600);
    } catch (_) {}
  }

  const VRTokenUI = {
    selectMode: false,

    _ensurePeekCard(popup) {
      // si la carte peek n'existe pas dans le HTML, on la crée
      try {
        const existing = popup.querySelector('[data-token-action="peek15"]');
        if (existing) return;

        const closeBtn = popup.querySelector('[data-token-action="close"]');
        const card = document.createElement("button");
        card.type = "button";
        card.className = "vr-card vr-token-card";
        card.setAttribute("data-token-action", "peek15");
        card.innerHTML =
          '<div class="vr-card-content">' +
          `<h4 class="vr-card-title" data-i18n="token.popup.peek.title">${t(
            "token.popup.peek.title",
            "Voir les effets (15)"
          )}</h4>` +
          `<p class="vr-card-text" data-i18n="token.popup.peek.text">${t(
            "token.popup.peek.text",
            "Pendant 15 choix, les jauges concernées clignotent et affichent un aperçu."
          )}</p>` +
          "</div>";

        if (closeBtn && closeBtn.parentElement) {
          closeBtn.parentElement.insertBefore(card, closeBtn);
        } else {
          popup.appendChild(card);
        }
      } catch (_) {}
    },

    init() {
      const btnJeton = document.getElementById("btn-jeton");
      const popup = document.getElementById("vr-token-popup");
      const overlay = document.getElementById("vr-token-gauge-overlay");
      const cancelGaugeBtn = document.getElementById("btn-cancel-gauge-select");
      const gaugesRow = document.getElementById("vr-gauges-row");

      if (!btnJeton || !popup) return;

      // crée la carte peek si absente (ton HTML actuel ne l'a pas)
      this._ensurePeekCard(popup);

      // si popup/overlay sont à l’intérieur de #view-game, on les remonte dans <body>
      try {
        const vg = document.getElementById("view-game");
        if (vg) {
          if (popup && vg.contains(popup)) document.body.appendChild(popup);
          if (overlay && vg.contains(overlay)) document.body.appendChild(overlay);
        }
      } catch (_) {}

      const _showDialog = (el, focusEl) => {
        if (!el) return;
        try {
          el.removeAttribute("inert");
        } catch (_) {}
        el.setAttribute("aria-hidden", "false");
        el.style.display = "flex";
        try {
          focusEl?.focus?.({ preventScroll: true });
        } catch (_) {}
      };

      const _hideDialog = (el, focusBackEl) => {
        if (!el) return;
        const active = document.activeElement;
        if (active && el.contains(active)) {
          try {
            active.blur();
          } catch (_) {}
          try {
            focusBackEl?.focus?.({ preventScroll: true });
          } catch (_) {}
        }
        try {
          el.setAttribute("inert", "");
        } catch (_) {}
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

      // actions popup
      popup.querySelectorAll("[data-token-action]").forEach((el) => {
        el.addEventListener("click", async () => {
          const action = el.getAttribute("data-token-action");
          if (!action) return;

          if (action === "close") {
            closePopup();
            return;
          }

          if (action === "adtoken" || action === "ad_token") {
            closePopup();
            const ok =
              (await (window.VRAds?.showRewardedAd?.({ placement: "token" }) ||
                Promise.resolve(false))) || false;

            if (ok) {
              window.VUserData?.addJetons?.(1);
              const u = window.VUserData?.load?.() || {};
              const kingName =
                document.getElementById("meta-king-name")?.textContent || "—";
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
            window.VRUIBinding?.enablePeek?.(15);
            toast(t("token.toast.peek_on", "Aperçu activé (15 choix)"));
            // refresh HUD
            const u = window.VUserData?.load?.() || {};
            const kingName =
              document.getElementById("meta-king-name")?.textContent || "—";
            window.VRUIBinding?.updateMeta?.(
              kingName,
              window.VRState?.getReignYears?.() || 0,
              Number(u.vcoins || 0),
              Number(u.jetons || 0)
            );
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
              toast(t("token.toast.undo_ok", "Retour -3 effectué"));
            }

            // refresh HUD
            const u = window.VUserData?.load?.() || {};
            const kingName =
              document.getElementById("meta-king-name")?.textContent || "—";
            window.VRUIBinding?.updateMeta?.(
              kingName,
              window.VRState?.getReignYears?.() || 0,
              Number(u.vcoins || 0),
              Number(u.jetons || 0)
            );
            return;
          }
        });
      });

      // sélection de jauge (mode gauge50)
      if (gaugesRow) {
        gaugesRow.addEventListener("click", (e) => {
          if (!this.selectMode) return;

          const gaugeEl = e.target?.closest?.(".vr-gauge");
          if (!gaugeEl) return;

          const gaugeId = gaugeEl.dataset.gaugeId;
          if (!gaugeId) return;

          // consomme 1 jeton maintenant
          const canSpend = window.VUserData?.spendJetons?.(1);
          if (!canSpend) {
            toast(t("token.toast.no_tokens", "Tu n'as pas de jeton"));
            stopSelectGauge50();
            return;
          }

          // set jauge à 50
          window.VRState?.setGaugeValue?.(gaugeId, 50);
          window.VRUIBinding?.updateGauges?.();

          stopSelectGauge50();
          toast(t("token.toast.gauge50_ok", "Jauge remise à 50%"));

          const u = window.VUserData?.load?.() || {};
          const kingName =
            document.getElementById("meta-king-name")?.textContent || "—";
          window.VRUIBinding?.updateMeta?.(
            kingName,
            window.VRState?.getReignYears?.() || 0,
            Number(u.vcoins || 0),
            Number(u.jetons || 0)
          );
        });
      }

      if (cancelGaugeBtn) {
        cancelGaugeBtn.addEventListener("click", () => stopSelectGauge50());
      }
      if (overlay) {
        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) stopSelectGauge50();
        });
      }
    }
  };

  window.VRTokenUI = VRTokenUI;
})();


// ------------------------------
// VRealms - Coins UI (popup vcoins)
// ------------------------------
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
          "background:rgba(0,0,0,85);color:#fff;padding:10px 14px;border-radius:12px;" +
          "font:14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;" +
          "z-index:2147483647;max-width:84vw;text-align:center";
        document.body.appendChild(el);
      }
      el.textContent = String(msg || "");
      el.style.opacity = "1";
      clearTimeout(el.__t1);
      clearTimeout(el.__t2);
      el.__t1 = setTimeout(() => {
        el.style.transition = "opacity .25s";
        el.style.opacity = "0";
      }, 2200);
      el.__t2 = setTimeout(() => {
        try {
          el.remove();
        } catch (_) {}
      }, 2600);
    } catch (_) {}
  }

  const VRCoinUI = {
    init() {
      const btnVcoins = document.getElementById("btn-vcoins");
      const popup = document.getElementById("vr-coins-popup");
      if (!btnVcoins || !popup) return;

      // si popup est dans #view-game, on la remonte dans <body>
      try {
        const vg = document.getElementById("view-game");
        if (vg && popup && vg.contains(popup)) document.body.appendChild(popup);
      } catch (_) {}

      const _showDialog = (el, focusEl) => {
        if (!el) return;
        try {
          el.removeAttribute("inert");
        } catch (_) {}
        el.setAttribute("aria-hidden", "false");
        el.style.display = "flex";
        try {
          focusEl?.focus?.({ preventScroll: true });
        } catch (_) {}
      };

      const _hideDialog = (el, focusBackEl) => {
        if (!el) return;
        const active = document.activeElement;
        if (active && el.contains(active)) {
          try {
            active.blur();
          } catch (_) {}
          try {
            focusBackEl?.focus?.({ preventScroll: true });
          } catch (_) {}
        }
        try {
          el.setAttribute("inert", "");
        } catch (_) {}
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

          if (action === "close") {
            closePopup();
            return;
          }

          if (action === "open_shop") {
            closePopup();
            try {
              window.location.href = "shop.html";
            } catch (_) {}
            return;
          }

          if (action === "adcoins") {
            closePopup();

            const ok =
              (await (window.VRAds?.showRewardedAd?.({
                placement: "coins_500"
              }) || Promise.resolve(false))) || false;

            if (ok) {
              window.VUserData?.addVcoins?.(500);

              const u = window.VUserData?.load?.() || {};
              const kingName =
                document.getElementById("meta-king-name")?.textContent || "—";
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


// ------------------------------
// VRealms - game.js (controller page)
// ------------------------------
window.VRGame = {
  currentUniverse: null,
  session: { reignLength: 0 },

  async onUniverseSelected(universeId) {
    this.currentUniverse = universeId;
    this.session.reignLength = 0;

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
    user.vcoins += bonus;
    user.stats.totalRuns += 1;
    if (this.session.reignLength > user.stats.bestReign)
      user.stats.bestReign = this.session.reignLength;
    window.VUserData.save(user);

    const kingName = document.getElementById("meta-king-name")?.textContent || "—";
    window.VRUIBinding.updateMeta(
      kingName,
      window.VRState.getReignYears(),
      user.vcoins,
      user.jetons
    );
  }
};


// ------------------------------
// INIT page
// ------------------------------
(function initApp() {
  "use strict";

  // ✅ anti scroll
  try {
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  } catch (_) {}

  // ✅ anti bfcache (revenir arrière navigateur => refresh propre)
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) {
      try { window.location.reload(); } catch (_) {}
    }
  });

  // ✅ anti back navigateur (on reste sur la page game)
  try {
    history.pushState({ vr_game: true }, "", location.href);
    window.addEventListener("popstate", () => {
      try {
        history.pushState({ vr_game: true }, "", location.href);
        if (typeof window.showToast === "function") window.showToast("Utilise le bouton Accueil");
      } catch (_) {}
    });
  } catch (_) {}

  // ✅ init UI popups
  try { window.VRTokenUI?.init?.(); } catch (_) {}
  try { window.VRCoinUI?.init?.(); } catch (_) {}

  // ✅ univers depuis query ?u=
  const params = new URLSearchParams(window.location.search);
  const universeId = params.get("u") || localStorage.getItem("vrealms_universe") || "hell_king";
  localStorage.setItem("vrealms_universe", universeId);

  window.VRGame.onUniverseSelected(universeId);
})();
