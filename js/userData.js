// Vuniverse - userData.js
// Local cache (localStorage) + Supabase (window.sb) en "source of truth" pour vcoins/jetons/univers débloqués.
// - Auth anonyme au lancement (via window.bootstrapAuthAndProfile si dispo).
// - Lecture profil via RPC secure_get_me()
// - Écriture solde uniquement via RPC (secure_add_vcoins / secure_add_jetons / secure_spend_jetons / secure_reduce_vcoins_to)
// - Username via RPC secure_set_username()
// - Lang via RPC secure_set_lang()
// - Univers via RPC secure_unlock_universe()
//
// ✅ Corrections "prod-safe" :
// - Plus de logs visibles : aucun console.* par défaut (debug optionnel via window.__VR_DEBUG = true)
// - queueRemote garde la chaîne sans casser, mais expose une erreur via event (debug-only)
// - Ajout d'API async confirmées: addVcoinsAsync / addJetonsAsync / setVcoinsAsync (retourne solde confirmé)
// - spendJetons : suppression du double refresh (1 seul refresh en fallback ou en fin si voulu)
// - addVcoins/addJetons/setVcoins restent "fire-and-forget" pour l'UX (UI via event vr:profile)
//
// ✅ Fix anti-"flash UI" :
// - On charge le cache local SANS émettre vr:profile
// - On fait 1er refresh remote
// - Puis on déverrouille l’UI et on émet UNE SEULE fois

