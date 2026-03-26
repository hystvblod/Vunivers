// Vuniverse - js/profile.js
// Gère:
// - pseudo
// - vcoins / jetons
// - badges localStorage + base profiles.universe_badges
// - 1 seul empty pour tous les badges
// - modal d'aperçu badge
//
// Base attendue dans profiles:
// - universe_badges jsonb
// - universe_badges_updated_at timestamptz

(function () {
  "use strict";

  const BADGES_STORAGE_KEY = "vuniverse_badges_v1";

  const SECRET_USERNAME_CODE = "thomaslucasprout";
  const SECRET_REWARD_VCOINS = 150;
  const SECRET_PROFILE_FIELD = "secret_lucas_thomas_prout_claimed";

  function _secretNorm(v) {
    return String(v || "").trim().toLowerCase();
  }

  function ensureSecretOverlay() {
    if (!document.getElementById("vrSecretStyle")) {
      const style = document.createElement("style");
      style.id = "vrSecretStyle";
      style.textContent = `
        body.vr-secret-active > *:not(#vrSecretOverlay){
          filter: grayscale(.82) contrast(1.06) brightness(.92);
        }

        #vrSecretOverlay{
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: none;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: rgba(0,0,0,.78);
          backdrop-filter: blur(3px);
          -webkit-backdrop-filter: blur(3px);
          overflow: hidden;
        }

        #vrSecretOverlay.is-open{
          display: flex;
        }

        body.vr-secret-screen-shake{
          animation: vrSecretShake .9s linear 3;
          transform-origin: center center;
        }

        #vrSecretOverlay .vr-secret-noise{
          position: absolute;
          inset: -15%;
          pointer-events: none;
          opacity: .22;
          background:
            repeating-linear-gradient(
              180deg,
              rgba(255,255,255,.10) 0px,
              rgba(255,255,255,.10) 1px,
              transparent 2px,
              transparent 4px
            ),
            repeating-linear-gradient(
              90deg,
              rgba(255,255,255,.05) 0px,
              rgba(255,255,255,.05) 1px,
              transparent 2px,
              transparent 6px
            );
          mix-blend-mode: screen;
          animation: vrSecretNoise .16s steps(2) infinite;
        }

        #vrSecretOverlay .vr-secret-panel{
          position: relative;
          z-index: 10;
          width: min(560px, 100%);
          border-radius: 24px;
          padding: 24px 18px 18px;
          border: 1px solid rgba(255,255,255,.12);
          background: linear-gradient(180deg, rgba(23,27,40,.96), rgba(10,12,18,.98));
          box-shadow: 0 24px 70px rgba(0,0,0,.5);
          color: #fff;
          text-align: center;
          transform: translateY(10px) scale(.98);
          animation: vrSecretPanelIn .24s ease forwards;
        }

        #vrSecretOverlay .vr-secret-title{
          font-size: clamp(22px, 4.8vw, 32px);
          font-weight: 1000;
          line-height: 1.04;
          margin-bottom: 12px;
        }

        #vrSecretOverlay .vr-secret-body{
          font-size: clamp(14px, 3.2vw, 16px);
          line-height: 1.5;
          opacity: .95;
          white-space: pre-line;
          max-width: 440px;
          margin: 0 auto 18px;
          min-height: 168px;
        }

        #vrSecretOverlay .vr-secret-body.is-typing::after{
          content: "▋";
          display: inline-block;
          margin-left: 4px;
          animation: vrSecretCaret .7s step-end infinite;
        }

        #vrSecretOverlay .vr-secret-reward{
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 12px 18px;
          border-radius: 999px;
          margin-bottom: 18px;
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.12);
        }

        #vrSecretOverlay .vr-secret-reward img{
          width: 34px;
          height: 34px;
          object-fit: contain;
        }

        #vrSecretOverlay .vr-secret-reward-text{
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          line-height: 1.04;
        }

        #vrSecretOverlay .vr-secret-reward-label{
          font-size: 11px;
          letter-spacing: .08em;
          text-transform: uppercase;
          opacity: .78;
        }

        #vrSecretOverlay .vr-secret-reward-value{
          font-size: 28px;
          font-weight: 1000;
          animation: vrSecretBlink 1s ease-in-out infinite;
        }

        #vrSecretOverlay .vr-secret-btn{
          min-width: 160px;
          border: 0;
          border-radius: 14px;
          padding: 12px 18px;
          font-weight: 1000;
          cursor: pointer;
          color: #10131b;
          background: linear-gradient(180deg, #ffffff, #dfe7ff);
          box-shadow: 0 10px 24px rgba(0,0,0,.22);
        }

        #vrSecretOverlay .vr-secret-confetti{
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          z-index: 5;
        }

        #vrSecretOverlay .vr-secret-piece{
          position: absolute;
          top: -10%;
          width: 10px;
          height: 18px;
          border-radius: 3px;
          opacity: .96;
          animation-name: vrSecretConfetti;
          animation-timing-function: ease-out;
          animation-fill-mode: forwards;
        }

        @keyframes vrSecretCaret{
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        @keyframes vrSecretShake{
          0%   { transform: translate(0,0) rotate(0deg); }
          10%  { transform: translate(-10px, 4px) rotate(-0.4deg); }
          20%  { transform: translate(10px, -5px) rotate(0.4deg); }
          30%  { transform: translate(-8px, 5px) rotate(-0.35deg); }
          40%  { transform: translate(9px, -4px) rotate(0.35deg); }
          50%  { transform: translate(-7px, 4px) rotate(-0.25deg); }
          60%  { transform: translate(7px, -5px) rotate(0.25deg); }
          70%  { transform: translate(-6px, 3px) rotate(-0.2deg); }
          80%  { transform: translate(6px, -3px) rotate(0.2deg); }
          90%  { transform: translate(-3px, 2px) rotate(-0.1deg); }
          100% { transform: translate(0,0) rotate(0deg); }
        }

        @keyframes vrSecretNoise{
          0%   { transform: translate(0,0); }
          25%  { transform: translate(-1%, 1%); }
          50%  { transform: translate(1%, -1%); }
          75%  { transform: translate(1%, 1%); }
          100% { transform: translate(0,0); }
        }

        @keyframes vrSecretPanelIn{
          from { opacity: 0; transform: translateY(16px) scale(.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes vrSecretConfetti{
          0%{
            transform: translate3d(0,0,0) rotate(0deg);
            opacity: 0;
          }
          10%{
            opacity: 1;
          }
          100%{
            transform: translate3d(var(--dx), 120vh, 0) rotate(var(--rot));
            opacity: 0;
          }
        }

        @keyframes vrSecretBlink{
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .45; transform: scale(1.08); }
        }
      `;
      document.head.appendChild(style);
    }

    if (!document.getElementById("vrSecretOverlay")) {
      const overlay = document.createElement("div");
      overlay.id = "vrSecretOverlay";
      overlay.innerHTML = `
        <div class="vr-secret-noise"></div>
        <div class="vr-secret-confetti" id="vrSecretConfetti"></div>

        <div class="vr-secret-panel" role="dialog" aria-modal="true">
          <div class="vr-secret-title" id="vrSecretTitle"></div>
          <div class="vr-secret-body" id="vrSecretBody"></div>

          <div class="vr-secret-reward" id="vrSecretReward" hidden>
            <img src="assets/img/ui/vcoins.webp" alt="" draggable="false" />
            <div class="vr-secret-reward-text">
              <span class="vr-secret-reward-label" id="vrSecretRewardLabel"></span>
              <span class="vr-secret-reward-value" id="vrSecretRewardValue"></span>
            </div>
          </div>

          <button type="button" class="vr-secret-btn" id="vrSecretCloseBtn"></button>
        </div>
      `;
      document.body.appendChild(overlay);

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeSecretOverlay();
      });

      overlay.querySelector("#vrSecretCloseBtn")?.addEventListener("click", closeSecretOverlay);

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeSecretOverlay();
      });
    }
  }

  function closeSecretOverlay() {
    const overlay = document.getElementById("vrSecretOverlay");
    if (!overlay || !overlay.classList.contains("is-open")) return;

    overlay.classList.remove("is-open");
    try {
      document.body.classList.remove("vr-secret-active");
      document.body.classList.remove("vr-secret-screen-shake");
    } catch (_) {}

    const confetti = document.getElementById("vrSecretConfetti");
    if (confetti) confetti.innerHTML = "";

    const done = overlay.__resolve;
    overlay.__resolve = null;
    if (typeof done === "function") done();
  }

  function spawnSecretConfetti() {
    const host = document.getElementById("vrSecretConfetti");
    if (!host) return;

    host.innerHTML = "";
    const colors = ["#ffffff", "#ffd84d", "#8dd6ff", "#ff8ad8", "#9effa5", "#ffb347"];

    for (let i = 0; i < 90; i += 1) {
      const piece = document.createElement("span");
      piece.className = "vr-secret-piece";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.width = `${6 + Math.random() * 10}px`;
      piece.style.height = `${10 + Math.random() * 16}px`;
      piece.style.borderRadius = `${2 + Math.random() * 4}px`;
      piece.style.setProperty("--dx", `${(-220 + Math.random() * 440).toFixed(0)}px`);
      piece.style.setProperty("--rot", `${(-900 + Math.random() * 1800).toFixed(0)}deg`);
      piece.style.animationDuration = `${4.8 + Math.random() * 2.8}s`;
      piece.style.animationDelay = `${Math.random() * 0.7}s`;
      host.appendChild(piece);
    }

    setTimeout(() => {
      if (host) host.innerHTML = "";
    }, 9000);
  }

  function typeSecretBodyText(el, text, baseSpeed = 18) {
    if (!el) return Promise.resolve();

    const fullText = String(text || "");
    el.textContent = "";
    el.classList.add("is-typing");

    return new Promise((resolve) => {
      let i = 0;

      function tick() {
        el.textContent = fullText.slice(0, i);
        i += 1;

        if (i <= fullText.length) {
          const prev = fullText.charAt(i - 1);
          let delay = baseSpeed;

          if (prev === "\n") delay = 120;
          else if (/[.!?…]/.test(prev)) delay = 140;
          else if (/[,;:]/.test(prev)) delay = 80;

          setTimeout(tick, delay);
        } else {
          el.classList.remove("is-typing");
          resolve();
        }
      }

      tick();
    });
  }

  async function showSecretOverlay(result) {
    ensureSecretOverlay();

    const overlay = document.getElementById("vrSecretOverlay");
    const title = document.getElementById("vrSecretTitle");
    const body = document.getElementById("vrSecretBody");
    const reward = document.getElementById("vrSecretReward");
    const rewardLabel = document.getElementById("vrSecretRewardLabel");
    const rewardValue = document.getElementById("vrSecretRewardValue");
    const closeBtn = document.getElementById("vrSecretCloseBtn");

    if (!overlay || !title || !body || !reward || !rewardLabel || !rewardValue || !closeBtn) {
      return Promise.resolve();
    }

    const credited = !!result?.credited;
    const rewardAmount = Number(result?.reward || 0) || 0;

    const titleText = credited
      ? _t("profile.secretTitleClaimed", "")
      : _t("profile.secretTitleSeen", "");

    const bodyText = credited
      ? _t("profile.secretBodyClaimed", "")
      : _t("profile.secretBodySeen", "");

    title.textContent = titleText;
    body.textContent = "";

    rewardLabel.textContent = _t("profile.secretRewardLabel", "");
    rewardValue.textContent = `+${rewardAmount}`;
    reward.hidden = true;

    closeBtn.textContent = _t("common.continue", "Continue");

    try {
      document.body.classList.add("vr-secret-active");
      document.body.classList.add("vr-secret-screen-shake");
    } catch (_) {}

    await new Promise((resolve) => setTimeout(resolve, 2200));

    try {
      document.body.classList.remove("vr-secret-screen-shake");
    } catch (_) {}

    overlay.classList.add("is-open");

    if (credited) {
      setTimeout(() => {
        spawnSecretConfetti();
      }, 180);
    }

    await typeSecretBodyText(body, bodyText, 18);

    reward.hidden = !credited;

    return new Promise((resolve) => {
      overlay.__resolve = resolve;
    });
  }

  async function tryClaimProfileSecretOnce() {
    const sb = window.sb;
    if (!sb || typeof sb.from !== "function") {
      return { ok: false, credited: false, reward: 0, first_time: false, reason: "no_client" };
    }

    const uid = await _ensureAuth();
    if (!uid) {
      return { ok: false, credited: false, reward: 0, first_time: false, reason: "no_auth" };
    }

    try {
      const claim = await sb
        .from("profiles")
        .update({ [SECRET_PROFILE_FIELD]: true })
        .eq("id", uid)
        .eq(SECRET_PROFILE_FIELD, false)
        .select("id");

      if (claim?.error) {
        console.error("SECRET claim error:", claim.error);
        return { ok: false, credited: false, reward: 0, first_time: false, reason: "claim_failed" };
      }

      const firstTime = Array.isArray(claim?.data) && claim.data.length > 0;

      if (!firstTime) {
        return { ok: true, credited: false, reward: 0, first_time: false };
      }

      const newBalance = await window.VUserData?.addVcoinsAsync?.(SECRET_REWARD_VCOINS);

      if (typeof newBalance !== "number" || Number.isNaN(newBalance)) {
        return { ok: false, credited: false, reward: 0, first_time: true, reason: "credit_failed" };
      }

      try { await window.VUserData?.refresh?.(); } catch (_) {}

      return {
        ok: true,
        credited: true,
        reward: SECRET_REWARD_VCOINS,
        first_time: true,
        vcoins: Number(newBalance || 0) || 0
      };
    } catch (err) {
      console.error("SECRET exception:", err);
      return { ok: false, credited: false, reward: 0, first_time: false, reason: "exception" };
    }
  }

  async function runProfileSecretFlow() {
    const result = await tryClaimProfileSecretOnce();

    if (!result.ok) {
      setMsg("err", "profile.secretErrGeneric");
      return false;
    }

    renderProfileFromState();

    try {
      await window.VRAnalytics?.log?.("profile_secret_found", {
        code: SECRET_USERNAME_CODE,
        first_time: !!result.first_time,
        credited: !!result.credited,
        reward: Number(result.reward || 0) || 0
      });
    } catch (_) {}

    await showSecretOverlay(result);
    return true;
  }

  const FALLBACK_UNIVERSES = [
    "hell_king",
    "heaven_king",
    "western_president",
    "mega_corp_ceo",
    "new_world_explorer",
    "vampire_lord"
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function _safeParse(raw) {
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  function _norm(v) {
    return String(v || "").trim().toLowerCase();
  }

  function _now() {
    return Date.now();
  }

  function _bool(v) {
    return !!v;
  }

  function _fromIso(v) {
    try {
      const t = new Date(v).getTime();
      return Number.isFinite(t) ? t : 0;
    } catch (_) {
      return 0;
    }
  }

  function _toIso(ts) {
    try {
      return new Date(Number(ts || Date.now())).toISOString();
    } catch (_) {
      return new Date().toISOString();
    }
  }

  function _normalizeBadgeMap(input) {
    const out = {};
    const src = (input && typeof input === "object") ? input : {};

    Object.keys(src).forEach((universeId) => {
      const uid = _norm(universeId);
      if (!uid) return;

      const row = src[universeId];
      if (!row || typeof row !== "object") return;

      out[uid] = {
        bronze: _bool(row.bronze),
        silver: _bool(row.silver),
        gold: _bool(row.gold)
      };
    });

    return out;
  }

  function _readLocalBadges() {
    const raw = localStorage.getItem(BADGES_STORAGE_KEY);
    const parsed = _safeParse(raw);

    if (!parsed || typeof parsed !== "object") {
      return { ts: 0, map: {} };
    }

    return {
      ts: Number(parsed.ts || 0) || 0,
      map: _normalizeBadgeMap(parsed.map || {})
    };
  }

  function _writeLocalBadges(data) {
    const payload = {
      ts: Number(data?.ts || 0) || _now(),
      map: _normalizeBadgeMap(data?.map || {})
    };

    try {
      localStorage.setItem(BADGES_STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {}
  }

  function _emitBadges(detail) {
    try {
      window.dispatchEvent(new CustomEvent("vr:reign_badge_updated", {
        detail: detail || {}
      }));
    } catch (_) {}
  }

  // ✅ PATCH: session locale d’abord, puis fallback getUser
  async function _ensureAuth() {
    try { await window.bootstrapAuthAndProfile?.({ skipProfileFetch: true }); } catch (_) {}

    const sb = window.sb;
    if (!sb || !sb.auth) return null;

    try {
      const s = await sb.auth.getSession();
      const uid = s?.data?.session?.user?.id || null;
      if (uid) return uid;
    } catch (_) {}

    try {
      const r = await sb.auth.getUser();
      return r?.data?.user?.id || null;
    } catch (_) {
      return null;
    }
  }

  async function _readRemoteBadges() {
    const sb = window.sb;
    if (!sb || typeof sb.from !== "function") return null;

    const uid = await _ensureAuth();
    if (!uid) return null;

    try {
      const r = await sb
        .from("profiles")
        .select("id, universe_badges, universe_badges_updated_at")
        .eq("id", uid)
        .single();

      if (r?.error) return null;

      return {
        ts: _fromIso(r?.data?.universe_badges_updated_at),
        map: _normalizeBadgeMap(r?.data?.universe_badges || {})
      };
    } catch (_) {
      return null;
    }
  }

  async function _writeRemoteBadges(data) {
    const sb = window.sb;
    if (!sb || typeof sb.from !== "function") return null;

    const uid = await _ensureAuth();
    if (!uid) return null;

    const payload = {
      universe_badges: _normalizeBadgeMap(data?.map || {}),
      universe_badges_updated_at: _toIso(data?.ts || _now())
    };

    try {
      const r = await sb
        .from("profiles")
        .update(payload)
        .eq("id", uid)
        .select("id, universe_badges, universe_badges_updated_at")
        .single();

      if (r?.error) return null;

      return {
        ts: _fromIso(r?.data?.universe_badges_updated_at),
        map: _normalizeBadgeMap(r?.data?.universe_badges || {})
      };
    } catch (_) {
      return null;
    }
  }

  function _hasAnyBadge(map) {
    try {
      return Object.values(map || {}).some((row) => row && (row.bronze || row.silver || row.gold));
    } catch (_) {
      return false;
    }
  }

  async function _initBadges() {
    const local = _readLocalBadges();
    const remote = await _readRemoteBadges();

    if (!remote) {
      _writeLocalBadges(local);
      return local;
    }

    const localHas = _hasAnyBadge(local.map);
    const remoteHas = _hasAnyBadge(remote.map);

    if ((!localHas && remoteHas) || remote.ts >= local.ts) {
      _writeLocalBadges(remote);
      _emitBadges({ source: "remote", mode: "replace" });
      return remote;
    }

    if (localHas && local.ts > 0) {
      const pushed = await _writeRemoteBadges(local);
      if (pushed) {
        _writeLocalBadges(pushed);
        _emitBadges({ source: "local", mode: "push" });
        return pushed;
      }
    }

    _writeLocalBadges(local);
    return local;
  }

  async function _refreshBadges() {
    const local = _readLocalBadges();
    const remote = await _readRemoteBadges();

    if (!remote) return local;

    const localHas = _hasAnyBadge(local.map);
    const remoteHas = _hasAnyBadge(remote.map);

    if ((!localHas && remoteHas) || remote.ts >= local.ts) {
      _writeLocalBadges(remote);
      _emitBadges({ source: "remote", mode: "replace" });
      return remote;
    }

    return local;
  }

  function _getAllBadges() {
    return _readLocalBadges();
  }

  async function _syncBadges() {
    const local = _readLocalBadges();
    const pushed = await _writeRemoteBadges(local);

    if (pushed) {
      _writeLocalBadges(pushed);
      _emitBadges({ source: "local", mode: "push" });
      return pushed;
    }

    return local;
  }

  async function _setBadge(universeId, badgeKey, unlocked) {
    const uid = _norm(universeId);
    const key = _norm(badgeKey);

    if (!uid) return false;
    if (!["bronze", "silver", "gold"].includes(key)) return false;

    const local = _readLocalBadges();
    const map = _normalizeBadgeMap(local.map || {});

    if (!map[uid]) {
      map[uid] = { bronze: false, silver: false, gold: false };
    }

    map[uid][key] = !!unlocked;

    const next = {
      ts: _now(),
      map
    };

    _writeLocalBadges(next);
    _emitBadges({ universe_id: uid, badge: key, unlocked: !!unlocked, source: "local" });

    const pushed = await _writeRemoteBadges(next);
    if (pushed) {
      _writeLocalBadges(pushed);
      _emitBadges({ universe_id: uid, badge: key, unlocked: !!unlocked, source: "remote" });
    }

    return true;
  }

  async function _setUniverse(universeId, state) {
    const uid = _norm(universeId);
    if (!uid) return false;

    const local = _readLocalBadges();
    const map = _normalizeBadgeMap(local.map || {});

    map[uid] = {
      bronze: !!state?.bronze,
      silver: !!state?.silver,
      gold: !!state?.gold
    };

    const next = {
      ts: _now(),
      map
    };

    _writeLocalBadges(next);
    _emitBadges({ universe_id: uid, source: "local" });

    const pushed = await _writeRemoteBadges(next);
    if (pushed) {
      _writeLocalBadges(pushed);
      _emitBadges({ universe_id: uid, source: "remote" });
    }

    return true;
  }

  async function _replaceAllBadges(fullMap) {
    const next = {
      ts: _now(),
      map: _normalizeBadgeMap(fullMap || {})
    };

    _writeLocalBadges(next);
    _emitBadges({ source: "local", mode: "replace_all" });

    const pushed = await _writeRemoteBadges(next);
    if (pushed) {
      _writeLocalBadges(pushed);
      _emitBadges({ source: "remote", mode: "replace_all" });
    }

    return true;
  }

  async function _clearUniverseBadges(universeId) {
    const uid = _norm(universeId);
    if (!uid) return false;

    const local = _readLocalBadges();
    const map = _normalizeBadgeMap(local.map || {});
    delete map[uid];

    const next = {
      ts: _now(),
      map
    };

    _writeLocalBadges(next);
    _emitBadges({ universe_id: uid, source: "local", mode: "clear_universe" });

    const pushed = await _writeRemoteBadges(next);
    if (pushed) {
      _writeLocalBadges(pushed);
      _emitBadges({ universe_id: uid, source: "remote", mode: "clear_universe" });
    }

    return true;
  }

  function badgeIconPaths() {
    return {
      bronze: {
        empty: "assets/img/ui/badge_empty.webp",
        full: "assets/img/ui/badge_bronze_full.webp"
      },
      silver: {
        empty: "assets/img/ui/badge_empty.webp",
        full: "assets/img/ui/badge_silver_full.webp"
      },
      gold: {
        empty: "assets/img/ui/badge_empty.webp",
        full: "assets/img/ui/badge_gold_full.webp"
      }
    };
  }

  function clearMsg() {
    const el = $("pf_msg");
    if (!el) return;
    el.textContent = "";
    el.style.display = "none";
    el.classList.remove("ok", "err");
  }

  function setMsg(type, key, vars) {
    const el = $("pf_msg");
    if (!el) return;

    const txt = window.VRI18n?.t?.(key, "", vars) || "";
    el.classList.remove("ok", "err");

    if (!txt) {
      el.textContent = "";
      el.style.display = "none";
      return;
    }

    el.classList.add(type === "ok" ? "ok" : "err");
    el.textContent = txt;
    el.style.display = "block";
  }

  function isValidUsername(v) {
    const s = String(v || "").trim();
    if (s.length < 3 || s.length > 20) return false;
    return /^[a-zA-Z0-9_-]+$/.test(s);
  }

  function openEdit(open) {
    const wrap = $("pf_edit_wrap");
    if (!wrap) return;
    if (open) wrap.classList.add("is-open");
    else wrap.classList.remove("is-open");
  }

  function _t(key, fallback) {
    try {
      const out = window.VRI18n?.t?.(key);
      if (typeof out === "string" && out.trim()) return out;
    } catch (_) {}
    return String(fallback || "");
  }

  function getKnownUniverses() {
    const baseOrder = FALLBACK_UNIVERSES.slice();

    try {
      const list = window.VUserData?.getAllKnownUniverses?.();
      if (!Array.isArray(list) || !list.length) return baseOrder;

      const set = new Set(list.map(_norm).filter(Boolean));
      const ordered = baseOrder.filter((id) => set.has(id));
      const extras = Array.from(set).filter((id) => !ordered.includes(id));
      return ordered.concat(extras);
    } catch (_) {
      return baseOrder;
    }
  }

  function getBadgeMap() {
    try {
      const all = _getAllBadges();
      return (all && all.map && typeof all.map === "object") ? all.map : {};
    } catch (_) {
      return {};
    }
  }

  function getUniverseBadgeState(universeId, map) {
    const uid = _norm(universeId);
    const row = (map && map[uid] && typeof map[uid] === "object") ? map[uid] : {};

    return {
      bronze: !!row.bronze,
      silver: !!row.silver,
      gold: !!row.gold
    };
  }

  async function syncProfileWalletFromRemote() {
    try {
      const me = await window.VRRemoteStore?.getMe?.();
      if (!me || typeof me !== "object") return false;

      const cur = window.VUserData?.load?.() || {};

      window.VUserData?.save?.({
        ...cur,
        vcoins: Number(me.vcoins ?? cur.vcoins ?? 0) || 0,
        jetons: Number(me.jetons ?? cur.jetons ?? 0) || 0
      });

      return true;
    } catch (_) {
      return false;
    }
  }

  function renderProfileFromState() {
    const state = window.VUserData?.load?.() || {};

    const elV = $("pf_vcoins");
    const elJ = $("pf_jetons");
    const elU = $("pf_username_text");

    if (elV) elV.textContent = String(Number(state.vcoins ?? 0));
    if (elJ) elJ.textContent = String(Number(state.jetons ?? 0));
    if (elU) elU.textContent = String(state.username || "").trim() || "—";
  }

  function renderUniverses() {
    const host = $("pf_universes");
    if (!host) return;

    host.innerHTML = "";

    const icons = badgeIconPaths();
    const ids = getKnownUniverses();
    const badgeMap = getBadgeMap();

    for (const rawId of ids) {
      const uid = _norm(rawId);
      if (!uid) continue;

      const st = getUniverseBadgeState(uid, badgeMap);

      const unlocked = !!(window.VUserData?.isUniverseUnlocked?.(uid) || uid === "hell_king" || uid === "vampire_lord");

      const card = document.createElement("div");
      card.className = "vr-universe-card" + (unlocked ? "" : " is-locked");

      const inner = document.createElement("div");
      inner.className = "vr-universe-inner";

      const name = document.createElement("h3");
      name.className = "vr-universe-name";

      const titleKey = `universe.${uid}.title`;
      name.setAttribute("data-i18n", titleKey);
      name.textContent = _t(titleKey, uid);

      inner.appendChild(name);

      const badges = document.createElement("div");
      badges.className = "vr-universe-badges";

      for (const key of ["bronze", "silver", "gold"]) {
        const unlocked2 = !!st[key];

        const box = document.createElement("button");
        box.type = "button";
        box.className = "vr-badge" + (unlocked2 ? " unlocked" : "");
        box.setAttribute("data-universe", uid);
        box.setAttribute("data-badge", key);
        box.setAttribute("aria-label", _t(`profile.badge_${key}_aria`, `badge ${key}`));

        const imgEmpty = document.createElement("img");
        imgEmpty.className = "empty";
        imgEmpty.alt = "";
        imgEmpty.src = icons[key].empty;

        const imgFull = document.createElement("img");
        imgFull.className = "full";
        imgFull.alt = "";
        imgFull.src = icons[key].full;

        box.appendChild(imgEmpty);
        box.appendChild(imgFull);
        badges.appendChild(box);
      }

      inner.appendChild(badges);
      card.appendChild(inner);
      host.appendChild(card);
    }

    try { window.VRI18n?.initI18n?.(); } catch (_) {}
  }

  function openModalWithBadge(meta) {
    const modal = $("badgeModal");
    const img = $("badgeModalImg");
    const title = $("badgeModalTitle");
    const desc = $("badgeModalDesc");

    if (!modal || !img || !meta || !meta.src) return;

    img.src = meta.src;
    img.alt = String(meta.title || "");

    if (title) title.textContent = String(meta.title || "");
    if (desc) desc.textContent = String(meta.desc || "");

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");

    try { document.documentElement.style.overflow = "hidden"; } catch (_) {}
    try { document.body.style.overflow = "hidden"; } catch (_) {}
  }

  function closeModal() {
    const modal = $("badgeModal");
    const img = $("badgeModalImg");
    const title = $("badgeModalTitle");
    const desc = $("badgeModalDesc");

    if (!modal || !img) return;

    img.removeAttribute("src");
    img.setAttribute("alt", "");

    if (title) title.textContent = "";
    if (desc) desc.textContent = "";

    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");

    try { document.documentElement.style.overflow = ""; } catch (_) {}
    try { document.body.style.overflow = ""; } catch (_) {}
  }

  function getBadgePreviewMeta(badgeEl) {
    if (!badgeEl) return null;

    const key = _norm(badgeEl.getAttribute("data-badge"));
    if (!["bronze", "silver", "gold"].includes(key)) return null;

    const icons = badgeIconPaths();
    const src =
      badgeEl.querySelector("img.full")?.getAttribute("src") ||
      icons[key]?.full ||
      null;

    if (!src) return null;

    const titleMap = {
      bronze: _t("profile.badgeBronze", "Badge bronze"),
      silver: _t("profile.badgeSilver", "Badge argent"),
      gold: _t("profile.badgeGold", "Badge or")
    };

    const descMap = {
      bronze: _t("profile.badgeUnlockBronze", "Débloqué à partir de 40 choix dans une partie."),
      silver: _t("profile.badgeUnlockSilver", "Débloqué à partir de 60 choix dans une partie."),
      gold: _t("profile.badgeUnlockGold", "Débloqué à partir de 100 choix dans une partie.")
    };

    return {
      src,
      title: titleMap[key],
      desc: descMap[key]
    };
  }

  async function handleSaveUsername() {
    const input = $("pf_username_input");
    if (!input) return;

    const next = String(input.value || "").trim();

    if (_secretNorm(next) === SECRET_USERNAME_CODE) {
      const saveBtnSecret = $("pf_save");
      if (saveBtnSecret) saveBtnSecret.disabled = true;

      try {
        const ok = await runProfileSecretFlow();
        if (ok) {
          const state = window.VUserData?.load?.() || {};
          input.value = String(state.username || "").trim();
          openEdit(false);
          clearMsg();
        }
      } finally {
        if (saveBtnSecret) saveBtnSecret.disabled = false;
      }
      return;
    }

    if (!isValidUsername(next)) {
      if (next.length < 3 || next.length > 20) {
        setMsg("err", "auth.username.errors.length");
      } else {
        setMsg("err", "auth.username.errors.chars");
      }
      return;
    }

    const curState = window.VUserData?.load?.() || {};
    const cur = String(curState.username || "").trim();
    const uid = String(curState.user_id || "").trim();

    if (!uid) {
      setMsg("err", "auth.username.errors.generic");
      return;
    }

    if (cur === next) {
      openEdit(false);
      setMsg("ok", "profile.usernameOkNochange");
      return;
    }

    const saveBtn = $("pf_save");
    if (saveBtn) saveBtn.disabled = true;

    try {
      const res = await window.VUserData?.setUsername?.(next);

      if (!res || !res.ok) {
        const reason = res?.reason || "generic";

        if (reason === "taken") setMsg("err", "auth.username.errors.taken");
        else if (reason === "length") setMsg("err", "auth.username.errors.length");
        else if (reason === "invalid") setMsg("err", "auth.username.errors.chars");
        else setMsg("err", "auth.username.errors.generic");

        return;
      }

      try { await window.VUserData?.refresh?.(); } catch (_) {}
      try { await syncProfileWalletFromRemote(); } catch (_) {}

      renderProfileFromState();
      openEdit(false);
      setMsg("ok", "profile.usernameOkSaved");
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  function bindUsernameUi() {
    const editBtn = $("pf_edit_toggle");
    const cancelBtn = $("pf_cancel");
    const saveBtn = $("pf_save");

    if (editBtn) {
      editBtn.addEventListener("click", () => {
        const wrap = $("pf_edit_wrap");
        const shouldOpen = !(wrap && wrap.classList.contains("is-open"));
        openEdit(shouldOpen);

        const state = window.VUserData?.load?.() || {};
        const input = $("pf_username_input");
        if (shouldOpen && input) {
          input.value = String(state.username || "").trim();
          input.focus();
        }

        if (!shouldOpen) clearMsg();
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        openEdit(false);
        clearMsg();
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", handleSaveUsername);
    }
  }

  function bindBadgeModal() {
    const grid = $("pf_universes");
    const backdrop = $("badgeModalBackdrop");
    const closeBtn = $("badgeModalClose");

    if (grid) {
      grid.addEventListener("click", (e) => {
        const badgeEl = e.target?.closest?.(".vr-badge");
        if (!badgeEl) return;

        const meta = getBadgePreviewMeta(badgeEl);
        if (!meta) return;

        e.preventDefault();
        e.stopPropagation();
        openModalWithBadge(meta);
      }, true);
    }

    if (backdrop) {
      backdrop.addEventListener("click", (e) => {
        e.preventDefault();
        closeModal();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        closeModal();
      });
    }

    window.addEventListener("keydown", (e) => {
      const modal = $("badgeModal");
      if (!modal || !modal.classList.contains("is-open")) return;

      if (e.key === "Escape" || e.key === "Esc") {
        e.preventDefault();
        closeModal();
      }
    });
  }

  async function refreshEverything() {
    try { await window.VUserData?.refresh?.(); } catch (_) {}
    try { await _refreshBadges(); } catch (_) {}

    renderProfileFromState();
    renderUniverses();
  }

  async function boot() {
    try {
      await window.VRI18n?.initI18n?.();
    } catch (_) {}

    try { await window.bootstrapAuthAndProfile?.(); } catch (_) {}
    try { await window.VUserData?.init?.(); } catch (_) {}
    try { await _initBadges(); } catch (_) {}

    renderProfileFromState();
    renderUniverses();

    bindUsernameUi();
    bindBadgeModal();

    window.addEventListener("vr:profile", () => {
      renderProfileFromState();
    });

    window.addEventListener("vr:reign_badge_updated", () => {
      renderUniverses();
    });

    window.addEventListener("pageshow", () => {
      refreshEverything();
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        refreshEverything();
      }
    });

    try { window.VRI18n?.initI18n?.(); } catch (_) {}
  }

  document.addEventListener("DOMContentLoaded", boot);

  window.VUProfileBadges = {
    async setBadge(universeId, badgeKey, unlocked) {
      return await _setBadge(universeId, badgeKey, unlocked);
    },

    async setUniverse(universeId, state) {
      return await _setUniverse(universeId, state);
    },

    async replaceAll(map) {
      return await _replaceAllBadges(map);
    },

    async clearUniverse(universeId) {
      return await _clearUniverseBadges(universeId);
    },

    getAll() {
      return _getAllBadges();
    },

    async refresh() {
      return await _refreshBadges();
    },

    async sync() {
      return await _syncBadges();
    }
  };
})();
