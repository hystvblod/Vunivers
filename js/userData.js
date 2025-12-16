// VRealms - userData.js
// Cache local (localStorage) + hooks Supabase (window.sb) prêts.
// Objectif: dès que Supabase est branché, tu passes en "source of truth" remote.

(function () {
  "use strict";

  const VUserDataKey = "vrealms_user_data";

  // --------- Remote store (Supabase) : stubs robustes ----------
  // Convention attendue:
  // - supabase client global: window.sb
  // - auth possible via window.bootstrapAuthAndProfile() (si tu l'as)
  window.VRRemoteStore = window.VRRemoteStore || {
    enabled() {
      return !!(window.sb && window.sb.auth);
    },

    async ensureAuth() {
      const sb = window.sb;
      if (!sb || !sb.auth) return null;

      try {
        if (typeof window.bootstrapAuthAndProfile === "function") {
          await window.bootstrapAuthAndProfile(); // peut faire signIn anon / profile init
        }
      } catch (_) {}

      try {
        const { data: { user }, error } = await sb.auth.getUser();
        if (error) return null;
        return user?.id || null;
      } catch (_) {
        return null;
      }
    },

    async loadLang() {
      // optionnel: récup langue depuis DB
      return null;
    },

    async saveLang(_lang) {
      return;
    },

    async loadBalances() {
      // Retour attendu: { vcoins:number, jetons:number }
      const sb = window.sb;
      if (!sb) return null;

      const uid = await this.ensureAuth();
      if (!uid) return null;

      // 1) si tu crées un RPC du style get_balances -> on le prend
      try {
        if (typeof sb.rpc === "function") {
          const r = await sb.rpc("get_balances");
          if (!r?.error && r?.data) {
            const row = Array.isArray(r.data) ? (r.data[0] || {}) : (r.data || {});
            const vcoins = Number(row.vcoins ?? row.points ?? 0);
            const jetons = Number(row.jetons ?? row.tokens ?? 0);
            return { vcoins, jetons };
          }
        }
      } catch (_) {}

      // 2) fallback table (à adapter quand tu l'auras)
      // ex: table "profiles" avec colonnes vcoins, jetons
      try {
        if (typeof sb.from === "function") {
          const r2 = await sb.from("profiles").select("vcoins,jetons").eq("id", uid).single();
          if (!r2?.error && r2?.data) {
            return {
              vcoins: Number(r2.data.vcoins || 0),
              jetons: Number(r2.data.jetons || 0)
            };
          }
        }
      } catch (_) {}

      return null;
    },

    async updateBalances(balances) {
      // balances: { vcoins, jetons }
      const sb = window.sb;
      if (!sb) return false;

      const uid = await this.ensureAuth();
      if (!uid) return false;

      // 1) RPC "set_balances" si tu veux (recommandé)
      try {
        if (typeof sb.rpc === "function") {
          const r = await sb.rpc("set_balances", {
            p_user_id: uid,
            p_vcoins: Number(balances?.vcoins || 0),
            p_jetons: Number(balances?.jetons || 0)
          });
          if (!r?.error) return true;
        }
      } catch (_) {}

      // 2) fallback update table
      try {
        if (typeof sb.from === "function") {
          const r2 = await sb.from("profiles")
            .update({
              vcoins: Number(balances?.vcoins || 0),
              jetons: Number(balances?.jetons || 0)
            })
            .eq("id", uid);
          if (!r2?.error) return true;
        }
      } catch (_) {}

      return false;
    },

    async addVcoins(delta) {
      const sb = window.sb;
      if (!sb) return false;

      const uid = await this.ensureAuth();
      if (!uid) return false;

      // RPC "secure_add_vcoins" (idempotent côté serveur)
      try {
        if (typeof sb.rpc === "function") {
          const r = await sb.rpc("secure_add_vcoins", {
            p_user_id: uid,
            p_amount: Number(delta || 0),
            p_product: "game"
          });
          if (!r?.error) return true;
        }
      } catch (_) {}

      // fallback: charge puis update
      const cur = await this.loadBalances();
      if (!cur) return false;
      cur.vcoins = Number(cur.vcoins || 0) + Number(delta || 0);
      return this.updateBalances(cur);
    },

    async addJetons(delta) {
      const sb = window.sb;
      if (!sb) return false;

      const uid = await this.ensureAuth();
      if (!uid) return false;

      // RPC "secure_add_jetons"
      try {
        if (typeof sb.rpc === "function") {
          const r = await sb.rpc("secure_add_jetons", {
            p_user_id: uid,
            p_amount: Number(delta || 0),
            p_product: "reward_ad"
          });
          if (!r?.error) return true;
        }
      } catch (_) {}

      // fallback
      const cur = await this.loadBalances();
      if (!cur) return false;
      cur.jetons = Number(cur.jetons || 0) + Number(delta || 0);
      return this.updateBalances(cur);
    }
  };
  // ------------------------------------------------------------

  const VUserData = {
    // Quand Supabase sera prêt: mets true pour préférer strictement le remote
    REMOTE_PREFERRED: true,

    _default() {
      return {
        lang: "fr",
        vcoins: 0,
        jetons: 0,

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
    },

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

    async init() {
      // Optionnel: langue remote
      try {
        const remoteLang = await window.VRRemoteStore?.loadLang?.();
        if (remoteLang) this.setLang(remoteLang);
      } catch (_) {}

      // ✅ balances remote -> cache local
      try {
        if (this.REMOTE_PREFERRED && window.VRRemoteStore?.enabled?.()) {
          const b = await window.VRRemoteStore.loadBalances();
          if (b && typeof b === "object") {
            const u = this.load();
            u.vcoins = Number(b.vcoins || 0);
            u.jetons = Number(b.jetons || 0);
            this.save(u);
          }
        }
      } catch (_) {}
    },

    getLang() {
      const u = this.load();
      return (u.lang || "fr").toString();
    },

    setLang(lang) {
      const l = (lang || "fr").toString().trim().toLowerCase() || "fr";
      const u = this.load();
      u.lang = l;
      this.save(u);

      // fire-and-forget remote
      try { window.VRRemoteStore?.saveLang?.(l); } catch (_) {}
      return l;
    },

    setVcoins(v) {
      const u = this.load();
      u.vcoins = Math.max(0, Math.floor(Number(v || 0)));
      this.save(u);

      // si remote, on pousse (non bloquant)
      try { window.VRRemoteStore?.updateBalances?.({ vcoins: u.vcoins, jetons: u.jetons }); } catch (_) {}
      return u.vcoins;
    },

    setJetons(v) {
      const u = this.load();
      u.jetons = Math.max(0, Math.floor(Number(v || 0)));
      this.save(u);

      try { window.VRRemoteStore?.updateBalances?.({ vcoins: u.vcoins, jetons: u.jetons }); } catch (_) {}
      return u.jetons;
    },

    addVcoins(delta) {
      const d = Math.floor(Number(delta || 0));
      if (!d) return this.load().vcoins;

      const u = this.load();
      u.vcoins = Math.max(0, Number(u.vcoins || 0) + d);
      this.save(u);

      // fire-and-forget remote (plus tard: rpc serveur)
      try { window.VRRemoteStore?.addVcoins?.(d); } catch (_) {}
      return u.vcoins;
    },

    addJetons(delta) {
      const d = Math.floor(Number(delta || 0));
      if (!d) return this.load().jetons;

      const u = this.load();
      u.jetons = Math.max(0, Number(u.jetons || 0) + d);
      this.save(u);

      try { window.VRRemoteStore?.addJetons?.(d); } catch (_) {}
      return u.jetons;
    },

    spendJetons(cost) {
      const c = Math.max(0, Math.floor(Number(cost || 0)));
      if (!c) return true;

      const u = this.load();
      const cur = Number(u.jetons || 0);
      if (cur < c) return false;

      u.jetons = cur - c;
      this.save(u);

      // remote: on fait addJetons(-c) si tu l'autorises côté serveur (sinon RPC dédié)
      try { window.VRRemoteStore?.addJetons?.(-c); } catch (_) {}
      return true;
    }
  };

  window.VUserData = VUserData;
})();