(function () {
  "use strict";

  const VUserDataKey = "vrealms_user_data";
  const LangStorageKey = "vrealms_lang";

  // -----------------------------
  // Anti "flash" : verrou UI
  // -----------------------------
  let _uiPaused = true;     // tant que true, on n’envoie pas vr:profile
  let _pendingEmit = false; // si on a “raté” un emit, on le fera après

  // Debug DEV uniquement (aucun log en prod). Activer manuellement dans la console:
  // window.__VR_DEBUG = true;
  function _isDebug() {
    try { return !!window.__VR_DEBUG; } catch (_) { return false; }
  }

  // Remonte une erreur "silencieuse" : en prod => no-op.
  // En debug => event + un champ mémoire consultable.
  const _errState = { last: null, ts: 0 };
  function _reportRemoteError(where, err) {
    try {
      if (!_isDebug()) return;
      _errState.last = {
        where: (where || "").toString(),
        message: (err && err.message) ? String(err.message) : String(err || "error"),
        ts: Date.now()
      };
      _errState.ts = Date.now();
      window.dispatchEvent(
        new CustomEvent("vr:remote_error", { detail: { ..._errState.last } })
      );
    } catch (_) {}
  }

  let _remoteQueue = Promise.resolve();

  function queueRemote(fn, where) {
    _remoteQueue = _remoteQueue
      .then(fn)
      .catch((e) => {
        _reportRemoteError(where || "queueRemote", e);
        return null;
      });
    return _remoteQueue;
  }

  const _memState = {
    user_id: "",
    username: "",
    vcoins: 0,
    jetons: 0,
    lang: "fr",
    // Univers débloqués (cache local UX). Supabase = source de vérité.
    unlocked_universes: ["hell_king", "heaven_king"],
    updated_at: Date.now(),
    last_sync_at: 0
  };

  function _clampInt(n) {
    return Math.max(0, Math.floor(Number(n || 0)));
  }

  function _safeParse(raw) {
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  function _readLocal() {
    try {
      const raw = localStorage.getItem(VUserDataKey);
      if (!raw) return null;
      const o = _safeParse(raw);
      if (!o || typeof o !== "object") return null;
      return o;
    } catch (_) {
      return null;
    }
  }

  function _writeLocal(obj) {
    try { localStorage.setItem(VUserDataKey, JSON.stringify(obj)); } catch (_) {}
  }

  function _persistLocal() {
    try {
      _writeLocal({
        user_id: (_memState.user_id || "").toString(),
        username: (_memState.username || "").toString(),
        vcoins: _clampInt(_memState.vcoins || 0),
        jetons: _clampInt(_memState.jetons || 0),
        lang: (_memState.lang || "fr").toString(),
        unlocked_universes: Array.isArray(_memState.unlocked_universes) ? _memState.unlocked_universes.slice(0) : ["hell_king","heaven_king"],
        updated_at: Date.now(),
        last_sync_at: Number(_memState.last_sync_at || 0)
      });
    } catch (_) {}

    try { localStorage.setItem(LangStorageKey, (_memState.lang || "fr").toString()); } catch (_) {}
  }

  function _emitProfile() {
    try {
      if (_uiPaused) { _pendingEmit = true; return; }

      window.dispatchEvent(
        new CustomEvent("vr:profile", {
          detail: {
            user_id: _memState.user_id,
            username: _memState.username,
            lang: _memState.lang,
            vcoins: _memState.vcoins,
            jetons: _memState.jetons,
            unlocked_universes: Array.isArray(_memState.unlocked_universes)
              ? _memState.unlocked_universes.slice(0)
              : ["hell_king", "heaven_king"]
          }
        })
      );
    } catch (_) {}
  }

  function _default() {
    return {
      user_id: "",
      username: "",
      vcoins: 0,
      jetons: 0,
      lang: "fr",
      unlocked_universes: ["hell_king", "heaven_king"],
      updated_at: Date.now()
    };
  }

  function _applyMe(me) {
    if (!me) return false;

    _memState.user_id = (me.id || "").toString();
    _memState.username = (me.username || "").toString();
    _memState.vcoins = _clampInt(me.vcoins || 0);
    _memState.jetons = _clampInt(me.jetons || 0);
    _memState.lang = (me.lang || "fr").toString();

    // ✅ Univers débloqués (si la colonne existe côté DB)
    if (Array.isArray(me.unlocked_universes)) {
      _memState.unlocked_universes = me.unlocked_universes.filter(Boolean).map(String);
    } else if (typeof me.unlocked_universes === "string" && me.unlocked_universes) {
      _memState.unlocked_universes = [me.unlocked_universes];
    } else if (!Array.isArray(_memState.unlocked_universes) || !_memState.unlocked_universes.length) {
      _memState.unlocked_universes = ["hell_king", "heaven_king"];
    }

    _memState.updated_at = Date.now();
    _memState.last_sync_at = Date.now();

    _emitProfile();
    _persistLocal();
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

      try {
        if (typeof window.bootstrapAuthAndProfile === "function") {
          const p = await window.bootstrapAuthAndProfile();
          return p?.id || (await this._getUid());
        }
      } catch (e) {
        _reportRemoteError("ensureAuth.bootstrapAuthAndProfile", e);
      }

      const uid = await this._getUid();
      if (uid) return uid;

      try {
        const r = await sb.auth.signInAnonymously();
        if (r?.data?.user?.id) return r.data.user.id;
      } catch (e) {
        _reportRemoteError("ensureAuth.signInAnonymously", e);
      }

      return await this._getUid();
    },

    async _getUid() {
      const sb = window.sb;
      if (!sb || !sb.auth) return null;
      try {
        const r = await sb.auth.getUser();
        return r?.data?.user?.id || null;
      } catch (e) {
        _reportRemoteError("_getUid", e);
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
        if (r?.error) {
          _reportRemoteError("rpc.secure_get_me", r.error);
          return null;
        }
        return r?.data || null;
      } catch (e) {
        _reportRemoteError("rpc.secure_get_me.exception", e);
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
        if (r?.error) {
          _reportRemoteError("rpc.secure_set_username", r.error);
          return { ok: false, reason: "rpc_error" };
        }
        return { ok: !!r?.data, reason: r?.data ? "ok" : "taken" };
      } catch (e) {
        _reportRemoteError("rpc.secure_set_username.exception", e);
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
        if (r?.error) {
          _reportRemoteError("rpc.secure_add_vcoins", r.error);
          return null;
        }
        return Number(r?.data ?? 0);
      } catch (e) {
        _reportRemoteError("rpc.secure_add_vcoins.exception", e);
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
        if (r?.error) {
          _reportRemoteError("rpc.secure_add_jetons", r.error);
          return null;
        }
        return Number(r?.data ?? 0);
      } catch (e) {
        _reportRemoteError("rpc.secure_add_jetons.exception", e);
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
        // ⚠️ Vérifie côté SQL que le param s'appelle bien p_delta
        const r = await sb.rpc("secure_spend_jetons", { p_delta: c });
        if (r?.error) {
          _reportRemoteError("rpc.secure_spend_jetons", r.error);
          return null;
        }
        return Number(r?.data ?? 0);
      } catch (e) {
        _reportRemoteError("rpc.secure_spend_jetons.exception", e);
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
        if (r?.error) {
          _reportRemoteError("rpc.secure_reduce_vcoins_to", r.error);
          return null;
        }
        return Number(r?.data ?? 0);
      } catch (e) {
        _reportRemoteError("rpc.secure_reduce_vcoins_to.exception", e);
        return null;
      }
    },

    async unlockUniverse(universeId) {
      const sb = window.sb;
      if (!sb || typeof sb.rpc !== "function") return { ok: false, reason: "no_client" };

      const uid = await this.ensureAuth();
      if (!uid) return { ok: false, reason: "no_auth" };

      const u = (universeId || "").toString().trim();
      if (!u) return { ok: false, reason: "invalid_universe" };

      try {
        const r = await sb.rpc("secure_unlock_universe", { p_universe: u });
        if (r?.error) {
          _reportRemoteError("rpc.secure_unlock_universe", r.error);
          return { ok: false, reason: r.error.message || "rpc_error", error: r.error };
        }
        return { ok: true, data: r?.data || null };
      } catch (e) {
        _reportRemoteError("rpc.secure_unlock_universe.exception", e);
        return { ok: false, reason: "rpc_exception", error: e };
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
        if (r?.error) _reportRemoteError("rpc.secure_set_lang", r.error);
        return !r?.error && !!r?.data;
      } catch (e) {
        _reportRemoteError("rpc.secure_set_lang.exception", e);
        return false;
      }
    }
  };

  const VUserData = {
    async init() {
      // 1) Charge cache local mais SANS event UI (on évite le flash)
      const cached = _readLocal();
      if (cached) {
        this.save(cached, { silent: true });
      } else {
        this.save(this.load(), { silent: true });
      }

      // 2) Remote = source of truth
      if (window.VRRemoteStore?.enabled?.()) {
        await this.refresh().catch((e) => {
          _reportRemoteError("VUserData.init.refresh", e);
          return false;
        });
      }

      // 3) Maintenant seulement, on autorise l’UI et on émet 1 fois
      _uiPaused = false;
      if (_pendingEmit) { _pendingEmit = false; _emitProfile(); }

      return true;
    },

    async refresh() {
      if (!window.VRRemoteStore?.enabled?.()) return false;

      return await queueRemote(async () => {
        const me = await window.VRRemoteStore.getMe();
        if (!me) return false;
        _applyMe(me);
        return true;
      }, "VUserData.refresh");
    },

    load() {
      try {
        const d = _default();
        return {
          ...d,
          user_id: (_memState.user_id || "").toString(),
          username: (_memState.username || "").toString(),
          vcoins: _clampInt(_memState.vcoins || 0),
          jetons: _clampInt(_memState.jetons || 0),
          lang: (_memState.lang || "fr").toString(),
          unlocked_universes: Array.isArray(_memState.unlocked_universes)
            ? _memState.unlocked_universes.slice(0)
            : ["hell_king","heaven_king"],
          updated_at: Number(_memState.updated_at || Date.now())
        };
      } catch (_) {
        return _default();
      }
    },

    // save(u, opts) : opts.silent = true => pas de vr:profile
    save(u, opts) {
      const silent = !!(opts && opts.silent);
      try {
        const data = (u && typeof u === "object") ? u : _default();
        _memState.user_id = (data.user_id || _memState.user_id || "").toString();
        _memState.username = (data.username || _memState.username || "").toString();
        _memState.vcoins = _clampInt(typeof data.vcoins !== "undefined" ? data.vcoins : _memState.vcoins);
        _memState.jetons = _clampInt(typeof data.jetons !== "undefined" ? data.jetons : _memState.jetons);
        _memState.lang = (data.lang || _memState.lang || "fr").toString();

        if (Array.isArray(data.unlocked_universes)) {
          _memState.unlocked_universes = data.unlocked_universes.filter(Boolean).map(String);
        } else if (!Array.isArray(_memState.unlocked_universes) || !_memState.unlocked_universes.length) {
          _memState.unlocked_universes = ["hell_king","heaven_king"];
        }

        _memState.updated_at = Date.now();

        if (!silent) _emitProfile();
        _persistLocal();
      } catch (_) {}
    },

    // Debug access (devtools uniquement)
    getLastRemoteError() {
      return _isDebug() ? (_errState.last ? { ..._errState.last } : null) : null;
    },

    getUnlockedUniverses() {
      const u = this.load();
      const arr = Array.isArray(u.unlocked_universes) ? u.unlocked_universes : null;
      if (arr && arr.length) return arr.filter(Boolean).map(String);
      return ["hell_king","heaven_king"];
    },

    isUniverseUnlocked(universeId) {
      const id = (universeId || "").toString();
      if (!id) return false;
      const set = new Set(this.getUnlockedUniverses());
      return set.has(id);
    },

    async unlockUniverse(universeId) {
      const id = (universeId || "").toString().trim();
      if (!id) return { ok: false, reason: "invalid_universe" };

      if (this.isUniverseUnlocked(id)) return { ok: true, reason: "already", data: this.load() };

      if (!window.VRRemoteStore?.enabled?.()) return { ok: false, reason: "no_remote" };

      const res = await window.VRRemoteStore.unlockUniverse(id);
      if (!res?.ok) return res || { ok: false, reason: "error" };

      const me = Array.isArray(res.data) ? (res.data[0] || null) : res.data;
      if (me && typeof me === "object") {
        const cur = this.load();
        this.save({
          ...cur,
          user_id: (me.id || cur.user_id || "").toString(),
          username: (me.username || cur.username || "").toString(),
          vcoins: (typeof me.vcoins !== "undefined") ? me.vcoins : cur.vcoins,
          jetons: (typeof me.jetons !== "undefined") ? me.jetons : cur.jetons,
          lang: (me.lang || cur.lang || "fr").toString(),
          unlocked_universes: Array.isArray(me.unlocked_universes) ? me.unlocked_universes : cur.unlocked_universes
        });
      } else {
        await this.refresh().catch(() => false);
      }
      return { ok: true, reason: "ok", data: this.load() };
    },

    getUsername() { return (this.load().username || "").toString(); },
    getUserId() { return (this.load().user_id || "").toString(); },
    getLang() { return (this.load().lang || "fr").toString(); },

    async setUsername(username) {
      const name = (username || "").toString().trim();
      if (name.length < 3 || name.length > 20) return { ok: false, reason: "invalid" };
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) return { ok: false, reason: "invalid" };
      if (!window.VRRemoteStore?.enabled?.()) return { ok: false, reason: "no_remote" };

      const res = await window.VRRemoteStore.setUsername(name);
      if (res?.ok) {
        await this.refresh().catch(() => false);
        return { ok: true, reason: "ok" };
      }
      return res || { ok: false, reason: "error" };
    },

    async setLang(lang) {
      const l = (lang || "fr").toString().trim().toLowerCase() || "fr";
      const cur = this.load();
      this.save({ ...cur, lang: l });

      if (window.VRRemoteStore?.enabled?.()) {
        const ok = await window.VRRemoteStore.setLang(l);
        if (ok) {
          await this.refresh().catch(() => false);
          return l;
        }
        await this.refresh().catch(() => false);
        return this.getLang();
      }
      return l;
    },

    getVcoins() { return Number(this.load().vcoins || 0); },
    getJetons() { return Number(this.load().jetons || 0); },

    // -----------------------------
    // Fire-and-forget (UX)
    // -----------------------------
    addVcoins(delta) {
      const d = Math.floor(Number(delta || 0));
      if (d <= 0) return this.getVcoins();
      if (!window.VRRemoteStore?.enabled?.()) return this.getVcoins();

      queueRemote(async () => {
        const newv = await window.VRRemoteStore.addVcoins(d);
        if (typeof newv === "number" && !Number.isNaN(newv)) {
          _memState.vcoins = _clampInt(newv);
          _memState.updated_at = Date.now();
          _emitProfile();
          _persistLocal();
        } else {
          await this.refresh().catch(() => false);
        }
        return true;
      }, "VUserData.addVcoins");

      // Retour immédiat (valeur actuelle). La UI doit écouter vr:profile.
      return this.getVcoins();
    },

    setVcoins(v) {
      const target = Math.max(0, Math.floor(Number(v || 0)));
      if (!window.VRRemoteStore?.enabled?.()) return this.getVcoins();

      queueRemote(async () => {
        const newv = await window.VRRemoteStore.reduceVcoinsTo(target);
        if (typeof newv === "number" && !Number.isNaN(newv)) {
          _memState.vcoins = _clampInt(newv);
          _memState.updated_at = Date.now();
          _emitProfile();
          _persistLocal();
        } else {
          await this.refresh().catch(() => false);
        }
        return true;
      }, "VUserData.setVcoins");

      return this.getVcoins();
    },

    addJetons(delta) {
      const d = Math.floor(Number(delta || 0));
      if (d <= 0) return this.getJetons();
      if (!window.VRRemoteStore?.enabled?.()) return this.getJetons();

      queueRemote(async () => {
        const newj = await window.VRRemoteStore.addJetons(d);
        if (typeof newj === "number" && !Number.isNaN(newj)) {
          _memState.jetons = _clampInt(newj);
          _memState.updated_at = Date.now();
          _emitProfile();
          _persistLocal();
        } else {
          await this.refresh().catch(() => false);
        }
        return true;
      }, "VUserData.addJetons");

      return this.getJetons();
    },

    // -----------------------------
    // Async confirmées (studio)
    // -----------------------------
    async addVcoinsAsync(delta) {
      const d = Math.floor(Number(delta || 0));
      if (d <= 0) return this.getVcoins();
      if (!window.VRRemoteStore?.enabled?.()) return this.getVcoins();

      const out = await queueRemote(async () => {
        const newv = await window.VRRemoteStore.addVcoins(d);
        if (typeof newv === "number" && !Number.isNaN(newv)) {
          _memState.vcoins = _clampInt(newv);
          _memState.updated_at = Date.now();
          _emitProfile();
          _persistLocal();
          return _memState.vcoins;
        }
        await this.refresh().catch(() => false);
        return this.getVcoins();
      }, "VUserData.addVcoinsAsync");

      return (typeof out === "number" && !Number.isNaN(out)) ? out : this.getVcoins();
    },

    async addJetonsAsync(delta) {
      const d = Math.floor(Number(delta || 0));
      if (d <= 0) return this.getJetons();
      if (!window.VRRemoteStore?.enabled?.()) return this.getJetons();

      const out = await queueRemote(async () => {
        const newj = await window.VRRemoteStore.addJetons(d);
        if (typeof newj === "number" && !Number.isNaN(newj)) {
          _memState.jetons = _clampInt(newj);
          _memState.updated_at = Date.now();
          _emitProfile();
          _persistLocal();
          return _memState.jetons;
        }
        await this.refresh().catch(() => false);
        return this.getJetons();
      }, "VUserData.addJetonsAsync");

      return (typeof out === "number" && !Number.isNaN(out)) ? out : this.getJetons();
    },

    async setVcoinsAsync(v) {
      const target = Math.max(0, Math.floor(Number(v || 0)));
      if (!window.VRRemoteStore?.enabled?.()) return this.getVcoins();

      const out = await queueRemote(async () => {
        const newv = await window.VRRemoteStore.reduceVcoinsTo(target);
        if (typeof newv === "number" && !Number.isNaN(newv)) {
          _memState.vcoins = _clampInt(newv);
          _memState.updated_at = Date.now();
          _emitProfile();
          _persistLocal();
          return _memState.vcoins;
        }
        await this.refresh().catch(() => false);
        return this.getVcoins();
      }, "VUserData.setVcoinsAsync");

      return (typeof out === "number" && !Number.isNaN(out)) ? out : this.getVcoins();
    },

    // -----------------------------
    // Spend jetons (sync, confirmé)
    // -----------------------------
    async spendJetons(cost) {
      const c = Math.floor(Number(cost || 0));
      if (c <= 0) return false;
      if (!window.VRRemoteStore?.enabled?.()) return false;

      // Ici on attend le RPC : c'est un "achat", donc confirmé.
      const newBal = await window.VRRemoteStore.spendJetons(c);

      if (typeof newBal !== "number" || Number.isNaN(newBal)) {
        // fallback: resync si RPC fail
        await this.refresh().catch(() => false);
        return false;
      }

      _memState.jetons = _clampInt(newBal);
      _memState.updated_at = Date.now();
      _emitProfile();
      _persistLocal();

      // ✅ Pas de double refresh. Si tu veux reconfirmer, fais-le côté appelant.
      return true;
    }
  };

  window.VUserData = VUserData;
})();
