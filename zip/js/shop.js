// VRealms - shop.js
// Boutique d'univers : affiche locked/unlocked + achat 300 VCoins via RPC secure_unlock_universe

(function () {
  "use strict";

  const PRICE_VCOINS = 300;

  function $(id) { return document.getElementById(id); }

  function setStatus(msg) {
    const el = $("shop-universe-status") || $("shop-status");
    if (el) el.textContent = msg || "";
  }

  function ensureBadge(card) {
    const content = card.querySelector(".vr-card-content");
    if (!content) return null;
    let badge = content.querySelector(".vr-universe-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "vr-universe-badge";
      badge.setAttribute("aria-hidden", "true");
      content.appendChild(badge);
    }
    return badge;
  }

  function getUnlockedSet() {
    try {
      const arr = window.VUserData?.getUnlockedUniverses?.();
      if (Array.isArray(arr) && arr.length) return new Set(arr.map(String));
    } catch (_) {}
    return new Set(["hell_king", "heaven_king"]);
  }

  function applyUniverseUI() {
    const grid = document.getElementById("shop-universe-grid");
    if (!grid) return;

    const unlocked = getUnlockedSet();

    grid.querySelectorAll(".vr-card[data-universe]").forEach((card) => {
      const id = card.getAttribute("data-universe");
      if (!id) return;

      const badge = ensureBadge(card);
      const ok = unlocked.has(id) || id === "hell_king" || id === "heaven_king";

      if (ok) {
        card.classList.remove("vr-card-locked");
        if (badge) {
          badge.className = "vr-universe-badge unlocked";
          badge.textContent = "✓ Débloqué";
        }
      } else {
        card.classList.add("vr-card-locked");
        if (badge) {
          badge.className = "vr-universe-badge locked";
          badge.textContent = "🔒 " + PRICE_VCOINS + " VCoins";
        }
      }
    });
  }

  function launchUniverse(universeId) {
    localStorage.setItem("vrealms_universe", universeId);
    window.location.href = "game.html";
  }

  async function buyUniverse(universeId) {
    setStatus("");

    const user = window.VUserData?.load?.() || {};
    const v = Number(user.vcoins || 0);

    if (v < PRICE_VCOINS) {
      setStatus("Pas assez de VCoins (" + v + "/" + PRICE_VCOINS + ").");
      return;
    }

    const ok = confirm("Débloquer cet univers pour " + PRICE_VCOINS + " VCoins ?");
    if (!ok) return;

    setStatus("Déblocage en cours…");

    const res = await window.VUserData?.unlockUniverse?.(universeId);

    if (!res?.ok) {
      const r = (res?.reason || "").toString();
      if (r.includes("insufficient_vcoins")) setStatus("Pas assez de VCoins.");
      else if (r.includes("universe_not_for_sale")) setStatus("Univers non disponible.");
      else setStatus("Erreur : " + (res?.reason || "unlock_failed"));
      return;
    }

    setStatus("✅ Univers débloqué !");
    applyUniverseUI();
  }

  async function boot() {
    const grid = document.getElementById("shop-universe-grid");
    if (!grid) return; // shop.js est chargé aussi sur index, donc on évite de faire n’importe quoi

    try { await window.vrWaitBootstrap?.(); } catch (_) {}
    try { await window.VUserData?.init?.(); } catch (_) {}
    try { await window.VUserData?.refresh?.(); } catch (_) {}

    applyUniverseUI();

    // Si index a demandé un focus sur un univers verrouillé
    const focus = localStorage.getItem("vrealms_shop_focus_universe");
    if (focus) {
      localStorage.removeItem("vrealms_shop_focus_universe");
      const card = grid.querySelector('.vr-card[data-universe="' + focus + '"]');
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.style.outline = "2px solid rgba(255,255,255,.45)";
        setTimeout(() => { try { card.style.outline = ""; } catch (_) {} }, 1400);
      }
    }

    // Click cards
    grid.addEventListener("click", async (e) => {
      const card = e.target.closest(".vr-card[data-universe]");
      if (!card) return;

      const id = card.getAttribute("data-universe");
      if (!id) return;

      const unlocked = window.VUserData?.isUniverseUnlocked?.(id) || id === "hell_king" || id === "heaven_king";

      if (unlocked) {
        launchUniverse(id);
      } else {
        await buyUniverse(id);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
