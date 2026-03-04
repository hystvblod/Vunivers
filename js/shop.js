// VUniverse — shop.js
// Boutique rewarded / store via purchases.js
// Boutique cosmétiques branchée sur VUserData
// Popup personnalisation aussi exploitable depuis game.html

(function () {
  "use strict";

  const CATEGORY_KEYS = {
    background: "shop.cosmetics.background",
    message: "shop.cosmetics.message",
    choice: "shop.cosmetics.choice"
  };

  const _lightboxState = {
    open: false,
    src: "",
    universeId: "",
    category: "",
    itemId: "",
    slideIndex: 0
  };

  const LIGHTBOX_GRAY_ASSETS = {
    hell_king: {
      background: "assets/img/backgrounds/hell_default_gray.webp",
      message: "assets/img/ui/hell_msg_default_gray.webp",
      choice: "assets/img/ui/hell_choice_default_gray.webp"
    },
    heaven_king: {
      background: "assets/img/backgrounds/heaven_default_gray.webp",
      message: "assets/img/ui/heaven_msg_default_gray.webp",
      choice: "assets/img/ui/heaven_choice_default_gray.webp"
    },
    western_president: {
      background: "assets/img/backgrounds/west_default_gray.webp",
      message: "assets/img/ui/western_card.webp",
      choice: "assets/img/ui/western_choice.webp"
    },
    mega_corp_ceo: {
      background: "assets/img/backgrounds/corp_default_gray.webp",
      message: "assets/img/ui/corp_msg_default_gray.webp",
      choice: "assets/img/ui/corp_choice_default_gray.webp"
    },
    new_world_explorer: {
      background: "assets/img/backgrounds/explorer_default_gray.webp",
      message: "assets/img/ui/western_card.webp",
      choice: "assets/img/ui/western_choice.webp"
    },
    vampire_lord: {
      background: "assets/img/backgrounds/vampire_default_gray.webp",
      message: "assets/img/ui/hell_msg_default_gray.webp",
      choice: "assets/img/ui/hell_choice_default_gray.webp"
    }
  };

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function normalizePath(value) {
    return String(value || "").replace(/\/+$/, "").trim();
  }

  function buildCosmeticItems(opts) {
    const prefix = String(opts?.prefix || "").trim();
    const keyNs = String(opts?.keyNs || "").trim();
    const category = String(opts?.category || "").trim();
    const price = Number(opts?.price || 0);
    const count = Number(opts?.count || 0);
    const dir = normalizePath(opts?.dir || "");

    const filePart =
      category === "background" ? "bg" :
      category === "message" ? "msg" :
      "choice";

    const keyPart =
      category === "background" ? "background" :
      category === "message" ? "message" :
      "choice";

    const kind = category === "background" ? "bg" : "ui";

    return Array.from({ length: count }, function (_, index) {
      const n = pad2(index + 1);
      const base = prefix + "_" + filePart + "_" + n;

      return {
        id: base,
        nameKey: "shop.cosmetics." + keyNs + "." + keyPart + "_" + (index + 1),
        price: price,
        img: dir + "/" + base + ".webp",
        kind: kind
      };
    });
  }

  function buildUniverseCatalog(opts) {
    const bgDir = normalizePath(opts.bgDir || "assets/img/backgrounds");
    const uiBaseDir = normalizePath(opts.uiDir || ("assets/img/ui/" + String(opts.prefix || "").trim()));
    const msgDir = normalizePath(opts.msgDir || (uiBaseDir + "/msg"));
    const choiceDir = normalizePath(opts.choiceDir || (uiBaseDir + "/choice"));

    return {
      id: String(opts?.id || "").trim(),
      labelKey: String(opts?.labelKey || "").trim(),
      categories: {
        background: buildCosmeticItems({
          prefix: opts.prefix,
          keyNs: opts.keyNs,
          category: "background",
          price: Number(opts.bgPrice || 400),
          count: Number(opts.bgCount || 0),
          dir: bgDir
        }),
        message: buildCosmeticItems({
          prefix: opts.prefix,
          keyNs: opts.keyNs,
          category: "message",
          price: Number(opts.uiPrice || 300),
          count: Number(opts.msgCount || 0),
          dir: msgDir
        }),
        choice: buildCosmeticItems({
          prefix: opts.prefix,
          keyNs: opts.keyNs,
          category: "choice",
          price: Number(opts.uiPrice || 300),
          count: Number(opts.choiceCount || 0),
          dir: choiceDir
        })
      }
    };
  }

  const COSMETICS_DATA = [
    buildUniverseCatalog({
      id: "hell_king",
      labelKey: "shop.universe.hell_king",
      prefix: "hell",
      keyNs: "hell",
      bgDir: "assets/img/backgrounds",
      uiDir: "assets/img/ui/hell",
      bgCount: 6,
      msgCount: 7,
      choiceCount: 7,
      bgPrice: 400,
      uiPrice: 300
    }),

    buildUniverseCatalog({
      id: "heaven_king",
      labelKey: "shop.universe.heaven_king",
      prefix: "heaven",
      keyNs: "heaven",
      bgDir: "assets/img/backgrounds",
      uiDir: "assets/img/ui/heaven",
      bgCount: 3,
      msgCount: 5,
      choiceCount: 5,
      bgPrice: 400,
      uiPrice: 300
    }),

    buildUniverseCatalog({
      id: "western_president",
      labelKey: "shop.universe.western_president",
      prefix: "west",
      keyNs: "president",
      bgDir: "assets/img/backgrounds",
      uiDir: "assets/img/ui/west",
      bgCount: 3,
      msgCount: 3,
      choiceCount: 3,
      bgPrice: 400,
      uiPrice: 300
    }),

    buildUniverseCatalog({
      id: "mega_corp_ceo",
      labelKey: "shop.universe.mega_corp_ceo",
      prefix: "corp",
      keyNs: "ceo",
      bgDir: "assets/img/backgrounds",
      uiDir: "assets/img/ui/corp",
      bgCount: 3,
      msgCount: 3,
      choiceCount: 3,
      bgPrice: 400,
      uiPrice: 300
    }),

    buildUniverseCatalog({
      id: "new_world_explorer",
      labelKey: "shop.universe.new_world_explorer",
      prefix: "explorer",
      keyNs: "explorer",
      bgDir: "assets/img/backgrounds",
      uiDir: "assets/img/ui/explorer",
      bgCount: 3,
      msgCount: 3,
      choiceCount: 3,
      bgPrice: 400,
      uiPrice: 300
    }),

    buildUniverseCatalog({
      id: "vampire_lord",
      labelKey: "shop.universe.vampire_lord",
      prefix: "vampire",
      keyNs: "vampire",
      bgDir: "assets/img/backgrounds",
      uiDir: "assets/img/ui/vampire",
      bgCount: 3,
      msgCount: 3,
      choiceCount: 3,
      bgPrice: 400,
      uiPrice: 300
    })
  ];

  function t(key, fallback) {
    try {
      if (window.VRI18n && typeof window.VRI18n.t === "function") {
        return window.VRI18n.t(key, fallback);
      }
    } catch (_) {}
    return fallback;
  }

  function isShopPage() {
    try {
      return document.body && document.body.getAttribute("data-page") === "shop";
    } catch (_) {
      return false;
    }
  }

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(id, text) {
    const el = $(id);
    if (!el) return;
    el.textContent = text || "";
  }

  function toSafeNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  }

  function readStoredUserData() {
    const keys = ["vuniverse_user_data", "vrealms_user_data"];

    for (let i = 0; i < keys.length; i++) {
      try {
        const raw = localStorage.getItem(keys[i]);
        if (!raw) continue;

        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          return parsed;
        }
      } catch (_) {}
    }

    return {};
  }

  function pickBalance(values) {
    for (let i = 0; i < values.length; i++) {
      const n = toSafeNumber(values[i]);
      if (n !== null) return n;
    }
    return 0;
  }

  function getLiveBalances() {
    const store = readStoredUserData();
    const live = window.VUserData || {};
    const liveData = typeof live.getData === "function" ? (live.getData() || {}) : {};

    return {
      vcoins: pickBalance([
        typeof live.getVCoins === "function" ? live.getVCoins() : null,
        typeof live.getBalance === "function" ? live.getBalance("vcoins") : null,
        liveData.vcoins,
        liveData.coins,
        store.vcoins,
        store.coins,
        store.balance && store.balance.vcoins,
        store.wallet && store.wallet.vcoins,
        store.profile && store.profile.vcoins,
        store.user && store.user.vcoins
      ]),
      jetons: pickBalance([
        typeof live.getJetons === "function" ? live.getJetons() : null,
        typeof live.getBalance === "function" ? live.getBalance("jetons") : null,
        liveData.jetons,
        liveData.tokens,
        store.jetons,
        store.tokens,
        store.balance && store.balance.jetons,
        store.wallet && store.wallet.jetons,
        store.profile && store.profile.jetons,
        store.user && store.user.jetons
      ])
    };
  }

  function renderTopBalances() {
    const coinsEl = $("top-vcoins-balance");
    const jetonsEl = $("top-jetons-balance");
    if (!coinsEl && !jetonsEl) return;

    const balances = getLiveBalances();

    if (coinsEl) coinsEl.textContent = String(balances.vcoins);
    if (jetonsEl) jetonsEl.textContent = String(balances.jetons);
  }

  function getLightboxGrayAsset(universeId, category) {
    return LIGHTBOX_GRAY_ASSETS?.[universeId]?.[category] || "";
  }

  function buildLightboxPreviewAssets(universeId, category, src) {
    return {
      background: category === "background" ? src : getLightboxGrayAsset(universeId, "background"),
      message: category === "message" ? src : getLightboxGrayAsset(universeId, "message"),
      choice: category === "choice" ? src : getLightboxGrayAsset(universeId, "choice")
    };
  }

  function ensureStyles() {
    if (document.getElementById("vr-cosmetics-inline-style")) return;

    const style = document.createElement("style");
    style.id = "vr-cosmetics-inline-style";
    style.textContent = `
      .vr-cosmetics{display:flex;flex-direction:column;gap:14px;margin-top:14px;padding-bottom:10px}
      .vr-universe-block{position:relative;overflow:hidden;border-radius:20px;border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.18);box-shadow:0 18px 34px rgba(0,0,0,.26);padding:14px 12px 12px}
      .vr-universe-block::before{content:"";position:absolute;inset:-2px;pointer-events:none;background:radial-gradient(520px 220px at 15% 12%, rgba(255,255,255,.08), transparent 60%),radial-gradient(520px 260px at 85% 18%, rgba(255,214,156,.08), transparent 60%),linear-gradient(180deg, rgba(255,255,255,.03), transparent 40%);opacity:.9}
      .vr-universe-title{position:relative;z-index:1;text-align:center;font-weight:950;font-size:19px;line-height:1.1;color:rgba(255,255,255,.96);margin:0 0 12px;text-shadow:0 12px 24px rgba(0,0,0,.55)}
      .vr-cos-row{position:relative;z-index:1;margin:0 0 14px}
      .vr-cos-row:last-child{margin-bottom:0}
      .vr-cos-carousel{display:grid;grid-template-columns:36px minmax(0,1fr) 36px;align-items:center;gap:8px}
      .vr-cos-arrow{width:36px;height:36px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.22);box-shadow:0 10px 18px rgba(0,0,0,.22);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;color:rgba(255,255,255,.96);font-size:18px;font-weight:900;line-height:1}
      .vr-cos-viewport{min-width:0;overflow:hidden;touch-action:pan-y}
      .vr-cos-track{display:flex;transition:transform .24s ease;will-change:transform}
      .vr-cos-slide{min-width:100%;width:100%;box-sizing:border-box}
      .vr-cos-card{position:relative;overflow:hidden;border-radius:18px;height:132px;border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.24);box-shadow:0 16px 28px rgba(0,0,0,.28);cursor:pointer}
      .vr-cos-card > img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;z-index:0;user-select:none;pointer-events:none}
      .vr-cos-card.is-ui > img{object-fit:contain;padding:14px;background:radial-gradient(circle at 50% 40%, rgba(255,255,255,.10), transparent 46%),linear-gradient(180deg, rgba(255,255,255,.03), rgba(0,0,0,.08))}
      .vr-cos-overlay{position:absolute;inset:auto 0 0 0;z-index:2;padding:32px 10px 10px;background:linear-gradient(180deg, transparent, rgba(0,0,0,.78))}
      .vr-cos-bottom{display:flex;align-items:center;justify-content:flex-end;gap:8px}
      .vr-cos-count{color:rgba(255,255,255,.86);font-size:12px;font-weight:900;text-shadow:0 8px 18px rgba(0,0,0,.45)}
      .vr-cos-dots{display:flex;justify-content:center;gap:6px;margin-top:8px}
      .vr-cos-dot{width:7px;height:7px;border-radius:999px;background:rgba(255,255,255,.28);box-shadow:0 4px 10px rgba(0,0,0,.22)}
      .vr-cos-dot.active{background:rgba(255,255,255,.92)}
      .vr-cos-action{width:100%;margin-top:8px;display:inline-flex;align-items:center;justify-content:center;padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.22);color:#fff;font-weight:900;cursor:pointer;position:relative;z-index:3}
      .vr-cos-action-content{display:inline-flex;align-items:center;justify-content:center;gap:6px;line-height:1}
      .vr-cos-action-ico{width:14px;height:14px;min-width:14px;min-height:14px;object-fit:contain;display:block;flex:0 0 auto;filter:drop-shadow(0 2px 6px rgba(0,0,0,.45))}
      .vr-cos-action.is-owned{background:rgba(255,255,255,.10)}
      .vr-cos-action.is-equipped{background:rgba(138,197,95,.22);border-color:rgba(138,197,95,.55)}
      .vr-cos-owned-mark{display:inline-flex;align-items:center;justify-content:center;font-size:20px;line-height:1;font-weight:1000;color:#79f18b;text-shadow:0 2px 10px rgba(0,0,0,.45)}

      .vr-cos-lightbox{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:99999}
      .vr-cos-lightbox.is-open{display:flex}
      .vr-cos-lightbox-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.82);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
      .vr-cos-lightbox-close{position:absolute;top:12px;right:12px;z-index:5;width:42px;height:42px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.32);color:#fff;font-size:24px;line-height:1;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 10px 22px rgba(0,0,0,.22)}

      .vr-cos-lightbox-shell{
        position:relative;
        z-index:2;
        display:grid;
        grid-template-columns:44px minmax(0,1fr) 44px;
        align-items:center;
        gap:12px;
        width:min(94vw,860px);
      }

      .vr-cos-lightbox-arrow{
        width:44px;
        height:44px;
        border-radius:999px;
        border:1px solid rgba(255,255,255,.16);
        background:rgba(0,0,0,.28);
        color:#fff;
        font-size:22px;
        font-weight:900;
        line-height:1;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        cursor:pointer;
        box-shadow:0 10px 22px rgba(0,0,0,.22);
      }

      .vr-cos-lightbox-stage{
        min-width:0;
        overflow:hidden;
      }

      .vr-cos-lightbox-track{
        display:flex;
        transition:transform .26s ease;
        will-change:transform;
      }

      .vr-cos-lightbox-slide{
        min-width:100%;
        width:100%;
        box-sizing:border-box;
        display:flex;
        align-items:center;
        justify-content:center;
      }

      .vr-cos-lightbox-panel{
        width:100%;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        padding:12px;
        box-sizing:border-box;
      }

      .vr-cos-lightbox-img{
        display:block;
        max-width:100%;
        max-height:82vh;
        object-fit:contain;
        border-radius:18px;
        box-shadow:0 22px 48px rgba(0,0,0,.45);
      }

      .vr-cos-lightbox-dots{
        display:flex;
        justify-content:center;
        gap:8px;
        margin-top:10px;
        position:relative;
        z-index:2;
      }

      .vr-cos-lightbox-dot{
        width:8px;
        height:8px;
        border-radius:999px;
        background:rgba(255,255,255,.28);
        box-shadow:0 4px 10px rgba(0,0,0,.22);
        cursor:pointer;
      }

      .vr-cos-lightbox-dot.active{
        background:rgba(255,255,255,.92);
      }

      .vr-cos-preview{
        position:relative;
        width:min(86vw,420px);
        aspect-ratio:9/16;
        border-radius:22px;
        overflow:hidden;
        background:#0d1420;
        box-shadow:0 22px 48px rgba(0,0,0,.45);
      }

      .vr-cos-preview-bg{
        position:absolute;
        inset:0;
        background-size:100% 100%;
        background-position:center center;
        background-repeat:no-repeat;
        z-index:0;
      }

      .vr-cos-preview-shade{
        position:absolute;
        inset:0;
        background:linear-gradient(180deg, rgba(7,10,18,.18), rgba(7,10,18,.28));
        z-index:1;
        pointer-events:none;
      }

      .vr-cos-preview-top{
        position:absolute;
        top:12px;
        left:12px;
        right:12px;
        z-index:2;
        display:flex;
        align-items:center;
        justify-content:space-between;
      }

      .vr-cos-preview-mini-btn{
        width:34px;
        height:34px;
        border-radius:999px;
        border:1px solid rgba(255,255,255,.16);
        background:rgba(0,0,0,.22);
        box-shadow:0 8px 18px rgba(0,0,0,.22);
      }

      .vr-cos-preview-mini-balances{
        display:flex;
        align-items:center;
        gap:10px;
      }

      .vr-cos-preview-mini-balance{
        display:inline-flex;
        align-items:center;
        gap:4px;
        color:#fff;
        font-size:11px;
        font-weight:900;
        text-shadow:0 4px 10px rgba(0,0,0,.28);
      }

      .vr-cos-preview-mini-balance img{
        width:12px;
        height:12px;
        object-fit:contain;
        display:block;
        filter:drop-shadow(0 2px 4px rgba(0,0,0,.35));
      }

      .vr-cos-preview-center{
        position:absolute;
        left:0;
        right:0;
        top:72px;
        bottom:18px;
        z-index:2;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:flex-start;
        gap:14px;
        padding:0 14px;
        box-sizing:border-box;
      }

      .vr-cos-preview-message{
        width:100%;
        height:132px;
        border-radius:18px;
        background-position:center center;
        background-repeat:no-repeat;
        background-size:100% 100%;
        box-shadow:0 14px 28px rgba(0,0,0,.28);
      }

      .vr-cos-preview-choices{
        width:100%;
        display:flex;
        flex-direction:column;
        gap:10px;
        margin-top:auto;
      }

      .vr-cos-preview-choice{
        width:100%;
        height:68px;
        border-radius:16px;
        background-position:center center;
        background-repeat:no-repeat;
        background-size:100% 100%;
        box-shadow:0 12px 22px rgba(0,0,0,.22);
      }

      body.vr-lightbox-open{overflow:hidden}

      @media (max-width:390px){
        .vr-cos-action-ico{width:13px;height:13px;min-width:13px;min-height:13px}
        .vr-cos-owned-mark{font-size:18px}
        .vr-cos-lightbox-shell{grid-template-columns:38px minmax(0,1fr) 38px;gap:8px}
        .vr-cos-lightbox-arrow{width:38px;height:38px;font-size:20px}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureCosmeticsRoot() {
    let root = $("cosmetics-block");
    if (root) return root;

    const storeStatus = $("store-status");
    const parent = (storeStatus && storeStatus.parentElement) || $("view-shop") || document.body;

    root = document.createElement("div");
    root.id = "cosmetics-block";
    root.className = "vr-cosmetics";
    parent.appendChild(root);

    return root;
  }

  function updateLightboxSlide(index) {
    const root = $("vr-cos-lightbox");
    if (!root) return;

    const track = root.querySelector(".vr-cos-lightbox-track");
    const dots = root.querySelectorAll(".vr-cos-lightbox-dot");
    if (!track) return;

    const safeIndex = normalizeCarouselIndex(index, 2);
    _lightboxState.slideIndex = safeIndex;
    track.style.transform = "translateX(-" + (safeIndex * 100) + "%)";

    dots.forEach(function (dot, i) {
      dot.classList.toggle("active", i === safeIndex);
    });
  }

  function fillLightboxPreview(universeId, category, src) {
    const root = $("vr-cos-lightbox");
    if (!root) return;

    const assets = buildLightboxPreviewAssets(universeId, category, src);

    const bg = root.querySelector(".vr-cos-preview-bg");
    const message = root.querySelector(".vr-cos-preview-message");
    const choices = root.querySelectorAll(".vr-cos-preview-choice");

    if (bg) {
      bg.style.backgroundImage = assets.background ? `url("${assets.background}")` : "";
    }

    if (message) {
      message.style.backgroundImage = assets.message ? `url("${assets.message}")` : "";
    }

    choices.forEach(function (choiceEl) {
      choiceEl.style.backgroundImage = assets.choice ? `url("${assets.choice}")` : "";
    });
  }

  function ensureLightboxRoot() {
    let root = $("vr-cos-lightbox");
    if (root) return root;

    root = document.createElement("div");
    root.id = "vr-cos-lightbox";
    root.className = "vr-cos-lightbox";
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `
      <div class="vr-cos-lightbox-backdrop" data-lightbox-close="1"></div>
      <button class="vr-cos-lightbox-close" type="button" data-lightbox-close="1">×</button>

      <div class="vr-cos-lightbox-shell">
        <button class="vr-cos-lightbox-arrow" type="button" data-lightbox-nav="-1">‹</button>

        <div class="vr-cos-lightbox-stage">
          <div class="vr-cos-lightbox-track">
            <div class="vr-cos-lightbox-slide">
              <div class="vr-cos-lightbox-panel">
                <img class="vr-cos-lightbox-img" src="" alt="" draggable="false">
                <div class="vr-cos-lightbox-dots">
                  <span class="vr-cos-lightbox-dot active" data-lightbox-dot="0"></span>
                  <span class="vr-cos-lightbox-dot" data-lightbox-dot="1"></span>
                </div>
              </div>
            </div>

            <div class="vr-cos-lightbox-slide">
              <div class="vr-cos-lightbox-panel">
                <div class="vr-cos-preview">
                  <div class="vr-cos-preview-bg"></div>
                  <div class="vr-cos-preview-shade"></div>

                  <div class="vr-cos-preview-top">
                    <div class="vr-cos-preview-mini-btn"></div>

                    <div class="vr-cos-preview-mini-balances">
                      <div class="vr-cos-preview-mini-balance">
                        <img src="assets/img/ui/vcoins.webp" alt="" draggable="false">
                        <span>0</span>
                      </div>
                      <div class="vr-cos-preview-mini-balance">
                        <img src="assets/img/ui/jeton.webp" alt="" draggable="false">
                        <span>0</span>
                      </div>
                    </div>

                    <div class="vr-cos-preview-mini-btn"></div>
                  </div>

                  <div class="vr-cos-preview-center">
                    <div class="vr-cos-preview-message"></div>

                    <div class="vr-cos-preview-choices">
                      <div class="vr-cos-preview-choice"></div>
                      <div class="vr-cos-preview-choice"></div>
                      <div class="vr-cos-preview-choice"></div>
                    </div>
                  </div>
                </div>

                <div class="vr-cos-lightbox-dots">
                  <span class="vr-cos-lightbox-dot active" data-lightbox-dot="0"></span>
                  <span class="vr-cos-lightbox-dot" data-lightbox-dot="1"></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button class="vr-cos-lightbox-arrow" type="button" data-lightbox-nav="1">›</button>
      </div>
    `;
    document.body.appendChild(root);

    root.addEventListener("click", function (e) {
      const closeBtn = e.target && e.target.closest ? e.target.closest("[data-lightbox-close]") : null;
      if (closeBtn) {
        closeLightbox();
        return;
      }

      const navBtn = e.target && e.target.closest ? e.target.closest("[data-lightbox-nav]") : null;
      if (navBtn) {
        const step = Number(navBtn.getAttribute("data-lightbox-nav") || 0);
        updateLightboxSlide(_lightboxState.slideIndex + step);
        return;
      }

      const dotBtn = e.target && e.target.closest ? e.target.closest("[data-lightbox-dot]") : null;
      if (dotBtn) {
        const idx = Number(dotBtn.getAttribute("data-lightbox-dot") || 0);
        updateLightboxSlide(idx);
      }
    });

    document.addEventListener("keydown", function (e) {
      if (!_lightboxState.open) return;

      if (e.key === "Escape") {
        closeLightbox();
        return;
      }

      if (e.key === "ArrowLeft") {
        updateLightboxSlide(_lightboxState.slideIndex - 1);
        return;
      }

      if (e.key === "ArrowRight") {
        updateLightboxSlide(_lightboxState.slideIndex + 1);
      }
    });

    return root;
  }

  function openLightbox(opts) {
    const root = ensureLightboxRoot();
    const img = root.querySelector(".vr-cos-lightbox-img");
    if (!root || !img || !opts?.src) return;

    _lightboxState.open = true;
    _lightboxState.src = String(opts.src || "");
    _lightboxState.universeId = String(opts.universeId || "");
    _lightboxState.category = String(opts.category || "");
    _lightboxState.itemId = String(opts.itemId || "");
    _lightboxState.slideIndex = 0;

    img.src = _lightboxState.src;

    fillLightboxPreview(_lightboxState.universeId, _lightboxState.category, _lightboxState.src);
    updateLightboxSlide(0);

    root.classList.add("is-open");
    root.setAttribute("aria-hidden", "false");
    document.body.classList.add("vr-lightbox-open");
  }

  function closeLightbox() {
    const root = $("vr-cos-lightbox");
    const img = root ? root.querySelector(".vr-cos-lightbox-img") : null;

    _lightboxState.open = false;
    _lightboxState.src = "";
    _lightboxState.universeId = "";
    _lightboxState.category = "";
    _lightboxState.itemId = "";
    _lightboxState.slideIndex = 0;

    if (img) img.src = "";
    if (root) {
      root.classList.remove("is-open");
      root.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("vr-lightbox-open");
  }

  function getUniverse(universeId) {
    return COSMETICS_DATA.find(function (u) {
      return u.id === universeId;
    }) || null;
  }

  function getItem(universeId, category, itemId) {
    const universe = getUniverse(universeId);
    const items = (universe && universe.categories && universe.categories[category]) || [];

    return items.find(function (item) {
      return item.id === itemId;
    }) || null;
  }

  window.VRCosmeticsCatalog = {
    CATEGORY_KEYS: CATEGORY_KEYS,
    DATA: COSMETICS_DATA,
    getUniverse: getUniverse,
    getItem: getItem
  };

  function normalizeCarouselIndex(index, total) {
    if (!total) return 0;
    const n = Number(index) || 0;
    return ((n % total) + total) % total;
  }

  function updateCarousel(row, index) {
    if (!row) return;

    const track = row.querySelector(".vr-cos-track");
    const slides = row.querySelectorAll(".vr-cos-slide");
    const dots = row.querySelectorAll(".vr-cos-dot");
    const prev = row.querySelector(".vr-cos-prev");
    const next = row.querySelector(".vr-cos-next");
    const total = slides.length;

    if (!track || !total) return;

    const safeIndex = normalizeCarouselIndex(index, total);

    row.dataset.index = String(safeIndex);
    track.style.transform = "translateX(-" + (safeIndex * 100) + "%)";

    dots.forEach(function (dot, i) {
      dot.classList.toggle("active", i === safeIndex);
    });

    if (prev) prev.disabled = false;
    if (next) next.disabled = false;
  }

  function wireCarousels(root) {
    root.querySelectorAll(".vr-cos-row").forEach(function (row) {
      updateCarousel(row, Number(row.dataset.index || 0));

      const prev = row.querySelector(".vr-cos-prev");
      const next = row.querySelector(".vr-cos-next");
      const viewport = row.querySelector(".vr-cos-viewport");

      if (prev) {
        prev.onclick = function () {
          updateCarousel(row, Number(row.dataset.index || 0) - 1);
        };
      }

      if (next) {
        next.onclick = function () {
          updateCarousel(row, Number(row.dataset.index || 0) + 1);
        };
      }

      if (viewport) {
        let startX = 0;
        let endX = 0;
        let touching = false;

        viewport.addEventListener("touchstart", function (e) {
          const t0 = e.changedTouches && e.changedTouches[0];
          if (!t0) return;

          touching = true;
          startX = t0.clientX;
          endX = t0.clientX;
        }, { passive: true });

        viewport.addEventListener("touchmove", function (e) {
          const t0 = e.changedTouches && e.changedTouches[0];
          if (!t0 || !touching) return;
          endX = t0.clientX;
        }, { passive: true });

        viewport.addEventListener("touchend", function () {
          if (!touching) return;

          const delta = endX - startX;
          const current = Number(row.dataset.index || 0);

          if (Math.abs(delta) > 35) {
            if (delta < 0) updateCarousel(row, current + 1);
            else updateCarousel(row, current - 1);
          }

          touching = false;
          startX = 0;
          endX = 0;
        }, { passive: true });
      }
    });
  }

  function getActionMeta(item) {
    const universeId = String(item.universeId || "").trim();
    const category = String(item.category || "").trim();
    const itemId = String(item.id || "").trim();

    const owned = !!window.VUserData?.isCosmeticOwned?.(universeId, category, itemId);
    const equippedId = String(window.VUserData?.getEquippedCosmetic?.(universeId, category) || "");
    const equipped = owned && equippedId === itemId;

    if (equipped) {
      return {
        owned: owned,
        equipped: equipped,
        html: `<span class="vr-cos-owned-mark">V</span>`,
        className: "vr-cos-action is-equipped"
      };
    }

    if (owned) {
      return {
        owned: owned,
        equipped: equipped,
        html: `<span class="vr-cos-owned-mark">V</span>`,
        className: "vr-cos-action is-owned"
      };
    }

    return {
      owned: owned,
      equipped: equipped,
      html:
        `<span class="vr-cos-action-content">` +
          `<span>${t("common.buy", "Acheter")}</span>` +
          `<img class="vr-cos-action-ico" src="assets/img/ui/vcoins.webp" alt="" draggable="false">` +
          `<span>${item.price}</span>` +
        `</span>`,
      className: "vr-cos-action"
    };
  }

  function renderCosmetics() {
    const root = ensureCosmeticsRoot();
    if (!root) return;

    root.innerHTML = COSMETICS_DATA.map(function (universe) {
      return `
        <section class="vr-universe-block" data-universe="${universe.id}">
          <h4 class="vr-universe-title">${t(universe.labelKey, universe.id)}</h4>

          ${["background", "message", "choice"].map(function (category) {
            const items = (universe.categories[category] || []).map(function (it) {
              return Object.assign({}, it, {
                universeId: universe.id,
                category: category
              });
            });

            return `
              <div class="vr-cos-row" data-category="${category}" data-index="0">
                <div class="vr-cos-carousel">
                  <button class="vr-cos-arrow vr-cos-prev" type="button" aria-label="${t("shop.carousel.prev", "Précédent")}">‹</button>

                  <div class="vr-cos-viewport">
                    <div class="vr-cos-track">
                      ${items.map(function (item, index) {
                        const action = getActionMeta(item);

                        return `
                          <div class="vr-cos-slide" data-index="${index}">
                            <div
                              class="vr-cos-card ${item.kind === "ui" ? "is-ui" : ""}"
                              data-item="${item.id}"
                              data-lightbox-src="${item.img}"
                              data-lightbox-universe="${item.universeId}"
                              data-lightbox-category="${item.category}"
                              data-lightbox-item-id="${item.id}"
                            >
                              <img src="${item.img}" alt="" draggable="false">
                              <div class="vr-cos-overlay">
                                <div class="vr-cos-bottom">
                                  <div class="vr-cos-count">${index + 1} / ${items.length}</div>
                                </div>
                                <button
                                  class="${action.className}"
                                  type="button"
                                  data-cosmetic-action="1"
                                  data-universe="${item.universeId}"
                                  data-category="${item.category}"
                                  data-item-id="${item.id}"
                                  data-price="${item.price}"
                                >${action.html}</button>
                              </div>
                            </div>
                          </div>
                        `;
                      }).join("")}
                    </div>
                  </div>

                  <button class="vr-cos-arrow vr-cos-next" type="button" aria-label="${t("shop.carousel.next", "Suivant")}">›</button>
                </div>

                <div class="vr-cos-dots">
                  ${items.map(function (_, index) {
                    return `<span class="vr-cos-dot${index === 0 ? " active" : ""}"></span>`;
                  }).join("")}
                </div>
              </div>
            `;
          }).join("")}
        </section>
      `;
    }).join("");

    wireCarousels(root);
  }

  async function handleCosmeticAction(btn) {
    const universeId = String(btn?.dataset?.universe || "").trim();
    const category = String(btn?.dataset?.category || "").trim();
    const itemId = String(btn?.dataset?.itemId || "").trim();
    const price = Number(btn?.dataset?.price || 0);

    if (!universeId || !category || !itemId) return;

    btn.disabled = true;

    try {
      const owned = !!window.VUserData?.isCosmeticOwned?.(universeId, category, itemId);

      let res = null;

      if (!owned) {
        res = await window.VUserData?.buyCosmetic?.({
          universeId: universeId,
          category: category,
          itemId: itemId,
          price: price
        }, { autoEquip: true });
      } else {
        res = await window.VUserData?.equipCosmetic?.(universeId, category, itemId);
      }

      if (!res?.ok) {
        if (res?.reason === "insufficient_vcoins") {
          setStatus("store-status", t("shop.toast.insufficient_vcoins", "Pas assez de VCoins"));
        } else if (res?.reason === "not_owned") {
          setStatus("store-status", t("shop.toast.not_owned", "Objet non possédé"));
        } else {
          setStatus("store-status", t("common.error_generic", "Erreur"));
        }
      } else {
        setStatus("store-status", "");
      }

      renderTopBalances();
      renderCosmetics();
    } catch (_) {
      setStatus("store-status", t("common.error_generic", "Erreur"));
    } finally {
      btn.disabled = false;
    }
  }

  async function boot() {
    if (!isShopPage()) return;

    try { await window.vrWaitBootstrap?.(); } catch (_) {}
    try { await window.VUserData?.init?.(); } catch (_) {}
    try { await window.VUserData?.refresh?.(); } catch (_) {}

    ensureStyles();
    ensureLightboxRoot();

    const back = $("btn-back");
    const profile = $("btn-profile");

    if (back) {
      back.addEventListener("click", function (e) {
        e.preventDefault();
        try {
          const ref = document.referrer || "";
          if (ref && ref.includes(location.origin)) history.back();
          else location.href = "index.html";
        } catch (_) {
          location.href = "index.html";
        }
      });
    }

    if (profile) {
      profile.addEventListener("click", function (e) {
        e.preventDefault();
        location.href = "profile.html";
      });
    }

    setStatus("shop-status", "");
    setStatus("store-status", "");
    renderTopBalances();
    renderCosmetics();

    document.addEventListener("click", async function (e) {
      const actionBtn = e.target && e.target.closest ? e.target.closest("[data-cosmetic-action]") : null;
      if (actionBtn) {
        await handleCosmeticAction(actionBtn);
        renderTopBalances();
        return;
      }

      const lightboxCard = e.target && e.target.closest ? e.target.closest(".vr-cos-card[data-lightbox-src]") : null;
      if (lightboxCard) {
        const src = String(lightboxCard.getAttribute("data-lightbox-src") || "").trim();
        const universeId = String(lightboxCard.getAttribute("data-lightbox-universe") || "").trim();
        const category = String(lightboxCard.getAttribute("data-lightbox-category") || "").trim();
        const itemId = String(lightboxCard.getAttribute("data-lightbox-item-id") || "").trim();

        if (src) {
          openLightbox({
            src: src,
            universeId: universeId,
            category: category,
            itemId: itemId
          });
        }
      }
    });

    window.addEventListener("vr:profile", function () {
      if (!isShopPage()) return;
      renderTopBalances();
      renderCosmetics();
    });

    window.addEventListener("focus", function () {
      renderTopBalances();
    });

    window.addEventListener("storage", function () {
      renderTopBalances();
    });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) return;
      renderTopBalances();
    });

    setInterval(function () {
      if (!isShopPage()) return;
      renderTopBalances();
    }, 800);
  }

  document.addEventListener("DOMContentLoaded", boot);
})();