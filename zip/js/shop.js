// VUniverse — shop.js
// ✅ Boutique rewarded / store via purchases.js
// ✅ Boutique cosmétiques branchée sur VUserData (achat + équipement)
// ✅ Catalogue aussi disponible dans game.html pour la popup de personnalisation

(function () {
  "use strict";

  const CATEGORY_KEYS = {
    background: "shop.cosmetics.background",
    message: "shop.cosmetics.message",
    choice: "shop.cosmetics.choice"
  };

  const COSMETICS_DATA = [
    {
      id: "hell_king",
      labelKey: "shop.universe.hell_king",
      categories: {
        background: [
          { id: "hell_bg_01", nameKey: "shop.cosmetics.hell.background_1", price: 400, img: "assets/img/backgrounds/hell_king_bg.webp", kind: "bg" },
          { id: "hell_bg_02", nameKey: "shop.cosmetics.hell.background_2", price: 400, img: "assets/img/backgrounds/hell_king_bg.webp", kind: "bg" },
          { id: "hell_bg_03", nameKey: "shop.cosmetics.hell.background_3", price: 400, img: "assets/img/backgrounds/hell_king_bg.webp", kind: "bg" },
          { id: "hell_bg_04", nameKey: "shop.cosmetics.hell.background_4", price: 400, img: "assets/img/backgrounds/hell_king_bg.webp", kind: "bg" }
        ],
        message: [
          { id: "hell_msg_01", nameKey: "shop.cosmetics.hell.message_1", price: 300, img: "assets/img/ui/hell_card.webp", kind: "ui" },
          { id: "hell_msg_02", nameKey: "shop.cosmetics.hell.message_2", price: 300, img: "assets/img/ui/hell_card.webp", kind: "ui" },
          { id: "hell_msg_03", nameKey: "shop.cosmetics.hell.message_3", price: 300, img: "assets/img/ui/hell_card.webp", kind: "ui" }
        ],
        choice: [
          { id: "hell_choice_01", nameKey: "shop.cosmetics.hell.choice_1", price: 300, img: "assets/img/ui/hell_choice.webp", kind: "ui" },
          { id: "hell_choice_02", nameKey: "shop.cosmetics.hell.choice_2", price: 300, img: "assets/img/ui/hell_choice.webp", kind: "ui" },
          { id: "hell_choice_03", nameKey: "shop.cosmetics.hell.choice_3", price: 300, img: "assets/img/ui/hell_choice.webp", kind: "ui" }
        ]
      }
    },
    {
      id: "heaven_king",
      labelKey: "shop.universe.heaven_king",
      categories: {
        background: [
          { id: "heaven_bg_01", nameKey: "shop.cosmetics.heaven.background_1", price: 400, img: "assets/img/backgrounds/heaven_king_bg.png", kind: "bg" },
          { id: "heaven_bg_02", nameKey: "shop.cosmetics.heaven.background_2", price: 400, img: "assets/img/backgrounds/heaven_king_bg.png", kind: "bg" },
          { id: "heaven_bg_03", nameKey: "shop.cosmetics.heaven.background_3", price: 400, img: "assets/img/backgrounds/heaven_king_bg.png", kind: "bg" }
        ],
        message: [
          { id: "heaven_msg_01", nameKey: "shop.cosmetics.heaven.message_1", price: 300, img: "assets/img/ui/heaven_card.webp", kind: "ui" },
          { id: "heaven_msg_02", nameKey: "shop.cosmetics.heaven.message_2", price: 300, img: "assets/img/ui/heaven_card.webp", kind: "ui" },
          { id: "heaven_msg_03", nameKey: "shop.cosmetics.heaven.message_3", price: 300, img: "assets/img/ui/heaven_card.webp", kind: "ui" }
        ],
        choice: [
          { id: "heaven_choice_01", nameKey: "shop.cosmetics.heaven.choice_1", price: 300, img: "assets/img/ui/heaven_choice.webp", kind: "ui" },
          { id: "heaven_choice_02", nameKey: "shop.cosmetics.heaven.choice_2", price: 300, img: "assets/img/ui/heaven_choice.webp", kind: "ui" },
          { id: "heaven_choice_03", nameKey: "shop.cosmetics.heaven.choice_3", price: 300, img: "assets/img/ui/heaven_choice.webp", kind: "ui" }
        ]
      }
    },
    {
      id: "western_president",
      labelKey: "shop.universe.western_president",
      categories: {
        background: [
          { id: "west_bg_01", nameKey: "shop.cosmetics.president.background_1", price: 400, img: "assets/img/backgrounds/western_president_bg.webp", kind: "bg" },
          { id: "west_bg_02", nameKey: "shop.cosmetics.president.background_2", price: 400, img: "assets/img/backgrounds/western_president_bg.webp", kind: "bg" },
          { id: "west_bg_03", nameKey: "shop.cosmetics.president.background_3", price: 400, img: "assets/img/backgrounds/western_president_bg.webp", kind: "bg" }
        ],
        message: [
          { id: "west_msg_01", nameKey: "shop.cosmetics.president.message_1", price: 300, img: "assets/img/ui/western_card.webp", kind: "ui" },
          { id: "west_msg_02", nameKey: "shop.cosmetics.president.message_2", price: 300, img: "assets/img/ui/western_card.webp", kind: "ui" },
          { id: "west_msg_03", nameKey: "shop.cosmetics.president.message_3", price: 300, img: "assets/img/ui/western_card.webp", kind: "ui" }
        ],
        choice: [
          { id: "west_choice_01", nameKey: "shop.cosmetics.president.choice_1", price: 300, img: "assets/img/ui/western_choice.webp", kind: "ui" },
          { id: "west_choice_02", nameKey: "shop.cosmetics.president.choice_2", price: 300, img: "assets/img/ui/western_choice.webp", kind: "ui" },
          { id: "west_choice_03", nameKey: "shop.cosmetics.president.choice_3", price: 300, img: "assets/img/ui/western_choice.webp", kind: "ui" }
        ]
      }
    },
    {
      id: "mega_corp_ceo",
      labelKey: "shop.universe.mega_corp_ceo",
      categories: {
        background: [
          { id: "corp_bg_01", nameKey: "shop.cosmetics.ceo.background_1", price: 400, img: "assets/img/backgrounds/mega_corp_ceo_bg.webp", kind: "bg" },
          { id: "corp_bg_02", nameKey: "shop.cosmetics.ceo.background_2", price: 400, img: "assets/img/backgrounds/mega_corp_ceo_bg.webp", kind: "bg" },
          { id: "corp_bg_03", nameKey: "shop.cosmetics.ceo.background_3", price: 400, img: "assets/img/backgrounds/mega_corp_ceo_bg.webp", kind: "bg" }
        ],
        message: [
          { id: "corp_msg_01", nameKey: "shop.cosmetics.ceo.message_1", price: 300, img: "assets/img/ui/corp_card.webp", kind: "ui" },
          { id: "corp_msg_02", nameKey: "shop.cosmetics.ceo.message_2", price: 300, img: "assets/img/ui/corp_card.webp", kind: "ui" },
          { id: "corp_msg_03", nameKey: "shop.cosmetics.ceo.message_3", price: 300, img: "assets/img/ui/corp_card.webp", kind: "ui" }
        ],
        choice: [
          { id: "corp_choice_01", nameKey: "shop.cosmetics.ceo.choice_1", price: 300, img: "assets/img/ui/corp_choice.webp", kind: "ui" },
          { id: "corp_choice_02", nameKey: "shop.cosmetics.ceo.choice_2", price: 300, img: "assets/img/ui/corp_choice.webp", kind: "ui" },
          { id: "corp_choice_03", nameKey: "shop.cosmetics.ceo.choice_3", price: 300, img: "assets/img/ui/corp_choice.webp", kind: "ui" }
        ]
      }
    },
    {
      id: "new_world_explorer",
      labelKey: "shop.universe.new_world_explorer",
      categories: {
        background: [
          { id: "explorer_bg_01", nameKey: "shop.cosmetics.explorer.background_1", price: 400, img: "assets/img/backgrounds/new_world_explorer_bg.webp", kind: "bg" },
          { id: "explorer_bg_02", nameKey: "shop.cosmetics.explorer.background_2", price: 400, img: "assets/img/backgrounds/new_world_explorer_bg.webp", kind: "bg" },
          { id: "explorer_bg_03", nameKey: "shop.cosmetics.explorer.background_3", price: 400, img: "assets/img/backgrounds/new_world_explorer_bg.webp", kind: "bg" }
        ],
        message: [
          { id: "explorer_msg_01", nameKey: "shop.cosmetics.explorer.message_1", price: 300, img: "assets/img/ui/western_card.webp", kind: "ui" },
          { id: "explorer_msg_02", nameKey: "shop.cosmetics.explorer.message_2", price: 300, img: "assets/img/ui/western_card.webp", kind: "ui" },
          { id: "explorer_msg_03", nameKey: "shop.cosmetics.explorer.message_3", price: 300, img: "assets/img/ui/western_card.webp", kind: "ui" }
        ],
        choice: [
          { id: "explorer_choice_01", nameKey: "shop.cosmetics.explorer.choice_1", price: 300, img: "assets/img/ui/western_choice.webp", kind: "ui" },
          { id: "explorer_choice_02", nameKey: "shop.cosmetics.explorer.choice_2", price: 300, img: "assets/img/ui/western_choice.webp", kind: "ui" },
          { id: "explorer_choice_03", nameKey: "shop.cosmetics.explorer.choice_3", price: 300, img: "assets/img/ui/western_choice.webp", kind: "ui" }
        ]
      }
    },
    {
      id: "vampire_lord",
      labelKey: "shop.universe.vampire_lord",
      categories: {
        background: [
          { id: "vampire_bg_01", nameKey: "shop.cosmetics.vampire.background_1", price: 400, img: "assets/img/backgrounds/vampire_lord_bg.webp", kind: "bg" },
          { id: "vampire_bg_02", nameKey: "shop.cosmetics.vampire.background_2", price: 400, img: "assets/img/backgrounds/vampire_lord_bg.webp", kind: "bg" },
          { id: "vampire_bg_03", nameKey: "shop.cosmetics.vampire.background_3", price: 400, img: "assets/img/backgrounds/vampire_lord_bg.webp", kind: "bg" }
        ],
        message: [
          { id: "vampire_msg_01", nameKey: "shop.cosmetics.vampire.message_1", price: 300, img: "assets/img/ui/hell_card.webp", kind: "ui" },
          { id: "vampire_msg_02", nameKey: "shop.cosmetics.vampire.message_2", price: 300, img: "assets/img/ui/hell_card.webp", kind: "ui" },
          { id: "vampire_msg_03", nameKey: "shop.cosmetics.vampire.message_3", price: 300, img: "assets/img/ui/hell_card.webp", kind: "ui" }
        ],
        choice: [
          { id: "vampire_choice_01", nameKey: "shop.cosmetics.vampire.choice_1", price: 300, img: "assets/img/ui/hell_choice.webp", kind: "ui" },
          { id: "vampire_choice_02", nameKey: "shop.cosmetics.vampire.choice_2", price: 300, img: "assets/img/ui/hell_choice.webp", kind: "ui" },
          { id: "vampire_choice_03", nameKey: "shop.cosmetics.vampire.choice_3", price: 300, img: "assets/img/ui/hell_choice.webp", kind: "ui" }
        ]
      }
    }
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
    try { return document.body && document.body.getAttribute("data-page") === "shop"; }
    catch { return false; }
  }

  function $(id) { return document.getElementById(id); }

  function setStatus(id, text) {
    const el = $(id);
    if (!el) return;
    el.textContent = text || "";
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
      .vr-cos-subtitle{text-align:center;font-weight:900;font-size:13px;color:rgba(255,255,255,.92);margin:0 0 8px;letter-spacing:.15px}
      .vr-cos-carousel{display:grid;grid-template-columns:36px minmax(0,1fr) 36px;align-items:center;gap:8px}
      .vr-cos-arrow{width:36px;height:36px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.22);box-shadow:0 10px 18px rgba(0,0,0,.22);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;color:rgba(255,255,255,.96);font-size:18px;font-weight:900;line-height:1}
      .vr-cos-arrow[disabled]{opacity:.42;cursor:default}
      .vr-cos-viewport{min-width:0;overflow:hidden;touch-action:pan-y}
      .vr-cos-track{display:flex;transition:transform .24s ease;will-change:transform}
      .vr-cos-slide{min-width:100%;width:100%;box-sizing:border-box}
      .vr-cos-card{position:relative;overflow:hidden;border-radius:18px;height:132px;border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.24);box-shadow:0 16px 28px rgba(0,0,0,.28)}
      .vr-cos-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;z-index:0;user-select:none;pointer-events:none}
      .vr-cos-card.is-ui img{object-fit:contain;padding:14px;background:radial-gradient(circle at 50% 40%, rgba(255,255,255,.10), transparent 46%),linear-gradient(180deg, rgba(255,255,255,.03), rgba(0,0,0,.08))}
      .vr-cos-overlay{position:absolute;inset:auto 0 0 0;z-index:2;padding:32px 10px 10px;background:linear-gradient(180deg, transparent, rgba(0,0,0,.78))}
      .vr-cos-name{text-align:center;font-weight:900;font-size:13px;color:rgba(255,255,255,.96);line-height:1.15;margin-bottom:8px;text-shadow:0 8px 18px rgba(0,0,0,.45)}
      .vr-cos-bottom{display:flex;align-items:center;justify-content:space-between;gap:8px}
      .vr-cos-price{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.30);box-shadow:0 10px 18px rgba(0,0,0,.22);color:rgba(255,255,255,.96);font-weight:950;font-size:12px;line-height:1}
      .vr-cos-price img{position:static;width:16px;height:16px;object-fit:contain;padding:0;background:none;filter:drop-shadow(0 2px 6px rgba(0,0,0,.45))}
      .vr-cos-count{color:rgba(255,255,255,.86);font-size:12px;font-weight:900;text-shadow:0 8px 18px rgba(0,0,0,.45)}
      .vr-cos-dots{display:flex;justify-content:center;gap:6px;margin-top:8px}
      .vr-cos-dot{width:7px;height:7px;border-radius:999px;background:rgba(255,255,255,.28);box-shadow:0 4px 10px rgba(0,0,0,.22)}
      .vr-cos-dot.active{background:rgba(255,255,255,.92)}
      .vr-cos-action{width:100%;margin-top:8px;display:inline-flex;align-items:center;justify-content:center;padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.22);color:#fff;font-weight:900;cursor:pointer}
      .vr-cos-action.is-owned{background:rgba(255,255,255,.10)}
      .vr-cos-action.is-equipped{background:rgba(138,197,95,.22);border-color:rgba(138,197,95,.55)}
      .vr-cos-note{text-align:center;color:rgba(255,255,255,.84);font-size:12px;margin-top:6px}
    `;
    document.head.appendChild(style);
  }

  function ensureCosmeticsRoot() {
    let root = $("cosmetics-block");
    if (root) return root;

    const storeStatus = $("store-status");
    const parent = storeStatus?.parentElement || $("view-shop") || document.body;
    root = document.createElement("div");
    root.id = "cosmetics-block";
    root.className = "vr-cosmetics";
    parent.appendChild(root);
    return root;
  }

  function getUniverse(universeId) {
    return COSMETICS_DATA.find((u) => u.id === universeId) || null;
  }

  function getItem(universeId, category, itemId) {
    const universe = getUniverse(universeId);
    const items = universe?.categories?.[category] || [];
    return items.find((item) => item.id === itemId) || null;
  }

  window.VRCosmeticsCatalog = {
    CATEGORY_KEYS,
    DATA: COSMETICS_DATA,
    getUniverse,
    getItem
  };

  function updateCarousel(row, index) {
    if (!row) return;
    const track = row.querySelector(".vr-cos-track");
    const slides = row.querySelectorAll(".vr-cos-slide");
    const dots = row.querySelectorAll(".vr-cos-dot");
    const prev = row.querySelector(".vr-cos-prev");
    const next = row.querySelector(".vr-cos-next");
    const total = slides.length;
    if (!track || !total) return;

    let safeIndex = Number(index) || 0;
    if (safeIndex < 0) safeIndex = 0;
    if (safeIndex > total - 1) safeIndex = total - 1;

    row.dataset.index = String(safeIndex);
    track.style.transform = `translateX(-${safeIndex * 100}%)`;

    dots.forEach((dot, i) => dot.classList.toggle("active", i === safeIndex));
    if (prev) prev.disabled = safeIndex <= 0;
    if (next) next.disabled = safeIndex >= total - 1;
  }

  function wireCarousels(root) {
    root.querySelectorAll(".vr-cos-row").forEach((row) => {
      updateCarousel(row, Number(row.dataset.index || 0));

      const prev = row.querySelector(".vr-cos-prev");
      const next = row.querySelector(".vr-cos-next");
      const viewport = row.querySelector(".vr-cos-viewport");

      if (prev) prev.onclick = () => updateCarousel(row, Number(row.dataset.index || 0) - 1);
      if (next) next.onclick = () => updateCarousel(row, Number(row.dataset.index || 0) + 1);

      if (viewport) {
        let startX = 0;
        let endX = 0;
        let touching = false;

        viewport.addEventListener("touchstart", (e) => {
          const t0 = e.changedTouches && e.changedTouches[0];
          if (!t0) return;
          touching = true;
          startX = t0.clientX;
          endX = t0.clientX;
        }, { passive: true });

        viewport.addEventListener("touchmove", (e) => {
          const t0 = e.changedTouches && e.changedTouches[0];
          if (!t0 || !touching) return;
          endX = t0.clientX;
        }, { passive: true });

        viewport.addEventListener("touchend", () => {
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
        owned,
        equipped,
        text: t("common.equipped", "Équipé"),
        className: "vr-cos-action is-equipped"
      };
    }
    if (owned) {
      return {
        owned,
        equipped,
        text: t("common.use", "Équiper"),
        className: "vr-cos-action is-owned"
      };
    }
    return {
      owned,
      equipped,
      text: `${t("common.buy", "Acheter")} · ${item.price}`,
      className: "vr-cos-action"
    };
  }

  function renderCosmetics() {
    const root = ensureCosmeticsRoot();
    if (!root) return;

    root.innerHTML = COSMETICS_DATA.map((universe) => `
      <section class="vr-universe-block" data-universe="${universe.id}">
        <h4 class="vr-universe-title">${t(universe.labelKey, universe.id)}</h4>

        ${["background", "message", "choice"].map((category) => {
          const items = (universe.categories[category] || []).map((it) => ({
            ...it,
            universeId: universe.id,
            category
          }));

          return `
            <div class="vr-cos-row" data-category="${category}" data-index="0">
              <div class="vr-cos-subtitle">${t(CATEGORY_KEYS[category], category)}</div>

              <div class="vr-cos-carousel">
                <button class="vr-cos-arrow vr-cos-prev" type="button" aria-label="${t("shop.carousel.prev", "Précédent")}">‹</button>

                <div class="vr-cos-viewport">
                  <div class="vr-cos-track">
                    ${items.map((item, index) => {
                      const action = getActionMeta(item);
                      return `
                        <div class="vr-cos-slide" data-index="${index}">
                          <div class="vr-cos-card ${item.kind === "ui" ? "is-ui" : ""}" data-item="${item.id}">
                            <img src="${item.img}" alt="" draggable="false">
                            <div class="vr-cos-overlay">
                              <div class="vr-cos-name">${t(item.nameKey, item.id)}</div>
                              <div class="vr-cos-bottom">
                                <div class="vr-cos-price">
                                  <img src="assets/img/ui/vcoins.webp" alt="" draggable="false">
                                  <span>${item.price}</span>
                                </div>
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
                              >${action.text}</button>
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
                ${items.map((_, index) => `<span class="vr-cos-dot${index === 0 ? " active" : ""}"></span>`).join("")}
              </div>
            </div>
          `;
        }).join("")}
      </section>
    `).join("");

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
          universeId,
          category,
          itemId,
          price
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

    const back = $("btn-back");
    const profile = $("btn-profile");

    if (back) {
      back.addEventListener("click", () => {
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
      profile.addEventListener("click", () => {
        location.href = "profile.html";
      });
    }

    setStatus("shop-status", "");
    setStatus("store-status", "");
    renderCosmetics();

    document.addEventListener("click", async (e) => {
      const btn = e.target && e.target.closest ? e.target.closest("[data-cosmetic-action]") : null;
      if (!btn) return;
      await handleCosmeticAction(btn);
    });

    window.addEventListener("vr:profile", () => {
      if (!isShopPage()) return;
      renderCosmetics();
    });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();