(function () {
  "use strict";

  const REFERRAL_URL = "https://vuniverse.app";

  function t(key, fallback) {
    try {
      return window.VRI18n?.t?.(key, fallback) || fallback || "";
    } catch (_) {
      return fallback || "";
    }
  }

  async function copyText(value) {
    if (!value) return false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (_) {}

    try {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return !!ok;
    } catch (_) {
      return false;
    }
  }

  async function shareInvite() {
    const url = REFERRAL_URL;
    const title = t("referral.share_title", "Invite a friend");
    const textTpl = t("referral.share_text", "Download VUniverse here: {url}");
    const text = textTpl.replace("{url}", url);

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
    } catch (_) {}

    const copied = await copyText(url);
    if (copied) {
      try { alert(t("referral.link_copied", "Link copied")); } catch (_) {}
    }
  }

  function bindInviteButtons() {
    const ids = ["pf_invite_btn", "cp_invite_btn"];

    ids.forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn || btn.dataset.referralBound === "1") return;

      btn.dataset.referralBound = "1";
      btn.addEventListener("click", async () => {
        await shareInvite();
      });
    });
  }

  function bootReferral() {
    bindInviteButtons();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootReferral, { once: true });
  } else {
    bootReferral();
  }

  window.addEventListener("vr:i18n:changed", () => {
    bindInviteButtons();
  });
})();
