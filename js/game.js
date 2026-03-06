// ===============================================
// VRealms - js/game.js (bundle complet) — VERSION RÉPARÉE
// - Loader univers/decks/i18n
// - UI binding + swipe animé sur les choix (A/B/C)
// - State / Endings / Engine core
// - Popups Jeton & VCoins
// - Popup Personnalisation
// - VRGame + anti-retour navigateur (best-effort)
// - ✅ SAVE LOCAL PAR UNIVERS (reprise session)
// - ✅ EVENTS: toutes les 3 cartes -> 1/10, pool 30, anti-répétition 25/30
// - ✅ Fix: events anti-répétition = 25 DISTINCTS (pas “25 tirages”)
// - ✅ Fix: undo/save restore aussi les jetons UI
// - ✅ FIX(1): swipe = PointerEvents only (+ fallback touch si pas PointerEvent)
// - ✅ FIX(2): _handleDeath() n’empile plus de listeners (bind once + delegation)
// - ✅ FIX(3): events jetons: UI ne bouge que si DB ok + refresh soft après event
// - ✅ FIX(5): i18n overlay event (Continuer / Événement) avec fallback
// - ✅ COSMETICS: fallback gris + popup perso + application live
// - ✅ FIX POPUP COSMETICS: une seule ligne rerender au scroll, plus de flash global
// - ✅ JETON PEEK: blink/zoom seulement hors-peek + delta +/−% affiché en peek + % jauges mis à jour
// - ✅ FIX CRITIQUE: ne restaure plus une save morte/corrompue
// - ✅ FIX UI: popups jetons/vcoins en cartouches basiques, sans images du jeu
// ===============================================


// -------------------------------------------------------
// Helpers profil (100% Supabase authoritative)
// -------------------------------------------------------
(function () {
  "use strict";

  const _mem = { me: null, ts: 0 };

  async function getMeFresh(maxAgeMs) {
    const now = Date.now();
    const age = now - (_mem.ts || 0);
    if (_mem.me && age <= (maxAgeMs || 0)) return _mem.me;

    try {
      const me = await window.VRRemoteStore?.getMe?.();
      if (me) {
        _mem.me = me;
        _mem.ts = now;
        return me;
      }
    } catch (_) {}

    return _mem.me;
  }

  function n(x) {
    const v = Number(x);
    return Number.isFinite(v) ? v : 0;
  }

  window.VRProfile = window.VRProfile || {
    async getMe(maxAgeMs) { return await getMeFresh(maxAgeMs); },
    _n: n
  };
})();


// -------------------------------------------------------
// ✅ Save system local (par univers) — reprise session
// -------------------------------------------------------
(function () {
  "use strict";

  const SAVE_PREFIX = "vrealms_save_";
  const SAVE_VERSION = 1;

  function _key(universeId) {
    return `${SAVE_PREFIX}${String(universeId || "unknown")}`;
  }

  function _safeParse(raw) {
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  function load(universeId) {
    try {
      const raw = localStorage.getItem(_key(universeId));
      if (!raw) return null;
      const data = _safeParse(raw);
      if (!data || typeof data !== "object") return null;
      if (data.version !== SAVE_VERSION) return null;
      if (data.universeId !== universeId) return null;
      return data;
    } catch (_) {
      return null;
    }
  }

  function save(universeId, payload) {
    try {
      const data = {
        version: SAVE_VERSION,
        universeId,
        ts: Date.now(),
        ...payload
      };
      localStorage.setItem(_key(universeId), JSON.stringify(data));
      return true;
    } catch (_) {
      return false;
    }
  }

  function clear(universeId) {
    try { localStorage.removeItem(_key(universeId)); } catch (_) {}
  }

  window.VRSave = { load, save, clear, _key };
})();


// -------------------------------------------------------
// Badge thresholds (sans mort)
// -------------------------------------------------------
const VR_BADGE_BRONZE_CHOICES = 40;
const VR_BADGE_SILVER_CHOICES = 60;
const VR_BADGE_GOLD_CHOICES = 100;


// -------------------------------------------------------
// Loader univers / deck / textes / events
// -------------------------------------------------------
(function () {
  "use strict";

  const SCENARIOS_PATH = "data/scenarios";
  const LEGACY_CONFIG_PATH = "data/universes";
  const LEGACY_DECKS_PATH = "data/decks";
  const LEGACY_I18N_PATH = "data/i18n";
  const LEGACY_EVENTS_LOGIC_PATH = "data/events";

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

    async loadUniverseEvents(universeId, lang) {
      const logicPromise = this._loadEventsLogic(universeId);
      const textsPromise = this._loadEventsTexts(universeId, lang);

      const [logic, texts] = await Promise.all([logicPromise, textsPromise]);

      return { eventsLogic: logic, eventsTexts: texts };
    },

    async _loadConfig(universeId) {
      const urlNew = `${SCENARIOS_PATH}/${universeId}/config.json`;
      let res = await fetch(urlNew, { cache: "no-cache" });

      if (!res.ok) {
        const urlOld = `${LEGACY_CONFIG_PATH}/${universeId}.config.json`;
        res = await fetch(urlOld, { cache: "no-cache" });
      }

      if (!res.ok) {
        throw new Error(`[VREventsLoader] Impossible de charger la config univers ${universeId}`);
      }
      return res.json();
    },

    async _loadDeck(universeId) {
      const urlNew = `${SCENARIOS_PATH}/${universeId}/deck.json`;
      let res = await fetch(urlNew, { cache: "no-cache" });

      if (!res.ok) {
        const urlOld = `${LEGACY_DECKS_PATH}/${universeId}.json`;
        res = await fetch(urlOld, { cache: "no-cache" });
      }

      if (!res.ok) {
        throw new Error(`[VREventsLoader] Impossible de charger le deck pour ${universeId}`);
      }

      const deckJson = await res.json();
      const cards = Array.isArray(deckJson) ? deckJson : (deckJson?.cards || null);

      if (!Array.isArray(cards)) {
        throw new Error(`[VREventsLoader] Deck invalide pour ${universeId} (attendu array ou {cards:[]}).`);
      }
      return cards;
    },

    async _loadCardTexts(universeId, lang) {
      const urlNew = `${SCENARIOS_PATH}/${universeId}/cards_${lang}.json`;
      const urlOld1 = `${LEGACY_I18N_PATH}/${lang}/cards_${universeId}.json`;
      const urlOld2 = `${LEGACY_I18N_PATH}/cards_${universeId}_${lang}.json`;

      let res = await fetch(urlNew, { cache: "no-cache" });
      if (!res.ok) res = await fetch(urlOld1, { cache: "no-cache" });
      if (!res.ok) res = await fetch(urlOld2, { cache: "no-cache" });

      if (!res.ok) {
        throw new Error(`[VREventsLoader] Impossible de charger les cartes de ${universeId} en ${lang}`);
      }
      return res.json();
    },

    async _loadEventsLogic(universeId) {
      const urlNew = `${SCENARIOS_PATH}/${universeId}/logic_events.json`;
      let res = await fetch(urlNew, { cache: "no-cache" });

      if (!res.ok) {
        const urlOld = `${LEGACY_EVENTS_LOGIC_PATH}/logic_events_${universeId}.json`;
        res = await fetch(urlOld, { cache: "no-cache" });
      }

      if (!res.ok) return { events: [] };

      const data = await res.json();
      if (Array.isArray(data)) return { events: data };
      if (data && typeof data === "object" && Array.isArray(data.events)) return data;
      return { events: [] };
    },

    async _loadEventsTexts(universeId, lang) {
      const urlNew = `${SCENARIOS_PATH}/${universeId}/events_${lang}.json`;
      const urlOld1 = `${LEGACY_I18N_PATH}/${lang}/events_${universeId}.json`;
      const urlOld2 = `${LEGACY_I18N_PATH}/events_${universeId}_${lang}.json`;

      let res = await fetch(urlNew, { cache: "no-cache" });
      if (!res.ok) res = await fetch(urlOld1, { cache: "no-cache" });
      if (!res.ok) res = await fetch(urlOld2, { cache: "no-cache" });

      if (!res.ok) return {};
      const data = await res.json();
      return (data && typeof data === "object") ? data : {};
    }
  };

  window.VREventsLoader = VREventsLoader;
})();


