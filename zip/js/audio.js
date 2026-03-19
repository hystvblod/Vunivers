// ===============================================
// VRealms - js/audio.js
// Version fiable pour fond musical auto au chargement d'un univers
// - BGM via HTMLAudioElement
// - pas de verrou par interaction
// - SFX simples
// ===============================================
(function () {
  "use strict";

  const AUDIO_BANK = {
    common: {
      death: "assets/audio/common/death_common.m4a",
      choice: "assets/audio/common/choice_common.m4a"
    },

    universes: {
      intro: {
        bg: "assets/audio/universes/intro/bg_loop.m4a",
        choice: "assets/audio/universes/intro/choice.m4a"
      },
      hell_king: {
        bg: "assets/audio/universes/hell_king/bg_loop.m4a",
        choice: "assets/audio/universes/hell_king/choice.m4a"
      },
      heaven_king: {
        bg: "assets/audio/universes/heaven_king/bg_loop.m4a",
        choice: "assets/audio/universes/heaven_king/choice.m4a"
      },
      mega_corp_ceo: {
        bg: "assets/audio/universes/mega_corp_ceo/bg_loop.m4a",
        choice: "assets/audio/universes/mega_corp_ceo/choice.m4a"
      },
      new_world_explorer: {
        bg: "assets/audio/universes/new_world_explorer/bg_loop.m4a",
        choice: "assets/audio/universes/new_world_explorer/choice.m4a"
      },
      vampire_lord: {
        bg: "assets/audio/universes/vampire_lord/bg_loop.m4a",
        choice: "assets/audio/universes/vampire_lord/choice.m4a"
      },
      western_president: {
        bg: "assets/audio/universes/western_president/bg_loop.m4a",
        choice: "assets/audio/universes/western_president/choice.m4a"
      }
    }
  };

  const state = {
    currentUniverse: null,
    bg: null,
    bgPath: "",
    pendingBgRetry: false,

    musicEnabled: readBool("vrealms_music_enabled", true),
    sfxEnabled: readBool("vrealms_sfx_enabled", true),

    musicVolume: readNumber("vrealms_music_volume", 0.32),
    sfxVolume: readNumber("vrealms_sfx_volume", 0.82)
  };

  function clamp(v, min, max) {
    const n = Number(v);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function readBool(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return !!fallback;
      return raw === "1";
    } catch (_) {
      return !!fallback;
    }
  }

  function writeBool(key, value) {
    try { localStorage.setItem(key, value ? "1" : "0"); } catch (_) {}
  }

  function readNumber(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      const n = Number(raw);
      return Number.isFinite(n) ? n : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function resolveUniverseId(universeId) {
    const id = String(
      universeId ||
      state.currentUniverse ||
      document.body?.dataset?.universe ||
      localStorage.getItem("vrealms_universe") ||
      "hell_king"
    ).trim();

    return id || "hell_king";
  }

  function getUniverseAudio(universeId) {
    return AUDIO_BANK.universes[resolveUniverseId(universeId)] || null;
  }

  function ensureBg() {
    if (state.bg) return state.bg;

    let a = document.getElementById("vr-bg-music");
    if (!a) {
      a = document.createElement("audio");
      a.id = "vr-bg-music";
      a.hidden = true;
      document.body.appendChild(a);
    }

    a.preload = "auto";
    a.loop = true;
    a.autoplay = false;
    a.playsInline = true;
    a.setAttribute("playsinline", "");
    a.setAttribute("webkit-playsinline", "");

    a.addEventListener("canplay", () => {
      if (state.pendingBgRetry && state.musicEnabled && !document.hidden) {
        tryPlayBg();
      }
    });

    a.addEventListener("loadeddata", () => {
      if (state.pendingBgRetry && state.musicEnabled && !document.hidden) {
        tryPlayBg();
      }
    });

    state.bg = a;
    state.bg.volume = state.musicEnabled ? state.musicVolume : 0;

    return a;
  }

  async function tryPlayBg() {
    const a = ensureBg();
    if (!state.musicEnabled) return;
    if (!a.src) return;

    a.volume = clamp(state.musicVolume, 0, 1);

    try {
      const p = a.play();
      if (p && typeof p.then === "function") {
        await p;
      }
      state.pendingBgRetry = false;
    } catch (err) {
      state.pendingBgRetry = true;
      console.warn("[VRAudio] autoplay bg bloqué :", err);
    }
  }

  function stopBackground() {
    const a = ensureBg();
    state.pendingBgRetry = false;

    try { a.pause(); } catch (_) {}
    try { a.currentTime = 0; } catch (_) {}
  }

  async function startUniverseBg(universeId, opts = {}) {
    const { forceRestart = false } = opts || {};

    state.currentUniverse = resolveUniverseId(universeId);

    if (!state.musicEnabled) {
      stopBackground();
      return;
    }

    const cfg = getUniverseAudio(state.currentUniverse);
    const path = cfg?.bg || "";
    if (!path) {
      stopBackground();
      return;
    }

    const a = ensureBg();
    const absolute = new URL(path, document.baseURI).href;

    if (!forceRestart && state.bgPath === absolute && !a.paused) {
      a.volume = clamp(state.musicVolume, 0, 1);
      return;
    }

    if (state.bgPath !== absolute) {
      try { a.pause(); } catch (_) {}
      a.src = path;
      a.load();
      state.bgPath = absolute;
    }

    a.volume = clamp(state.musicVolume, 0, 1);
    await tryPlayBg();
  }

  function playPath(path, volume) {
    if (!path) return;

    try {
      const a = new Audio(path);
      a.preload = "auto";
      a.playsInline = true;
      a.volume = clamp(volume, 0, 1);
      const p = a.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (_) {}
  }

  function duckBackground(ms = 1200, factor = 0.22) {
    const a = ensureBg();
    if (!state.musicEnabled) return;
    if (!a || !a.src) return;

    const base = clamp(state.musicVolume, 0, 1);
    const ducked = clamp(base * factor, 0, 1);

    a.volume = ducked;

    window.setTimeout(() => {
      try {
        if (state.musicEnabled) a.volume = base;
      } catch (_) {}
    }, ms);
  }

  function playChoice(universeId) {
    if (!state.sfxEnabled) return;

    const cfg = getUniverseAudio(universeId);
    const path = cfg?.choice || AUDIO_BANK.common.choice || "";
    playPath(path, state.sfxVolume);
  }

  function playDeath() {
    if (!state.sfxEnabled) return;

    duckBackground(1200, 0.22);
    playPath(AUDIO_BANK.common.death, Math.min(1, state.sfxVolume + 0.08));
  }

  function setMusicEnabled(enabled) {
    state.musicEnabled = !!enabled;
    writeBool("vrealms_music_enabled", state.musicEnabled);

    const a = ensureBg();

    if (!state.musicEnabled) {
      try { a.pause(); } catch (_) {}
      a.volume = 0;
      return;
    }

    a.volume = clamp(state.musicVolume, 0, 1);
    startUniverseBg(state.currentUniverse || localStorage.getItem("vrealms_universe") || "hell_king");
  }

  function setSfxEnabled(enabled) {
    state.sfxEnabled = !!enabled;
    writeBool("vrealms_sfx_enabled", state.sfxEnabled);
  }

  function setMusicVolume(value) {
    state.musicVolume = clamp(value, 0, 1);
    try { localStorage.setItem("vrealms_music_volume", String(state.musicVolume)); } catch (_) {}

    const a = ensureBg();
    if (state.musicEnabled) {
      a.volume = state.musicVolume;
    }
  }

  function setSfxVolume(value) {
    state.sfxVolume = clamp(value, 0, 1);
    try { localStorage.setItem("vrealms_sfx_volume", String(state.sfxVolume)); } catch (_) {}
  }

  function init() {
    ensureBg();

    window.addEventListener("pageshow", () => {
      if (state.musicEnabled && !document.hidden) {
        tryPlayBg();
      }
    });

    document.addEventListener("visibilitychange", () => {
      const a = ensureBg();

      if (document.hidden) {
        try { a.pause(); } catch (_) {}
        return;
      }

      if (state.musicEnabled) {
        tryPlayBg();
      }
    });
  }

  init();

  window.VRAudio = {
    onUniverseSelected(universeId) {
      state.currentUniverse = resolveUniverseId(universeId);
      startUniverseBg(state.currentUniverse);
    },

    startUniverseBg,
    stopBackground,

    playChoice(universeId) {
      playChoice(universeId);
    },

    playDeath() {
      playDeath();
    },

    setMusicEnabled,
    setSfxEnabled,
    setMusicVolume,
    setSfxVolume,

    isMusicEnabled() {
      return !!state.musicEnabled;
    },

    isSfxEnabled() {
      return !!state.sfxEnabled;
    }
  };
})();