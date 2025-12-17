// VRealms - userData.js
// Local cache (localStorage) + Supabase (window.sb) en "source of truth" pour vcoins/jetons.
// - Auth anonyme au lancement (via window.bootstrapAuthAndProfile si dispo).
// - Lecture profil via RPC secure_get_me()
// - Écriture solde uniquement via RPC (secure_add_vcoins / secure_add_jetons / secure_spend_jetons)
// - Username via RPC secure_set_username()

(function () {
  "use strict";

  const VUserDataKey = "vrealms_user_data";

  // Petite queue pour sérialiser les appels Supabase (évite les races)
  let _remoteQueue = Promise.resolve();
  function queueRemote(fn) {
    _remoteQueue = _remoteQueue.then(fn).catch(() => null);
    return _remoteQueue;
  }

  // --------- Remote store (Supabase) ----------
  window.VRRemoteStore = window.VRRemoteStore || {
    enabled() {
      return !!(window.sb && window.sb.auth && typeof window.sb.rpc === "function");
    },

    async ensureAuth() {
      const sb = window.sb;
      if (!sb || !sb.auth) return null;

      // Si tu as la fonction globale de bootstrap, on l’utilise
      try {
        if (typeof window.bootstrapAuthAndProfile === "function") {
          const p = await window.bootstrapAuthAndProfile();
          return p?.id || (await this._getUid());
        }
      } catch (_) {}

      // Sinon, on fait au plus robuste:
      const uid = await this._getUid();
      if (uid) return uid;

      try {
        const r = await sb.auth.signInAnonymously();
        if (r?.data?.user?.id) return r.data.user.id;
      } catch (_) {}

      return await this._getUid();
    },

    async _getUid() {
      const sb = window.sb;
      if (!sb || !sb.auth) return null;
      try {
        const r = await sb.auth.getUser();
        return r?.data?.user?.id || null;
      } catch (_) {
        return null;
      }
    },

    async getMe() {
      const sb = window.sb;
      if (!sb || typeof sb.rpc !== "function") return null;

      const uid = await this.ensureAuth();
      if (!uid) return null;

      try {
        const r = await sb.rpc("secure_get_me");
        if (r?.error) return null;
        return r?.data || null;
      } catch (_) {
        return null;
      }
    },

    async setUsername(username) {
      const sb = window.sb;
      if (!sb || typeof sb.rpc !== "function") return { ok: false, reason: "no_client" };

      const uid = await this.ensureAuth();
      if (!uid) return { ok: false, reason: "no_auth" };

      try {
        const r = await sb.rpc("secure_set_username", { p_username: username });
        if (r?.error) return { ok: false, reason: "rpc_error" };
        // La fonction renvoie boolean: true = ok, false = déjà pris
        return { ok: !!r?.data, reason: r?.data ? "ok" : "taken" };
      } catch (_) {
        return { ok: false, reason: "exception" };
      }
    },

    async addVcoins(delta) {
      const sb = window.sb;
      if (!sb || typeof sb.rpc !== "function") return null;

      const uid = await this.ensureAuth();
      if (!uid) return null;

      const d = Math.floor(Number(delta || 0));
      if (d <= 0) return null;

      try {
        const r = await sb.rpc("secure_add_vcoins", { p_delta: d });
        if (r?.error) return null;
        return Number(r?.data ?? 0);
      } catch (_) {
        return null;
      }
    },

    async addJetons(delta) {
      const sb = window.sb;
      if (!sb || typeof sb.rpc !== "function") return null;

      const uid = await this.ensureAuth();
      if (!uid) return null;

      const d = Math.floor(Number(delta || 0));
      if (d <= 0) return null;

      try {
        const r = await sb.rpc("secure_add_jetons", { p_delta: d });
        if (r?.error) return null;
        return Number(r?.data ?? 0);
      } catch (_) {
        return null;
      }
    },

    async spendJetons(cost) {
      const sb = window.sb;
      if (!sb || typeof sb.rpc !== "function") return null;

      const uid = await this.ensureAuth();
      if (!uid) return null;

      const c = Math.floor(Number(cost || 0));
      if (c <= 0) return null;

      try {
        const r = await sb.rpc("secure_spend_jetons", { p_cost: c });
        if (r?.error) return null;
        return !!r?.data; // boolean
      } catch (_) {
        return null;
      }
    },

    async reduceVcoinsTo(value) {
      const sb = window.sb;
      if (!sb || typeof sb.rpc !== "function") return null;

      const uid = await this.ensureAuth();
      if (!uid) return null;

      const v = Math.max(0, Math.floor(Number(value || 0)));

      try {
        const r = await sb.rpc("secure_reduce_vcoins_to", { p_value: v });
        if (r?.error) return null;
        return Number(r?.data ?? 0);
      } catch (_) {
        return null;
      }
    },

    async setLang(lang) {
      const sb = window.sb;
      if (!sb || typeof sb.rpc !== "function") return false;

      const uid = await this.ensureAuth();
      if (!uid) return false;

      const l = (lang || "fr").toString().trim().toLowerCase() || "fr";
      try {
        const r = await sb.rpc("secure_set_lang", { p_lang: l });
        return !r?.error && !!r?.data;
      } catch (_) {
        return false;
      }
    }
  };

  // --------- Local store ----------
  function _default() {
    return {
      user_id: "",
      username: "",
      vcoins: 0,
      jetons: 0,
      lang: "fr",
      updated_at: Date.now()
    };
  }

  const VUserData = {
    init() {
      // Assure qu'on a un objet en local
      const u = this.load();
      this.save(u);

      // Si Supabase est dispo, on sync le profil au démarrage (non bloquant)
      if (window.VRRemoteStore?.enabled?.()) {
        queueRemote(async () => {
          const me = await window.VRRemoteStore.getMe();
          if (!me) return null;

          const cur = this.load();
          cur.user_id = me.id || cur.user_id || "";
          cur.username = (me.username || "").toString();
          cur.vcoins = Math.max(0, Math.floor(Number(me.vcoins || 0)));
          cur.jetons = Math.max(0, Math.floor(Number(me.jetons || 0)));
          cur.lang = (me.lang || cur.lang || "fr").toString();
          cur.updated_at = Date.now();
          this.save(cur);
          return true;
        });
      }
    },

    load() {
      try {
        const raw = localStorage.getItem(VUserDataKey);
        if (!raw) return _default();
        const parsed = JSON.parse(raw);
        const d = _default();

        const out = {
          ...d,
          ...(parsed && typeof parsed === "object" ? parsed : {})
        };

        out.vcoins = Math.max(0, Math.floor(Number(out.vcoins || 0)));
        out.jetons = Math.max(0, Math.floor(Number(out.jetons || 0)));
        out.lang = (out.lang || "fr").toString();
        out.username = (out.username || "").toString();
        out.user_id = (out.user_id || "").toString();
        out.updated_at = Number(out.updated_at || Date.now());

        return out;
      } catch (_) {
        return _default();
      }
    },

    save(u) {
      try {
        const data = (u && typeof u === "object") ? u : _default();
        data.updated_at = Date.now();
        localStorage.setItem(VUserDataKey, JSON.stringify(data));
      } catch (_) {}
    },

    // ----- Profil -----
    getUsername() {
      const u = this.load();
      return (u.username || "").toString();
    },

    getUserId() {
      const u = this.load();
      return (u.user_id || "").toString();
    },

    // Utilisé par l'index (popup pseudo)
    async setUsername(username) {
      const name = (username || "").toString().trim();
      if (name.length < 3 || name.length > 20) return { ok: false, reason: "invalid" };
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) return { ok: false, reason: "invalid" };

      if (!window.VRRemoteStore?.enabled?.()) {
        // Pas de remote -> on stocke local (dev), mais ça ne sera pas "server authoritative"
        const u = this.load();
        u.username = name;
        this.save(u);
        return { ok: true, reason: "local_only" };
      }

      const res = await window.VRRemoteStore.setUsername(name);
      if (res?.ok) {
        const u = this.load();
        u.username = name;
        this.save(u);
        return { ok: true, reason: "ok" };
      }
      return res || { ok: false, reason: "error" };
    },

    // ----- Lang -----
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
      if (window.VRRemoteStore?.enabled?.()) {
        queueRemote(async () => {
          await window.VRRemoteStore.setLang(l);
          return true;
        });
      }

      return l;
    },

    // ----- Soldes (server authoritative) -----
    getVcoins() {
      const u = this.load();
      return Number(u.vcoins || 0);
    },

    getJetons() {
      const u = this.load();
      return Number(u.jetons || 0);
    },

    addVcoins(delta) {
      const d = Math.floor(Number(delta || 0));
      if (d <= 0) return this.getVcoins();

      const u = this.load();
      u.vcoins = Math.max(0, Math.floor(Number(u.vcoins || 0))) + d;
      this.save(u);

      if (window.VRRemoteStore?.enabled?.()) {
        queueRemote(async () => {
          const newv = await window.VRRemoteStore.addVcoins(d);
          if (typeof newv === "number" && !Number.isNaN(newv)) {
            const cur = this.load();
            cur.vcoins = Math.max(0, Math.floor(newv));
            this.save(cur);
          } else {
            const me = await window.VRRemoteStore.getMe();
            if (me) {
              const cur = this.load();
              cur.vcoins = Math.max(0, Math.floor(Number(me.vcoins || 0)));
              cur.jetons = Math.max(0, Math.floor(Number(me.jetons || 0)));
              cur.username = (me.username || cur.username || "").toString();
              cur.lang = (me.lang || cur.lang || "fr").toString();
              cur.user_id = (me.id || cur.user_id || "").toString();
              this.save(cur);
            }
          }
          return true;
        });
      }

      return u.vcoins;
    },

    addJetons(delta) {
      const d = Math.floor(Number(delta || 0));
      if (d <= 0) return this.getJetons();

      const u = this.load();
      u.jetons = Math.max(0, Math.floor(Number(u.jetons || 0))) + d;
      this.save(u);

      if (window.VRRemoteStore?.enabled?.()) {
        queueRemote(async () => {
          const newj = await window.VRRemoteStore.addJetons(d);
          if (typeof newj === "number" && !Number.isNaN(newj)) {
            const cur = this.load();
            cur.jetons = Math.max(0, Math.floor(newj));
            this.save(cur);
          } else {
            const me = await window.VRRemoteStore.getMe();
            if (me) {
              const cur = this.load();
              cur.vcoins = Math.max(0, Math.floor(Number(me.vcoins || 0)));
              cur.jetons = Math.max(0, Math.floor(Number(me.jetons || 0)));
              cur.username = (me.username || cur.username || "").toString();
              cur.lang = (me.lang || cur.lang || "fr").toString();
              cur.user_id = (me.id || cur.user_id || "").toString();
              this.save(cur);
            }
          }
          return true;
        });
      }

      return u.jetons;
    },

    // Important: cette version est async (car on veut être sûr côté serveur)
    async spendJetons(cost) {
      const c = Math.floor(Number(cost || 0));
      if (c <= 0) return false;

      const u = this.load();
      const cur = Math.max(0, Math.floor(Number(u.jetons || 0)));
      if (cur < c) return false;

      // Sans remote: fallback local
      if (!window.VRRemoteStore?.enabled?.()) {
        u.jetons = cur - c;
        this.save(u);
        return true;
      }

      // Remote d'abord (source of truth)
      const ok = await window.VRRemoteStore.spendJetons(c);
      if (!ok) return false;

      // Puis on sync le local (et on refresh si besoin)
      const after = this.load();
      after.jetons = Math.max(0, cur - c);
      this.save(after);

      // Re-synchronise (en file) pour être certain
      queueRemote(async () => {
        const me = await window.VRRemoteStore.getMe();
        if (me) {
          const cur2 = this.load();
          cur2.vcoins = Math.max(0, Math.floor(Number(me.vcoins || 0)));
          cur2.jetons = Math.max(0, Math.floor(Number(me.jetons || 0)));
          cur2.username = (me.username || cur2.username || "").toString();
          cur2.lang = (me.lang || cur2.lang || "fr").toString();
          cur2.user_id = (me.id || cur2.user_id || "").toString();
          this.save(cur2);
        }
        return true;
      });

      return true;
    },

    // Utilisé par l’undo : on autorise uniquement une réduction côté serveur
    setVcoins(v) {
      const target = Math.max(0, Math.floor(Number(v || 0)));

      const u = this.load();
      u.vcoins = Math.max(0, Math.floor(Number(u.vcoins || 0)));
      u.vcoins = Math.min(u.vcoins, target); // local: réduction uniquement
      this.save(u);

      if (window.VRRemoteStore?.enabled?.()) {
        queueRemote(async () => {
          const newv = await window.VRRemoteStore.reduceVcoinsTo(target);
          if (typeof newv === "number" && !Number.isNaN(newv)) {
            const cur = this.load();
            cur.vcoins = Math.max(0, Math.floor(newv));
            this.save(cur);
          }
          return true;
        });
      }

      return u.vcoins;
    }
  };

  window.VUserData = VUserData;
})();
