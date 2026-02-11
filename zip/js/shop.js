// VRealms - shop.js
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  function setStatus(msg) {
    const el = $("shop-status");
    if (el) el.textContent = msg || "";
  }

  async function rewardJeton() {
    setStatus("");

    // 1) Affiche la pub (côté client)
    const ok = await (window.VRAds?.showRewardedAd?.({ placement: "shop_jeton" }) || Promise.resolve(false));
    if (!ok) return setStatus("Pub indisponible pour le moment.");

    // 2) Crédit = serveur (anti-triche / quotas / mapping DB)
    try {
      if (!window.VUserData?.claimReward) {
        // fallback strict: on ne crédite rien si claimReward n'existe pas
        // (sinon triche possible)
        await window.VUserData?.refresh?.().catch(() => false);
        return setStatus("Mise à jour impossible (client non prêt).");
      }

      const res = await window.VUserData.claimReward("shop_jeton");
      if (!res) {
        await window.VUserData?.refresh?.().catch(() => false);
        return setStatus("Erreur lors de la validation de la récompense.");
      }

      if (res.limited) {
        return setStatus("Limite journalière atteinte pour cette récompense.");
      }

      setStatus("+1 jeton ajouté ✅");
    } catch (_) {
      await window.VUserData?.refresh?.().catch(() => false);
      setStatus("Erreur lors de la validation de la récompense.");
    }
  }

  async function rewardCoins() {
    setStatus("");

    // 1) Affiche la pub (côté client)
    const ok = await (window.VRAds?.showRewardedAd?.({ placement: "shop_200_coins" }) || Promise.resolve(false));
    if (!ok) return setStatus("Pub indisponible pour le moment.");

    // 2) Crédit = serveur (anti-triche / quotas / mapping DB)
    try {
      if (!window.VUserData?.claimReward) {
        await window.VUserData?.refresh?.().catch(() => false);
        return setStatus("Mise à jour impossible (client non prêt).");
      }

      const res = await window.VUserData.claimReward("shop_200_coins");
      if (!res) {
        await window.VUserData?.refresh?.().catch(() => false);
        return setStatus("Erreur lors de la validation de la récompense.");
      }

      if (res.limited) {
        return setStatus("Limite journalière atteinte pour cette récompense.");
      }

      setStatus("+200 pièces ajoutées ✅");
    } catch (_) {
      await window.VUserData?.refresh?.().catch(() => false);
      setStatus("Erreur lors de la validation de la récompense.");
    }
  }

  function wireNav() {
    const p = $("btn-profile");
    const s = $("btn-settings");
    const sh = $("btn-shop");

    if (p) p.onclick = () => (window.location.href = "profile.html");
    if (s) s.onclick = () => (window.location.href = "settings.html");
    if (sh) sh.onclick = () => (window.location.href = "shop.html");
  }

  function init() {
    wireNav();

    const b1 = $("btn-reward-jeton");
    const b2 = $("btn-reward-coins");

    if (b1) b1.onclick = rewardJeton;
    if (b2) b2.onclick = rewardCoins;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
