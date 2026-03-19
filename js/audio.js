// ===============================================
// VRealms - js/audio.js
// Gestion centralisée musique + SFX
// - musique de fond par univers
// - son commun de mort
// - son de choix commun avec override par univers
// - reprise auto après 1re interaction utilisateur
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
    unlocked: false,
    currentUniverse: null,
    bgAudio: null,
    bgPath: "",
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

  function safePlay(audio) {
    if (!audio) return;
    try {
      const p = audio.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (_) {}
  }

  function makeOneShot(path, volume) {
    if (!path) return null;
    try {
      const a = new Audio(path);
      a.preload = "auto";
      a.volume = clamp(volume, 0, 1);
      a.playsInline = true;
      return a;
    } catch (_) {
      return null;
    }
  }

  function unlockAudio() {
    if (state.unlocked) return;
    state.unlocked = true;

    if (state.currentUniverse && state.musicEnabled) {
      startUniverseBg(state.currentUniverse);
    }
  }

  function attachUnlockListeners() {
    const unlock = () => unlockAudio();

    try { document.addEventListener("pointerdown", unlock, { passive: true, capture: true }); } catch (_) {}
    try { document.addEventListener("touchstart", unlock, { passive: true, capture: true }); } catch (_) {}
    try { document.addEventListener("keydown", unlock, { passive: true, capture: true }); } catch (_) {}
  }

  function stopBackground() {
    try {
      if (state.bgAudio) {
        state.bgAudio.pause();
        state.bgAudio.currentTime = 0;
      }
    } catch (_) {}

    state.bgAudio = null;
    state.bgPath = "";
  }

  function startUniverseBg(universeId) {
    state.currentUniverse = resolveUniverseId(universeId);

    if (!state.musicEnabled) {
      stopBackground();
      return;
    }

    if (!state.unlocked) return;

    const cfg = getUniverseAudio(state.currentUniverse);
    const path = cfg?.bg || "";

    if (!path) {
      stopBackground();
      return;
    }

    if (state.bgAudio && state.bgPath === path) {
      state.bgAudio.volume = clamp(state.musicVolume, 0, 1);
      safePlay(state.bgAudio);
      return;
    }

    stopBackground();

    try {
      const a = new Audio(path);
      a.preload = "auto";
      a.loop = true;
      a.volume = clamp(state.musicVolume, 0, 1);
      a.playsInline = true;
      state.bgAudio = a;
      state.bgPath = path;
      safePlay(a);
    } catch (_) {
      stopBackground();
    }
  }

  function duckBackground(ms = 900, factor = 0.35) {
    try {
      if (!state.bgAudio) return;
      const base = clamp(state.musicVolume, 0, 1);
      state.bgAudio.volume = clamp(base * factor, 0, 1);

      window.setTimeout(() => {
        try {
          if (state.bgAudio) state.bgAudio.volume = base;
        } catch (_) {}
      }, ms);
    } catch (_) {}
  }

  function playChoice(universeId) {
    if (!state.sfxEnabled) return;

    const cfg = getUniverseAudio(universeId);
    const path = cfg?.choice || AUDIO_BANK.common.choice || "";

    const shot = makeOneShot(path, state.sfxVolume);
    if (!shot) return;
    safePlay(shot);
  }

  function playDeath() {
    if (!state.sfxEnabled) return;

    duckBackground(1000, 0.25);

    const shot = makeOneShot(AUDIO_BANK.common.death, Math.min(1, state.sfxVolume + 0.08));
    if (!shot) return;
    safePlay(shot);
  }

  function setMusicEnabled(enabled) {
    state.musicEnabled = !!enabled;
    writeBool("vrealms_music_enabled", state.musicEnabled);

    if (!state.musicEnabled) {
      stopBackground();
      return;
    }

    startUniverseBg(state.currentUniverse || localStorage.getItem("vrealms_universe") || "hell_king");
  }

  function setSfxEnabled(enabled) {
    state.sfxEnabled = !!enabled;
    writeBool("vrealms_sfx_enabled", state.sfxEnabled);
  }

  function setMusicVolume(value) {
    state.musicVolume = clamp(value, 0, 1);
    try { localStorage.setItem("vrealms_music_volume", String(state.musicVolume)); } catch (_) {}
    try {
      if (state.bgAudio) state.bgAudio.volume = state.musicVolume;
    } catch (_) {}
  }

  function setSfxVolume(value) {
    state.sfxVolume = clamp(value, 0, 1);
    try { localStorage.setItem("vrealms_sfx_volume", String(state.sfxVolume)); } catch (_) {}
  }

  function init() {
    attachUnlockListeners();

    try {
      document.addEventListener("visibilitychange", () => {
        if (!state.bgAudio) return;

        if (document.hidden) {
          try { state.bgAudio.pause(); } catch (_) {}
          return;
        }

        if (state.musicEnabled && state.unlocked) {
          safePlay(state.bgAudio);
        }
      });
    } catch (_) {}
  }

  init();

  window.VRAudio = {
    onUniverseSelected(universeId) {
      state.currentUniverse = resolveUniverseId(universeId);
      startUniverseBg(state.currentUniverse);
    },

    playChoice(universeId) {
      playChoice(universeId);
    },

    playDeath() {
      playDeath();
    },

    stopBackground,
    startUniverseBg,
    setMusicEnabled,
    setSfxEnabled,
    setMusicVolume,
    setSfxVolume,

    isMusicEnabled() {
      return !!state.musicEnabled;
    },

    isSfxEnabled() {
      return !!state.sfxEnabled;
    },

    _bank: AUDIO_BANK
  };
})();
