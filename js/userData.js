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

  // ====== IMPORTANT ======
  // ✅ Rien en localStorage. Tout est lu/écrit via Supabase.
  // On conserve un cache en mémoire (runtime) pour l'UI uniquement.
  const _memState = {
    user_id: "",
    username: "",
    vcoins: 0,
    jetons: 0,
    lang: "fr",
    updated_at: Date.now(),
    last_sync_at: 0
  };

  function _clampInt(n) {
    return Math.max(0, Math.floor(Number(n || 0)));
  }

  function _emitProfile() {
    try {
      window.dispatchEvent(
        new CustomEvent("vr:profile", {
          detail: {
            user_id: _memState.user_id,
            username: _memState.username,
            lang: _memState.lang,
            vcoins: _memState.vcoins,
            jetons: _memState.jetons
          }
        })
      );
    } catch (_) {}
  }

  function _applyMe(me) {
    if (!me) return false;

    _memState.user_id = (me.id || "").toString();
    _memState.username = (me.username || "").toString();
    _memState.vcoins = _clampInt(me.vcoins || 0);
    _memState.jetons = _clampInt(me.jetons || 0);
    _memState.lang = (me.lang || "fr").toString();
    _memState.updated_at = Date.now();
    _memState.last_sync_at = Date.now();

    _emitProfile();
    return true;
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
        const r = await sb.rpc("secure_spend_jetons", { p_delta: c });

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
      // On garde l'appel load/save pour compat, mais ça n'écrit plus rien en local.
      const u = this.load();
      this.save(u);

      // Si Supabase est dispo, on sync le profil au démarrage (non bloquant)
      if (window.VRRemoteStore?.enabled?.()) {
        queueRemote(async () => {
          const me = await window.VRRemoteStore.getMe();
          if (!me) return null;
          _applyMe(me);
          return true;
        });
      }
    },

    // ✅ NEW: sync explicite (utile pages shop/profil)
    async refresh() {
      if (!window.VRRemoteStore?.enabled?.()) return false;

      return await queueRemote(async () => {
        const me = await window.VRRemoteStore.getMe();
        if (!me) return false;
        _applyMe(me);
        return true;
      });
    },

    load() {
      // ✅ plus de localStorage: on renvoie l'état mémoire
      try {
        const d = _default();
        return {
          ...d,
          user_id: (_memState.user_id || "").toString(),
          username: (_memState.username || "").toString(),
          vcoins: _clampInt(_memState.vcoins || 0),
          jetons: _clampInt(_memState.jetons || 0),
          lang: (_memState.lang || "fr").toString(),
          updated_at: Number(_memState.updated_at || Date.now())
        };
      } catch (_) {
        return _default();
      }
    },

    save(u) {
      // ✅ plus de localStorage: on met juste à jour l'état mémoire
      try {
        const data = (u && typeof u === "object") ? u : _default();
        _memState.user_id = (data.user_id || _memState.user_id || "").toString();
        _memState.username = (data.username || _memState.username || "").toString();
        _memState.vcoins = _clampInt(typeof data.vcoins !== "undefined" ? data.vcoins : _memState.vcoins);
        _memState.jetons = _clampInt(typeof data.jetons !== "undefined" ? data.jetons : _memState.jetons);
        _memState.lang = (data.lang || _memState.lang || "fr").toString();
        _memState.updated_at = Date.now();
        _emitProfile();
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

      // ✅ tout via Supabase
      if (!window.VRRemoteStore?.enabled?.()) {
        return { ok: false, reason: "no_remote" };
      }

      const res = await window.VRRemoteStore.setUsername(name);
      if (res?.ok) {
        // refresh authoritative
        await this.refresh().catch(() => false);
        return { ok: true, reason: "ok" };
      }
      return res || { ok: false, reason: "error" };
    },

    // ----- Lang -----
    getLang() {
      const u = this.load();
      return (u.lang || "fr").toString();
    },

    async setLang(lang) {
      const l = (lang || "fr").toString().trim().toLowerCase() || "fr";

      // ✅ tout via Supabase
      if (!window.VRRemoteStore?.enabled?.()) {
        return "fr";
      }

      const ok = await window.VRRemoteStore.setLang(l);
      if (ok) {
        await this.refresh().catch(() => false);
        return l;
      }

      // fallback : on resync ce que dit le serveur
      await this.refresh().catch(() => false);
      return this.getLang();
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

      // ✅ tout via Supabase
      if (!window.VRRemoteStore?.enabled?.()) {
        return this.getVcoins();
      }

      queueRemote(async () => {
        const newv = await window.VRRemoteStore.addVcoins(d);
        if (typeof newv === "number" && !Number.isNaN(newv)) {
          _memState.vcoins = _clampInt(newv);
          _memState.updated_at = Date.now();
          _emitProfile();
        } else {
          await this.refresh().catch(() => false);
        }
        return true;
      });

      // retour immédiat = valeur actuelle (sera mise à jour après sync)
      return this.getVcoins();
    },

    addJetons(delta) {
      const d = Math.floor(Number(delta || 0));
      if (d <= 0) return this.getJetons();

      // ✅ tout via Supabase
      if (!window.VRRemoteStore?.enabled?.()) {
        return this.getJetons();
      }

      queueRemote(async () => {
        const newj = await window.VRRemoteStore.addJetons(d);
        if (typeof newj === "number" && !Number.isNaN(newj)) {
          _memState.jetons = _clampInt(newj);
          _memState.updated_at = Date.now();
          _emitProfile();
        } else {
          await this.refresh().catch(() => false);
        }
        return true;
      });

      return this.getJetons();
    },

    // Important: cette version est async (car on veut être sûr côté serveur)
    async spendJetons(cost) {
      const c = Math.floor(Number(cost || 0));
      if (c <= 0) return false;

      // ✅ tout via Supabase
      if (!window.VRRemoteStore?.enabled?.()) {
        return false;
      }

      // Remote d'abord (source of truth)
      const ok = await window.VRRemoteStore.spendJetons(c);
      if (!ok) {
        await this.refresh().catch(() => false);
        return false;
      }

      // Resync authoritative
      await this.refresh().catch(() => false);
      return true;
    },

    // Utilisé par l’undo : on autorise uniquement une réduction côté serveur
    setVcoins(v) {
      const target = Math.max(0, Math.floor(Number(v || 0)));

      // ✅ tout via Supabase
      if (!window.VRRemoteStore?.enabled?.()) {
        return this.getVcoins();
      }

      queueRemote(async () => {
        const newv = await window.VRRemoteStore.reduceVcoinsTo(target);
        if (typeof newv === "number" && !Number.isNaN(newv)) {
          _memState.vcoins = _clampInt(newv);
          _memState.updated_at = Date.now();
          _emitProfile();
        } else {
          await this.refresh().catch(() => false);
        }
        return true;
      });

      return this.getVcoins();
    }
  };

  window.VUserData = VUserData;
})();
