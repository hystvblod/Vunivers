(function () {
  "use strict";

  const BADGES_CACHE_KEY = "vrealms_badges_cache_v1";
  const USERNAME_FLAG_PREFIX = "vrealms_username_changed_once_";

  const UNIVERSE_IDS = [
    "hell_king",
    "heaven_king",
    "western_president",
    "mega_corp_ceo",
    "new_world_explorer",
    "vampire_lord"
  ];

  function $(id) { return document.getElementById(id); }
  function safeParse(raw) { try { return JSON.parse(raw); } catch (_) { return null; } }
  function now() { return Date.now(); }
  function norm(x) { return String(x || "").trim().toLowerCase(); }

  function t(key) {
    try {
      const out = window.VRI18n?.t?.(key);
      if (out && out !== key) return String(out);
    } catch (_) {}
    return "";
  }

  function applyI18n(root) {
    const scope = root || document;

    scope.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const txt = t(key);
      if (txt) el.textContent = txt;
    });

    scope.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      const txt = t(key);
      if (txt) el.setAttribute("placeholder", txt);
    });

    scope.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      const txt = t(key);
      if (txt) el.setAttribute("aria-label", txt);
    });

    document.title = t("profile.title") || document.title || "";
  }

  function readBadgesCache() {
    try {
      const raw = localStorage.getItem(BADGES_CACHE_KEY);
      const o = safeParse(raw);
      if (!o || typeof o !== "object") return null;
      if (!o.user_id) return null;
      if (!o.map || typeof o.map !== "object") return null;
      return o;
    } catch (_) {
      return null;
    }
  }

  function writeBadgesCache(userId, map) {
    try {
      localStorage.setItem(BADGES_CACHE_KEY, JSON.stringify({
        user_id: String(userId || ""),
        ts: now(),
        map: map || {}
      }));
    } catch (_) {}
  }

  function normalizeTierState(value) {
    let bronze = false;
    let silver = false;
    let gold = false;

    if (typeof value === "number" && Number.isFinite(value)) {
      bronze = value >= 1;
      silver = value >= 2;
      gold = value >= 3;
      return { bronze, silver, gold };
    }

    if (Array.isArray(value)) {
      const set = new Set(value.map(norm));
      bronze = set.has("bronze") || set.has("good");
      silver = set.has("silver") || set.has("bad");
      gold = set.has("gold") || set.has("secret");
      return { bronze, silver, gold };
    }

    if (value && typeof value === "object") {
      bronze = !!(value.bronze || value.good || value.tier1);
      silver = !!(value.silver || value.bad || value.tier2);
      gold = !!(value.gold || value.secret || value.tier3);
      return { bronze, silver, gold };
    }

    return { bronze: false, silver: false, gold: false };
  }

  function mapObjectToBadges(obj) {
    const out = {};
    if (!obj || typeof obj !== "object") return out;

    for (const rawKey of Object.keys(obj)) {
      const id = norm(rawKey);
      if (!id) continue;
      out[id] = normalizeTierState(obj[rawKey]);
    }

    return out;
  }

  function mergeBadgeMaps(a, b) {
    const out = {};
    const ids = new Set([
      ...Object.keys(a || {}),
      ...Object.keys(b || {})
    ]);

    ids.forEach((id) => {
      out[id] = {
        bronze: !!(a?.[id]?.bronze || b?.[id]?.bronze),
        silver: !!(a?.[id]?.silver || b?.[id]?.silver),
        gold: !!(a?.[id]?.gold || b?.[id]?.gold)
      };
    });

    return out;
  }

  function extractBadgesFromProfile(profile) {
    if (!profile || typeof profile !== "object") return {};

    let map = {};

    map = mergeBadgeMaps(map, mapObjectToBadges(profile.badges));
    map = mergeBadgeMaps(map, mapObjectToBadges(profile.universe_badges));
    map = mergeBadgeMaps(map, mapObjectToBadges(profile.universes_badges));

    map = mergeBadgeMaps(map, mapObjectToBadges(profile.endings));
    map = mergeBadgeMaps(map, mapObjectToBadges(profile.universe_endings));
    map = mergeBadgeMaps(map, mapObjectToBadges(profile.universes_endings));

    return map;
  }

  function getUnlockedUniverses() {
    try {
      if (window.VUserData?.getUnlockedUniverses) {
        const arr = window.VUserData.getUnlockedUniverses();
        if (Array.isArray(arr)) return arr.map(norm).filter(Boolean);
      }
    } catch (_) {}

    const st = window.VUserData?.load?.() || {};
    if (Array.isArray(st.unlocked_universes)) {
      return st.unlocked_universes.map(norm).filter(Boolean);
    }

    return ["hell_king", "heaven_king"];
  }

  function badgeLabelKey(tier) {
    if (tier === "bronze") return "profile.badgeBronze";
    if (tier === "silver") return "profile.badgeSilver";
    if (tier === "gold") return "profile.badgeGold";
    return "";
  }

  function badgeColors(tier, earned) {
    const locked = {
      ribbon: "#637081",
      body1: "#8c97a3",
      body2: "#6b7480",
      inner: "#aab2bb",
      stroke: "#d8dee4",
      glow: "rgba(255,255,255,.06)"
    };

    const byTier = {
      bronze: {
        ribbon: "#7c4b2f",
        body1: "#d28b52",
        body2: "#9e5c31",
        inner: "#f1c08d",
        stroke: "#ffe0b7",
        glow: "rgba(210,139,82,.32)"
      },
      silver: {
        ribbon: "#586b89",
        body1: "#d8e1ee",
        body2: "#92a2b8",
        inner: "#ffffff",
        stroke: "#eef4ff",
        glow: "rgba(216,225,238,.32)"
      },
      gold: {
        ribbon: "#7f6518",
        body1: "#ffd45a",
        body2: "#c59d1f",
        inner: "#fff1b6",
        stroke: "#fff6d9",
        glow: "rgba(255,212,90,.34)"
      }
    };

    return earned ? byTier[tier] : locked;
  }

  function badgeSvg(tier, earned) {
    const c = badgeColors(tier, earned);
    const glowId = `g_${tier}_${earned ? "1" : "0"}_${Math.random().toString(36).slice(2, 9)}`;

    return `
      <svg class="vrp-badge-svg" viewBox="0 0 128 128" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="${glowId}" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="${c.glow}" />
            <stop offset="100%" stop-color="rgba(255,255,255,0)" />
          </radialGradient>
          <linearGradient id="${glowId}_body" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${c.body1}" />
            <stop offset="100%" stop-color="${c.body2}" />
          </linearGradient>
        </defs>

        <circle cx="64" cy="64" r="54" fill="url(#${glowId})"></circle>

        <path d="M44 14h16l4 26H48z" fill="${c.ribbon}"></path>
        <path d="M68 14h16l-4 26H64z" fill="${c.ribbon}"></path>

        <circle cx="64" cy="70" r="30" fill="url(#${glowId}_body)" stroke="${c.stroke}" stroke-width="4"></circle>
        <circle cx="64" cy="70" r="18" fill="${c.inner}" opacity="${earned ? "1" : ".72"}"></circle>

        <path d="M64 50l5.7 11.6 12.8 1.9-9.2 8.9 2.2 12.6L64 79.3 52.5 85l2.2-12.6-9.2-8.9 12.8-1.9z"
              fill="${earned ? c.body2 : "#7b8590"}"
              opacity="${earned ? "1" : ".8"}"></path>
      </svg>
    `;
  }

  function renderUniverses(ids, unlockedList, badgeMap) {
    const host = $("pf_universes");
    if (!host) return;

    host.innerHTML = "";

    const unlocked = new Set((unlockedList || []).map(norm).filter(Boolean));

    for (const rawId of ids || []) {
      const id = String(rawId || "").trim();
      if (!id) continue;

      const sid = norm(id);
      const isUnlocked = unlocked.has(sid);
      const tiers = badgeMap?.[sid] || { bronze: false, silver: false, gold: false };

      const card = document.createElement("div");
      card.className = "vrp-universe-card" + (isUnlocked ? "" : " is-locked");

      const inner = document.createElement("div");
      inner.className = "vrp-universe-inner";

      const name = document.createElement("h3");
      name.className = "vrp-universe-name";
      name.setAttribute("data-i18n", `universe.${id}.title`);
      inner.appendChild(name);

      const badges = document.createElement("div");
      badges.className = "vrp-universe-badges";

      ["bronze", "silver", "gold"].forEach((tier) => {
        const earned = !!tiers?.[tier];

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "vrp-badge" + (earned ? " is-earned" : " is-locked");
        btn.setAttribute("data-universe", id);
        btn.setAttribute("data-tier", tier);
        btn.setAttribute("data-earned", earned ? "1" : "0");
        btn.setAttribute("data-i18n-aria", badgeLabelKey(tier));
        btn.innerHTML = badgeSvg(tier, earned);

        badges.appendChild(btn);
      });

      inner.appendChild(badges);
      card.appendChild(inner);
      host.appendChild(card);
    }

    applyI18n(host);
  }

  function setMsg(type, key) {
    const el = $("pf_msg");
    if (!el) return;

    el.classList.remove("ok", "err");

    if (!key) {
      el.textContent = "";
      el.style.display = "none";
      return;
    }

    el.classList.add(type === "ok" ? "ok" : "err");
    el.textContent = t(key);
    el.style.display = el.textContent ? "block" : "none";
  }

  function isValidUsername(u) {
    const s = String(u || "").trim();
    if (s.length < 3 || s.length > 20) return false;
    return /^[a-zA-Z0-9_]+$/.test(s);
  }

  function genRandomUsername() {
    const n = Math.floor(1000 + Math.random() * 9000);
    return `User_${n}`;
  }

  async function ensureDefaultUsernameIfMissing() {
    const st = window.VUserData?.load?.() || {};
    const uid = String(st.user_id || "");
    const cur = String(st.username || "").trim();

    if (!uid || cur) return;

    const textEl = $("pf_username_text");
    if (textEl) textEl.textContent = t("profile.usernameMissing");

    for (let i = 0; i < 8; i++) {
      const candidate = genRandomUsername();
      const res = await window.VUserData?.setUsername?.(candidate);
      if (res?.ok) {
        try { await window.VUserData?.refresh?.(); } catch (_) {}
        return;
      }
    }
  }

  function openEdit(open) {
    const wrap = $("pf_edit_wrap");
    if (!wrap) return;
    if (open) wrap.classList.add("is-open");
    else wrap.classList.remove("is-open");
  }

  async function handleSaveUsername() {
    const inp = $("pf_username_input");
    if (!inp) return;

    const next = String(inp.value || "").trim();

    if (!isValidUsername(next)) {
      setMsg("err", "profile.usernameErrFormat");
      return;
    }

    const curState = window.VUserData?.load?.() || {};
    const cur = String(curState.username || "").trim();
    const uid = String(curState.user_id || "");

    if (!uid) {
      setMsg("err", "profile.errNotReady");
      return;
    }

    if (cur === next) {
      setMsg("ok", "profile.usernameOkNochange");
      openEdit(false);
      return;
    }

    const flagKey = `${USERNAME_FLAG_PREFIX}${uid}`;
    const alreadyChanged = localStorage.getItem(flagKey) === "1";
    const needCost = !!alreadyChanged;

    if (needCost) {
      const jet = Number((window.VUserData?.load?.() || {}).jetons ?? 0);
      if (jet < 1) {
        setMsg("err", "profile.usernameErrNojeton");
        return;
      }
    }

    const saveBtn = $("pf_save");
    if (saveBtn) saveBtn.disabled = true;
    setMsg("ok", "profile.usernameWorking");

    try {
      const r = await window.VUserData?.setUsername?.(next);

      if (!r || !r.ok) {
        const reason = r?.reason || "rpc_error";
        if (reason === "taken") setMsg("err", "profile.usernameErrTaken");
        else setMsg("err", "profile.usernameErrGeneric");
        return;
      }

      if (needCost) {
        const spent = await window.VUserData?.spendJetons?.(1);
        if (!spent) {
          setMsg("err", "profile.usernameErrCostFailed");
        }
      } else {
        try { localStorage.setItem(flagKey, "1"); } catch (_) {}
      }

      try { await window.VUserData?.refresh?.(); } catch (_) {}
      setMsg("ok", "profile.usernameOkSaved");
      openEdit(false);
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  function renderProfileFromState() {
    const st = window.VUserData?.load?.() || {};

    const jet = Number(st.jetons ?? 0);
    const vc = Number(st.vcoins ?? 0);
    const un = String(st.username || "").trim();

    const best = (typeof st.best_reign_length !== "undefined")
      ? Number(st.best_reign_length || 0)
      : Number(st.stats?.bestReignLength || 0);

    const runs = (typeof st.total_runs !== "undefined")
      ? Number(st.total_runs || 0)
      : Number(st.stats?.totalRuns || 0);

    const jetEl = $("pf_jetons");
    const vcEl = $("pf_vcoins");
    const bestEl = $("pf_best_reign");
    const runsEl = $("pf_total_runs");
    const textEl = $("pf_username_text");

    if (jetEl) jetEl.textContent = String(jet);
    if (vcEl) vcEl.textContent = String(vc);
    if (bestEl) bestEl.textContent = String(best);
    if (runsEl) runsEl.textContent = String(runs);

    if (textEl) {
      textEl.textContent = un || t("profile.usernameMissing");
    }
  }

  async function fetchBadgesFromProfile() {
    const st0 = window.VUserData?.load?.() || {};
    const uid0 = String(st0.user_id || st0.id || "");
    const localMap = extractBadgesFromProfile(st0);

    if (uid0 && Object.keys(localMap).length > 0) {
      return { uid: uid0, map: localMap };
    }

    try {
      const row = await window.VRRemoteStore?.getMe?.();
      const uid1 = String(row?.user_id || row?.id || uid0 || "");
      const remoteMap = extractBadgesFromProfile(row);

      if (uid1 && Object.keys(remoteMap).length > 0) {
        return { uid: uid1, map: remoteMap };
      }

      return { uid: uid1, map: localMap };
    } catch (_) {
      return { uid: uid0, map: localMap };
    }
  }

  async function refreshBadgesOnce() {
    const st = window.VUserData?.load?.() || {};
    const uid = String(st.user_id || "");
    const unlocked = getUnlockedUniverses();

    const cache = readBadgesCache();
    const cacheOk = !!(cache && cache.user_id === uid && cache.map);

    if (cacheOk) {
      renderUniverses(UNIVERSE_IDS, unlocked, cache.map || {});
      return;
    }

    if (!uid) {
      if (cache?.map) {
        renderUniverses(UNIVERSE_IDS, unlocked, cache.map || {});
        return;
      }
      renderUniverses(UNIVERSE_IDS, unlocked, {});
      return;
    }

    try {
      const r = await fetchBadgesFromProfile();
      const badgeMap = r?.map || {};
      writeBadgesCache(uid, badgeMap);
      renderUniverses(UNIVERSE_IDS, unlocked, badgeMap);
    } catch (_) {
      renderUniverses(UNIVERSE_IDS, unlocked, {});
    }
  }

  let refreshBadgesRunning = false;
  async function refreshBadgesSafe() {
    if (refreshBadgesRunning) return;
    refreshBadgesRunning = true;
    try { await refreshBadgesOnce(); }
    finally { refreshBadgesRunning = false; }
  }

  function bindBadgeModal() {
    const grid = $("pf_universes");
    const modal = $("badgeModal");
    const modalBadge = $("badgeModalBadge");
    const btnClose = $("badgeModalClose");
    const backdrop = $("badgeModalBackdrop");

    if (!grid || !modal || !modalBadge || !btnClose || !backdrop) return;

    let lastFocus = null;

    function openModal(tier, earned) {
      lastFocus = document.activeElement || null;
      modalBadge.innerHTML = badgeSvg(tier, earned);

      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");

      try { btnClose.focus({ preventScroll: true }); } catch (_) {}
      try { document.documentElement.style.overflow = "hidden"; } catch (_) {}
      try { document.body.style.overflow = "hidden"; } catch (_) {}
    }

    function closeModal() {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      modalBadge.innerHTML = "";

      try { document.documentElement.style.overflow = ""; } catch (_) {}
      try { document.body.style.overflow = ""; } catch (_) {}

      if (lastFocus && typeof lastFocus.focus === "function") {
        try { lastFocus.focus({ preventScroll: true }); } catch (_) {}
      }
      lastFocus = null;
    }

    grid.addEventListener("click", function (e) {
      const badge = e.target?.closest?.(".vrp-badge");
      if (!badge) return;

      const tier = String(badge.getAttribute("data-tier") || "");
      const earned = badge.getAttribute("data-earned") === "1";

      e.preventDefault();
      e.stopPropagation();

      openModal(tier, earned);
    }, true);

    btnClose.addEventListener("click", function (e) {
      e.preventDefault();
      closeModal();
    });

    backdrop.addEventListener("click", function (e) {
      e.preventDefault();
      closeModal();
    });

    window.addEventListener("keydown", function (e) {
      if (!modal.classList.contains("is-open")) return;
      if (e.key === "Escape" || e.key === "Esc") {
        e.preventDefault();
        closeModal();
      }
    });
  }

  async function boot() {
    try {
      const langEarly = window.VUserData?.getLang?.() || localStorage.getItem("vrealms_lang") || "fr";
      await window.VRI18n?.initI18n?.(langEarly);
    } catch (_) {}

    try { await window.bootstrapAuthAndProfile?.(); } catch (_) {}

    try {
      const p = window.VUserData?.init?.();
      if (p && typeof p.then === "function") await p;
    } catch (_) {}

    applyI18n(document);
    renderProfileFromState();

    try { await ensureDefaultUsernameIfMissing(); } catch (_) {}
    renderProfileFromState();

    const toggle = $("pf_edit_toggle");
    const cancel = $("pf_cancel");
    const save = $("pf_save");

    if (toggle) {
      toggle.addEventListener("click", () => {
        const wrap = $("pf_edit_wrap");
        const open = !(wrap && wrap.classList.contains("is-open"));
        openEdit(open);

        const st = window.VUserData?.load?.() || {};
        const cur = String(st.username || "").trim();
        const inp = $("pf_username_input");

        if (open && inp) {
          inp.value = cur || "";
          try { inp.focus(); } catch (_) {}
        }
      });
    }

    if (cancel) {
      cancel.addEventListener("click", () => {
        setMsg("ok", "");
        openEdit(false);
      });
    }

    if (save) {
      save.addEventListener("click", handleSaveUsername);
    }

    bindBadgeModal();

    window.addEventListener("vr:profile", () => {
      applyI18n(document);
      renderProfileFromState();
      refreshBadgesSafe();
    });

    window.addEventListener("pageshow", async () => {
      try { await window.VUserData?.refresh?.(); } catch (_) {}
      applyI18n(document);
      renderProfileFromState();
      refreshBadgesSafe();
    });

    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState === "visible") {
        try { await window.VUserData?.refresh?.(); } catch (_) {}
        applyI18n(document);
        renderProfileFromState();
        refreshBadgesSafe();
      }
    });

    await refreshBadgesSafe();
  }

  boot();
})();