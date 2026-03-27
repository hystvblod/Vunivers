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

  const LADYBUG_USERNAME_CODE = "ladybugcometome";
  const LADYBUG_REWARD_VCOINS = 50;
  const LADYBUG_PROFILE_FIELD = "secret_ladybug_claimed";
  const BAUDELAIRE_USERNAME_CODE = "baudelaire";

  function _secretNorm(v) {
    return String(v || "").trim().toLowerCase();
  }

  function ensureLadybugOverlay() {
    if (!document.getElementById("vrLadybugStyle")) {
      const style = document.createElement("style");
      style.id = "vrLadybugStyle";
      style.textContent = `
      #vrLadybugOverlay{
        position:fixed;
        inset:0;
        z-index:100001;
        display:none;
        overflow:hidden;
        background:
          radial-gradient(circle at 20% 18%, rgba(255,255,255,0.05), transparent 20%),
          radial-gradient(circle at 78% 80%, rgba(255,255,255,0.04), transparent 22%),
          linear-gradient(180deg, rgba(145,0,0,0.97), rgba(190,0,0,0.97) 48%, rgba(155,0,0,0.98));
        font-family: Arial, Helvetica, sans-serif;
      }

      #vrLadybugOverlay.is-open{
        display:block;
      }

      #vrLadybugOverlay::after{
        content:"";
        position:absolute;
        inset:0;
        background: radial-gradient(circle at center, transparent 42%, rgba(0,0,0,0.14) 100%);
        pointer-events:none;
      }

      #vrLadybugOverlay .vr-ladybug-topbar{
        position:absolute;
        top:18px;
        left:50%;
        transform:translateX(-50%);
        width:min(390px, calc(100vw - 28px));
        padding:14px 18px;
        border-radius:22px;
        color:#fff;
        text-align:center;
        background:rgba(45,0,0,0.20);
        border:1px solid rgba(255,255,255,0.16);
        box-shadow:
          0 14px 34px rgba(0,0,0,0.24),
          inset 0 1px 0 rgba(255,255,255,0.10);
        backdrop-filter: blur(6px);
        z-index:3;
      }

      #vrLadybugOverlay .vr-ladybug-title{
        margin:0 0 6px;
        font-size:20px;
        font-weight:900;
        line-height:1.1;
      }

      #vrLadybugOverlay .vr-ladybug-sub{
        font-size:13px;
        font-weight:700;
        line-height:1.35;
        opacity:0.96;
      }

      #vrLadybugOverlay .vr-ladybug-counter{
        margin-top:10px;
        font-size:14px;
        font-weight:900;
        color:#ffeaea;
      }

      #vrLadybugOverlay .vr-ladybug-stage{
        position:absolute;
        inset:0;
        overflow:hidden;
        z-index:1;
      }

      #vrLadybugOverlay .vr-ladybug-bubble{
        position:absolute;
        border:none;
        border-radius:999px;
        cursor:pointer;
        user-select:none;
        -webkit-tap-highlight-color:transparent;
        background:
          radial-gradient(circle at 33% 28%, rgba(255,255,255,0.16), transparent 16%),
          radial-gradient(circle at 62% 74%, rgba(255,70,70,0.08), transparent 38%),
          radial-gradient(circle at 50% 50%, rgba(28,28,28,0.99), rgba(0,0,0,1) 78%);
        box-shadow:
          0 12px 28px rgba(0,0,0,0.30),
          inset 0 1px 0 rgba(255,255,255,0.05),
          inset 0 -10px 18px rgba(120,0,0,0.10);
        opacity:0.985;
        transform:translate3d(0,0,0) scale(1);
        transition: transform .12s ease, opacity .18s ease, filter .18s ease;
      }

      #vrLadybugOverlay .vr-ladybug-bubble:hover{
        transform:scale(1.04);
        filter:brightness(1.07);
      }

      #vrLadybugOverlay .vr-ladybug-bubble.is-popping{
        transform:scale(1.16);
        opacity:0;
        filter:blur(1px) brightness(1.12);
      }

      #vrLadybugOverlay .vr-ladybug-plus{
        position:absolute;
        transform:translate(-50%, -50%);
        color:#fff1b5;
        font-size:22px;
        font-weight:900;
        text-shadow:
          0 3px 10px rgba(0,0,0,0.34),
          0 0 18px rgba(255,235,140,0.28);
        pointer-events:none;
        animation: vrLadybugPlusUp .78s ease-out forwards;
        z-index:4;
      }

      #vrLadybugOverlay .vr-ladybug-spark{
        position:absolute;
        width:10px;
        height:10px;
        border-radius:999px;
        pointer-events:none;
        animation: vrLadybugSparkFly .55s ease-out forwards;
        box-shadow:0 0 10px rgba(0,0,0,0.18);
        z-index:4;
      }

      #vrLadybugOverlay .vr-ladybug-finish{
        position:absolute;
        left:50%;
        top:50%;
        transform:translate(-50%, -50%) scale(.96);
        width:min(420px, calc(100vw - 28px));
        padding:22px 18px 18px;
        border-radius:24px;
        text-align:center;
        color:#fff;
        background:rgba(30,0,0,0.36);
        border:1px solid rgba(255,255,255,0.16);
        box-shadow:
          0 18px 48px rgba(0,0,0,0.34),
          inset 0 1px 0 rgba(255,255,255,0.10);
        backdrop-filter: blur(10px);
        opacity:0;
        pointer-events:none;
        transition: opacity .24s ease, transform .24s ease;
        z-index:5;
      }

      #vrLadybugOverlay .vr-ladybug-finish.show{
        opacity:1;
        pointer-events:auto;
        transform:translate(-50%, -50%) scale(1);
      }

      #vrLadybugOverlay .vr-ladybug-finish h2{
        margin:0 0 10px;
        font-size:24px;
        line-height:1.15;
      }

      #vrLadybugOverlay .vr-ladybug-finish p{
        margin:0 0 16px;
        font-size:14px;
        line-height:1.45;
        color:rgba(255,255,255,0.95);
      }

      #vrLadybugOverlay .vr-ladybug-finish button{
        border:none;
        border-radius:999px;
        padding:12px 18px;
        font-size:14px;
        font-weight:900;
        cursor:pointer;
        color:#590000;
        background:linear-gradient(180deg,#fff1f1,#ffd6d6);
        box-shadow:0 10px 24px rgba(0,0,0,0.22);
      }

      @keyframes vrLadybugPlusUp{
        0%   { opacity:0; transform:translate(-50%, -50%) translateY(10px) scale(.82); }
        20%  { opacity:1; }
        100% { opacity:0; transform:translate(-50%, -50%) translateY(-44px) scale(1.06); }
      }

      @keyframes vrLadybugSparkFly{
        0%   { opacity:1; transform:translate(0,0) scale(1); }
        100% { opacity:0; transform:translate(var(--dx), var(--dy)) scale(.45); }
      }
    `;
      document.head.appendChild(style);
    }

    if (!document.getElementById("vrLadybugOverlay")) {
      const overlay = document.createElement("div");
      overlay.id = "vrLadybugOverlay";
      overlay.innerHTML = `
      <div class="vr-ladybug-topbar">
        <div class="vr-ladybug-title" id="vrLadybugTitle"></div>
        <div class="vr-ladybug-sub" id="vrLadybugSub"></div>
        <div class="vr-ladybug-counter" id="vrLadybugCounter">0 / 10 • 0</div>
      </div>

      <div class="vr-ladybug-stage" id="vrLadybugStage"></div>

      <div class="vr-ladybug-finish" id="vrLadybugFinish">
        <h2 id="vrLadybugFinishTitle"></h2>
        <p id="vrLadybugFinishBody"></p>
        <button type="button" id="vrLadybugCloseBtn"></button>
      </div>
    `;
      document.body.appendChild(overlay);

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeLadybugOverlay();
      });

      overlay.querySelector("#vrLadybugCloseBtn")?.addEventListener("click", closeLadybugOverlay);
    }
  }

  function closeLadybugOverlay() {
    const overlay = document.getElementById("vrLadybugOverlay");
    if (!overlay || !overlay.classList.contains("is-open")) return;

    overlay.classList.remove("is-open");

    if (overlay.__rafId) {
      cancelAnimationFrame(overlay.__rafId);
      overlay.__rafId = null;
    }

    const done = overlay.__resolve;
    overlay.__resolve = null;
    if (typeof done === "function") done();
  }

  async function showLadybugOverlay(result) {
    ensureLadybugOverlay();

    const overlay = document.getElementById("vrLadybugOverlay");
    const title = document.getElementById("vrLadybugTitle");
    const sub = document.getElementById("vrLadybugSub");
    const counter = document.getElementById("vrLadybugCounter");
    const stage = document.getElementById("vrLadybugStage");
    const finish = document.getElementById("vrLadybugFinish");
    const finishTitle = document.getElementById("vrLadybugFinishTitle");
    const finishBody = document.getElementById("vrLadybugFinishBody");
    const closeBtn = document.getElementById("vrLadybugCloseBtn");

    if (!overlay || !title || !sub || !counter || !stage || !finish || !finishTitle || !finishBody || !closeBtn) {
      return Promise.resolve();
    }

    stage.innerHTML = "";
    finish.classList.remove("show");

    const total = 10;
    const rewardPerBubble = 5;
    let popped = 0;
    const movers = [];
    let running = true;

    title.textContent = _t("profile.ladybugSecretTitle", "Ladybug secret");
    sub.textContent = _t("profile.ladybugSecretSub", "Pop all 10 bubbles");
    closeBtn.textContent = _t("common.continue", "Continue");

    function rand(min, max) {
      return Math.random() * (max - min) + min;
    }

    function updateCounter() {
      counter.textContent = `${popped} / ${total} • ${popped * rewardPerBubble}`;
    }

    function createPlus(x, y) {
      const el = document.createElement("div");
      el.className = "vr-ladybug-plus";
      el.textContent = "+5";
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      stage.appendChild(el);
      setTimeout(() => el.remove(), 850);
    }

    function createSparks(x, y) {
      for (let i = 0; i < 8; i++) {
        const s = document.createElement("div");
        s.className = "vr-ladybug-spark";
        s.style.left = `${x}px`;
        s.style.top = `${y}px`;
        s.style.background = i % 2 === 0
          ? "radial-gradient(circle, #1b0000, #000000)"
          : "radial-gradient(circle, #ff5252, #7a0000)";
        s.style.setProperty("--dx", `${rand(-34, 34)}px`);
        s.style.setProperty("--dy", `${rand(-34, 34)}px`);
        stage.appendChild(s);
        setTimeout(() => s.remove(), 580);
      }
    }

    function popBubble(el, mover) {
      if (!el || el.dataset.popped === "1") return;
      el.dataset.popped = "1";
      mover.dead = true;

      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      createPlus(x, y);
      createSparks(x, y);

      el.classList.add("is-popping");
      popped += 1;
      updateCounter();

      setTimeout(() => {
        el.remove();

        if (popped >= total) {
          finishTitle.textContent = result?.credited
            ? _t("profile.ladybugSecretFinishTitleClaimed", "Bravo")
            : _t("profile.ladybugSecretFinishTitleSeen", "Already collected");

          finishBody.textContent = result?.credited
            ? _t("profile.ladybugSecretFinishBodyClaimed", "You earned 50 VCoins.")
            : _t("profile.ladybugSecretFinishBodySeen", "You already received the 50 VCoins for this one.");

          finish.classList.add("show");
        }
      }, 220);
    }

    function overlaps(candidate, placed) {
      for (const p of placed) {
        const dx = candidate.x - p.x;
        const dy = candidate.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = (candidate.r + p.r) + rand(40, 90);
        if (dist < minDist) return true;
      }
      return false;
    }

    function placeBubbles() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const topSafe = 120;
      const bottomSafe = 24;
      const sideSafe = 18;
      const placed = [];

      for (let i = 0; i < total; i++) {
        const size = rand(42, 118);
        const r = size / 2;
        let tries = 0;
        let c;

        do {
          c = {
            x: rand(sideSafe + r, vw - sideSafe - r),
            y: rand(topSafe + r, vh - bottomSafe - r),
            r
          };
          tries++;
        } while (overlaps(c, placed) && tries < 500);

        placed.push(c);

        const b = document.createElement("button");
        b.type = "button";
        b.className = "vr-ladybug-bubble";
        b.style.width = `${size}px`;
        b.style.height = `${size}px`;
        stage.appendChild(b);

        const speedBase = rand(0.18, 0.46);
        const angle = rand(0, Math.PI * 2);

        const mover = {
          el: b,
          dead: false,
          r,
          x: c.x,
          y: c.y,
          vx: Math.cos(angle) * speedBase,
          vy: Math.sin(angle) * speedBase,
          pulse: rand(0, Math.PI * 2),
          pulseSpeed: rand(0.008, 0.02),
          pulseAmp: rand(2, 8)
        };

        b.addEventListener("click", () => popBubble(b, mover), { passive: true });
        movers.push(mover);
      }
    }

    function tick() {
      if (!running) return;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const topSafe = 120;
      const bottomSafe = 18;
      const sideSafe = 10;

      for (const m of movers) {
        if (m.dead || !m.el.isConnected) continue;

        m.pulse += m.pulseSpeed;
        m.x += m.vx;
        m.y += m.vy + Math.sin(m.pulse) * 0.12;

        if (m.x - m.r <= sideSafe) {
          m.x = sideSafe + m.r;
          m.vx *= -1;
        } else if (m.x + m.r >= vw - sideSafe) {
          m.x = vw - sideSafe - m.r;
          m.vx *= -1;
        }

        if (m.y - m.r <= topSafe) {
          m.y = topSafe + m.r;
          m.vy *= -1;
        } else if (m.y + m.r >= vh - bottomSafe) {
          m.y = vh - bottomSafe - m.r;
          m.vy *= -1;
        }

        const dx = Math.cos(m.pulse) * m.pulseAmp;
        const dy = Math.sin(m.pulse * 0.9) * m.pulseAmp * 0.55;

        m.el.style.left = `${m.x - m.r + dx}px`;
        m.el.style.top = `${m.y - m.r + dy}px`;
      }

      overlay.__rafId = requestAnimationFrame(tick);
    }

    updateCounter();
    overlay.classList.add("is-open");
    placeBubbles();
    tick();

    return new Promise((resolve) => {
      overlay.__resolve = () => {
        running = false;
        if (overlay.__rafId) {
          cancelAnimationFrame(overlay.__rafId);
          overlay.__rafId = null;
        }
        resolve();
      };
    });
  }

  async function tryClaimLadybugSecretOnce() {
    const sb = window.sb;
    if (!sb || typeof sb.from !== "function") {
      return { ok: false, credited: false, reward: 0, first_time: false, reason: "no_client" };
    }

    const uid = await _ensureAuth();
    if (!uid) {
      return { ok: false, credited: false, reward: 0, first_time: false, reason: "no_auth" };
    }

    try {
      const beforeBalance = Number(window.VUserData?.getVcoins?.() || 0) || 0;

      const claim = await sb
        .from("profiles")
        .update({ [LADYBUG_PROFILE_FIELD]: true })
        .eq("id", uid)
        .eq(LADYBUG_PROFILE_FIELD, false)
        .select("id");

      if (claim?.error) {
        console.error("LADYBUG SECRET claim error:", claim.error);
        return { ok: false, credited: false, reward: 0, first_time: false, reason: "claim_failed" };
      }

      const firstTime = Array.isArray(claim?.data) && claim.data.length > 0;

      if (!firstTime) {
        return { ok: true, credited: false, reward: 0, first_time: false };
      }

      const newBalance = await window.VUserData?.addVcoinsAsync?.(LADYBUG_REWARD_VCOINS);

      try { await window.VUserData?.refresh?.(); } catch (_) {}

      const afterBalance = Number(window.VUserData?.getVcoins?.() || newBalance || 0) || 0;
      const credited = afterBalance >= (beforeBalance + LADYBUG_REWARD_VCOINS);

      if (!credited) {
        console.error("LADYBUG SECRET credit failed: expected +50 VCoins", {
          beforeBalance,
          afterBalance,
          newBalance
        });

        try {
          await sb
            .from("profiles")
            .update({ [LADYBUG_PROFILE_FIELD]: false })
            .eq("id", uid)
            .eq(LADYBUG_PROFILE_FIELD, true);
        } catch (_) {}

        return {
          ok: false,
          credited: false,
          reward: 0,
          first_time: true,
          reason: "credit_failed"
        };
      }

      return {
        ok: true,
        credited: true,
        reward: LADYBUG_REWARD_VCOINS,
        first_time: true,
        vcoins: afterBalance
      };
    } catch (err) {
      console.error("LADYBUG SECRET exception:", err);
      return { ok: false, credited: false, reward: 0, first_time: false, reason: "exception" };
    }
  }

  async function runLadybugSecretFlow() {
    const result = await tryClaimLadybugSecretOnce();

    if (!result.ok) {
      setMsg("err", "profile.secretErrGeneric");
      return false;
    }

    renderProfileFromState();

    try {
      await window.VRAnalytics?.log?.("profile_secret_found", {
        code: "ladybug",
        first_time: !!result.first_time,
        credited: !!result.credited,
        reward: Number(result.reward || 0) || 0
      });
    } catch (_) {}

    await showLadybugOverlay(result);
    return true;
  }

  function ensureBaudelaireOverlay() {
    if (!document.getElementById("vrBaudelaireStyle")) {
      const style = document.createElement("style");
      style.id = "vrBaudelaireStyle";
      style.textContent = `
      #vrBaudelaireOverlay{
        position:fixed;
        inset:0;
        z-index:100002;
        display:none;
        align-items:center;
        justify-content:center;
        padding:18px;
        overflow:hidden;
      }

      #vrBaudelaireOverlay.is-open{
        display:flex;
      }

      #vrBaudelaireOverlay::before{
        content:"";
        position:absolute;
        inset:0;
        background:
          radial-gradient(circle at 50% 42%, rgba(255,255,255,0.06), transparent 18%),
          radial-gradient(circle at 18% 20%, rgba(110,110,140,0.08), transparent 24%),
          radial-gradient(circle at 82% 78%, rgba(110,110,140,0.08), transparent 22%),
          linear-gradient(180deg, rgba(10,10,16,0.90), rgba(14,14,22,0.94));
        backdrop-filter: blur(6px);
        animation: vrBaudelairePulse 2.8s ease-in-out infinite;
      }

      #vrBaudelaireOverlay::after{
        content:"";
        position:absolute;
        inset:0;
        pointer-events:none;
        background: radial-gradient(circle at center, transparent 28%, rgba(0,0,0,0.38) 100%);
      }

      #vrBaudelaireCard{
        position:relative;
        z-index:1;
        width:min(420px, calc(100vw - 28px));
        padding:24px 20px 18px;
        border-radius:24px;
        color:#f3f0e8;
        text-align:center;
        background:linear-gradient(180deg, rgba(28,28,38,0.96), rgba(18,18,26,0.98));
        border:1px solid rgba(255,255,255,0.10);
        box-shadow:
          0 22px 60px rgba(0,0,0,0.44),
          inset 0 1px 0 rgba(255,255,255,0.08);
        backdrop-filter: blur(10px);
        transform:translateY(8px) scale(.985);
        opacity:0;
        transition:transform .22s ease, opacity .22s ease;
      }

      #vrBaudelaireOverlay.is-open #vrBaudelaireCard{
        transform:translateY(0) scale(1);
        opacity:1;
      }

      #vrBaudelaireGlow{
        position:absolute;
        left:50%;
        top:50%;
        width:min(560px, 94vw);
        height:min(560px, 94vw);
        transform:translate(-50%, -50%);
        border-radius:999px;
        background:radial-gradient(circle, rgba(255,255,255,0.07), rgba(120,120,170,0.05) 28%, transparent 64%);
        filter:blur(26px);
        pointer-events:none;
        animation: vrBaudelaireGlow 3.2s ease-in-out infinite;
      }

      #vrBaudelaireTitle{
        margin:0 0 10px;
        font-size:24px;
        line-height:1.1;
        font-weight:900;
        letter-spacing:.01em;
      }

      #vrBaudelaireBody{
        margin:0 0 18px;
        font-size:14px;
        line-height:1.6;
        color:rgba(243,240,232,0.92);
        white-space:pre-line;
        max-height:min(58vh, 520px);
        overflow:auto;
        padding-right:4px;
      }

      #vrBaudelaireBtn{
        border:none;
        border-radius:999px;
        padding:12px 18px;
        min-width:140px;
        font-size:14px;
        font-weight:900;
        cursor:pointer;
        color:#14141d;
        background:linear-gradient(180deg,#f5f1e8,#d7d1c7);
        box-shadow:0 10px 24px rgba(0,0,0,0.22);
      }

      @keyframes vrBaudelairePulse{
        0%,100%{ opacity:1; }
        50%{ opacity:.92; }
      }

      @keyframes vrBaudelaireGlow{
        0%,100%{ opacity:.70; transform:translate(-50%, -50%) scale(1); }
        50%{ opacity:1; transform:translate(-50%, -50%) scale(1.06); }
      }
      `;
      document.head.appendChild(style);
    }

    if (!document.getElementById("vrBaudelaireOverlay")) {
      const overlay = document.createElement("div");
      overlay.id = "vrBaudelaireOverlay";
      overlay.innerHTML = `
      <div id="vrBaudelaireGlow"></div>
      <div id="vrBaudelaireCard" role="dialog" aria-modal="true" aria-labelledby="vrBaudelaireTitle">
        <h2 id="vrBaudelaireTitle"></h2>
        <p id="vrBaudelaireBody"></p>
        <button type="button" id="vrBaudelaireBtn"></button>
      </div>
      `;
      document.body.appendChild(overlay);

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeBaudelaireOverlay();
      });

      overlay.querySelector("#vrBaudelaireBtn")?.addEventListener("click", closeBaudelaireOverlay);
    }
  }

  function closeBaudelaireOverlay() {
    const overlay = document.getElementById("vrBaudelaireOverlay");
    if (!overlay || !overlay.classList.contains("is-open")) return;

    overlay.classList.remove("is-open");

    const done = overlay.__resolve;
    overlay.__resolve = null;
    if (typeof done === "function") done();
  }

  async function showBaudelaireOverlay() {
    ensureBaudelaireOverlay();

    const overlay = document.getElementById("vrBaudelaireOverlay");
    const title = document.getElementById("vrBaudelaireTitle");
    const body = document.getElementById("vrBaudelaireBody");
    const btn = document.getElementById("vrBaudelaireBtn");

    if (!overlay || !title || !body || !btn) {
      return Promise.resolve();
    }

    title.textContent = _t("profile.baudelaireSecretTitle", "Baudelaire — Destruction");
    body.textContent = _t("profile.baudelaireSecretBody", "Without cease the Demon stirs beside me...");
    btn.textContent = _t("profile.baudelaireSecretButton", "Continue");

    overlay.classList.add("is-open");

    return new Promise((resolve) => {
      overlay.__resolve = resolve;
    });
  }

  async function runBaudelaireSecretFlow() {
    try {
      await window.VRAnalytics?.log?.("profile_secret_found", {
        code: "baudelaire",
        first_time: false,
        credited: false,
        reward: 0
      });
    } catch (_) {}

    await showBaudelaireOverlay();
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

    const nextNorm = _secretNorm(next);

    if (nextNorm === LADYBUG_USERNAME_CODE) {
      const saveBtnSecret = $("pf_save");
      if (saveBtnSecret) saveBtnSecret.disabled = true;

      try {
        const ok = await runLadybugSecretFlow();

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

    if (nextNorm === BAUDELAIRE_USERNAME_CODE) {
      const saveBtnSecret = $("pf_save");
      if (saveBtnSecret) saveBtnSecret.disabled = true;

      try {
        const ok = await runBaudelaireSecretFlow();

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