(function () {
  "use strict";

  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const HAS_POINTER = ("PointerEvent" in window);

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
    peekRemaining: 0,
    _peekChoiceActive: null,

    init(universeConfig, lang, cardTextsDict) {
      this.universeConfig = universeConfig;
      this.lang = lang || "fr";
      this.cardTextsDict = cardTextsDict || {};

      this.peekRemaining = 0;
      this._peekChoiceActive = null;
      try { document.body?.classList?.remove("vr-peek-mode"); } catch (_) {}

      this._ensurePeekStyles();
      this._setupGaugeLabels();
      this._ensureGaugePreviewBars();
      this.updateGauges();
      this._setupChoiceButtons();
    },

    enablePeek(steps) {
      const n = Math.max(0, Math.min(Number(steps || 0), 99));
      this.peekRemaining = n;

      this._ensurePeekStyles();

      try {
        if (n > 0) document.body.classList.add("vr-peek-mode");
        else document.body.classList.remove("vr-peek-mode");
      } catch (_) {}

      this.updateGauges();
    },

    _ensurePeekStyles() {
      try {
        const ID = "vr_peek_styles";
        if (document.getElementById(ID)) return;

        const style = document.createElement("style");
        style.id = ID;
        style.textContent = `
@keyframes vrGaugeBlinkGlow {
  0%   { filter: brightness(1); }
  50%  { filter: brightness(1.25); }
  100% { filter: brightness(1); }
}
@keyframes vrGaugeBlinkPulse {
  0%   { transform: translateZ(0) scale(1); }
  50%  { transform: translateZ(0) scale(1.01); }
  100% { transform: translateZ(0) scale(1); }
}

.vr-gauge-value{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:6px;
  min-width:64px;
  line-height:1.05;
  font:900 12px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  letter-spacing:.2px;
  text-shadow:0 2px 10px rgba(0,0,0,.45);
}

body:not(.vr-peek-mode) .vr-gauge-value{
  opacity:0 !important;
  visibility:hidden !important;
}

body.vr-peek-mode .vr-gauge-value{
  opacity:1 !important;
  visibility:visible !important;
}

.vr-gauge-delta:empty{
  display:none !important;
}

body.vr-peek-mode .vr-gauge.vr-peek-up .vr-gauge-delta{
  color:rgba(170,255,210,.98);
}
body.vr-peek-mode .vr-gauge.vr-peek-down .vr-gauge-delta{
  color:rgba(255,190,190,.98);
}

body:not(.vr-peek-mode) .vr-gauge.vr-peek-up .vr-gauge-fill,
body:not(.vr-peek-mode) .vr-gauge.vr-peek-down .vr-gauge-fill{
  transform-origin:50% 50%;
  animation:
    vrGaugeBlinkGlow 650ms ease-in-out infinite,
    vrGaugeBlinkPulse 650ms ease-in-out infinite;
}

body.vr-peek-mode .vr-gauge.vr-peek-up .vr-gauge-fill,
body.vr-peek-mode .vr-gauge.vr-peek-down .vr-gauge-fill{
  animation:none !important;
  filter:brightness(1.12) saturate(1.06);
}

body:not(.vr-peek-mode) .vr-gauge-preview{
  opacity:0 !important;
}
body.vr-peek-mode .vr-gauge-preview{
  position:absolute;
  inset:0;
  pointer-events:none;
  opacity:.55;
  clip-path:inset(calc(100% - var(--vr-pct, 0%)) 0 0 0);
}
`;
        (document.head || document.documentElement).appendChild(style);
      } catch (_) {}
    },

    _consumePeekDecision() {
      if (this.peekRemaining <= 0) return;

      this.peekRemaining = Math.max(0, this.peekRemaining - 1);

      if (this.peekRemaining <= 0) {
        this.peekRemaining = 0;
        this._clearPeek();
        try { document.body.classList.remove("vr-peek-mode"); } catch (_) {}
        this.updateGauges();
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
        try {
          el.querySelectorAll(".vr-gauge-under").forEach((n) => n.remove());
        } catch (_) {}

        let preview = el.querySelector(".vr-gauge-preview");
        if (!preview) {
          preview = document.createElement("div");
          preview.className = "vr-gauge-preview";
          preview.style.setProperty("--vr-pct", "0%");

          const frame = el.querySelector(".vr-gauge-frame");
          if (frame) {
            try {
              const pos = getComputedStyle(frame).position;
              if (pos === "static") frame.style.position = "relative";
            } catch (_) {}
            frame.appendChild(preview);
          }
        }
      });
    },

    updateGauges() {
      const gaugesCfg = this.universeConfig?.gauges || [];
      const gaugeEls = document.querySelectorAll(".vr-gauge");

      const isPeek = (() => {
        try { return document.body.classList.contains("vr-peek-mode"); }
        catch (_) { return false; }
      })();

      gaugeEls.forEach((gEl, idx) => {
        const cfg = gaugesCfg[idx];
        const gaugeId = gEl?.dataset?.gaugeId || cfg?.id || null;
        if (!gaugeId) return;

        const val =
          (window.VRState?.getGaugeValue?.(gaugeId) ??
            this.universeConfig?.initialGauges?.[gaugeId] ??
            cfg?.start ??
            50);

        const safeVal = clamp(Number(val) || 0, 0, 100);

        const fillEl = gEl.querySelector(".vr-gauge-fill");
        if (fillEl) {
          fillEl.dataset.gaugeId = gaugeId;
          fillEl.style.setProperty("--vr-pct", `${safeVal}%`);
        }

        const valEl = gEl.querySelector(".vr-gauge-val");
        if (valEl) valEl.textContent = isPeek ? `${Math.round(safeVal)}%` : "";

        const deltaEl = gEl.querySelector(".vr-gauge-delta");
        if (deltaEl) deltaEl.textContent = "";

        const previewEl = gEl.querySelector(".vr-gauge-preview");
        if (previewEl) previewEl.style.setProperty("--vr-pct", "0%");
      });

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
      this.updateGauges();
    },

    _resetChoiceCards() {
      const btns = document.querySelectorAll(".vr-choice-button[data-choice]");
      btns.forEach((b) => {
        b.style.transition = "";
        b.style.transform = "";
      });
    },

    _setupChoiceButtons() {
      const buttons = Array.from(document.querySelectorAll(".vr-choice-button[data-choice]"));

      buttons.forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
        });

        try { btn.style.touchAction = "none"; } catch (_) {}
        this._setupSwipeOnChoiceCard(btn);
      });
    },

    _setupSwipeOnChoiceCard(btn) {
      const TH = 62;
      const ROT_MAX = 12;
      const PREVIEW_TH = 12;
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

        if (Math.abs(dy) > Math.abs(dx) * 1.25) {
          this._clearPeek();
          setTransform(dx * 0.25);
          return;
        }

        if (Math.abs(dx) >= PREVIEW_TH) {
          const choiceId = btn.getAttribute("data-choice");
          if (choiceId) {
            if (this.peekRemaining > 0) this._showPeekForChoice(choiceId);
            else this._showBlinkOnlyForChoice(choiceId);
          }
        } else {
          this._clearPeek();
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
          if (!choiceId) { animateBack(); return; }

          animateFlyOut(dx, () => {
            try { window.VREngine.applyChoice(this.currentCardLogic, choiceId); } catch (_) {}
          });
        } else {
          animateBack();
        }
      };

      if (HAS_POINTER) {
        btn.addEventListener("pointerdown", onDown, { passive: false });
        btn.addEventListener("pointermove", onMove, { passive: false });
        btn.addEventListener("pointerup", onUp, { passive: true });
        btn.addEventListener("pointercancel", onUp, { passive: true });
      } else {
        btn.addEventListener("touchstart", onDown, { passive: false });
        btn.addEventListener("touchmove", onMove, { passive: false });
        btn.addEventListener("touchend", onUp, { passive: true });
        btn.addEventListener("touchcancel", onUp, { passive: true });
      }
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

      try {
        document.querySelectorAll(".vr-gauge-preview").forEach((previewEl) => {
          previewEl.style.setProperty("--vr-pct", "0%");
        });

        document.querySelectorAll(".vr-gauge-delta").forEach((dEl) => {
          dEl.textContent = "";
        });
      } catch (_) {}

      this._clearPeekClasses();
    },

    _showBlinkOnlyForChoice(choiceId) {
      if (!this.currentCardLogic?.choices?.[choiceId]) return;

      this._clearPeekClasses();
      try {
        document.querySelectorAll(".vr-gauge-delta").forEach((dEl) => {
          dEl.textContent = "";
        });
      } catch (_) {}

      const deltas = this.currentCardLogic.choices[choiceId]?.gaugeDelta || {};
      for (const [gaugeId, delta] of Object.entries(deltas)) {
        if (typeof delta !== "number" || delta === 0) continue;

        const el = document.querySelector(`.vr-gauge[data-gauge-id="${gaugeId}"]`);
        if (!el) continue;

        el.classList.add(delta > 0 ? "vr-peek-up" : "vr-peek-down");
      }
    },

    _showPeekForChoice(choiceId) {
      if (!this.currentCardLogic?.choices?.[choiceId]) return;

      this._peekChoiceActive = choiceId;

      const gaugesCfg = this.universeConfig?.gauges || [];
      const gaugeEls = document.querySelectorAll(".vr-gauge");
      const previewEls = document.querySelectorAll(".vr-gauge-preview");

      gaugeEls.forEach((g, idx) => {
        g.classList.remove("vr-peek-up");
        g.classList.remove("vr-peek-down");

        const cfg = gaugesCfg[idx];
        const gaugeId = g?.dataset?.gaugeId || cfg?.id || null;

        const currentVal =
          (gaugeId != null)
            ? (window.VRState?.getGaugeValue?.(gaugeId) ??
              this.universeConfig?.initialGauges?.[gaugeId] ??
              cfg?.start ??
              50)
            : 50;

        const valEl = g.querySelector(".vr-gauge-val");
        if (valEl) valEl.textContent = `${Math.round(Number(currentVal) || 0)}%`;

        const deltaEl = g.querySelector(".vr-gauge-delta");
        if (deltaEl) deltaEl.textContent = "";
      });

      previewEls.forEach((previewEl, idx) => {
        const cfg = gaugesCfg[idx];
        if (!cfg) return;

        const gaugeId = cfg.id;

        const baseVal =
          (window.VRState?.getGaugeValue?.(gaugeId) ??
            this.universeConfig?.initialGauges?.[gaugeId] ??
            cfg?.start ??
            50);

        const d = this.currentCardLogic.choices[choiceId]?.gaugeDelta?.[gaugeId];
        const delta = (typeof d === "number") ? d : 0;

        const previewVal = clamp((Number(baseVal) || 0) + delta, 0, 100);
        previewEl.style.setProperty("--vr-pct", `${previewVal}%`);

        const gaugeEl = gaugeEls[idx];
        if (!gaugeEl) return;

        if (delta > 0) gaugeEl.classList.add("vr-peek-up");
        else if (delta < 0) gaugeEl.classList.add("vr-peek-down");

        const deltaEl = gaugeEl.querySelector(".vr-gauge-delta");
        if (deltaEl) {
          if (delta > 0) deltaEl.textContent = `+${Math.round(delta)}%`;
          else if (delta < 0) deltaEl.textContent = `-${Math.round(Math.abs(delta))}%`;
          else deltaEl.textContent = "";
        }
      });
    }
  };

  window.VRUIBinding = VRUIBinding;
})();


// -------------------------------------------------------
// State
// -------------------------------------------------------
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


