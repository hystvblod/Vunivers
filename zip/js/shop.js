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
    const ok = await (window.VRAds?.showRewardedAd?.({ placement: "shop_jeton" }) || Promise.resolve(false));
    if (!ok) return setStatus("Pub indisponible pour le moment.");

    try {
      await window.VUserData?.addJetons?.(1);
    } catch (_) {
      const u = window.VUserData.load();
      u.jetons = (u.jetons || 0) + 1;
      window.VUserData.save(u);
    }

    setStatus("+1 jeton ajouté ✅");
  }

  async function rewardCoins() {
    setStatus("");
    const ok = await (window.VRAds?.showRewardedAd?.({ placement: "shop_200_coins" }) || Promise.resolve(false));
    if (!ok) return setStatus("Pub indisponible pour le moment.");

    try {
      await window.VUserData?.addVcoins?.(200);
    } catch (_) {
      const u = window.VUserData.load();
      u.vcoins = (u.vcoins || 0) + 200;
      window.VUserData.save(u);
    }

    setStatus("+200 pièces ajoutées ✅");
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
