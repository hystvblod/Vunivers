// VRealms - userData.js
// Gestion simple de l'état utilisateur (localStorage)
// + langue (local) + hooks "DB" prêts (Supabase plus tard)

(function () {
  const VUserDataKey = "vrealms_user_data";

  const VUserData = {
    load() {
      try {
        const raw = localStorage.getItem(VUserDataKey);
        if (!raw) return this._default();
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

    getLang() {
      const u = this.load();
      return (u.lang || "fr").toString();
    },

    setLang(lang) {
      const l = (lang || "fr").toString().trim().toLowerCase() || "fr";
      const u = this.load();
      this.save({ ...u, lang: l });
      return l;
    },

    _default() {
      return {
        lang: "fr",          // ✅ langue sauvegardée en local

        vcoins: 0,
        premium: false,
        unlockedUniverses: ["hell_king"],
        items: {
          revive: 0,
          gaugeSet50: 0,
          gaugePlus20: 0,
          gaugeMinus20: 0
        },
        stats: {
          totalRuns: 0,
          bestReignLength: 0
        }
      };
    }
  };

  // --------- PREPA "DB" (Supabase plus tard) ----------
  // Tu brancheras ça quand tu auras Supabase + un userId :
  // - loadLang(): récupérer la langue depuis la DB
  // - saveLang(lang): sauvegarder la langue en DB
  //
  // Par défaut: no-op (ça ne casse rien).
  window.VRRemoteStore = window.VRRemoteStore || {
    async loadLang() {
      return null;
    },
    async saveLang(_lang) {
      return;
    }
  };
  // ----------------------------------------------------

  window.VUserData = VUserData;
})();