// -------------------------------------------------------
// Endings
// -------------------------------------------------------
(function () {
  "use strict";

  const ENDINGS_BASE_PATH = "data/scenarios";
  const cache = new Map();

  async function loadEndings(universeId, lang) {
    const key = `${universeId}__${lang}`;
    if (cache.has(key)) return cache.get(key);

    const urlNew = `${ENDINGS_BASE_PATH}/${universeId}/endings_${lang}.json`;
    const urlOld1 = `data/i18n/${lang}/endings_${universeId}.json`;
    const urlOld2 = `data/i18n/endings_${universeId}_${lang}.json`;

    let res = await fetch(urlNew, { cache: "no-cache" });
    if (!res.ok) res = await fetch(urlOld1, { cache: "no-cache" });
    if (!res.ok) res = await fetch(urlOld2, { cache: "no-cache" });

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

    let lang = "fr";
    try {
      const me = await window.VRProfile?.getMe?.(4000);
      lang = (me?.lang || "fr").toString();
    } catch (_) {
      lang = localStorage.getItem("vrealms_lang") || "fr";
    }

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


// -------------------------------------------------------
// Engine core
// -------------------------------------------------------
(function () {
  "use strict";

  const RECENT_MEMORY_SIZE = 4;
  const BASE_COINS_PER_CARD = 5;
  const HISTORY_MAX = 30;

  const EVENT_CHECK_EVERY_N_CARDS = 3;
  const EVENT_CHANCE = 0.10;
  const EVENT_NO_REPEAT_UNTIL = 25;
  const EVENT_EXCLUDE_LAST = 5;

  const CHOICES_PER_YEAR = 4;
  const VCOINS_PER_YEAR = 10;

  function toRoman(num) {
    const n = Math.max(1, Number(num || 1));
    const map = [
      [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
      [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
      [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]
    ];

    let rest = n;
    let out = "";

    for (const [value, symbol] of map) {
      while (rest >= value) {
        out += symbol;
        rest -= value;
      }
    }

    return out || "I";
  }

  function getProfilePseudo() {
    try {
      const raw =
        window.VUserData?.getUsername?.() ||
        window.VUserData?.load?.()?.username ||
        "";

      const clean = String(raw || "").trim();
      return clean || "—";
    } catch (_) {
      return "—";
    }
  }

  function getResolvedChoicesCount() {
    try {
      return Math.max(0, Number(window.VRGame?.session?.reignLength || 0));
    } catch (_) {
      return 0;
    }
  }

  function getCompletedYearsCount() {
    return Math.floor(getResolvedChoicesCount() / CHOICES_PER_YEAR);
  }

  function getDisplayedYearIndex() {
    return getCompletedYearsCount() + 1;
  }

  function getYearLabel() {
    let label = "Année";

    try {
      const out = window.VRI18n?.t?.("game.year_label");
      if (out && out !== "game.year_label") label = out;
    } catch (_) {}

    return `${label} ${toRoman(getDisplayedYearIndex())}`;
  }

  function getDynastyName() {
    return `${getProfilePseudo()} ${toRoman(getDisplayedYearIndex())}`;
  }

  function deepClone(obj) {
    try { return JSON.parse(JSON.stringify(obj)); } catch (_) { return obj; }
  }

  function asInt(x, fallback) {
    const n = Number(x);
    return Number.isFinite(n) ? Math.trunc(n) : (fallback || 0);
  }

  function ensureEndingEnhancements() {
    try {
      if (!document.getElementById("vr-ending-inline-style")) {
        const style = document.createElement("style");
        style.id = "vr-ending-inline-style";
        style.textContent = `
          #vr-ending-overlay .vr-ending-card{
            text-align:center;
            align-items:stretch;
            gap:12px;
          }
          #vr-ending-overlay .vr-ending-title,
          #vr-ending-overlay .vr-ending-text{
            text-align:center !important;
          }
          .vr-ending-reward{
            display:flex;
            align-items:center;
            justify-content:center;
            gap:10px;
            padding:10px 14px;
            border-radius:16px;
            background:rgba(255,255,255,.08);
            border:1px solid rgba(255,255,255,.12);
            box-shadow:0 14px 26px rgba(0,0,0,.24);
          }
          .vr-ending-reward img{
            width:24px;
            height:24px;
            object-fit:contain;
            filter:drop-shadow(0 6px 12px rgba(0,0,0,.32));
          }
          .vr-ending-reward strong{
            font-size:20px;
            font-weight:950;
            letter-spacing:.2px;
          }
          .vr-ending-double{
            position:relative;
            overflow:hidden;
            display:flex;
            flex-direction:column;
            align-items:center;
            justify-content:center;
            gap:4px;
            width:100%;
            min-height:92px;
            border:1px solid rgba(255,255,255,.14);
            border-radius:22px;
            padding:14px 16px;
            background:linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.05));
            box-shadow:0 18px 34px rgba(0,0,0,.28);
            color:#fff;
            font:inherit;
            cursor:pointer;
          }
          .vr-ending-double::before{
            content:"";
            position:absolute;
            inset:0;
            background:radial-gradient(circle at 50% 18%, rgba(255,255,255,.20), transparent 55%);
            pointer-events:none;
          }
          .vr-ending-double.is-glow{
            animation:vrEndingPulse 1.35s ease-in-out infinite;
          }
          .vr-ending-double[disabled]{
            opacity:.65;
            cursor:default;
            animation:none !important;
          }
          .vr-ending-double-title{
            display:flex;
            align-items:center;
            justify-content:center;
            gap:10px;
            font-size:20px;
            font-weight:950;
            line-height:1.05;
          }
          .vr-ending-double-title img{
            width:28px;
            height:28px;
            object-fit:contain;
            filter:drop-shadow(0 6px 12px rgba(0,0,0,.34));
          }
          .vr-ending-double-sub{
            font-size:13px;
            font-weight:800;
            opacity:.92;
          }
          .vr-ending-actions{
            display:flex;
            flex-direction:column;
            gap:10px;
          }
          .vr-ending-actions .vr-choice-button{
            width:100%;
          }
          .vr-ending-actions-bottom{
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:10px;
          }
          @keyframes vrEndingPulse{
            0%,100%{ transform:translateY(0) scale(1); filter:brightness(1); }
            50%{ transform:translateY(-1px) scale(1.01); filter:brightness(1.10); }
          }
        `;
        document.head.appendChild(style);
      }

      const card = document.querySelector("#vr-ending-overlay .vr-ending-card");
      const textEl = document.getElementById("ending-text");
      const restartBtn = document.getElementById("ending-restart-btn");
      const reviveBtn = document.getElementById("ending-revive-btn");
      const returnBtn = document.getElementById("ending-return-btn");
      if (!card || !textEl || !restartBtn || !reviveBtn || !returnBtn) return;

      let reward = document.getElementById("ending-reward-row");
      if (!reward) {
        reward = document.createElement("div");
        reward.id = "ending-reward-row";
        reward.className = "vr-ending-reward";
        reward.innerHTML = `
          <img src="assets/img/ui/vcoins.webp" alt="" draggable="false">
          <strong id="ending-reward-value">+0</strong>
        `;
        textEl.insertAdjacentElement("afterend", reward);
      }

      let doubleBtn = document.getElementById("ending-double-btn");
      if (!doubleBtn) {
        doubleBtn = document.createElement("button");
        doubleBtn.id = "ending-double-btn";
        doubleBtn.type = "button";
        doubleBtn.className = "vr-ending-double is-glow";
        doubleBtn.innerHTML = `
          <span class="vr-ending-double-title">
            <img src="assets/img/ui/vcoins.webp" alt="" draggable="false">
            <span id="ending-double-title">Doubler ton gain</span>
          </span>
          <span class="vr-ending-double-sub" id="ending-double-sub">Regarder une pub récompensée</span>
        `;
        reward.insertAdjacentElement("afterend", doubleBtn);
      }

      let actions = document.getElementById("ending-actions-wrap");
      if (!actions) {
        actions = document.createElement("div");
        actions.id = "ending-actions-wrap";
        actions.className = "vr-ending-actions";
        doubleBtn.insertAdjacentElement("afterend", actions);
        actions.appendChild(reviveBtn);

        const bottom = document.createElement("div");
        bottom.className = "vr-ending-actions-bottom";
        bottom.appendChild(restartBtn);
        bottom.appendChild(returnBtn);
        actions.appendChild(bottom);
      }
    } catch (_) {}
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
    _reviveUsed: false,
    history: [],
    _uiCoins: 0,
    _uiTokens: 0,
    _restored: false,
    eventsLogic: { events: [] },
    eventsTexts: {},
    _eventById: new Map(),
    _allEventIds: [],
    _eventPool: [],
    _seenEvents: [],
    _cardsSinceEventRoll: 0,
    _eventShowing: false,
    _deathUiBound: false,
    _pendingRunBonusCoins: 0,
    _pendingEndReward: 0,
    _pendingEndChoices: 0,
    _pendingEndYears: 0,
    _pendingEndClaimed: false,
    _pendingEndClaimMultiplier: 1,
    _pendingEndFinalized: false,

    _clearPendingEndState() {
      this._pendingEndReward = 0;
      this._pendingEndChoices = 0;
      this._pendingEndYears = 0;
      this._pendingEndClaimed = false;
      this._pendingEndClaimMultiplier = 1;
      this._pendingEndFinalized = false;
    },

    _preparePendingEndReward() {
      this._pendingEndChoices = getResolvedChoicesCount();
      this._pendingEndYears = getCompletedYearsCount();
      this._pendingEndReward = Math.max(0, (this._pendingEndYears * VCOINS_PER_YEAR) + asInt(this._pendingRunBonusCoins, 0));
      this._pendingEndClaimed = false;
      this._pendingEndClaimMultiplier = 1;
      this._pendingEndFinalized = false;
      return {
        choices: this._pendingEndChoices,
        years: this._pendingEndYears,
        reward: this._pendingEndReward
      };
    },

    async _claimPendingEndReward(multiplier) {
      const base = Math.max(0, asInt(this._pendingEndReward, 0));
      const mult = Math.max(1, asInt(multiplier, 1));

      if (this._pendingEndClaimed) {
        return { ok: true, amount: Math.max(0, base * asInt(this._pendingEndClaimMultiplier, 1)), already: true };
      }

      const amount = Math.max(0, base * mult);

      if (amount > 0) {
        const ok = await (window.VUserData?.addVcoins?.(amount) || Promise.resolve(true));
        if (ok === false) return { ok: false, amount: 0 };
      }

      this._pendingEndClaimed = true;
      this._pendingEndClaimMultiplier = mult;

      try {
        const me = await window.VRProfile?.getMe?.(0);
        if (me) {
          this._uiCoins = window.VRProfile._n(me.vcoins);
          this._uiTokens = window.VRProfile._n(me.jetons);
        } else if (amount > 0) {
          this._uiCoins += amount;
        }
      } catch (_) {
        if (amount > 0) this._uiCoins += amount;
      }

      try {
        window.VRUIBinding?.updateMeta?.(getDynastyName(), getYearLabel(), this._uiCoins, this._uiTokens);
      } catch (_) {}

      this._saveRunSoft();
      return { ok: true, amount, already: false };
    },

    async _finalizeEndedRun(multiplier) {
      if (!this._pendingEndFinalized) {
        const claimed = await this._claimPendingEndReward(multiplier || 1);
        if (!claimed?.ok) return { ok: false, amount: 0 };

        await window.VRGame?.onRunEnded?.();
        this._pendingEndFinalized = true;
        this._saveRunSoft();
        return { ok: true, amount: claimed.amount || 0 };
      }

      return {
        ok: true,
        amount: Math.max(0, asInt(this._pendingEndReward, 0) * Math.max(1, asInt(this._pendingEndClaimMultiplier, 1)))
      };
    },

    _distinctSeenCount() {
      try { return new Set(Array.isArray(this._seenEvents) ? this._seenEvents : []).size; }
      catch (_) { return 0; }
    },

    _rebuildEventIndex() {
      this._eventById = new Map();
      const arr = Array.isArray(this.eventsLogic?.events) ? this.eventsLogic.events : [];
      arr.forEach((ev) => {
        if (ev && ev.id) this._eventById.set(ev.id, ev);
      });

      this._allEventIds = Array.from(this._eventById.keys());

      if (!Array.isArray(this._eventPool)) this._eventPool = [];
      if (!Array.isArray(this._seenEvents)) this._seenEvents = [];

      const allow = new Set(this._allEventIds);
      this._eventPool = this._eventPool.filter(id => allow.has(id));
      this._seenEvents = this._seenEvents.filter(id => allow.has(id));

      if (!this._eventPool.length && this._allEventIds.length) {
        this._eventPool = this._allEventIds.slice();
      }

      if (!Number.isFinite(this._cardsSinceEventRoll)) this._cardsSinceEventRoll = 0;
    },

    _makeSavePayload() {
      try {
        return {
          state: {
            alive: !!window.VRState?.alive,
            lastDeath: window.VRState?.lastDeath || null,
            reignYears: Number(window.VRState?.reignYears || 0),
            cardsPlayed: Number(window.VRState?.cardsPlayed || 0),
            gauges: deepClone(window.VRState?.gauges || {})
          },
          engine: {
            reignIndex: Number(this.reignIndex || 0),
            recentCards: deepClone(this.recentCards || []),
            coinsStreak: Number(this.coinsStreak || 0),
            currentCardId: this.currentCardLogic?.id || null,
            reviveUsed: !!this._reviveUsed,
            events: {
              cardsSinceRoll: asInt(this._cardsSinceEventRoll, 0),
              pool: Array.isArray(this._eventPool) ? deepClone(this._eventPool) : [],
              seen: Array.isArray(this._seenEvents) ? deepClone(this._seenEvents) : []
            },
            ui: {
              coins: asInt(this._uiCoins, 0),
              tokens: asInt(this._uiTokens, 0)
            },
            pending: {
              runBonusCoins: asInt(this._pendingRunBonusCoins, 0),
              endReward: asInt(this._pendingEndReward, 0),
              endChoices: asInt(this._pendingEndChoices, 0),
              endYears: asInt(this._pendingEndYears, 0),
              endClaimed: !!this._pendingEndClaimed,
              endClaimMultiplier: asInt(this._pendingEndClaimMultiplier, 1),
              endFinalized: !!this._pendingEndFinalized
            }
          },
          session: {
            reignLength: Number(window.VRGame?.session?.reignLength || 0)
          }
        };
      } catch (_) {
        return null;
      }
    },

    _saveRunSoft() {
      try {
        const universeId =
          this.universeId ||
          window.VRState?.universeId ||
          localStorage.getItem("vrealms_universe") ||
          "unknown";

        const payload = this._makeSavePayload();
        if (!payload) return;
        window.VRSave?.save?.(universeId, payload);
      } catch (_) {}
    },

    _clearBrokenRunSave() {
      try {
        const universeId =
          this.universeId ||
          window.VRState?.universeId ||
          localStorage.getItem("vrealms_universe") ||
          "unknown";
        window.VRSave?.clear?.(universeId);
      } catch (_) {}
    },

    _isTerminalGaugeState(gauges) {
      try {
        for (const v of Object.values(gauges || {})) {
          const n = Number(v);
          if (!Number.isFinite(n)) return true;
          if (n <= 0 || n >= 100) return true;
        }
      } catch (_) {
        return true;
      }
      return false;
    },

    _restoreFromSaveIfAny() {
      try {
        const universeId = this.universeId;
        if (!universeId) return false;

        const saved = window.VRSave?.load?.(universeId);
        if (!saved) return false;

        const s = saved.state || {};
        const e = saved.engine || {};
        const sess = saved.session || {};

        // ✅ si la save est morte/cassée, on la jette
        if (!s || typeof s !== "object" || !s.gauges || typeof s.gauges !== "object") {
          this._clearBrokenRunSave();
          return false;
        }

        if (s.alive === false) {
          this._clearBrokenRunSave();
          return false;
        }

        if (this._isTerminalGaugeState(s.gauges)) {
          this._clearBrokenRunSave();
          return false;
        }

        window.VRState.gauges = deepClone(s.gauges) || window.VRState.gauges;
        window.VRState.alive = true;
        window.VRState.lastDeath = null;
        window.VRState.reignYears = Number(s.reignYears || 0);
        window.VRState.cardsPlayed = Number(s.cardsPlayed || 0);

        this.reignIndex = Math.max(0, Number(e.reignIndex || 0));
        this.recentCards = Array.isArray(e.recentCards) ? deepClone(e.recentCards) : [];
        this.coinsStreak = Number(e.coinsStreak || 0);
        this._reviveUsed = !!e.reviveUsed;

        const evs = e.events || {};
        this._cardsSinceEventRoll = asInt(evs.cardsSinceRoll, 0);
        this._eventPool = Array.isArray(evs.pool) ? deepClone(evs.pool) : [];
        this._seenEvents = Array.isArray(evs.seen) ? deepClone(evs.seen) : [];

        const ui = e.ui || {};
        if (Number.isFinite(Number(ui.coins))) this._uiCoins = asInt(ui.coins, this._uiCoins);
        if (Number.isFinite(Number(ui.tokens))) this._uiTokens = asInt(ui.tokens, this._uiTokens);

        const pending = e.pending || {};
        this._pendingRunBonusCoins = asInt(pending.runBonusCoins, 0);
        this._pendingEndReward = asInt(pending.endReward, 0);
        this._pendingEndChoices = asInt(pending.endChoices, 0);
        this._pendingEndYears = asInt(pending.endYears, 0);
        this._pendingEndClaimed = !!pending.endClaimed;
        this._pendingEndClaimMultiplier = Math.max(1, asInt(pending.endClaimMultiplier, 1));
        this._pendingEndFinalized = !!pending.endFinalized;

        if (window.VRGame?.session) {
          window.VRGame.session.reignLength = Number(sess.reignLength || 0);
        }

        const cardId = e.currentCardId || null;
        const card = cardId ? this.deck.find(c => c && c.id === cardId) : null;

        if (card) {
          this.currentCardLogic = card;
          window.VRUIBinding.showCard(card);
        } else {
          const deck = this.deck || [];
          if (!deck.length) {
            this._clearBrokenRunSave();
            return false;
          }

          const candidates = deck.filter(c => c && !this.recentCards.includes(c.id));
          const pool = candidates.length ? candidates : deck;
          const picked = pool[Math.floor(Math.random() * pool.length)];
          if (!picked) {
            this._clearBrokenRunSave();
            return false;
          }

          this.currentCardLogic = picked;
          window.VRUIBinding.showCard(picked);
        }

        window.VRUIBinding.updateGauges();

        const kingName = getDynastyName();
        window.VRUIBinding.updateMeta(
          kingName,
          getYearLabel(),
          this._uiCoins,
          this._uiTokens
        );

        this._restored = true;
        return true;
      } catch (_) {
        this._clearBrokenRunSave();
        return false;
      }
    },

    async init(universeId, lang) {
      this.universeId = universeId;

      let finalLang = (lang || "fr").toString();
      try {
        const me = await window.VRProfile?.getMe?.(4000);
        finalLang = (me?.lang || finalLang || "fr").toString();
      } catch (_) {}
      this.lang = finalLang;

      const { config, deck, cardTexts } =
        await window.VREventsLoader.loadUniverseData(universeId, this.lang);

      let eventsLogic = { events: [] };
      let eventsTexts = {};
      try {
        const ev = await window.VREventsLoader.loadUniverseEvents(universeId, this.lang);
        eventsLogic = ev?.eventsLogic || { events: [] };
        eventsTexts = ev?.eventsTexts || {};
      } catch (_) {}

      this.universeConfig = config;
      this.deck = Array.isArray(deck) ? deck : [];
      this.cardTextsDict = cardTexts || {};
      this.recentCards = [];
      this.reignIndex = 0;
      this.coinsStreak = 0;
      this.history = [];
      this.currentCardLogic = null;
      this._restored = false;
      this._reviveUsed = false;

      this.eventsLogic = eventsLogic || { events: [] };
      this.eventsTexts = eventsTexts || {};
      this._eventPool = [];
      this._seenEvents = [];
      this._cardsSinceEventRoll = 0;
      this._eventShowing = false;
      this._pendingRunBonusCoins = 0;
      this._clearPendingEndState();
      this._rebuildEventIndex();

      try {
        const me = await window.VRProfile?.getMe?.(0);
        this._uiCoins = window.VRProfile._n(me?.vcoins);
        this._uiTokens = window.VRProfile._n(me?.jetons);
      } catch (_) {
        this._uiCoins = 0;
        this._uiTokens = 0;
      }

      window.VRState.initUniverse(this.universeConfig);
      window.VRUIBinding.init(this.universeConfig, this.lang, this.cardTextsDict);

      const restored = this._restoreFromSaveIfAny();
      this._rebuildEventIndex();

      if (!restored) {
        this._startNewReign();
        this._saveRunSoft();
      } else {
        if (!this._eventPool.length && this._allEventIds.length) {
          this._eventPool = this._allEventIds.slice();
        }
        this._saveRunSoft();
      }
    },

    async _refreshUIBalancesSoft() {
      try {
        const me = await window.VRProfile?.getMe?.(800);
        if (me) {
          this._uiCoins = window.VRProfile._n(me.vcoins);
          this._uiTokens = window.VRProfile._n(me.jetons);
        }
      } catch (_) {}
    },

    _resetGaugesToInitial() {
      try {
        const cfg = this.universeConfig || {};
        const init = (cfg && cfg.initialGauges) ? cfg.initialGauges : {};
        const gauges = (cfg.gauges || []);
        gauges.forEach((g) => {
          const v = (init && Object.prototype.hasOwnProperty.call(init, g.id)) ? init[g.id] : (g.start ?? 50);
          window.VRState.gauges[g.id] = (Number.isFinite(Number(v)) ? Number(v) : 50);
        });
      } catch (_) {}
    },

    _startNewReign() {
      this.reignIndex += 1;
      window.VRState.alive = true;
      window.VRState.lastDeath = null;
      window.VRState.reignYears = 0;
      window.VRState.cardsPlayed = 0;

      this._resetGaugesToInitial();

      this.recentCards = [];
      this.coinsStreak = 0;
      this.history = [];
      this.currentCardLogic = null;
      this._reviveUsed = false;
      this._cardsSinceEventRoll = 0;
      this._pendingRunBonusCoins = 0;
      this._clearPendingEndState();

      if (!this._eventPool.length && this._allEventIds.length) {
        this._eventPool = this._allEventIds.slice();
      }

      const kingName = getDynastyName();
      const years = getYearLabel();

      window.VRUIBinding.updateMeta(kingName, years, this._uiCoins, this._uiTokens);

      this._refreshUIBalancesSoft().then(() => {
        window.VRUIBinding.updateMeta(getDynastyName(), getYearLabel(), this._uiCoins, this._uiTokens);
      });

      this._nextCard();
      this._saveRunSoft();
    },

    _clearRunSave() {
      try {
        const universeId =
          this.universeId ||
          window.VRState?.universeId ||
          localStorage.getItem("vrealms_universe") ||
          "unknown";
        window.VRSave?.clear?.(universeId);
      } catch (_) {}
    },

    restartRun() {
      try { this._clearRunSave(); } catch (_) {}

      this._reviveUsed = false;
      this.history = [];
      this.recentCards = [];
      this.coinsStreak = 0;
      this.currentCardLogic = null;

      this.reignIndex = 0;
      this._cardsSinceEventRoll = 0;
      this._eventShowing = false;
      this._eventPool = this._allEventIds.slice();
      this._seenEvents = [];

      if (window.VRGame?.session) window.VRGame.session.reignLength = 0;
      this._startNewReign();
    },

    reviveSecondChance() {
      if (this._reviveUsed) return false;
      this._reviveUsed = true;
      this._clearPendingEndState();

      this._resetGaugesToInitial();
      try {
        window.VRState.alive = true;
        window.VRState.lastDeath = null;
      } catch (_) {}

      try { window.VRUIBinding?.updateGauges?.(); } catch (_) {}

      try { this._nextCard_internalOnly(); } catch (_) { try { this._nextCard(); } catch (_) {} }

      try { this._saveRunSoft(); } catch (_) {}
      return true;
    },

    _nextCard() {
      if (!window.VRState.isAlive()) return;
      if (this._eventShowing) return;

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

      this._saveRunSoft();
    },

    _rememberCard(cardId) {
      this.recentCards.push(cardId);
      if (this.recentCards.length > RECENT_MEMORY_SIZE) this.recentCards.shift();
    },

    _pushHistorySnapshot(cardLogic) {
      const snap = {
        cardId: cardLogic?.id || null,
        gauges: deepClone(window.VRState.gauges),
        alive: true,
        lastDeath: null,
        reignYears: window.VRState.reignYears,
        cardsPlayed: window.VRState.cardsPlayed,
        recentCards: deepClone(this.recentCards),
        coinsStreak: this.coinsStreak,
        uiCoins: this._uiCoins,
        uiTokens: this._uiTokens,
        sessionReignLength: Number(window.VRGame?.session?.reignLength || 0),
        cardsSinceEventRoll: asInt(this._cardsSinceEventRoll, 0),
        eventPool: deepClone(this._eventPool || []),
        seenEvents: deepClone(this._seenEvents || [])
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
      this._uiCoins = Number(snap.uiCoins || 0);
      this._uiTokens = Number(snap.uiTokens || 0);

      this._cardsSinceEventRoll = asInt(snap.cardsSinceEventRoll, 0);
      this._eventPool = Array.isArray(snap.eventPool) ? deepClone(snap.eventPool) : this._eventPool;
      this._seenEvents = Array.isArray(snap.seenEvents) ? deepClone(snap.seenEvents) : this._seenEvents;

      if (window.VRGame?.session) {
        window.VRGame.session.reignLength = Number(snap.sessionReignLength || 0);
      }

      const card = this.deck.find(c => c.id === snap.cardId) || this.currentCardLogic;
      if (card) {
        this.currentCardLogic = card;
        window.VRUIBinding.showCard(card);
      }

      window.VRUIBinding.updateGauges();

      const kingName = getDynastyName();
      window.VRUIBinding.updateMeta(
        kingName,
        getYearLabel(),
        this._uiCoins,
        this._uiTokens
      );

      this._saveRunSoft();
      return true;
    },

    _maybeRollEventAfterCardResolved() {
      this._cardsSinceEventRoll = asInt(this._cardsSinceEventRoll, 0) + 1;

      if (this._cardsSinceEventRoll < EVENT_CHECK_EVERY_N_CARDS) {
        this._saveRunSoft();
        return false;
      }

      this._cardsSinceEventRoll = 0;

      if (!this._allEventIds.length) {
        this._saveRunSoft();
        return false;
      }

      const hit = Math.random() < EVENT_CHANCE;
      this._saveRunSoft();
      return hit;
    },

    _refillEventPoolIfNeeded() {
      const all = this._allEventIds || [];
      if (!all.length) return;

      if (!Array.isArray(this._seenEvents)) this._seenEvents = [];
      if (!Array.isArray(this._eventPool)) this._eventPool = [];

      if (this._eventPool.length !== 0) return;

      const distinct = this._distinctSeenCount();

      if (distinct < EVENT_NO_REPEAT_UNTIL) {
        const seenSet = new Set(this._seenEvents);
        this._eventPool = all.filter(id => !seenSet.has(id));
        if (!this._eventPool.length) this._eventPool = all.slice();
        return;
      }

      const last = this._seenEvents.slice(-EVENT_EXCLUDE_LAST);
      const lastSet = new Set(last);
      this._eventPool = all.filter(id => !lastSet.has(id));
      if (!this._eventPool.length) this._eventPool = all.slice();
    },

    _pickRandomEventId() {
      this._refillEventPoolIfNeeded();
      if (!this._eventPool.length) return null;

      const idx = Math.floor(Math.random() * this._eventPool.length);
      const id = this._eventPool[idx];

      this._eventPool.splice(idx, 1);
      this._seenEvents.push(id);

      return id || null;
    },

    async _triggerRandomEvent() {
      if (this._eventShowing) return false;
      if (!window.VRState.isAlive()) return false;

      const id = this._pickRandomEventId();
      if (!id) return false;

      const ev = this._eventById.get(id) || null;
      const texts = this.eventsTexts?.[id] || null;

      try {
        const deltaMap = ev?.effects || ev?.gaugeDelta || ev?.deltas || {};
        if (deltaMap && typeof deltaMap === "object") {
          window.VRState.applyDeltas(deltaMap);
        }

        const dv =
          (typeof ev?.vcoins === "number") ? ev.vcoins :
          (typeof ev?.vcoinsDelta === "number") ? ev.vcoinsDelta :
          0;

        if (dv) {
          this._pendingRunBonusCoins += asInt(dv, 0);
        }

        const dj =
          (typeof ev?.jetons === "number") ? ev.jetons :
          (typeof ev?.jetonsDelta === "number") ? ev.jetonsDelta :
          0;

        if (dj) {
          if (dj > 0) {
            const ok = await (window.VUserData?.addJetons?.(dj) || Promise.resolve(false));
            if (ok !== false) this._uiTokens += dj;
          } else {
            const cost = Math.abs(dj);
            const ok = await (window.VUserData?.spendJetons?.(cost) || Promise.resolve(false));
            if (ok) this._uiTokens -= cost;
          }
        }
      } catch (e) {
        console.error("[VREngine] event apply error:", e);
      }

      await this._refreshUIBalancesSoft();

      const kingName = getDynastyName();
      window.VRUIBinding.updateGauges();
      window.VRUIBinding.updateMeta(kingName, getYearLabel(), this._uiCoins, this._uiTokens);

      this._eventShowing = true;
      this._saveRunSoft();

      const t = (k, fb) => {
        try {
          const out = window.VRI18n?.t?.(k);
          if (out && out !== k) return out;
        } catch (_) {}
        return fb;
      };

      const title = texts?.title || t("event.title", "Événement");
      const body = texts?.body || texts?.text || "";

      try {
        await window.VREventOverlay?.showEvent?.(title, body);
      } catch (_) {}

      this._eventShowing = false;

      if (!window.VRState.isAlive()) {
        await this._handleDeath();
        return true;
      }

      this._saveRunSoft();
      this._nextCard();
      return true;
    },

    applyChoice(cardLogic, choiceId) {
      if (!cardLogic || !cardLogic.choices || !cardLogic.choices[choiceId]) return;

      this._pushHistorySnapshot(cardLogic);

      const choiceData = cardLogic.choices[choiceId];
      const deltas = choiceData.gaugeDelta || {};
      window.VRState.applyDeltas(deltas);

      this.coinsStreak += 1;

      window.VRGame?.onCardResolved?.();
      window.VRState.reignYears = getCompletedYearsCount();

      const years = getYearLabel();
      const kingName = getDynastyName();
      window.VRUIBinding.updateMeta(kingName, years, this._uiCoins, this._uiTokens);
      window.VRUIBinding.updateGauges();

      try { window.VRUIBinding?._consumePeekDecision?.(); } catch (_) {}
      try { window.VRGame?.maybeShowInterstitial?.(); } catch (_) {}

      this._saveRunSoft();

      this._refreshUIBalancesSoft().then(() => {
        window.VRUIBinding.updateMeta(
          getDynastyName(),
          getYearLabel(),
          this._uiCoins,
          this._uiTokens
        );
      });

      if (!window.VRState.isAlive()) {
        this._handleDeath();
        return;
      }

      const shouldEvent = this._maybeRollEventAfterCardResolved();
      if (shouldEvent) {
        this._triggerRandomEvent();
        return;
      }

      this._nextCard();
    },

    _nextCard_internalOnly() {
      this._nextCard();
    },

    _bindDeathUIOnce() {
      if (this._deathUiBound) return;
      this._deathUiBound = true;

      const revivePopup = document.getElementById("vr-revive-popup");

      document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        const rp = document.getElementById("vr-revive-popup");
        if (!rp) return;
        const open = (rp.style && rp.style.display === "flex") || rp.getAttribute("aria-hidden") === "false";
        if (open) {
          try { rp.__close?.(); } catch (_) {}
        }
      });

      if (revivePopup) {
        revivePopup.addEventListener("click", async (e) => {
          if (e.target === revivePopup) {
            try { revivePopup.__close?.(); } catch (_) {}
            return;
          }

          const btn = e.target?.closest?.("[data-revive-action]");
          if (!btn) return;

          const action = btn.getAttribute("data-revive-action");
          if (!action) return;

          try { await (revivePopup.__act?.(action, btn) || Promise.resolve()); } catch (_) {}
        });
      }
    },

    async _handleDeath() {
      const lastDeath = window.VRState.getLastDeath();
      this._preparePendingEndReward();
      await window.VREndings.showEnding(this.universeConfig, lastDeath);
      ensureEndingEnhancements();

      const restartBtn = document.getElementById("ending-restart-btn");
      const reviveBtn = document.getElementById("ending-revive-btn");
      const returnBtn = document.getElementById("ending-return-btn");
      const doubleBtn = document.getElementById("ending-double-btn");
      const rewardValueEl = document.getElementById("ending-reward-value");

      const t = (key, fallback) => {
        try {
          const out = window.VRI18n?.t?.(key);
          if (out && out !== key) return out;
        } catch (_) {}
        return fallback || key;
      };

      const renderEndingReward = (displayAmount) => {
        if (rewardValueEl) rewardValueEl.textContent = `+${Math.max(0, asInt(displayAmount, 0))}`;
      };

      const syncEndingButtons = () => {
        if (doubleBtn) {
          doubleBtn.classList.toggle("is-glow", !this._pendingEndClaimed);
          doubleBtn.disabled = !!this._pendingEndClaimed;
          const title = doubleBtn.querySelector("#ending-double-title");
          const sub = doubleBtn.querySelector("#ending-double-sub");
          if (title) title.textContent = this._pendingEndClaimed
            ? t("game.ending.reward_claimed", "Gain doublé crédité")
            : t("game.ending.double_gain", "Doubler ton gain");
          if (sub) sub.textContent = this._pendingEndClaimed
            ? t("game.ending.reward_claimed_sub", "Tu peux maintenant recommencer ou revenir")
            : t("game.ending.double_gain_sub", "Regarder une pub récompensée");
        }

        if (reviveBtn) {
          reviveBtn.textContent = t("game.ending.revive_token", "Revivre avec 1 jeton");
          reviveBtn.disabled = !!this._reviveUsed || !!this._pendingEndClaimed;
        }

        if (restartBtn) restartBtn.textContent = t("game.restart", "Recommencer");
        if (returnBtn) returnBtn.textContent = t("game.return", "Retour");
      };

      renderEndingReward(this._pendingEndReward);
      syncEndingButtons();
      this._saveRunSoft();

      if (doubleBtn) {
        doubleBtn.onclick = async () => {
          if (this._pendingEndClaimed) return;

          try { doubleBtn.disabled = true; } catch (_) {}

          const okAd = await (window.VRAds?.showRewardedAd?.({ placement: "end_reward_x2" }) || Promise.resolve(false));
          if (!okAd) {
            try { window.showToast?.(t("coins.toast.reward_fail", "Pub indisponible")); } catch (_) {}
            syncEndingButtons();
            return;
          }

          const out = await this._finalizeEndedRun(2);
          if (!out?.ok) {
            try { window.showToast?.(t("common.error_generic", "Erreur")); } catch (_) {}
            syncEndingButtons();
            return;
          }

          renderEndingReward(out.amount);
          syncEndingButtons();
        };
      }

      if (reviveBtn) {
        reviveBtn.onclick = async () => {
          if (this._reviveUsed || this._pendingEndClaimed) return;

          try { reviveBtn.disabled = true; } catch (_) {}

          const ok = await (window.VUserData?.spendJetons?.(1) || Promise.resolve(false));
          if (!ok) {
            try { window.showToast?.(t("token.toast.no_tokens", "Tu n'as pas de jeton")); } catch (_) {}
            syncEndingButtons();
            return;
          }

          this._clearPendingEndState();
          window.VREndings.hideEnding();

          const did = this.reviveSecondChance();
          if (!did) this.restartRun();
        };
      }

      if (restartBtn) {
        restartBtn.onclick = async () => {
          if (!this._pendingEndFinalized) {
            const out = await this._finalizeEndedRun(1);
            if (!out?.ok) {
              try { window.showToast?.(t("common.error_generic", "Erreur")); } catch (_) {}
              return;
            }
            renderEndingReward(out.amount);
          }

          window.VREndings.hideEnding();
          this.restartRun();
        };
      }

      if (returnBtn) {
        returnBtn.onclick = async () => {
          if (!this._pendingEndFinalized) {
            const out = await this._finalizeEndedRun(1);
            if (!out?.ok) {
              try { window.showToast?.(t("common.error_generic", "Erreur")); } catch (_) {}
              return;
            }
            renderEndingReward(out.amount);
          }

          try { this._clearRunSave(); } catch (_) {}
          try { window.location.href = "index.html"; } catch (_) {}
        };
      }

      this.coinsStreak = 0;
      this._saveRunSoft();
    }
  };

  window.VREngine = VREngine;
})();


// -------------------------------------------------------
// Token UI
// -------------------------------------------------------
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

  function ensureBasicPopupCardStyles() {
    try {
      const ID = "vr-basic-popup-card-style";
      if (document.getElementById(ID)) return;

      const style = document.createElement("style");
      style.id = ID;
      style.textContent = `
#vr-token-popup [data-token-action],
#vr-coins-popup [data-coins-action]{
  background-image:none !important;
}

#vr-token-popup .vr-card,
#vr-token-popup .vr-token-card,
#vr-token-popup .vr-token-basic-card,
#vr-coins-popup .vr-card,
#vr-coins-popup .vr-coins-basic-card{
  position:relative;
  display:block;
  width:100%;
  padding:0;
  border:none;
  background:none !important;
  box-shadow:none !important;
}

#vr-token-popup .vr-card-content,
#vr-token-popup .vr-token-basic-card .vr-card-content,
#vr-coins-popup .vr-card-content{
  background:linear-gradient(180deg, rgba(255,255,255,.11), rgba(255,255,255,.06)) !important;
  border:1px solid rgba(255,255,255,.14) !important;
  border-radius:18px !important;
  padding:14px 14px !important;
  box-shadow:0 16px 30px rgba(0,0,0,.24) !important;
  backdrop-filter:blur(2px);
}

#vr-token-popup .vr-card-title,
#vr-token-popup .vr-token-basic-card .vr-card-title,
#vr-coins-popup .vr-card-title{
  margin:0 0 6px 0 !important;
  color:#fff !important;
  font:900 16px/1.15 system-ui,-apple-system,Segoe UI,Roboto,sans-serif !important;
  text-shadow:none !important;
}

#vr-token-popup .vr-card-text,
#vr-token-popup .vr-token-basic-card .vr-card-text,
#vr-coins-popup .vr-card-text{
  margin:0 !important;
  color:rgba(255,255,255,.88) !important;
  font:700 13px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif !important;
  text-shadow:none !important;
}

#vr-token-popup img,
#vr-coins-popup img{
  object-fit:contain !important;
}
`;
      document.head.appendChild(style);
    } catch (_) {}
  }

  const VRTokenUI = {
    selectMode: false,

    init() {
      ensureBasicPopupCardStyles();

      const btnJeton = document.getElementById("btn-jeton");
      const popup = document.getElementById("vr-token-popup");
      const overlay = document.getElementById("vr-token-gauge-overlay");
      const cancelGaugeBtn = document.getElementById("btn-cancel-gauge-select");
      const gaugesRow = document.getElementById("vr-gauges-row");

      if (!btnJeton || !popup) return;

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

      try {
        const host = (popup.querySelector("[data-token-action]")?.parentElement) || popup;

        if (host && !host.querySelector('[data-token-action="peek15"]')) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "vr-token-basic-card";
          btn.setAttribute("data-token-action", "peek15");

          const content = document.createElement("div");
          content.className = "vr-card-content";

          const title = document.createElement("h4");
          title.className = "vr-card-title";
          title.textContent = t("token.popup.peek.title", "Voir les effets 15");

          const desc = document.createElement("p");
          desc.className = "vr-card-text";
          desc.textContent = t(
            "token.popup.peek.text",
            "Pendant 15 choix, les jauges concernées clignotent et affichent un aperçu."
          );

          content.appendChild(title);
          content.appendChild(desc);
          btn.appendChild(content);

          const before =
            host.querySelector('[data-token-action="gauge50"]') ||
            host.querySelector('[data-token-action="back3"]') ||
            host.querySelector('[data-token-action="close"]');

          if (before && before.parentNode === host) host.insertBefore(btn, before);
          else host.appendChild(btn);
        }
      } catch (_) {}

      popup.querySelectorAll("[data-token-action]").forEach((el) => {
        el.addEventListener("click", async () => {
          const action = el.getAttribute("data-token-action");
          if (!action) return;

          if (action === "close") { closePopup(); return; }

          if (action === "adtoken" || action === "ad_token") {
            closePopup();

            const ok = await (window.VRAds?.showRewardedAd?.({ placement: "token" }) || Promise.resolve(false));
            if (ok) {
              try { await window.VUserData?.addJetons?.(1); } catch (_) {}

              try {
                const me = await window.VRProfile?.getMe?.(0);
                if (me) {
                  window.VREngine._uiCoins = window.VRProfile._n(me.vcoins);
                  window.VREngine._uiTokens = window.VRProfile._n(me.jetons);
                }
              } catch (_) {}

              const kingName = getDynastyName();
              window.VRUIBinding?.updateMeta?.(
                kingName,
                getYearLabel(),
                window.VREngine?._uiCoins || 0,
                window.VREngine?._uiTokens || 0
              );

              toast(t("token.toast.reward_ok", "+1 jeton ajouté"));
            } else {
              toast(t("token.toast.reward_fail", "Pub indisponible"));
            }
            return;
          }

          if (action === "peek15") {
            const okSpend = await window.VUserData?.spendJetons?.(1);
            if (!okSpend) {
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
            const me = await window.VRProfile?.getMe?.(0);
            if (window.VRProfile._n(me?.jetons) <= 0) {
              toast(t("token.toast.no_tokens", "Tu n'as pas de jeton"));
              closePopup();
              return;
            }
            startSelectGauge50();
            return;
          }

          if (action === "back3") {
            const okSpend = await window.VUserData?.spendJetons?.(1);
            if (!okSpend) {
              toast(t("token.toast.no_tokens", "Tu n'as pas de jeton"));
              closePopup();
              return;
            }

            closePopup();

            const ok = window.VREngine?.undoChoices?.(3);
            if (!ok) {
              try { await window.VUserData?.addJetons?.(1); } catch (_) {}
              toast(t("token.toast.undo_fail", "Impossible de revenir en arrière"));
              try {
                await window.VREventOverlay?.showEvent?.(
                  t("token.undo.fail.title", "Retour arrière"),
                  t("token.undo.fail.body", "Impossible de revenir en arrière. Rien n’a été modifié.")
                );
              } catch (_) {}
            } else {
              toast(t("token.toast.undo_done", "Retour -3 effectué"));
              try {
                await window.VREventOverlay?.showEvent?.(
                  t("token.undo.ok.title", "Retour arrière"),
                  t("token.undo.ok.body", "3 choix annulés. Tu peux continuer.")
                );
              } catch (_) {}
            }

            try {
              const me2 = await window.VRProfile?.getMe?.(0);
              if (me2) {
                window.VREngine._uiCoins = window.VRProfile._n(me2.vcoins);
                window.VREngine._uiTokens = window.VRProfile._n(me2.jetons);
              }
            } catch (_) {}

            const kingName = getDynastyName();
            window.VRUIBinding?.updateMeta?.(
              kingName,
              getYearLabel(),
              window.VREngine?._uiCoins || 0,
              window.VREngine?._uiTokens || 0
            );

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

      if (gaugesRow) {
        gaugesRow.addEventListener("click", async (e) => {
          if (!this.selectMode) return;

          const gaugeEl = e.target?.closest?.(".vr-gauge");
          if (!gaugeEl) return;

          const gaugeId = gaugeEl.dataset.gaugeId;
          if (!gaugeId) return;

          const spent = await window.VUserData?.spendJetons?.(1);
          if (!spent) {
            toast(t("token.toast.no_tokens", "Tu n'as pas de jeton"));
            stopSelectGauge50();
            return;
          }

          window.VRState?.setGaugeValue?.(gaugeId, 50);
          window.VRUIBinding?.updateGauges?.();

          try { window.VREngine?._saveRunSoft?.(); } catch (_) {}

          try {
            const me = await window.VRProfile?.getMe?.(0);
            if (me) {
              window.VREngine._uiCoins = window.VRProfile._n(me.vcoins);
              window.VREngine._uiTokens = window.VRProfile._n(me.jetons);
            }
          } catch (_) {}

          const kingName = getDynastyName();
          window.VRUIBinding?.updateMeta?.(
            kingName,
            getYearLabel(),
            window.VREngine?._uiCoins || 0,
            window.VREngine?._uiTokens || 0
          );

          toast(t("token.toast.gauge_set_50", "Jauge remise à 50%"));
          stopSelectGauge50();
        });
      }
    }
  };

  window.VRTokenUI = VRTokenUI;
})();


// -------------------------------------------------------
// VCoins UI
// -------------------------------------------------------
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
              try { await window.VUserData?.addVcoins?.(500); } catch (_) {}

              try {
                const me = await window.VRProfile?.getMe?.(0);
                if (me) {
                  window.VREngine._uiCoins = window.VRProfile._n(me.vcoins);
                  window.VREngine._uiTokens = window.VRProfile._n(me.jetons);
                }
              } catch (_) {}

              const kingName = getDynastyName();
              window.VRUIBinding?.updateMeta?.(
                kingName,
                getYearLabel(),
                window.VREngine?._uiCoins || 0,
                window.VREngine?._uiTokens || 0
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


// -------------------------------------------------------
// COSMETICS GAME
// -------------------------------------------------------
(function () {
  "use strict";

  const DEFAULT_GRAY_ASSETS = {
    hell_king: {
      background: "assets/img/backgrounds/hell_default_gray.webp",
      message: "assets/img/ui/hell_msg_default_gray.webp",
      choice: "assets/img/ui/hell_choice_default_gray.webp"
    },
    heaven_king: {
      background: "assets/img/backgrounds/heaven_default_gray.webp",
      message: "assets/img/ui/heaven_msg_default_gray.webp",
      choice: "assets/img/ui/heaven_choice_default_gray.webp"
    },
    western_president: {
      background: "assets/img/backgrounds/west_default_gray.webp",
      message: "assets/img/ui/west_msg_default_grey.webp",
      choice: "assets/img/ui/west_choice_default_grey.webp"
    },
    mega_corp_ceo: {
      background: "assets/img/backgrounds/corp_default_gray.webp",
      message: "assets/img/ui/corp_msg_default_gray.webp",
      choice: "assets/img/ui/corp_choice_default_gray.webp"
    },
    new_world_explorer: {
      background: "assets/img/backgrounds/explorer_default_gray.webp",
      message: "assets/img/ui/explorer_msg_default_gray.webp",
      choice: "assets/img/ui/explorer_choice_default_gray.webp"
    },
    vampire_lord: {
      background: "assets/img/backgrounds/vampire_default_gray.webp",
      message: "assets/img/ui/vampire_msg_default_gray.webp",
      choice: "assets/img/ui/vampire_choice_default_gray.webp"
    }
  };

  const _state = {
    open: false,
    universeId: "",
    index: {
      background: 0,
      message: 0,
      choice: 0
    }
  };

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

  function ensureStyles() {
    if (document.getElementById("vr-customize-inline-style")) return;

    const style = document.createElement("style");
    style.id = "vr-customize-inline-style";
    style.textContent = `
      #vr-customize-content{
        display:flex;
        flex-direction:column;
        gap:12px;
        margin-top:10px;
      }
      .vr-customize-universe-title{
        text-align:center;
        font-weight:900;
        font-size:18px;
        color:#fff;
        margin:0 0 6px;
      }
      .vr-customize-row{
        display:flex;
        flex-direction:column;
        gap:8px;
      }
      .vr-customize-subtitle{
        text-align:center;
        font-weight:800;
        font-size:13px;
        opacity:.95;
      }
      .vr-customize-carousel{
        display:grid;
        grid-template-columns:36px minmax(0,1fr) 36px;
        align-items:center;
        gap:8px;
      }
      .vr-customize-arrow{
        width:36px;
        height:36px;
        border:none;
        background:transparent;
        box-shadow:none;
        border-radius:0;
        color:#fff;
        font-size:28px;
        font-weight:900;
        cursor:pointer;
        text-shadow:0 10px 22px rgba(0,0,0,.45);
      }
      .vr-customize-arrow[disabled]{
        opacity:.4;
        cursor:default;
      }
      .vr-customize-card{
        position:relative;
        overflow:hidden;
        border-radius:18px;
        min-height:138px;
        border:1px solid rgba(255,255,255,.12);
        background:rgba(255,255,255,.06);
        box-shadow:0 16px 30px rgba(0,0,0,.28);
      }
      .vr-customize-card.is-ui img{
        object-fit:contain;
        padding:12px;
        background:
          radial-gradient(circle at 50% 40%, rgba(255,255,255,.10), transparent 46%),
          linear-gradient(180deg, rgba(255,255,255,.03), rgba(0,0,0,.08));
      }
      .vr-customize-card img{
        position:absolute;
        inset:0;
        width:100%;
        height:100%;
        object-fit:cover;
        display:block;
      }
      .vr-customize-overlay{
        position:absolute;
        inset:auto 0 0 0;
        padding:34px 10px 10px;
        background:linear-gradient(180deg, transparent, rgba(0,0,0,.78));
      }
      .vr-customize-name{
        text-align:center;
        font-weight:900;
        font-size:13px;
        color:#fff;
        line-height:1.15;
        margin-bottom:8px;
      }
      .vr-customize-bottom{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
      }
      .vr-customize-price{
        display:inline-flex;
        align-items:center;
        gap:6px;
        padding:6px 10px;
        border-radius:999px;
        border:1px solid rgba(255,255,255,.14);
        background:rgba(0,0,0,.30);
        color:#fff;
        font-weight:950;
        font-size:12px;
      }
      .vr-customize-price img{
        position:static;
        width:16px;
        height:16px;
        object-fit:contain;
        padding:0;
        background:none;
      }
      .vr-customize-count{
        color:rgba(255,255,255,.86);
        font-size:12px;
        font-weight:900;
      }
      .vr-customize-action{
        width:100%;
        margin-top:8px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:10px 12px;
        border-radius:14px;
        border:1px solid rgba(255,255,255,.14);
        background:rgba(255,255,255,.08);
        color:#fff;
        font-weight:900;
        cursor:pointer;
      }
      .vr-customize-action.is-owned{
        background:rgba(255,255,255,.10);
      }
      .vr-customize-action.is-equipped{
        background:rgba(138,197,95,.22);
        border-color:rgba(138,197,95,.55);
      }
      .vr-customize-note{
        text-align:center;
        color:rgba(255,255,255,.84);
        font-size:12px;
        margin-top:6px;
      }
      #vr-customize-popup .vr-popup-inner{
        position: relative;
      }
      #vr-customize-popup .vr-popup-title{
        padding-right: 46px;
      }
      #vr-customize-popup .vr-customize-x{
        z-index: 2;
      }
      #vr-customize-popup .vr-customize-x{
        position:absolute;
        top: 10px;
        right: 10px;
        width: 38px;
        height: 38px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,.16);
        background: rgba(0,0,0,.25);
        cursor: pointer;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        box-shadow: 0 14px 26px rgba(0,0,0,.35);
      }
      #vr-customize-popup .vr-customize-x::before{
        content:"×";
        font-size: 24px;
        font-weight: 900;
        line-height: 1;
        color: #fff;
        text-shadow: 0 10px 20px rgba(0,0,0,.55);
        transform: translateY(-1px);
      }
      #vr-customize-popup .vr-customize-x:active{
        transform: scale(.97);
      }
    `;
    document.head.appendChild(style);
  }

  function getPopup() {
    return document.getElementById("vr-customize-popup");
  }

  function getContent() {
    return document.getElementById("vr-customize-content");
  }

  function getUniverse(universeId) {
    try {
      return window.VRCosmeticsCatalog?.getUniverse?.(universeId) || null;
    } catch (_) {
      return null;
    }
  }

  function getItem(universeId, category, itemId) {
    try {
      return window.VRCosmeticsCatalog?.getItem?.(universeId, category, itemId) || null;
    } catch (_) {
      return null;
    }
  }

  function getItems(universeId, category) {
    const universe = getUniverse(universeId);
    return Array.isArray(universe?.categories?.[category]) ? universe.categories[category] : [];
  }

  function getDefaultAsset(universeId, category) {
    return DEFAULT_GRAY_ASSETS?.[universeId]?.[category] || "";
  }

  function getEquippedItem(universeId, category) {
    const equippedId = String(window.VUserData?.getEquippedCosmetic?.(universeId, category) || "");
    if (!equippedId) return null;
    return getItem(universeId, category, equippedId);
  }

  function resolveAppliedAsset(universeId, category) {
    const equippedItem = getEquippedItem(universeId, category);
    if (equippedItem?.img) return equippedItem.img;
    return getDefaultAsset(universeId, category);
  }

  function applyUniverseCosmetics(universeId) {
    const viewGame = document.getElementById("view-game");
    const cardMain = document.getElementById("vr-card-main");
    const choiceBtns = document.querySelectorAll(".vr-choice-button[data-choice]");
    if (!viewGame || !universeId) return;

    const bg = resolveAppliedAsset(universeId, "background");
    const message = resolveAppliedAsset(universeId, "message");
    const choice = resolveAppliedAsset(universeId, "choice");

    if (bg) {
      viewGame.style.backgroundImage = `url("${bg}")`;
      viewGame.style.backgroundSize = "100% 100%";
      viewGame.style.backgroundPosition = "center center";
      viewGame.style.backgroundRepeat = "no-repeat";
    }

    if (cardMain && message) {
      cardMain.style.backgroundImage = `url("${message}")`;
      cardMain.style.backgroundSize = "100% 100%";
      cardMain.style.backgroundPosition = "center center";
      cardMain.style.backgroundRepeat = "no-repeat";
    }

    choiceBtns.forEach((btn) => {
      if (!choice) return;
      btn.style.backgroundImage = `url("${choice}")`;
      btn.style.backgroundSize = "100% 100%";
      btn.style.backgroundPosition = "center center";
      btn.style.backgroundRepeat = "no-repeat";
    });
  }

  function getActionMeta(universeId, category, item) {
    const owned = !!window.VUserData?.isCosmeticOwned?.(universeId, category, item.id);
    const equippedId = String(window.VUserData?.getEquippedCosmetic?.(universeId, category) || "");
    const equipped = owned && equippedId === item.id;

    if (equipped) {
      return {
        text: t("common.equipped", "Équipé"),
        className: "vr-customize-action is-equipped"
      };
    }
    if (owned) {
      return {
        text: t("common.use", "Équiper"),
        className: "vr-customize-action is-owned"
      };
    }
    return {
      text: `${t("common.buy", "Acheter")} · ${item.price}`,
      className: "vr-customize-action"
    };
  }

  function clampIndex(category, max) {
    const raw = Number(_state.index[category] || 0);
    if (max <= 0) return 0;
    return Math.max(0, Math.min(max - 1, raw));
  }

  function renderRow(universeId, category) {
    const items = getItems(universeId, category);
    const idx = clampIndex(category, items.length);
    _state.index[category] = idx;

    const subtitleKey = window.VRCosmeticsCatalog?.CATEGORY_KEYS?.[category] || category;

    if (!items.length) {
      return `
        <div class="vr-customize-row" data-category="${category}">
          <div class="vr-customize-subtitle">${t(subtitleKey, category)}</div>
          <div class="vr-customize-note">${t("common.unavailable", "Indisponible")}</div>
        </div>
      `;
    }

    const item = items[idx];
    const action = getActionMeta(universeId, category, item);

    return `
      <div class="vr-customize-row" data-category="${category}">
        <div class="vr-customize-subtitle">${t(subtitleKey, category)}</div>

        <div class="vr-customize-carousel">
          <button class="vr-customize-arrow" type="button" data-cus-nav="prev" data-category="${category}" ${idx <= 0 ? "disabled" : ""}>‹</button>

          <div class="vr-customize-card ${item.kind === "ui" ? "is-ui" : ""}">
            <img src="${item.img}" alt="" draggable="false">
            <div class="vr-customize-overlay">
              <div class="vr-customize-name">${t(item.nameKey, item.id)}</div>
              <div class="vr-customize-bottom">
                <div class="vr-customize-price">
                  <img src="assets/img/ui/vcoins.webp" alt="" draggable="false">
                  <span>${item.price}</span>
                </div>
                <div class="vr-customize-count">${idx + 1} / ${items.length}</div>
              </div>
              <button
                class="${action.className}"
                type="button"
                data-cus-action="item"
                data-universe="${universeId}"
                data-category="${category}"
                data-item-id="${item.id}"
                data-price="${item.price}"
              >${action.text}</button>
            </div>
          </div>

          <button class="vr-customize-arrow" type="button" data-cus-nav="next" data-category="${category}" ${idx >= items.length - 1 ? "disabled" : ""}>›</button>
        </div>
      </div>
    `;
  }

  function ensurePopupShell(universeId) {
    const content = getContent();
    if (!content) return null;

    if (!content.querySelector("#vr-customize-title")) {
      content.innerHTML = `
        <div class="vr-customize-universe-title" id="vr-customize-title"></div>
        <div id="vr-customize-rows"></div>
      `;
    }

    const universe = getUniverse(universeId);
    const titleEl = content.querySelector("#vr-customize-title");
    if (titleEl) {
      titleEl.textContent = t(universe?.labelKey || universeId, universeId);
    }

    return content.querySelector("#vr-customize-rows");
  }

  function renderRowOnly(category) {
    const universeId = _state.universeId || window.VRGame?.currentUniverse || localStorage.getItem("vrealms_universe") || "hell_king";
    const rowsRoot = ensurePopupShell(universeId);
    if (!rowsRoot) return;

    const html = renderRow(universeId, category);
    const holder = document.createElement("div");
    holder.innerHTML = html.trim();
    const freshRow = holder.firstElementChild;
    if (!freshRow) return;

    const existing = rowsRoot.querySelector(`.vr-customize-row[data-category="${category}"]`);
    if (existing) {
      existing.replaceWith(freshRow);
    } else {
      const order = ["background", "message", "choice"];
      const idx = order.indexOf(category);
      if (idx < 0 || idx >= rowsRoot.children.length) {
        rowsRoot.appendChild(freshRow);
      } else {
        const ref = rowsRoot.children[idx];
        if (ref) rowsRoot.insertBefore(freshRow, ref);
        else rowsRoot.appendChild(freshRow);
      }
    }
  }

  function renderPopup() {
    const universeId = _state.universeId || window.VRGame?.currentUniverse || localStorage.getItem("vrealms_universe") || "hell_king";
    ensurePopupShell(universeId);
    renderRowOnly("background");
    renderRowOnly("message");
    renderRowOnly("choice");
  }

  function showDialog(el, focusEl) {
    if (!el) return;
    try { el.removeAttribute("inert"); } catch (_) {}
    el.setAttribute("aria-hidden", "false");
    el.style.display = "flex";
    try { focusEl?.focus?.({ preventScroll: true }); } catch (_) {}
  }

  function hideDialog(el, focusBackEl) {
    if (!el) return;
    const active = document.activeElement;
    if (active && el.contains(active)) {
      try { active.blur(); } catch (_) {}
      try { focusBackEl?.focus?.({ preventScroll: true }); } catch (_) {}
    }
    try { el.setAttribute("inert", ""); } catch (_) {}
    el.setAttribute("aria-hidden", "true");
    el.style.display = "none";
  }

  function openPopup() {
    const popup = getPopup();
    const btn = document.getElementById("btn-customize");
    _state.universeId = window.VRGame?.currentUniverse || localStorage.getItem("vrealms_universe") || "hell_king";
    renderPopup();
    showDialog(popup, popup?.querySelector?.("[data-cus-nav], [data-cus-action]") || btn);
    _state.open = true;
  }

  function closePopup() {
    const popup = getPopup();
    const btn = document.getElementById("btn-customize");
    hideDialog(popup, btn);
    _state.open = false;
  }

  async function handleItemAction(btn) {
    const universeId = String(btn?.dataset?.universe || "").trim();
    const category = String(btn?.dataset?.category || "").trim();
    const itemId = String(btn?.dataset?.itemId || "").trim();
    const price = Number(btn?.dataset?.price || 0);

    if (!universeId || !category || !itemId) return;
    btn.disabled = true;

    try {
      const owned = !!window.VUserData?.isCosmeticOwned?.(universeId, category, itemId);
      let res = null;

      if (!owned) {
        res = await window.VUserData?.buyCosmetic?.({
          universeId,
          category,
          itemId,
          price
        }, { autoEquip: true });
      } else {
        res = await window.VUserData?.equipCosmetic?.(universeId, category, itemId);
      }

      if (!res?.ok) {
        if (res?.reason === "insufficient_vcoins") {
          toast(t("shop.toast.insufficient_vcoins", "Pas assez de VCoins"));
        } else if (res?.reason === "not_owned") {
          toast(t("shop.toast.not_owned", "Objet non possédé"));
        } else {
          toast(t("common.error_generic", "Erreur"));
        }
      } else {
        applyUniverseCosmetics(universeId);
        renderRowOnly(category);
      }
    } catch (_) {
      toast(t("common.error_generic", "Erreur"));
    } finally {
      btn.disabled = false;
    }
  }

  function init() {
    ensureStyles();

    const btn = document.getElementById("btn-customize");
    const popup = getPopup();

    if (!btn || !popup) return;
    function ensureCloseX() {
      const inner = popup.querySelector(".vr-popup-inner");
      if (!inner) return;

      if (inner.querySelector(".vr-customize-x")) return;

      const x = document.createElement("button");
      x.type = "button";
      x.className = "vr-customize-x";

      x.setAttribute("data-customize-action", "close");
      x.setAttribute("aria-label", "");
      x.setAttribute("data-i18n-aria", "common.close");

      inner.insertBefore(x, inner.firstChild);
    }

    ensureCloseX();

    btn.addEventListener("click", () => openPopup());

    popup.addEventListener("click", async (e) => {
      if (e.target === popup) {
        closePopup();
        return;
      }

      const closeBtn = e.target?.closest?.("[data-customize-action='close']");
      if (closeBtn) {
        closePopup();
        return;
      }

      const navBtn = e.target?.closest?.("[data-cus-nav]");
      if (navBtn) {
        const dir = String(navBtn.dataset.cusNav || "");
        const category = String(navBtn.dataset.category || "");
        const items = getItems(_state.universeId, category);
        if (!items.length) return;

        let next = Number(_state.index[category] || 0);
        if (dir === "prev") next -= 1;
        if (dir === "next") next += 1;
        _state.index[category] = Math.max(0, Math.min(items.length - 1, next));

        renderRowOnly(category);
        return;
      }

      const actionBtn = e.target?.closest?.("[data-cus-action='item']");
      if (actionBtn) {
        await handleItemAction(actionBtn);
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && _state.open) closePopup();
    });

    window.addEventListener("vr:profile", () => {
      const universeId = window.VRGame?.currentUniverse || localStorage.getItem("vrealms_universe") || "hell_king";
      applyUniverseCosmetics(universeId);

      if (_state.open) {
        renderPopup();
      }
    });
  }

  window.VRCosmeticsGame = {
    init,
    open: openPopup,
    close: closePopup,
    render: renderPopup,
    renderRowOnly,
    apply: applyUniverseCosmetics
  };
})();


// -------------------------------------------------------
// PREVIEW MODE (iframe depuis la boutique)
// -------------------------------------------------------
(function () {
  "use strict";

  const PREVIEW_DEFAULT_ASSETS = {
    hell_king: {
      background: "assets/img/backgrounds/hell_default_gray.webp",
      message: "assets/img/ui/hell_msg_default_gray.webp",
      choice: "assets/img/ui/hell_choice_default_gray.webp"
    },
    heaven_king: {
      background: "assets/img/backgrounds/heaven_default_gray.webp",
      message: "assets/img/ui/heaven_msg_default_gray.webp",
      choice: "assets/img/ui/heaven_choice_default_gray.webp"
    },
    western_president: {
      background: "assets/img/backgrounds/west_default_gray.webp",
      message: "assets/img/ui/west_msg_default_grey.webp",
      choice: "assets/img/ui/west_choice_default_grey.webp"
    },
    mega_corp_ceo: {
      background: "assets/img/backgrounds/corp_default_gray.webp",
      message: "assets/img/ui/corp_msg_default_gray.webp",
      choice: "assets/img/ui/corp_choice_default_gray.webp"
    },
    new_world_explorer: {
      background: "assets/img/backgrounds/explorer_default_gray.webp",
      message: "assets/img/ui/explorer_msg_default_gray.webp",
      choice: "assets/img/ui/explorer_choice_default_gray.webp"
    },
    vampire_lord: {
      background: "assets/img/backgrounds/vampire_default_gray.webp",
      message: "assets/img/ui/vampire_msg_default_gray.webp",
      choice: "assets/img/ui/vampire_choice_default_gray.webp"
    }
  };

  function getPreviewConfig() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      return {
        enabled: params.get("preview") === "1" || window.__VR_PREVIEW_MODE === true,
        universeId: String(params.get("universe") || localStorage.getItem("vrealms_universe") || "hell_king").trim(),
        category: String(params.get("category") || "").trim(),
        itemId: String(params.get("itemId") || "").trim(),
        src: String(params.get("src") || "").trim()
      };
    } catch (_) {
      return {
        enabled: false,
        universeId: "hell_king",
        category: "",
        itemId: "",
        src: ""
      };
    }
  }

  function getDefaultPreviewAsset(universeId, category) {
    return PREVIEW_DEFAULT_ASSETS?.[universeId]?.[category] || "";
  }

  function resolvePreviewAssets(cfg) {
    return {
      background: cfg.category === "background" ? cfg.src : getDefaultPreviewAsset(cfg.universeId, "background"),
      message: cfg.category === "message" ? cfg.src : getDefaultPreviewAsset(cfg.universeId, "message"),
      choice: cfg.category === "choice" ? cfg.src : getDefaultPreviewAsset(cfg.universeId, "choice")
    };
  }

  function setBgImage(el, src) {
    if (!el || !src) return;
    el.style.backgroundImage = `url("${src}")`;
    el.style.backgroundSize = "100% 100%";
    el.style.backgroundPosition = "center center";
    el.style.backgroundRepeat = "no-repeat";
  }

  function ensurePreviewStyles() {
    if (document.getElementById("vr-preview-inline-style")) return;

    const style = document.createElement("style");
    style.id = "vr-preview-inline-style";
    style.textContent = `
      html.vr-preview-mode,
      body.vr-preview-mode{
        overflow:hidden !important;
        overscroll-behavior:none !important;
      }

      body.vr-preview-mode .vr-game-header,
      body.vr-preview-mode .vr-popup,
      body.vr-preview-mode #vr-ending-overlay,
      body.vr-preview-mode #vr-token-gauge-overlay{
        display:none !important;
      }

      body.vr-preview-mode .vr-card-title,
      body.vr-preview-mode .vr-card-text,
      body.vr-preview-mode .vr-choice-label,
      body.vr-preview-mode .vr-gauge-label{
        display:none !important;
      }

      body.vr-preview-mode a,
      body.vr-preview-mode button{
        pointer-events:none !important;
      }

      body.vr-preview-mode #view-game{
        min-height:100vh !important;
      }

      body.vr-preview-mode .vr-card-container{
        margin-top: 8px !important;
      }
    `;
    document.head.appendChild(style);
  }

  function fillPreviewStaticUi() {
    const coins = document.getElementById("meta-coins");
    const tokens = document.getElementById("meta-tokens");
    const name = document.getElementById("meta-king-name");
    const years = document.getElementById("meta-years");

    if (coins) coins.textContent = "0";
    if (tokens) tokens.textContent = "0";
    if (name) name.textContent = "—";
    if (years) years.textContent = "0";

    const title = document.getElementById("card-title");
    const text = document.getElementById("card-text");
    const a = document.getElementById("choice-A");
    const b = document.getElementById("choice-B");
    const c = document.getElementById("choice-C");

    if (title) title.textContent = "";
    if (text) text.textContent = "";
    if (a) a.textContent = "";
    if (b) b.textContent = "";
    if (c) c.textContent = "";

    const fills = document.querySelectorAll(".vr-gauge-fill");
    const previews = document.querySelectorAll(".vr-gauge-preview");

    fills.forEach(function (el) {
      el.style.setProperty("--vr-pct", "60%");
      el.style.width = "";
    });

    previews.forEach(function (el) {
      el.style.setProperty("--vr-pct", "68%");
      el.style.width = "";
      el.style.opacity = "0.22";
    });
  }

  function applyPreviewCosmetics(cfg) {
    const viewGame = document.getElementById("view-game");
    const cardMain = document.getElementById("vr-card-main");
    const choiceBtns = document.querySelectorAll(".vr-choice-button[data-choice]");

    if (!viewGame) return;

    try {
      document.body.dataset.universe = cfg.universeId;
    } catch (_) {}

    try {
      window.VRGame?.applyUniverseBackground?.(cfg.universeId);
    } catch (_) {}

    const assets = resolvePreviewAssets(cfg);

    setBgImage(viewGame, assets.background);
    setBgImage(cardMain, assets.message);

    choiceBtns.forEach(function (btn) {
      setBgImage(btn, assets.choice);
    });
  }

  async function initPreviewMode() {
    const cfg = getPreviewConfig();
    if (!cfg.enabled) return false;

    ensurePreviewStyles();

    document.documentElement.classList.add("vr-preview-mode");
    document.body.classList.add("vr-preview-mode");

    fillPreviewStaticUi();
    applyPreviewCosmetics(cfg);

    return true;
  }

  window.VRPreviewMode = {
    getConfig: getPreviewConfig,
    init: initPreviewMode
  };
})();


// -------------------------------------------------------
// VRGame
// -------------------------------------------------------
window.VRGame = {
  currentUniverse: null,
  session: { reignLength: 0 },

  async onUniverseSelected(universeId) {
    this.currentUniverse = universeId;
    this.session.reignLength = 0;

    this.applyUniverseBackground(universeId);
    this.applyUniverseCosmetics(universeId);

    let lang = "fr";
    try {
      const me = await window.VRProfile?.getMe?.(0);
      lang = (me?.lang || "fr").toString();
    } catch (_) {
      lang = localStorage.getItem("vrealms_lang") || "fr";
    }

    try {
      await window.VREngine.init(universeId, lang);
    } catch (e) {
      console.error("[VRGame] Erreur init moteur:", e);
    }

    this.applyUniverseCosmetics(universeId);
    try { window.VRCosmeticsGame?.render?.(); } catch (_) {}
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

  applyUniverseCosmetics(universeId) {
    try { window.VRCosmeticsGame?.apply?.(universeId); } catch (_) {}
  },

  async maybeShowInterstitial() {
    try {
      await (window.VRAds?.markAction?.() || Promise.resolve(0));
    } catch (e) {
      console.warn("[VRGame] interstitial skipped:", e);
    }
  },

  async maybeUnlockRunBadges() {
    try {
      if (!window.VRState?.isAlive?.()) return;

      const reign = Number(this.session?.reignLength || 0);
      const universeId = String(this.currentUniverse || localStorage.getItem("vrealms_universe") || "").trim();
      if (!universeId) return;

      const all = window.VUProfileBadges?.getAll?.() || { map: {} };
      const row = (all.map && all.map[universeId]) ? all.map[universeId] : {};

      if (reign >= VR_BADGE_BRONZE_CHOICES && !row.bronze) {
        await window.VUProfileBadges?.setBadge?.(universeId, "bronze", true);
      }
      if (reign >= VR_BADGE_SILVER_CHOICES && !row.silver) {
        await window.VUProfileBadges?.setBadge?.(universeId, "silver", true);
      }
      if (reign >= VR_BADGE_GOLD_CHOICES && !row.gold) {
        await window.VUProfileBadges?.setBadge?.(universeId, "gold", true);
      }
    } catch (e) {
      console.warn("[VRGame] badge unlock skipped:", e);
    }
  },

  onCardResolved() {
    this.session.reignLength += 1;
    Promise.resolve().then(() => this.maybeUnlockRunBadges());
  },

  async onRunEnded() {
    try {
      const reign = Number(this.session.reignLength || 0);

      const sb = window.sb;
      if (sb && typeof sb.rpc === "function") {
        let did = false;
        try {
          const r = await sb.rpc("secure_finish_run", { p_reign_length: reign });
          if (!r?.error) did = true;
        } catch (_) {}

        if (!did) {
          try { await sb.rpc("secure_inc_total_runs", { p_delta: 1 }); } catch (_) {}
          try { await sb.rpc("secure_set_best_reign_length", { p_value: reign }); } catch (_) {}
        }
      }

      try {
        const me = await window.VRProfile?.getMe?.(0);
        if (me) {
          window.VREngine._uiCoins = window.VRProfile._n(me.vcoins);
          window.VREngine._uiTokens = window.VRProfile._n(me.jetons);
        }
      } catch (_) {}
    } catch (e) {
      console.error("[VRGame] onRunEnded error:", e);
    }
  }
};


// -------------------------------------------------------
// Init page jeu seule
// -------------------------------------------------------
(function () {
  function setupNavigationGuards() {
    try {
      history.pushState({ vr_game: 1 }, "", location.href);
      history.pushState({ vr_game: 2 }, "", location.href);

      window.addEventListener("popstate", () => {
        try { history.pushState({ vr_game: 3 }, "", location.href); } catch (_) {}
      });
    } catch (_) {}

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

    try { document.documentElement.style.overscrollBehavior = "none"; } catch (_) {}
    try { document.body.style.overscrollBehavior = "none"; } catch (_) {}
  }

  function setupSaveGuards() {
    const flush = () => {
      try { window.VREngine?._saveRunSoft?.(); } catch (_) {}
    };

    try {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") flush();
      });
    } catch (_) {}

    try { window.addEventListener("pagehide", () => flush()); } catch (_) {}
    try { window.addEventListener("beforeunload", () => flush()); } catch (_) {}
  }

  async function initApp() {
    setupNavigationGuards();
    setupSaveGuards();

    try { await window.__VR_BOOT_READY; } catch (_) {}

    const hasGameView = !!document.getElementById("view-game");
    if (!hasGameView) return;

    const previewCfg = window.VRPreviewMode?.getConfig?.() || { enabled: false };
    if (previewCfg.enabled) {
      try {
        await window.VRPreviewMode.init();
      } catch (e) {
        console.error("[VRealms] preview mode error:", e);
      }
      return;
    }

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

    try { window.VRTokenUI?.init?.(); } catch (_) {}
    try { window.VRCoinUI?.init?.(); } catch (_) {}
    try { window.VRCosmeticsGame?.init?.(); } catch (_) {}

    const universeId = localStorage.getItem("vrealms_universe") || "hell_king";
    if (window.VRGame && typeof window.VRGame.onUniverseSelected === "function") {
      await window.VRGame.onUniverseSelected(universeId);
    }
  }

  document.addEventListener("DOMContentLoaded", initApp);
})();