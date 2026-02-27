// Vuniverse - js/profile.js
// Profil calqué sur la logique de la version de référence
// - Même structure de rendu
// - Même logique pseudo editable
// - Même logique badges empty/full
// - Même logique modal agrandie
// - Adapté à Vuniverse + VUserData + events vr:*
//
// Badges:
// localStorage key = "vuniverse_reigns_cache_v1"
// format:
// {
//   "ts": 123456,
//   "map": {
//     "hell_king": { "bronze": true, "silver": false, "gold": false }
//   }
// }

(function () {
  "use strict";

  const REIGNS_CACHE_KEY = "vuniverse_reigns_cache_v1";

  const UNIVERSE_IDS = [
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

  function _now() {
    return Date.now();
  }

  function _norm(x) {
    return String(x || "").trim().toLowerCase();
  }

  function readReignsCache() {
    const raw = localStorage.getItem(REIGNS_CACHE_KEY);
    const o = _safeParse(raw);
    if (!o || typeof o !== "object") return null;
    if (!o.map || typeof o.map !== "object") return null;
    return o;
  }

  function writeReignsCache(map) {
    try {
      localStorage.setItem(REIGNS_CACHE_KEY, JSON.stringify({
        ts: _now(),
        map: map || {}
      }));
    } catch (_) {}
  }

  function getUniverseBadgeState(universeId, reignsMap) {
    const id = _norm(universeId);
    const st = (reignsMap && reignsMap[id] && typeof reignsMap[id] === "object")
      ? reignsMap[id]
      : {};

    return {
      bronze: !!st.bronze,
      silver: !!st.silver,
      gold: !!st.gold
    };
  }

  function badgeIconPaths() {
    return {
      bronze: {
        empty: "assets/img/ui/badge_bronze_empty.webp",
        full: "assets/img/ui/badge_bronze_full.webp"
      },
      silver: {
        empty: "assets/img/ui/badge_silver_empty.webp",
        full: "assets/img/ui/badge_silver_full.webp"
      },
      gold: {
        empty: "assets/img/ui/badge_gold_empty.webp",
        full: "assets/img/ui/badge_gold_full.webp"
      }
    };
  }

  function setMsg(type, key, vars) {
    const el = $("pf_msg");
    if (!el) return;
    el.classList.remove("ok", "err");
    el.classList.add(type === "ok" ? "ok" : "err");
    const txt = window.VRI18n?.t?.(key, "", vars) || "";
    el.textContent = txt;
    el.style.display = txt ? "block" : "none";
  }

  function isValidUsername(u) {
    const s = String(u || "").trim();
    if (s.length < 3 || s.length > 20) return false;
    return /^[a-zA-Z0-9_-]+$/.test(s);
  }

  function openEdit(open) {
    const wrap = $("pf_edit_wrap");
    if (!wrap) return;
    if (open) wrap.classList.add("is-open");
    else wrap.classList.remove("is-open");
  }

  function getKnownUniverses() {
    try {
      const list = window.VUserData?.getAllKnownUniverses?.();
      if (Array.isArray(list) && list.length) {
        return list.map(_norm).filter(Boolean);
      }
    } catch (_) {}
    return UNIVERSE_IDS.slice();
  }

  function getUnlockedUniverses() {
    try {
      const list = window.VUserData?.getUnlockedUniverses?.();
      if (Array.isArray(list)) {
        return list.map(_norm).filter(Boolean);
      }
    } catch (_) {}

    try {
      const st = window.VUserData?.load?.() || {};
      if (Array.isArray(st.unlocked_universes)) {
        return st.unlocked_universes.map(_norm).filter(Boolean);
      }
    } catch (_) {}

    return [];
  }

  function renderProfileFromState() {
    const st = window.VUserData?.load?.() || {};
    const jet = Number(st.jetons ?? 0);
    const vc = Number(st.vcoins ?? 0);
    const un = String(st.username || "").trim();

    const jetEl = $("pf_jetons");
    const vcEl = $("pf_vcoins");
    const textEl = $("pf_username_text");

    if (jetEl) jetEl.textContent = String(jet);
    if (vcEl) vcEl.textContent = String(vc);
    if (textEl) textEl.textContent = un || "—";
  }

  function renderUniverses() {
    const host = $("pf_universes");
    if (!host) return;

    host.innerHTML = "";

    const icons = badgeIconPaths();
    const ids = getKnownUniverses();
    const unlocked = new Set(getUnlockedUniverses());
    const cache = readReignsCache();
    const reignsMap = cache?.map || {};

    for (const rawId of ids) {
      const id = String(rawId || "").trim();
      const uid = _norm(id);
      if (!uid) continue;

      const isUnlocked = unlocked.has(uid);
      const st = getUniverseBadgeState(uid, reignsMap);

      const card = document.createElement("div");
      card.className = "vr-universe-card" + (isUnlocked ? "" : " is-locked");

      const inner = document.createElement("div");
      inner.className = "vr-universe-inner";

      const name = document.createElement("h3");
      name.className = "vr-universe-name";
      name.setAttribute("data-i18n", `universe.${uid}.title`);
      inner.appendChild(name);

      const badges = document.createElement("div");
      badges.className = "vr-universe-badges";

      for (const key of ["bronze", "silver", "gold"]) {
        const box = document.createElement("div");
        const done = !!st[key];
        box.className = "vr-badge" + (done ? " unlocked" : "");
        box.setAttribute("data-badge", key);
        box.setAttribute("data-universe", uid);

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

    try { window.VRI18n?.applyI18n?.(host); } catch (_) {}
  }

  async function handleSaveUsername() {
    const inp = $("pf_username_input");
    if (!inp) return;

    const next = String(inp.value || "").trim();

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
    const uid = String(curState.user_id || "");

    if (!uid) {
      setMsg("err", "auth.username.errors.generic");
      return;
    }

    if (cur === next) {
      openEdit(false);
      setMsg("ok", "profile.username_ok_nochange");
      return;
    }

    const saveBtn = $("pf_save");
    if (saveBtn) saveBtn.disabled = true;

    try {
      const r = await window.VUserData?.setUsername?.(next);

      if (!r || !r.ok) {
        const reason = r?.reason || "generic";
        if (reason === "taken") setMsg("err", "auth.username.errors.taken");
        else if (reason === "length") setMsg("err", "auth.username.errors.length");
        else if (reason === "invalid") setMsg("err", "auth.username.errors.chars");
        else setMsg("err", "auth.username.errors.generic");
        return;
      }

      try { await window.VUserData?.refresh?.(); } catch (_) {}

      renderProfileFromState();
      openEdit(false);
      setMsg("ok", "profile.username_ok_saved");
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  function openModalWithSrc(src) {
    const modal = $("badgeModal");
    const modalImg = $("badgeModalImg");
    if (!modal || !modalImg || !src) return;

    modalImg.src = src;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");

    try { document.documentElement.style.overflow = "hidden"; } catch (_) {}
    try { document.body.style.overflow = "hidden"; } catch (_) {}
  }

  function closeModal() {
    const modal = $("badgeModal");
    const modalImg = $("badgeModalImg");
    if (!modal || !modalImg) return;

    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    modalImg.removeAttribute("src");

    try { document.documentElement.style.overflow = ""; } catch (_) {}
    try { document.body.style.overflow = ""; } catch (_) {}
  }

  function pickBadgeSrc(badgeEl) {
    if (!badgeEl) return null;

    const full = badgeEl.querySelector("img.full");
    const empty = badgeEl.querySelector("img.empty");

    if (badgeEl.classList.contains("unlocked") && full && full.getAttribute("src")) {
      return full.getAttribute("src");
    }

    if (empty && empty.getAttribute("src")) return empty.getAttribute("src");
    if (full && full.getAttribute("src")) return full.getAttribute("src");
    return null;
  }

  function bindBadgeModal() {
    const grid = $("pf_universes");
    const closeBtn = $("badgeModalClose");
    const backdrop = $("badgeModalBackdrop");

    if (grid) {
      grid.addEventListener("click", function (e) {
        const badgeEl = e.target && e.target.closest ? e.target.closest(".vr-badge") : null;
        if (!badgeEl) return;

        const src = pickBadgeSrc(badgeEl);
        if (!src) return;

        e.preventDefault();
        e.stopPropagation();
        openModalWithSrc(src);
      }, true);
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", function (e) {
        e.preventDefault();
        closeModal();
      });
    }

    if (backdrop) {
      backdrop.addEventListener("click", function (e) {
        e.preventDefault();
        closeModal();
      });
    }

    window.addEventListener("keydown", function (e) {
      const modal = $("badgeModal");
      if (!modal || !modal.classList.contains("is-open")) return;
      if (e.key === "Escape" || e.key === "Esc") {
        e.preventDefault();
        closeModal();
      }
    });
  }

  function bindUsernameUi() {
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
          inp.focus();
        }
      });
    }

    if (cancel) {
      cancel.addEventListener("click", () => {
        setMsg("ok", "", null);
        openEdit(false);
      });
    }

    if (save) {
      save.addEventListener("click", handleSaveUsername);
    }
  }

  function bindNavFallback() {
    const btnSettings = $("btn-settings");
    const btnShop = $("btn-shop");

    if (btnSettings) {
      btnSettings.addEventListener("click", function () {
        if (!btnSettings.getAttribute("href")) {
          location.href = "settings.html";
        }
      });
    }

    if (btnShop) {
      btnShop.addEventListener("click", function () {
        if (!btnShop.getAttribute("href")) {
          location.href = "shop.html";
        }
      });
    }
  }

  let _refreshRunning = false;

  async function refreshProfileSafe() {
    if (_refreshRunning) return;
    _refreshRunning = true;
    try {
      renderProfileFromState();
      renderUniverses();
    } finally {
      _refreshRunning = false;
    }
  }

  async function boot() {
    try {
      const langEarly = window.VRI18n?.getLang?.() || "fr";
      await window.VRI18n?.initI18n?.(langEarly);
    } catch (_) {}

    try { await window.bootstrapAuthAndProfile?.(); } catch (_) {}

    try {
      const p = window.VUserData?.init?.();
      if (p && typeof p.then === "function") await p;
    } catch (_) {}

    renderProfileFromState();
    renderUniverses();

    bindUsernameUi();
    bindBadgeModal();
    bindNavFallback();

    window.addEventListener("vr:profile", () => {
      renderProfileFromState();
      renderUniverses();
    });

    window.addEventListener("vr:reign_badge_updated", () => {
      renderUniverses();
    });

    window.addEventListener("pageshow", () => {
      refreshProfileSafe();
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        refreshProfileSafe();
      }
    });

    try { window.VRI18n?.applyI18n?.(document); } catch (_) {}
  }

  document.addEventListener("DOMContentLoaded", boot);

  // API optionnelle pour alimenter les badges depuis le jeu
  window.VUProfileBadges = {
    setBadge(universeId, badgeKey, unlocked) {
      const uid = _norm(universeId);
      const key = _norm(badgeKey);
      if (!uid) return false;
      if (!["bronze", "silver", "gold"].includes(key)) return false;

      const cache = readReignsCache() || { map: {} };
      const map = cache.map || {};

      if (!map[uid] || typeof map[uid] !== "object") {
        map[uid] = { bronze: false, silver: false, gold: false };
      }

      map[uid][key] = !!unlocked;
      writeReignsCache(map);

      try {
        window.dispatchEvent(new CustomEvent("vr:reign_badge_updated", {
          detail: { universe_id: uid, badge: key, unlocked: !!unlocked }
        }));
      } catch (_) {}

      return true;
    },

    setUniverse(universeId, state) {
      const uid = _norm(universeId);
      if (!uid) return false;

      const cache = readReignsCache() || { map: {} };
      const map = cache.map || {};

      map[uid] = {
        bronze: !!state?.bronze,
        silver: !!state?.silver,
        gold: !!state?.gold
      };

      writeReignsCache(map);

      try {
        window.dispatchEvent(new CustomEvent("vr:reign_badge_updated", {
          detail: { universe_id: uid }
        }));
      } catch (_) {}

      return true;
    },

    getAll() {
      return readReignsCache() || { ts: 0, map: {} };
    }
  };
})();