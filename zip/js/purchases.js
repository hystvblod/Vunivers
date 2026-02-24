/* global CdvPurchase */
(function () {
  "use strict";

  const TAG = "[IAP]";
  const DEBUG = true;

  const log = (...a) => { if (DEBUG) console.log(TAG, ...a); };
  const warn = (...a) => { if (DEBUG) console.warn(TAG, ...a); };

  function $(id) { return document.getElementById(id); }
  function setText(id, txt) { const el = $(id); if (el) el.textContent = String(txt || ""); }

  // -------------------------
  // Produits (IDs Play Console)
  // -------------------------
  const SKU = {
    vrealms_no_ads:     { kind: "noads" },
    vrealms_coins_300:  { kind: "vcoins", amount: 300 },
    vrealms_coins_500:  { kind: "vcoins", amount: 500 },
    vrealms_coins_3000: { kind: "vcoins", amount: 3000 },
    vrealms_jetons_5:   { kind: "jetons", amount: 5 },
    vrealms_jetons_12:  { kind: "jetons", amount: 12 },
    vrealms_jetons_50:  { kind: "jetons", amount: 50 }
  };

  // -------------------------
  // Etat local (anti double-credit + pending replay)
  // -------------------------
  const PRICES_BY_ID = Object.create(null);
  const IN_FLIGHT_TX = new Set();

  const PENDING_KEY  = "vrealms_iap_pending_v1";   // [{txId, productId, ts}]
  const CREDITED_KEY = "vrealms_iap_credited_v1";  // [txId]
  let STORE_READY = false;

  const readJson  = (k, d=[]) => { try { return JSON.parse(localStorage.getItem(k)||"null") ?? d; } catch { return d; } };
  const writeJson = (k, v)    => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  function addPending(txId, productId) {
    if (!txId) return;
    const L = readJson(PENDING_KEY, []);
    if (!L.find(x => x.txId === txId)) {
      L.push({ txId, productId, ts: Date.now() });
      writeJson(PENDING_KEY, L.slice(-60));
    }
  }
  function removePending(txId) {
    if (!txId) return;
    writeJson(PENDING_KEY, readJson(PENDING_KEY, []).filter(x => x.txId !== txId));
  }
  function isCredited(txId) {
    if (!txId) return false;
    const L = readJson(CREDITED_KEY, []);
    return L.includes(txId);
  }
  function markCredited(txId) {
    if (!txId) return;
    const L = readJson(CREDITED_KEY, []);
    if (!L.includes(txId)) {
      L.push(txId);
      writeJson(CREDITED_KEY, L.slice(-250));
    }
  }

  // -------------------------
  // Event helpers (AJOUT)
  // -------------------------
  function emit(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch (_) {}
  }

  // Expose API pour index (AJOUT)
  window.VRIAP = window.VRIAP || {};
  window.VRIAP.isAvailable = function () { return !!window.CdvPurchase?.store; };
  window.VRIAP.getPrice = function (productId) { return PRICES_BY_ID[String(productId || "")] || ""; };
  window.VRIAP.order = function (productId) { return safeOrder(productId); };

  // -------------------------
  // Auth "comme l'autre app" mais version VRealms
  // -> on s'appuie sur VRRemoteStore.ensureAuth / bootstrap
  // -------------------------
  async function ensureAuthStrict() {
    try {
      try { await window.vrWaitBootstrap?.(); } catch {}
      const uid = await window.VRRemoteStore?.ensureAuth?.();
      if (uid) return uid;

      // filet de sécurité
      const sb = window.sb;
      if (sb?.auth?.getUser) {
        const r = await sb.auth.getUser();
        return r?.data?.user?.id || null;
      }
    } catch {}
    return null;
  }

  // -------------------------
  // No Ads (RPCs VRealms)
  // -------------------------
  function sbReady() {
    return !!(window.sb && window.sb.auth && typeof window.sb.rpc === "function");
  }

  async function fetchNoAds() {
    try {
      if (!sbReady()) return false;
      await ensureAuthStrict();
      const r = await window.sb.rpc("secure_get_no_ads");
      if (r && !r.error) return (r.data === true);
    } catch {}
    return false;
  }

  async function setNoAds(value) {
    try {
      if (!sbReady()) return false;
      await ensureAuthStrict();
      const r = await window.sb.rpc("secure_set_no_ads", { p_no_ads: !!value });
      return !!(r && !r.error && r.data === true);
    } catch {}
    return false;
  }

  async function refreshNoAdsUI() {
    const noAds = await fetchNoAds();
    setText("noads-status", noAds ? "✅ No Pub : activé (interstitiels off)" : "ℹ️ No Pub : désactivé");
    return noAds;
  }

  // -------------------------
  // Credit DB (VRealms)
  // -> IMPORTANT: on crédite via RPCs existants (userData.js)
  // -------------------------
  async function creditByProductClientSide(productId, txId) {
    const cfg = SKU[productId];
    if (!cfg) throw new Error("unknown_sku");

    const uid = await ensureAuthStrict();
    if (!uid) throw new Error("no_session");

    if (cfg.kind === "vcoins") {
      const r = await window.VRRemoteStore?.addVcoins?.(cfg.amount);
      if (r === null || r === undefined) throw new Error("credit_vcoins_failed");
    } else if (cfg.kind === "jetons") {
      const r = await window.VRRemoteStore?.addJetons?.(cfg.amount);
      if (r === null || r === undefined) throw new Error("credit_jetons_failed");
    } else if (cfg.kind === "noads") {
      const ok = await setNoAds(true);
      if (!ok) throw new Error("set_noads_failed");
    } else {
      throw new Error("unknown_kind");
    }

    if (txId) markCredited(txId);

    // ✅ Event "crédit OK" (AJOUT)
    emit("vr:iap_credited", {
      productId: String(productId || ""),
      kind: String(cfg.kind || ""),
      amount: Number(cfg.amount || 0),
      txId: String(txId || "")
    });

    return true;
  }

  // -------------------------
  // Extract robust txId / productId
  // -------------------------
  function parseMaybeJson(x) {
    try {
      if (!x) return null;
      if (typeof x === "object") return x;
      return JSON.parse(x);
    } catch {
      return null;
    }
  }

  function getTxIdFromTx(tx) {
    try {
      const rec = tx?.transaction?.receipt || tx?.receipt;
      const r = typeof rec === "string" ? parseMaybeJson(rec) : rec;

      if (r?.payload) {
        const p = typeof r.payload === "string" ? parseMaybeJson(r.payload) : r.payload;
        if (p?.purchaseToken) return p.purchaseToken;
      }
    } catch {}

    return (
      tx?.purchaseToken ||
      tx?.androidPurchaseToken ||
      tx?.transactionId ||
      tx?.orderId ||
      tx?.id ||
      null
    );
  }

  function getProductIdFromTx(tx) {
    let pid =
      tx?.products?.[0]?.id ||
      tx?.productIds?.[0] ||
      tx?.productId ||
      tx?.sku ||
      tx?.transaction?.productId ||
      tx?.transaction?.lineItems?.[0]?.productId ||
      null;

    if (!pid) {
      const rec = tx?.transaction?.receipt || tx?.receipt;
      const r = typeof rec === "string" ? parseMaybeJson(rec) : rec;
      if (Array.isArray(r?.productIds) && r.productIds[0]) pid = r.productIds[0];
      else if (r?.productId) pid = r.productId;
      else if (r?.payload) {
        const p = typeof r.payload === "string" ? parseMaybeJson(r.payload) : r.payload;
        pid = p?.productId || (Array.isArray(p?.productIds) && p.productIds[0]) || pid;
      }
    }
    return pid || null;
  }

  // -------------------------
  // Prix Play Store -> DOM
  // -------------------------
  function updateDisplayedPrices() {
    try {
      document.querySelectorAll("[data-price-for]").forEach((node) => {
        const id = node.getAttribute("data-price-for");
        const price = PRICES_BY_ID[id];
        node.textContent = price ? `(${price})` : "";
      });
    } catch {}
  }

  window.refreshDisplayedPrices = function () {
    updateDisplayedPrices();
  };

  // -------------------------
  // Init store (CdvPurchase v13)
  // -------------------------
  function getStoreApi() {
    const S = window.CdvPurchase?.store;
    return { S };
  }

  async function replayLocalPending() {
    const pendings = readJson(PENDING_KEY, []);
    if (!pendings.length) return;

    for (const it of pendings) {
      if (!it?.txId || !it?.productId) continue;
      if (isCredited(it.txId)) {
        removePending(it.txId);
        continue;
      }
      try {
        await creditByProductClientSide(it.productId, it.txId);
        removePending(it.txId);
        setText("shop-status", "✅ Achat restauré");
      } catch (e) {
        warn("replay pending failed", it.productId, it.txId, e?.message || e);
      }
    }
  }

  async function start() {
    const { S } = getStoreApi();
    if (!S) {
      // pas en app => silence
      return;
    }

    await ensureAuthStrict();

    try {
      const P = window.CdvPurchase?.ProductType;
      S.register({ id: "vrealms_no_ads",     type: P.NON_CONSUMABLE, platform: S.Platform.GOOGLE_PLAY });
      S.register({ id: "vrealms_coins_300",  type: P.CONSUMABLE,     platform: S.Platform.GOOGLE_PLAY });
      S.register({ id: "vrealms_coins_500",  type: P.CONSUMABLE,     platform: S.Platform.GOOGLE_PLAY });
      S.register({ id: "vrealms_coins_3000", type: P.CONSUMABLE,     platform: S.Platform.GOOGLE_PLAY });
      S.register({ id: "vrealms_jetons_5",   type: P.CONSUMABLE,     platform: S.Platform.GOOGLE_PLAY });
      S.register({ id: "vrealms_jetons_12",  type: P.CONSUMABLE,     platform: S.Platform.GOOGLE_PLAY });
      S.register({ id: "vrealms_jetons_50",  type: P.CONSUMABLE,     platform: S.Platform.GOOGLE_PLAY });
    } catch (e) {
      warn("register failed", e?.message || e);
    }

    S.when()
      .productUpdated((p) => {
        try {
          const id = p?.id;
          const price = p?.pricing?.price || p?.pricing?.formattedPrice || null;
          if (id && price) {
            PRICES_BY_ID[id] = price;
            updateDisplayedPrices();

            // ✅ Event "prix dispo" (AJOUT)
            emit("vr:iap_price", { productId: String(id), price: String(price) });
          }
        } catch {}
      })

      .approved(async (tx) => {
        const txId = getTxIdFromTx(tx);
        const productId = getProductIdFromTx(tx);

        if (!productId) return;

        if (txId && (IN_FLIGHT_TX.has(txId) || isCredited(txId))) {
          try { await tx.finish(); } catch {}
          return;
        }

        if (txId) {
          IN_FLIGHT_TX.add(txId);
          addPending(txId, productId);
        }

        try {
          setText("shop-status", "…");
          await creditByProductClientSide(productId, txId);
          removePending(txId);
          setText("shop-status", "✅ Achat crédité");
        } catch (e) {
          setText("shop-status", "❌ Achat non crédité (sera retenté)");
          warn("credit failed", productId, txId, e?.message || e);

          // ✅ Event "crédit KO" (AJOUT)
          emit("vr:iap_credit_failed", {
            productId: String(productId || ""),
            txId: String(txId || ""),
            error: String(e?.message || e || "credit_failed")
          });

          if (txId) IN_FLIGHT_TX.delete(txId);
          return;
        }

        try { await tx.finish(); } catch (e) { warn("finish failed", e?.message || e); }
        if (txId) IN_FLIGHT_TX.delete(txId);

        try { window.VRAds?.refreshNoAds && (await window.VRAds.refreshNoAds()); } catch {}
        try { await refreshNoAdsUI(); } catch {}
      });

    try {
      await replayLocalPending();
    } catch {}

    try {
      await S.initialize([S.Platform.GOOGLE_PLAY]);
      await S.update();
      STORE_READY = true;
    } catch (e) {
      warn("store init/update failed", e?.message || e);
    }

    try { updateDisplayedPrices(); } catch {}
    try { await refreshNoAdsUI(); } catch {}
  }

  // -------------------------
  // UI wiring (boutons)
  // -------------------------
  function wireTopNav() {
    const bProfile = $("btn-profile");
    const bSettings = $("btn-settings");
    const bShop = $("btn-shop");

    if (bProfile) bProfile.addEventListener("click", () => { window.location.href = "profile.html"; });
    if (bSettings) bSettings.addEventListener("click", () => { window.location.href = "settings.html"; });
    if (bShop) bShop.addEventListener("click", () => { window.location.href = "shop.html"; });
  }

  async function doRewarded(placement) {
    try {
      if (!window.VRAds || typeof window.VRAds.showRewardedAd !== "function") {
        setText("shop-status", "Ad system not ready");
        return false;
      }
      setText("shop-status", "…");
      const ok = await window.VRAds.showRewardedAd({ placement: String(placement || "shop") });
      if (!ok) { setText("shop-status", "❌ Pub non validée"); return false; }

      setText("shop-status", "✅ Récompense validée");
      return true;
    } catch {
      setText("shop-status", "❌ Erreur rewarded");
      return false;
    }
  }

  async function safeOrder(productId) {
    const { S } = getStoreApi();
    if (!S) {
      setText("shop-status", "⚠️ IAP indisponible (web).");
      // ✅ Event pour index (AJOUT)
      emit("vr:iap_unavailable", { productId: String(productId || "") });
      return;
    }

    await ensureAuthStrict();

    if (!STORE_READY) {
      try { await S.update(); STORE_READY = true; } catch {}
    }

    const p = S.get ? S.get(productId, S.Platform.GOOGLE_PLAY) : (S.products?.byId?.[productId]);
    if (!p) {
      setText("shop-status", "⚠️ Produit introuvable: " + productId);
      emit("vr:iap_order_failed", { productId: String(productId || ""), error: "product_not_found" });
      return;
    }

    const offer = p.getOffer && p.getOffer();
    let err = null;
    if (offer?.order) err = await offer.order();
    else if (p?.order) err = await p.order();

    if (err?.isError) {
      warn("order err", err.code, err.message);
      emit("vr:iap_order_failed", { productId: String(productId || ""), error: String(err.message || err.code || "order_error") });
    }
  }

  function wireShopButtons() {
    const bRJ = $("btn-reward-jeton");
    const bRC = $("btn-reward-coins");
    const bNoAds = $("btn-buy-noads");

    const bC300 = $("btn-buy-coins-300");
    const bC500 = $("btn-buy-coins-500");
    const bC3000 = $("btn-buy-coins-3000");

    const bJ5 = $("btn-buy-jetons-5");
    const bJ12 = $("btn-buy-jetons-12");
    const bJ50 = $("btn-buy-jetons-50");

    if (bRJ) bRJ.addEventListener("click", () => doRewarded("shop_jeton"));
    if (bRC) bRC.addEventListener("click", () => doRewarded("shop_coins_300"));

    if (bNoAds) bNoAds.addEventListener("click", () => safeOrder("vrealms_no_ads"));

    if (bC300)  bC300.addEventListener("click", () => safeOrder("vrealms_coins_300"));
    if (bC500)  bC500.addEventListener("click", () => safeOrder("vrealms_coins_500"));
    if (bC3000) bC3000.addEventListener("click", () => safeOrder("vrealms_coins_3000"));

    if (bJ5)  bJ5.addEventListener("click", () => safeOrder("vrealms_jetons_5"));
    if (bJ12) bJ12.addEventListener("click", () => safeOrder("vrealms_jetons_12"));
    if (bJ50) bJ50.addEventListener("click", () => safeOrder("vrealms_jetons_50"));
  }

  window.restorePurchases = async function () {
    try {
      await replayLocalPending();
      const { S } = getStoreApi();
      if (S?.update) await S.update();
    } catch {}
  };

  window.safeOrder = safeOrder;
  window.buyProduct = safeOrder;

  function startWhenReady() {
    try { wireTopNav(); wireShopButtons(); } catch {}

    const fire = () => { start().catch((e) => warn("start failed", e?.message || e)); };

    const already =
      (window.cordova && (
        (window.cordova.deviceready && window.cordova.deviceready.fired) ||
        (window.channel && window.channel.onCordovaReady && window.channel.onCordovaReady.fired)
      )) ||
      window._cordovaReady === true;

    if (already) fire();
    else {
      document.addEventListener("deviceready", function () {
        window._cordovaReady = true;
        fire();
      }, { once: true });

      setTimeout(() => { if (window._cordovaReady) fire(); }, 1200);
      setTimeout(() => { try { updateDisplayedPrices(); } catch {} }, 1500);
    }

    refreshNoAdsUI().catch(() => {});
  }

  startWhenReady();

})();
