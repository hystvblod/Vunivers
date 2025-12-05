// VRealms - userData.js
// Gestion simple de l'état utilisateur (localStorage)

(function () {
  const VUserDataKey = "vrealms_user_data";

  const VUserData = {
    load() {
      try {
        const raw = localStorage.getItem(VUserDataKey);
        if (!raw) {
          return this._default();
        }
        const parsed = JSON.parse(raw);
        return { ...this._default(), ...parsed };
      } catch (e) {
        console.error("Erreur chargement userData", e);
        return this._default();
      }
    },

    save(data) {
      try {
        localStorage.setItem(VUserDataKey, JSON.stringify(data));
      } catch (e) {
        console.error("Erreur sauvegarde userData", e);
      }
    },

    // Structure de base : VCoins + univers + jetons
    _default() {
      return {
        vcoins: 0,           // monnaie principale
        premium: false,      // plus tard : version premium ou pas
        unlockedUniverses: ["hell_king"], // univers débloqués
        items: {
          // jetons utilisables en jeu
          revive: 0,        // relance après la mort
          gaugeSet50: 0,    // remettre une jauge exactement à 50 %
          gaugePlus20: 0,   // augmenter une jauge de +20 %
          gaugeMinus20: 0   // diminuer une jauge de -20 %
        },
        stats: {
          totalRuns: 0,
          bestReignLength: 0
        }
      };
    }
  };

  // rendu global
  window.VUserData = VUserData;
})();
