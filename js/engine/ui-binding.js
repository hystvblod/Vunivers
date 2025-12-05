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
    currentCardText: null,

    init(universeConfig, lang) {
      this.universeConfig = universeConfig;
      this.lang = lang;
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

        if (!cfg) {
          el.style.display = "none";
          return;
        }

        el.style.display = "block";
        el.dataset.gaugeId = cfg.id;
        if (labelEl) {
          const label =
            this.lang === "fr"
              ? cfg.label_fr || cfg.id
              : cfg.label_en || cfg.id;
          labelEl.textContent = label;
        }
        if (fillEl) {
          fillEl.style.width = "50%";
        }
      });
    },

    _ensureGaugePreviewBars() {
      const frames = document.querySelectorAll(".vr-gauge-frame");
      frames.forEach((frame) => {
        let preview = frame.querySelector(".vr-gauge-preview");
        if (!preview) {
          preview = document.createElement("div");
          preview.className = "vr-gauge-preview";
          frame.appendChild(preview);
        }
        preview.style.width = "0%";
      });
    },

    updateGauges() {
      const gaugeEls = document.querySelectorAll(".vr-gauge");
      gaugeEls.forEach((el) => {
        const gaugeId = el.dataset.gaugeId;
        const fillEl = el.querySelector(".vr-gauge-fill");
        const previewEl = el.querySelector(".vr-gauge-preview");
        if (!gaugeId || !fillEl) return;

        const v = window.VRState.gauges[gaugeId] ?? 50;
        const clamped = Math.max(0, Math.min(100, v));
        fillEl.style.width = `${clamped}%`;

        // on reset la preview à chaque update normale
        if (previewEl) {
          previewEl.style.width = "0%";
        }
      });
    },

    showCard(cardLogic, cardText) {
      this.currentCardLogic = cardLogic;
      this.currentCardText = cardText || {};

      const titleEl = document.getElementById("event-title");
      const bodyEl = document.getElementById("event-body");
      const choiceA = document.getElementById("choice-A");
      const choiceB = document.getElementById("choice-B");
      const choiceC = document.getElementById("choice-C");

      // à chaque nouvelle carte on nettoie la preview
      this.clearPreview();

      if (!cardLogic) {
        if (titleEl) titleEl.textContent = "WIP";
        if (bodyEl) {
          bodyEl.textContent =
            "Cet univers n'est pas encore disponible.";
        }
        [choiceA, choiceB, choiceC].forEach((btn) => {
          if (btn) btn.style.display = "none";
        });
        return;
      }

      if (titleEl) {
        titleEl.textContent = cardText?.title || cardLogic.id || "";
      }
      if (bodyEl) {
        bodyEl.textContent = cardText?.body || "";
      }

      const choices = cardLogic.choices || {};

      this._fillChoiceButton(choiceA, "A", choices, cardText);
      this._fillChoiceButton(choiceB, "B", choices, cardText);
      this._fillChoiceButton(choiceC, "C", choices, cardText);
    },

    _fillChoiceButton(btn, key, choicesLogic, cardText) {
      if (!btn) return;
      const logic = choicesLogic[key];
      if (!logic) {
        btn.style.display = "none";
        return;
      }
      const text =
        cardText?.choices && cardText.choices[key]
          ? cardText.choices[key]
          : key;
      btn.textContent = text;
      btn.dataset.choiceKey = key;
      btn.style.display = "block";
    },

    // ✋ Preview des jauges pour un choix donné
    previewChoice(choiceKey) {
      if (!this.currentCardLogic) return;
      const logic = this.currentCardLogic.choices
        ? this.currentCardLogic.choices[choiceKey]
        : null;
      if (!logic) return;

      const deltaMap = logic.gaugeDelta || {};
      const gaugeEls = document.querySelectorAll(".vr-gauge");

      gaugeEls.forEach((el) => {
        const gaugeId = el.dataset.gaugeId;
        const previewEl = el.querySelector(".vr-gauge-preview");
        if (!gaugeId || !previewEl) return;

        const current = window.VRState.gauges[gaugeId] ?? 50;
        const delta = deltaMap[gaugeId] || 0;
        let previewValue = current + delta;
        if (previewValue < 0) previewValue = 0;
        if (previewValue > 100) previewValue = 100;

        previewEl.style.width = `${previewValue}%`;
      });
    },

    clearPreview() {
      const previewEls = document.querySelectorAll(".vr-gauge-preview");
      previewEls.forEach((el) => {
        el.style.width = "0%";
      });
    },

    _setupChoiceButtons() {
      ["A", "B", "C"].forEach((key) => {
        const btn = document.getElementById(`choice-${key}`);
        if (!btn) return;

        let startX = 0;
        let dragging = false;

        // Pointer down = début preview + on mémorise la position
        btn.addEventListener("pointerdown", (e) => {
          const choiceKey = btn.dataset.choiceKey || key;
          startX = e.clientX;
          dragging = true;
          // on montre la preview des jauges pour ce choix
          this.previewChoice(choiceKey);
          btn.setPointerCapture(e.pointerId);
        });

        // Pointer move = on regarde si on a glissé assez loin
        btn.addEventListener("pointermove", (e) => {
          if (!dragging) return;
          const dx = e.clientX - startX;
          // on pourrait animer le bouton avec dx si tu veux plus tard
        });

        // Pointer up / cancel = soit on valide (si glissé), soit on annule la preview
        const endDrag = (e) => {
          if (!dragging) return;
          dragging = false;
          const endX = e.clientX;
          const dx = endX - startX;
          const choiceKey = btn.dataset.choiceKey || key;

          // on enlève la preview de toute façon
          this.clearPreview();

          // si glissé assez loin → validation
          if (Math.abs(dx) >= DRAG_THRESHOLD) {
            if (
              window.VREngine &&
              typeof window.VREngine.choose === "function"
            ) {
              window.VREngine.choose(choiceKey);
            }
          } else {
            // pas assez glissé → juste preview temporaire, rien n'est joué
          }
        };

        btn.addEventListener("pointerup", endDrag);
        btn.addEventListener("pointercancel", endDrag);
        btn.addEventListener("pointerleave", (e) => {
          // si le doigt sort du bouton, on considère que le drag est terminé
          if (!dragging) return;
          endDrag(e);
        });
      });
    },

    showDeath() {
      const titleEl = document.getElementById("event-title");
      const bodyEl = document.getElementById("event-body");
      const choiceA = document.getElementById("choice-A");
      const choiceB = document.getElementById("choice-B");
      const choiceC = document.getElementById("choice-C");

      this.clearPreview();

      if (titleEl) titleEl.textContent = "Fin du règne";
      if (bodyEl) {
        bodyEl.textContent =
          "Une de tes jauges a atteint une extrémité. Ton règne s’achève, mais tes VCoins sont conservés.";
      }

      [choiceA, choiceB, choiceC].forEach((btn) => {
        if (!btn) return;
        btn.style.display = "none";
      });
    },

    showPlaceholder(title, body) {
      const titleEl = document.getElementById("event-title");
      const bodyEl = document.getElementById("event-body");
      const choiceA = document.getElementById("choice-A");
      const choiceB = document.getElementById("choice-B");
      const choiceC = document.getElementById("choice-C");

      this.clearPreview();

      if (titleEl) titleEl.textContent = title || "";
      if (bodyEl) bodyEl.textContent = body || "";

      [choiceA, choiceB, choiceC].forEach((btn) => {
        if (!btn) return;
        btn.style.display = "none";
      });
    }
  };

  window.VRUIBinding = VRUIBinding;
})();
