(function () {
  "use strict";

  const ENDINGS_CACHE_KEY = "vchoice_endings_cache_v1";

  const SCENARIO_IDS = [
    "bunker_reserve",
    "chateau_absents",
    "dossier14_appartement",
    "foret_relais",
    "hopital_ferme",
    "metro_station_zero",
    "styx_gare",
    "temple_mictlan"
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function safeParse(raw) {
    try { return JSON.parse(raw); }
    catch (_) { return null; }
  }

  function now() {
    return Date.now();
  }

  function norm(x) {
    return String(x || "").trim().toLowerCase();
  }

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

    const title = t("ui.profile_title");
    if (title) document.title = title;
  }

  function readEndingsCache() {
    const raw = localStorage.getItem(ENDINGS_CACHE_KEY);
    const obj = safeParse(raw);

    if (!obj || typeof obj !== "object") return null;
    if (!obj.user_id) return null;
    if (!obj.map || typeof obj.map !== "object") return null;

    return obj;
  }

  function writeEndingsCache(userId, map) {
    try {
      localStorage.setItem(ENDINGS_CACHE_KEY, JSON.stringify({
        user_id: String(userId || ""),
        ts: now(),
        map: map || {}
      }));
    } catch (_) {}
  }

  function endingsJsonToMap(endings) {
    const map = {};
    if (!endings || typeof endings !== "object") return map;

    for (const key of Object.keys(endings)) {
      const sid = norm(key);
      if (!sid) continue;

      const value = endings[key] || {};
      map[sid] = {
        good: !!value.good,
        bad: !!value.bad,
        secret: !!value.secret
      };
    }

    return map;
  }

  async function fetchEndingsFromProfiles() {
    const st0 = window.VUserData?.load?.() || {};
    const uid0 = String(st0.user_id || "");
    const map0 = endingsJsonToMap(st0.endings);

    if (uid0 && Object.keys(map0).length > 0) {
      return { uid: uid0, map: map0 };
    }

    if (uid0 && window.VUserData?.refresh) {
      try { await window.VUserData.refresh(); } catch (_) {}
      const st1 = window.VUserData?.load?.() || {};
      const uid1 = String(st1.user_id || uid0);
      const map1 = endingsJsonToMap(st1.endings);
      return { uid: uid1, map: map1 };
    }

    return { uid: uid0, map: map0 };
  }

  function endingIconPaths() {
    return {
      good: {
        empty: "assets/img/ui/ending_good_empty.webp",
        full: "assets/img/ui/ending_good_full.webp"
      },
      bad: {
        empty: "assets/img/ui/ending_bad_empty.webp",
        full: "assets/img/ui/ending_bad_full.webp"
      },
      secret: {
        empty: "assets/img/ui/ending_secret_empty.webp",
        full: "assets/img/ui/ending_secret_full.webp"
      }
    };
  }

  function renderScenarios(ids, unlockedList, endingsMap) {
    const host = $("pf_scenarios");
    if (!host) return;

    host.innerHTML = "";

    const unlocked = new Set((unlockedList || []).map(norm).filter(Boolean));
    const icons = endingIconPaths();

    for (const rawId of ids || []) {
      const id = String(rawId || "").trim();
      if (!id) continue;

      const sid = norm(id);
      const isUnlocked = unlocked.has(sid);
      const endings = endingsMap?.[sid] || { good: false, bad: false, secret: false };

      const card = document.createElement("div");
      card.className = "vcp-scen-card" + (isUnlocked ? "" : " is-locked");

      const inner = document.createElement("div");
      inner.className = "vcp-scen-inner";

      const name = document.createElement("h3");
      name.className = "vcp-scen-name";
      name.setAttribute("data-i18n", `scenarios.${id}.title`);
      inner.appendChild(name);

      const badgeRow = document.createElement("div");
      badgeRow.className = "vcp-scen-ends";

      for (const key of ["good", "bad", "secret"]) {
        const earned = !!endings[key];

        const button = document.createElement("button");
        button.type = "button";
        button.className = "vcp-badge " + (earned ? "is-earned" : "is-locked");
        button.setAttribute("data-type", key);
        button.setAttribute("data-earned", earned ? "1" : "0");
        button.setAttribute("data-src-empty", icons[key].empty);
        button.setAttribute("data-src-full", icons[key].full);

        const imgEmpty = document.createElement("img");
        imgEmpty.className = "empty";
        imgEmpty.alt = "";
        imgEmpty.src = icons[key].empty;
        imgEmpty.draggable = false;

        const imgFull = document.createElement("img");
        imgFull.className = "full";
        imgFull.alt = "";
        imgFull.src = icons[key].full;
        imgFull.draggable = false;

        button.appendChild(imgEmpty);
        button.appendChild(imgFull);
        badgeRow.appendChild(button);
      }

      inner.appendChild(badgeRow);
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
    if (textEl) {
      textEl.textContent = t("ui.profile_username_missing") || "—";
    }

    for (let i = 0; i < 8; i++) {
      const candidate = genRandomUsername();
      const res = await window.VCRemoteStore?.setUsername?.(candidate);

      if (res === undefined) return;

      if (res && res.ok) {
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
      setMsg("err", "ui.profile_username_err_format");
      return;
    }

    const curState = window.VUserData?.load?.() || {};
    const cur = String(curState.username || "").trim();
    const uid = String(curState.user_id || "");

    if (!uid) {
      setMsg("err", "ui.profile_err_not_ready");
      return;
    }

    if (cur === next) {
      setMsg("ok", "ui.profile_username_ok_nochange");
      openEdit(false);
      return;
    }

    const flagKey = `vchoice_username_changed_once_${uid}`;
    const alreadyChanged = localStorage.getItem(flagKey) === "1";
    const needCost = !!alreadyChanged;

    if (needCost) {
      const jet = Number((window.VUserData?.load?.() || {}).jetons ?? 0);
      if (jet < 1) {
        setMsg("err", "ui.profile_username_err_nojeton");
        return;
      }
    }

    const saveBtn = $("pf_save");
    if (saveBtn) saveBtn.disabled = true;

    setMsg("ok", "ui.profile_username_working");

    try {
      const res = await window.VCRemoteStore?.setUsername?.(next);

      if (!res || !res.ok) {
        const reason = res?.reason || "rpc_error";
        if (reason === "taken") setMsg("err", "ui.profile_username_err_taken");
        else setMsg("err", "ui.profile_username_err_generic");
        return;
      }

      if (needCost) {
        const spent = await window.VCRemoteStore?.spendJetons?.(1);
        if (spent === null || spent === false) {
          setMsg("err", "ui.profile_username_err_cost_failed");
        }
      } else {
        try { localStorage.setItem(flagKey, "1"); } catch (_) {}
      }

      try { await window.VUserData?.refresh?.(); } catch (_) {}

      setMsg("ok", "ui.profile_username_ok_saved");
      openEdit(false);
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  function renderProfileFromState() {
    const st = window.VUserData?.load?.() || {};
    const jet = Number(st.jetons ?? 0);
    const vc = Number(st.vcoins ?? 0);
    const username = String(st.username || "").trim();

    const jetEl = $("pf_jetons");
    const vcEl = $("pf_vcoins");
    const userEl = $("pf_username_text");

    if (jetEl) jetEl.textContent = String(jet);
    if (vcEl) vcEl.textContent = String(vc);
    if (userEl) userEl.textContent = username || (t("ui.profile_username_missing") || "—");
  }

  function bindBadgeModal() {
    const grid = $("pf_scenarios");
    const modal = $("badgeModal");
    const modalImg = $("badgeModalImg");
    const btnClose = $("badgeModalClose");
    const backdrop = $("badgeModalBackdrop");

    if (!grid || !modal || !modalImg || !btnClose || !backdrop) return;

    let lastFocus = null;

    function openModal(src) {
      if (!src) return;

      lastFocus = document.activeElement || null;
      modalImg.src = src;
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");

      try { btnClose.focus({ preventScroll: true }); } catch (_) {}
      try { document.documentElement.style.overflow = "hidden"; } catch (_) {}
      try { document.body.style.overflow = "hidden"; } catch (_) {}
    }

    function closeModal() {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      modalImg.removeAttribute("src");

      try { document.documentElement.style.overflow = ""; } catch (_) {}
      try { document.body.style.overflow = ""; } catch (_) {}

      if (lastFocus && typeof lastFocus.focus === "function") {
        try { lastFocus.focus({ preventScroll: true }); } catch (_) {}
      }
      lastFocus = null;
    }

    grid.addEventListener("click", function (e) {
      const badge = e.target?.closest?.(".vcp-badge");
      if (!badge) return;

      const earned = badge.getAttribute("data-earned") === "1";
      const full = badge.getAttribute("data-src-full") || "";
      const empty = badge.getAttribute("data-src-empty") || "";
      const src = earned ? (full || empty) : (empty || full);

      if (!src) return;

      e.preventDefault();
      e.stopPropagation();
      openModal(src);
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

  async function refreshEndingsOnce() {
    const st = window.VUserData?.load?.() || {};
    const uid = String(st.user_id || "");
    const unlocked = window.VUserData?.getUnlockedScenarios?.() || [];
    const ids = SCENARIO_IDS.slice();

    const cache = readEndingsCache();
    const cacheOk = !!(cache && cache.user_id === uid && cache.map);

    if (cacheOk) {
      renderScenarios(ids, unlocked, cache.map || {});
      return;
    }

    if (!uid) {
      if (cache?.map) {
        renderScenarios(ids, unlocked, cache.map || {});
        return;
      }

      renderScenarios(ids, unlocked, {});
      return;
    }

    try {
      const res = await fetchEndingsFromProfiles();
      const endingsMap = res?.map || {};
      writeEndingsCache(uid, endingsMap);
      renderScenarios(ids, unlocked, endingsMap);
    } catch (e) {
      console.error("[fetchEndingsFromProfiles]", e);
      renderScenarios(ids, unlocked, {});
    }
  }

  let refreshEndingsRunning = false;

  async function refreshEndingsSafe() {
    if (refreshEndingsRunning) return;
    refreshEndingsRunning = true;

    try {
      await refreshEndingsOnce();
    } finally {
      refreshEndingsRunning = false;
    }
  }

  async function boot() {
    try {
      const langEarly = window.VRI18n?.getLang?.() || "fr";
      await window.VRI18n?.initI18n?.(langEarly);
    } catch (e) {
      console.error("[i18n]", e);
    }

    try {
      await window.bootstrapAuthAndProfile?.();
    } catch (e) {
      console.error("[bootstrapAuthAndProfile]", e);
    }

    try {
      const initPromise = window.VUserData?.init?.();
      if (initPromise && typeof initPromise.then === "function") {
        await initPromise;
      }
    } catch (e) {
      console.error("[VUserData.init]", e);
    }

    applyI18n(document);
    renderProfileFromState();

    try {
      await ensureDefaultUsernameIfMissing();
    } catch (e) {
      console.error("[ensureDefaultUsernameIfMissing]", e);
    }

    applyI18n(document);
    renderProfileFromState();

    const toggle = $("pf_edit_toggle");
    const cancel = $("pf_cancel");
    const save = $("pf_save");

    if (toggle) {
      toggle.addEventListener("click", function () {
        const wrap = $("pf_edit_wrap");
        const willOpen = !(wrap && wrap.classList.contains("is-open"));
        openEdit(willOpen);

        const st = window.VUserData?.load?.() || {};
        const cur = String(st.username || "").trim();
        const inp = $("pf_username_input");

        if (willOpen && inp) {
          inp.value = cur || "";
          try { inp.focus(); } catch (_) {}
        }
      });
    }

    if (cancel) {
      cancel.addEventListener("click", function () {
        setMsg("ok", "");
        openEdit(false);
      });
    }

    if (save) {
      save.addEventListener("click", handleSaveUsername);
    }

    bindBadgeModal();

    window.addEventListener("vc:profile", function () {
      applyI18n(document);
      renderProfileFromState();
      refreshEndingsSafe();
    });

    window.addEventListener("vc:endings_updated", function () {
      refreshEndingsSafe();
    });

    window.addEventListener("pageshow", function () {
      applyI18n(document);
      renderProfileFromState();
      refreshEndingsSafe();
    });

    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") {
        applyI18n(document);
        renderProfileFromState();
        refreshEndingsSafe();
      }
    });

    await refreshEndingsSafe();
  }

  boot();
})();