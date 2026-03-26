(() => {
  const old = document.getElementById("__secret_preview_overlay__");
  const oldStyle = document.getElementById("__secret_preview_style__");
  if (old) old.remove();
  if (oldStyle) oldStyle.remove();

  const style = document.createElement("style");
  style.id = "__secret_preview_style__";
  style.textContent = `
    body.__secret_preview_active__{
      overflow: hidden !important;
    }

    #__secret_preview_overlay__{
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(0,0,0,.78);
      backdrop-filter: blur(3px);
      -webkit-backdrop-filter: blur(3px);
      overflow: hidden;
      transform: translateZ(0);
    }

    #__secret_preview_overlay__.is-open{
      display: flex;
    }

    #__secret_preview_overlay__.is-glitch{
      animation: __secretShake .46s linear 2;
    }

    #__secret_preview_overlay__ .noise{
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
      animation: __secretNoise .16s steps(2) infinite;
    }

    #__secret_preview_overlay__ .panel{
      position: relative;
      width: min(560px, 100%);
      border-radius: 24px;
      padding: 24px 18px 18px;
      border: 1px solid rgba(255,255,255,.12);
      background: linear-gradient(180deg, rgba(23,27,40,.96), rgba(10,12,18,.98));
      box-shadow: 0 24px 70px rgba(0,0,0,.5);
      color: #fff;
      text-align: center;
      transform: translateY(10px) scale(.98);
      animation: __secretPanelIn .24s ease forwards;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    }

    #__secret_preview_overlay__ .title{
      font-size: clamp(22px, 4.8vw, 32px);
      font-weight: 1000;
      line-height: 1.04;
      margin-bottom: 12px;
    }

    #__secret_preview_overlay__ .body{
      font-size: clamp(14px, 3.2vw, 16px);
      line-height: 1.5;
      opacity: .95;
      white-space: pre-line;
      max-width: 440px;
      margin: 0 auto 18px;
    }

    #__secret_preview_overlay__ .reward{
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 12px 18px;
      border-radius: 999px;
      margin-bottom: 18px;
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.12);
    }

    #__secret_preview_overlay__ .coin{
      width: 34px;
      height: 34px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at 30% 30%, #fff7b1, #ffd84d 55%, #d79c00 100%);
      color: #3d2a00;
      font-size: 18px;
      font-weight: 1000;
      box-shadow: inset 0 1px 2px rgba(255,255,255,.55), 0 4px 10px rgba(0,0,0,.22);
    }

    #__secret_preview_overlay__ .reward-text{
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      line-height: 1.04;
    }

    #__secret_preview_overlay__ .reward-label{
      font-size: 11px;
      letter-spacing: .08em;
      text-transform: uppercase;
      opacity: .78;
    }

    #__secret_preview_overlay__ .reward-value{
      font-size: 28px;
      font-weight: 1000;
    }

    #__secret_preview_overlay__ .btns{
      display: flex;
      gap: 10px;
      justify-content: center;
      flex-wrap: wrap;
    }

    #__secret_preview_overlay__ button{
      min-width: 150px;
      border: 0;
      border-radius: 14px;
      padding: 12px 18px;
      font-weight: 1000;
      cursor: pointer;
      color: #10131b;
      background: linear-gradient(180deg, #ffffff, #dfe7ff);
      box-shadow: 0 10px 24px rgba(0,0,0,.22);
    }

    #__secret_preview_overlay__ .btn-secondary{
      color: #fff;
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.14);
    }

    #__secret_preview_overlay__ .confetti{
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
    }

    #__secret_preview_overlay__ .piece{
      position: absolute;
      top: -10%;
      width: 10px;
      height: 18px;
      border-radius: 3px;
      opacity: .96;
      animation-name: __secretConfetti;
      animation-timing-function: ease-out;
      animation-fill-mode: forwards;
    }

    @keyframes __secretShake{
      0%   { transform: translate(0,0); }
      20%  { transform: translate(-6px, 2px); }
      40%  { transform: translate(6px, -3px); }
      60%  { transform: translate(-4px, 3px); }
      80%  { transform: translate(4px, -2px); }
      100% { transform: translate(0,0); }
    }

    @keyframes __secretNoise{
      0%   { transform: translate(0,0); }
      25%  { transform: translate(-1%, 1%); }
      50%  { transform: translate(1%, -1%); }
      75%  { transform: translate(1%, 1%); }
      100% { transform: translate(0,0); }
    }

    @keyframes __secretPanelIn{
      from { opacity: 0; transform: translateY(16px) scale(.96); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    @keyframes __secretConfetti{
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
  `;
  document.head.appendChild(style);

  const overlay = document.createElement("div");
  overlay.id = "__secret_preview_overlay__";
  overlay.innerHTML = `
    <div class="noise"></div>
    <div class="confetti" id="__secret_preview_confetti__"></div>

    <div class="panel" role="dialog" aria-modal="true">
      <div class="title" id="__secret_preview_title__"></div>
      <div class="body" id="__secret_preview_body__"></div>

      <div class="reward" id="__secret_preview_reward__" hidden>
        <div class="coin">V</div>
        <div class="reward-text">
          <span class="reward-label">RÉCOMPENSE</span>
          <span class="reward-value" id="__secret_preview_reward_value__"></span>
        </div>
      </div>

      <div class="btns">
        <button class="btn-secondary" id="__secret_preview_seen__">Déjà vu</button>
        <button id="__secret_preview_claimed__">Version créditée</button>
        <button id="__secret_preview_close__">Fermer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  function spawnConfetti() {
    const host = document.getElementById("__secret_preview_confetti__");
    if (!host) return;
    host.innerHTML = "";
    const colors = ["#ffffff", "#ffd84d", "#8dd6ff", "#ff8ad8", "#9effa5"];

    for (let i = 0; i < 42; i++) {
      const piece = document.createElement("span");
      piece.className = "piece";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.width = `${8 + Math.random() * 6}px`;
      piece.style.height = `${12 + Math.random() * 10}px`;
      piece.style.setProperty("--dx", `${(-140 + Math.random() * 280).toFixed(0)}px`);
      piece.style.setProperty("--rot", `${(-540 + Math.random() * 1080).toFixed(0)}deg`);
      piece.style.animationDuration = `${1.5 + Math.random() * 1.1}s`;
      piece.style.animationDelay = `${Math.random() * 0.18}s`;
      host.appendChild(piece);
    }

    setTimeout(() => {
      host.innerHTML = "";
    }, 3200);
  }

  function openPreview(credited = true) {
    document.getElementById("__secret_preview_title__").textContent = credited
      ? "TU AS DÉCOUVERT UN SECRET"
      : "SECRET DÉJÀ DÉCOUVERT";

    document.getElementById("__secret_preview_body__").textContent = credited
      ? "Tu as trouvé le pseudo caché.\nLe tonton relou a encore frappé.\nLucas et Thomas sont des prouts."
      : "Tu avais déjà trouvé ce secret une première fois.\nLe message se rouvre, mais sans nouveau crédit.";

    const reward = document.getElementById("__secret_preview_reward__");
    const rewardValue = document.getElementById("__secret_preview_reward_value__");
    reward.hidden = !credited;
    rewardValue.textContent = credited ? "+150" : "+0";

    document.body.classList.add("__secret_preview_active__");
    overlay.classList.add("is-open", "is-glitch");

    setTimeout(() => {
      overlay.classList.remove("is-glitch");
    }, 900);

    if (credited) spawnConfetti();
  }

  function closePreview() {
    overlay.classList.remove("is-open", "is-glitch");
    document.body.classList.remove("__secret_preview_active__");
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closePreview();
  });

  document.getElementById("__secret_preview_seen__").onclick = () => openPreview(false);
  document.getElementById("__secret_preview_claimed__").onclick = () => openPreview(true);
  document.getElementById("__secret_preview_close__").onclick = closePreview;

  window.secretPreviewOpen = openPreview;
  window.secretPreviewClose = closePreview;

  if (new URLSearchParams(window.location.search).get("secretPreview") === "1") {
    openPreview(true);
  }
})();
