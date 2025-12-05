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
    "Astaroth"
  ];

  const VREngine = {
    universeId: null,
    lang: "fr",
    config: null,
    deck: [],
    cardTexts: {},
    currentCard: null,
    recentCardIds: [],

    // meta / profil
    coinsTotal: 0,
    streakAlive: 0,

    // roi actuel
    currentKingName: null,
    currentKingNumber: 0,
    currentKingFull: null,

    async init(universeId, lang) {
      this.universeId = universeId;
      this.lang = lang || "fr";
      this.recentCardIds = [];
      this.streakAlive = 0;

      this._loadCoins();
      this._initDynasty(); // calcule Lucifer I / Belzebuth II / etc.

      const data = await window.VREventsLoader.loadUniverseData(
        universeId,
        this.lang
      );

      if (!data.config) {
        window.VRUIBinding.showPlaceholder(
          "Univers en préparation",
          "Cet univers n'est pas encore disponible. Reviens plus tard."
        );
        return;
      }

      this.config = data.config;
      this.deck = data.deck || [];
      this.cardTexts = data.cardTexts || {};

      window.VRState.initFromConfig(universeId, this.config);
      window.VRUIBinding.init(this.config, this.lang);
      window.VRUIBinding.updateGauges();

      if (!this.deck.length) {
        window.VRUIBinding.showPlaceholder(
          "Aucune carte",
          "Aucune carte n'est définie pour cet univers."
        );
        return;
      }

      this.currentCard = this._pickRandomCard();
      this._renderCurrentCard();

      // première mise à jour de la barre meta
      if (window.VRUIBinding.updateMeta) {
        window.VRUIBinding.updateMeta(
          this.currentKingFull,
          window.VRState.reignYears,
          this.coinsTotal
        );
      }
    },

    // --------- Tirage de carte avec anti-répétition ---------

    _pickRandomCard() {
      if (!this.deck.length) return null;

      // Si peu de cartes, on ne complique pas
      if (this.deck.length <= RECENT_MEMORY_SIZE) {
        const idx = Math.floor(Math.random() * this.deck.length);
        const card = this.deck[idx];
        this._rememberCard(card);
        return card;
      }

      let chosen = null;
      // Essais pour éviter les cartes récentes
      for (let i = 0; i < 10; i++) {
        const idx = Math.floor(Math.random() * this.deck.length);
        const candidate = this.deck[idx];
        if (!this.recentCardIds.includes(candidate.id)) {
          chosen = candidate;
          break;
        }
      }

      if (!chosen) {
        const idx = Math.floor(Math.random() * this.deck.length);
        chosen = this.deck[idx];
      }

      this._rememberCard(chosen);
      return chosen;
    },

    _rememberCard(card) {
      if (!card || !card.id) return;
      this.recentCardIds.push(card.id);
      if (this.recentCardIds.length > RECENT_MEMORY_SIZE) {
        this.recentCardIds.shift();
      }
    },

    _renderCurrentCard() {
      if (!this.currentCard) {
        window.VRUIBinding.showPlaceholder(
          "Aucune carte",
          "Aucune carte n'est définie pour cet univers."
        );
        return;
      }
      const text = this.cardTexts[this.currentCard.id] || null;
      window.VRUIBinding.showCard(this.currentCard, text);
      window.VRUIBinding.updateGauges();
    },

    // --------- Choix du joueur ---------

    choose(choiceKey) {
      if (!this.currentCard || window.VRState.isDead()) return;

      const logic = this.currentCard.choices
        ? this.currentCard.choices[choiceKey]
        : null;
      if (!logic) return;

      const delta = logic.gaugeDelta || {};
      window.VRState.applyGaugeDelta(delta);

      // temps + stats de run
      window.VRState.advanceAfterCard();

      // VCoins (base + streak)
      this._addCoinsForCard();

      // mise à jour UI : jauges + meta
      window.VRUIBinding.updateGauges();
      if (window.VRUIBinding.updateMeta) {
        window.VRUIBinding.updateMeta(
          this.currentKingFull,
          window.VRState.reignYears,
          this.coinsTotal
        );
      }

      // callback jeu global
      if (window.VRGame && typeof window.VRGame.onCardResolved === "function") {
        window.VRGame.onCardResolved();
      }

      // mort ?
      if (window.VRState.isDead()) {
        if (window.VRGame && typeof window.VRGame.onRunEnded === "function") {
          window.VRGame.onRunEnded();
        }

        // reset du streak pour la prochaine run
        this.streakAlive = 0;

        // écran de fin selon la jauge / direction
        if (window.VREndings && typeof window.VREndings.showEnding === "function") {
          window.VREndings.showEnding(this.universeId, this.lang);
        } else if (window.VRUIBinding.showEnding) {
          window.VRUIBinding.showEnding(
            "Fin du règne",
            "Une de tes jauges a atteint une extrémité. Ton règne s'achève."
          );
        }
        return;
      }

      // sinon, carte suivante
      this.currentCard = this._pickRandomCard();
      this._renderCurrentCard();
    },

    // --------- Dynasties : Lucifer I, Belzebuth II, etc. ---------

    _initDynasty() {
      // une dynastie par univers
      const key = `vrealms_${this.universeId}_dynasty`;
      let stored = null;
      try {
        stored = JSON.parse(localStorage.getItem(key) || "null");
      } catch (e) {
        stored = null;
      }
      if (!stored) {
        stored = { idx: 0, num: 0 }; // idx = index dans HELL_KING_DYNASTIES, num = numéro courant
      }

      let idx = stored.idx || 0;
      let num = (stored.num || 0) + 1;

      // on limite à 9 par nom puis on passe au suivant
      if (num > 9) {
        num = 1;
        idx = (idx + 1) % HELL_KING_DYNASTIES.length;
      }

      const baseName = HELL_KING_DYNASTIES[idx] || "Inconnu";
      const fullName = `${baseName} ${this._toRoman(num)}`;

      this.currentKingName = baseName;
      this.currentKingNumber = num;
      this.currentKingFull = fullName;

      stored.idx = idx;
      stored.num = num;
      try {
        localStorage.setItem(key, JSON.stringify(stored));
      } catch (e) {
        // silencieux
      }
    },

    _toRoman(num) {
      if (!num || num <= 0) return "";
      const map = [
        [1000, "M"],
        [900, "CM"],
        [500, "D"],
        [400, "CD"],
        [100, "C"],
        [90, "XC"],
        [50, "L"],
        [40, "XL"],
        [10, "X"],
        [9, "IX"],
        [5, "V"],
        [4, "IV"],
        [1, "I"]
      ];
      let n = num;
      let out = "";
      for (const [val, sym] of map) {
        while (n >= val) {
          out += sym;
          n -= val;
        }
      }
      return out;
    },

    // --------- VCoins : 5 par carte + bonus de série ---------

    _loadCoins() {
      let v = 0;
      try {
        const raw = localStorage.getItem("vrealms_coins");
        if (raw != null) v = parseInt(raw, 10) || 0;
      } catch (e) {
        v = 0;
      }
      this.coinsTotal = v;
    },

    _saveCoins() {
      try {
        localStorage.setItem("vrealms_coins", String(this.coinsTotal));
      } catch (e) {
        // ignore
      }
    },

    _addCoinsForCard() {
      let gained = BASE_COINS_PER_CARD; // 5 VCoins par décision
      this.streakAlive += 1;

      // bonus tous les STREAK_STEP choix à la suite (ex : toutes les 10 cartes)
      if (this.streakAlive > 0 && this.streakAlive % STREAK_STEP === 0) {
        gained += STREAK_BONUS;
      }

      this.coinsTotal += gained;
      this._saveCoins();

      // tu peux afficher le gain dans l'UI plus tard si tu veux
      if (window.VRUIBinding.updateMeta) {
        window.VRUIBinding.updateMeta(
          this.currentKingFull,
          window.VRState.reignYears,
          this.coinsTotal
        );
      }
    }
  };

  window.VREngine = VREngine;
})();
