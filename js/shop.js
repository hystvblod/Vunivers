// VRealms — shop.js
// ✅ Shop univers VCoins + badges locked/unlocked + modal
// ✅ 100% i18n (aucun texte visible en dur)

(function(){
  "use strict";

  function isShopPage(){
    try { return document.body && document.body.getAttribute("data-page") === "shop"; }
    catch { return false; }
  }
  if (!isShopPage()) return;

  const PRICE_VCOINS = 300;

  // =========================
  // i18n helper (compatible VRI18n / VCI18n)
  // =========================
  function getI18n(){
    return window.VRI18n || window.VCI18n || window.VRI18N || window.VCI18N || null;
  }

  function _asText(v, fallback){
    if (typeof v === "string") return v;
    if (typeof v === "number") return String(v);
    if (typeof v === "boolean") return v ? "1" : "0";
    return (typeof fallback === "string") ? fallback : "";
  }

  function t(key, vars){
    const k = String(key || "");
    const v = (vars && typeof vars === "object") ? vars : null;

    try{
      const i18n = getI18n();
      if (!i18n) return k;

      // signature la plus fréquente chez toi: t(key, fallback, vars)
      if (typeof i18n.t === "function"){
        const out = i18n.t(k, k, v || undefined);
        return _asText(out, k);
      }
      if (typeof i18n.get === "function"){
        const out = i18n.get(k, k, v || undefined);
        return _asText(out, k);
      }
      if (typeof i18n.translate === "function"){
        const out = i18n.translate(k, k, v || undefined);
        return _asText(out, k);
      }
      return k;
    }catch(_){
      return k;
    }
  }

  function applyI18nNow(){
    try{
      const i18n = getI18n();
      if (!i18n) return;
      if (typeof i18n.applyI18n === "function") i18n.applyI18n(document);
      if (typeof i18n.apply === "function") i18n.apply(document);
      if (typeof i18n.update === "function") i18n.update(document);
    }catch(_){}
  }

  async function ensureI18nReady(){
    try{
      const i18n = getI18n();
      if (!i18n) return;

      let lang = "";
      try{ lang = String(localStorage.getItem("vrealms_lang") || localStorage.getItem("vchoice_lang") || ""); }catch(_){ lang = ""; }
      if (!lang){
        try{ lang = String(window.VUserData?.getLang?.() || ""); }catch(_){ lang = ""; }
      }
      if (!lang) lang = "fr";

      if (typeof i18n.initI18n === "function"){
        await i18n.initI18n(lang);
        return;
      }
      if (typeof i18n.load === "function"){
        await i18n.load(lang);
        return;
      }
    }catch(_){}
  }

  // =========================
  // DOM helpers
  // =========================
  function $(sel, root){ return (root || document).querySelector(sel); }
  function $all(sel, root){ return Array.from((root || document).querySelectorAll(sel)); }

  function setStatus(key, vars){
    const el = $("#shop-universe-status") || $("#shop-status");
    if (!el) return;
    el.textContent = key ? t(key, vars) : "";
  }

  // =========================
  // Universe helpers
  // =========================
  function ensureBadge(card){
    const content = card ? card.querySelector(".vr-card-content") : null;
    if (!content) return null;

    let badge = content.querySelector(".vr-universe-badge");
    if (!badge){
      badge = document.createElement("div");
      badge.className = "vr-universe-badge";
      badge.setAttribute("aria-hidden", "true");
      content.appendChild(badge);
    }
    return badge;
  }

  function isFreeUniverse(id){
    return id === "hell_king" || id === "heaven_king";
  }

  function getUnlockedSet(){
    try{
      const arr = window.VUserData?.getUnlockedUniverses?.();
      if (Array.isArray(arr) && arr.length) return new Set(arr.map(String));
    }catch(_){}
    // fallback minimal (gratuit)
    return new Set(["hell_king", "heaven_king"]);
  }

  function applyUniverseUI(){
    const grid = $("#shop-universe-grid");
    if (!grid) return;

    const unlocked = getUnlockedSet();

    $all('.vr-card[data-universe]', grid).forEach((card) => {
      const id = String(card.getAttribute("data-universe") || "");
      if (!id) return;

      const ok = isFreeUniverse(id) || unlocked.has(id);

      const badge = ensureBadge(card);

      if (ok){
        card.classList.remove("vr-card-locked");
        if (badge){
          badge.className = "vr-universe-badge unlocked";
          badge.textContent = t("shop.universe_badge_unlocked");
        }
      }else{
        card.classList.add("vr-card-locked");
        if (badge){
          badge.className = "vr-universe-badge locked";
          badge.textContent = t("shop.universe_badge_locked", { price: PRICE_VCOINS });
        }
      }
    });
  }

  function launchUniverse(universeId){
    // on garde ta clé legacy + possibilité d’extension
    try{ localStorage.setItem("vrealms_universe", String(universeId)); }catch(_){}
    window.location.href = "game.html";
  }

  // =========================
  // Modal univers (unlock)
  // =========================
  const modal = $("#universeModal");
  const modalIcon = $("#universeModalIcon");
  const modalTitle = $("#universeModalTitle");
  const modalDesc = $("#universeModalDesc");
  const modalPrice = $("#universeModalPrice");
  const modalBuy = $("#universeModalBuy");
  const modalCancel = $("#universeModalCancel");

  let _openUniverseId = "";

  function _lockScroll(on){
    try{
      document.documentElement.classList.toggle("shop-modal-open", !!on);
      document.body.classList.toggle("shop-modal-open", !!on);
    }catch(_){}
  }

  function closeModal(){
    if (!modal) return;
    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("is-open");
    _openUniverseId = "";
    _lockScroll(false);
    try{ if (modalBuy) modalBuy.disabled = false; }catch(_){}
  }

  function openModalForUniverse(universeId){
    if (!modal) return;
    const id = String(universeId || "");
    if (!id) return;

    _openUniverseId = id;

    // titre/desc: on réutilise tes keys universe.<id>.title/desc
    if (modalTitle) modalTitle.textContent = t("universe." + id + ".title");
    if (modalDesc)  modalDesc.textContent  = t("universe." + id + ".desc");

    // prix
    if (modalPrice) modalPrice.textContent = t("shop.modal_price_vcoins", { price: PRICE_VCOINS });

    // icône
    if (modalIcon){
      // si tu veux une icône unique : laisse vcoin.webp
      modalIcon.src = "assets/img/ui/vcoin.webp";
    }

    if (modalBuy){
      modalBuy.setAttribute("data-universe-buy", id);
      modalBuy.disabled = false;
    }

    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("is-open");
    _lockScroll(true);
  }

  if (modal){
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }
  if (modalCancel){
    modalCancel.addEventListener("click", (e) => {
      e.preventDefault();
      closeModal();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && modal.classList.contains("is-open")) closeModal();
  });

  async function buyUniverse(universeId, btn){
    const id = String(universeId || "");
    if (!id) return;

    try{
      setStatus("", null);

      // récup profil local (cache) pour le check immédiat
      const user = window.VUserData?.load?.() || {};
      const v = Number(user.vcoins || 0);

      if (v < PRICE_VCOINS){
        setStatus("shop.msg_not_enough_vcoins", { have: v, price: PRICE_VCOINS });
        return;
      }

      if (btn) btn.disabled = true;
      setStatus("shop.msg_unlocking", null);

      const res = await window.VUserData?.unlockUniverse?.(id);

      if (!res?.ok){
        const r = String(res?.reason || "");
        if (r.includes("insufficient_vcoins")) setStatus("shop.msg_not_enough_vcoins_short", null);
        else if (r.includes("universe_not_for_sale")) setStatus("shop.msg_universe_not_for_sale", null);
        else setStatus("shop.msg_unlock_error", { reason: r || "unlock_failed" });
        return;
      }

      setStatus("shop.msg_unlocked_success", null);

      // refresh UI
      try{ await window.VUserData?.refresh?.(); }catch(_){}
      applyUniverseUI();

      // auto-launch
      closeModal();
      launchUniverse(id);
    }catch(_){
      setStatus("shop.msg_unlock_error", { reason: "unlock_failed" });
    }finally{
      try{ if (btn) btn.disabled = false; }catch(_){}
    }
  }

  // =========================
  // Boot
  // =========================
  async function boot(){
    const grid = $("#shop-universe-grid");
    if (!grid) return;

    try{ await window.vrWaitBootstrap?.(); }catch(_){}
    try{ await window.VUserData?.init?.(); }catch(_){}
    try{ await window.VUserData?.refresh?.(); }catch(_){}

    await ensureI18nReady();
    applyI18nNow();

    applyUniverseUI();

    // Focus demandé depuis index
    try{
      const focus = localStorage.getItem("vrealms_shop_focus_universe");
      if (focus){
        localStorage.removeItem("vrealms_shop_focus_universe");
        const card = grid.querySelector('.vr-card[data-universe="' + focus + '"]');
        if (card){
          card.scrollIntoView({ behavior: "smooth", block: "center" });
          card.style.outline = "2px solid rgba(255,255,255,.45)";
          setTimeout(() => { try{ card.style.outline = ""; }catch(_){ } }, 1400);
        }
      }
    }catch(_){}

    // Click univers cards
    grid.addEventListener("click", (e) => {
      const card = e.target && e.target.closest ? e.target.closest(".vr-card[data-universe]") : null;
      if (!card) return;

      const id = String(card.getAttribute("data-universe") || "");
      if (!id) return;

      const unlocked = isFreeUniverse(id) || !!window.VUserData?.isUniverseUnlocked?.(id);

      if (unlocked){
        launchUniverse(id);
      }else{
        openModalForUniverse(id);
      }
    });

    // Modal buy
    document.addEventListener("click", (e) => {
      const buyBtn = e.target && e.target.closest ? e.target.closest("[data-universe-buy]") : null;
      if (!buyBtn) return;

      const id = String(buyBtn.getAttribute("data-universe-buy") || "");
      if (!id) return;

      buyUniverse(id, buyBtn);
    });

    // Si profil/coins changent (si ton userData émet un event)
    window.addEventListener("vr:profile", () => {
      applyUniverseUI();
    });

    // si tu as un event custom après achat VCoins / rewarded
    window.addEventListener("vr:vcoins_updated", () => {
      applyUniverseUI();
    });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();