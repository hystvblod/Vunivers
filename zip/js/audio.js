// ===============================================
// VRealms - js/audio.js
// Version propre pour 1 seul fond par univers
// - Web Audio API
// - boucle interne avec loopStart / loopEnd
// - petit fade-in au lancement
// - duck léger pendant la mort
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

  // Réglages par univers pour éviter la cassure de boucle.
  // Ajuste ces valeurs à l’oreille si besoin.
  // start = point où la boucle redémarre
  // endTrim = combien on coupe avant la fin réelle du fichier
  const BG_LOOP_POINTS = {
    intro: { start: 0.20, endTrim: 0.25 },
    hell_king: { start: 0.35, endTrim: 0.40 },
    heaven_king: { start: 0.25, endTrim: 0.30 },
    mega_corp_ceo: { start: 0.18, endTrim: 0.22 },
    new_world_explorer: { start: 0.28, endTrim: 0.35 },
    vampire_lord: { start: 0.30, endTrim: 0.38 },
    western_president: { start: 0.20, endTrim: 0.25 }
  };

  const state = {
    unlocked: false,
    currentUniverse: null,

    musicEnabled: readBool("vrealms_music_enabled", true),
    sfxEnabled: readBool("vrealms_sfx_enabled", true),

    musicVolume: readNumber("vrealms_music_volume", 0.32),
    sfxVolume: readNumber("vrealms_sfx_volume", 0.82),

    ctx: null,
    masterGain: null,
    musicGain: null,
    sfxGain: null,

    bgSource: null,
    bgBuffer: null,
    bgUniverseId: null,
    bgAbortId: 0,

    decodedCache: Object.create(null)
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

  function getLoopPoints(universeId, duration) {
    const uid = resolveUniverseId(universeId);
    const cfg = BG_LOOP_POINTS[uid] || { start: 0.20, endTrim: 0.25 };

    const start = clamp(cfg.start, 0, Math.max(0, duration - 0.20));
    const end = clamp(duration - Math.max(0, cfg.endTrim), start + 0.10, duration);

    return { start, end };
  }

  function ensureAudioContext() {
    if (state.ctx) return state.ctx;

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;

    const ctx = new Ctx();
    const masterGain = ctx.createGain();
    const musicGain = ctx.createGain();
    const sfxGain = ctx.createGain();

    masterGain.gain.value = 1;
    musicGain.gain.value = state.musicEnabled ? state.musicVolume : 0;
    sfxGain.gain.value = state.sfxEnabled ? state.sfxVolume : 0;

    musicGain.connect(masterGain);
    sfxGain.connect(masterGain);
    masterGain.connect(ctx.destination);

    state.ctx = ctx;
    state.masterGain = masterGain;
    state.musicGain = musicGain;
    state.sfxGain = sfxGain;

    return ctx;
  }

  async function unlockAudio() {
    if (state.unlocked) return;
    const ctx = ensureAudioContext();
    if (!ctx) return;

    try {
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
    } catch (_) {}

    state.unlocked = true;

    if (state.currentUniverse && state.musicEnabled) {
      startUniverseBg(state.currentUniverse);
    }
  }

  function attachUnlockListeners() {
    const handler = () => { unlockAudio(); };

    try { document.addEventListener("pointerdown", handler, { passive: true, capture: true }); } catch (_) {}
    try { document.addEventListener("touchstart", handler, { passive: true, capture: true }); } catch (_) {}
    try { document.addEventListener("keydown", handler, { passive: true, capture: true }); } catch (_) {}
  }

  async function fetchDecodedBuffer(path) {
    const ctx = ensureAudioContext();
    if (!ctx || !path) return null;

    if (state.decodedCache[path]) {
      return state.decodedCache[path];
    }

    const res = await fetch(path);
    if (!res.ok) throw new Error("Audio fetch failed: " + path);

    const arr = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(arr.slice(0));

    state.decodedCache[path] = buf;
    return buf;
  }

  function stopBackground() {
    state.bgAbortId += 1;

    if (state.bgSource) {
      try { state.bgSource.stop(); } catch (_) {}
      try { state.bgSource.disconnect(); } catch (_) {}
    }

    state.bgSource = null;
    state.bgBuffer = null;
    state.bgUniverseId = null;
  }

  async function startUniverseBg(universeId) {
    state.currentUniverse = resolveUniverseId(universeId);

    stopBackground();

    if (!state.musicEnabled) return;
    if (!state.unlocked) return;

    const ctx = ensureAudioContext();
    if (!ctx) return;

    const cfg = getUniverseAudio(state.currentUniverse);
    const path = cfg?.bg || "";
    if (!path) return;

    const myAbortId = state.bgAbortId;

    try {
      const buffer = await fetchDecodedBuffer(path);
      if (!buffer) return;
      if (myAbortId !== state.bgAbortId) return;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const pts = getLoopPoints(state.currentUniverse, buffer.duration);
      source.loopStart = pts.start;
      source.loopEnd = pts.end;

      const entryGain = ctx.createGain();
      entryGain.gain.setValueAtTime(0, ctx.currentTime);

      source.connect(entryGain);
      entryGain.connect(state.musicGain);

      // On démarre au début du fichier pour garder une vraie intro,
      // puis les répétitions repartent entre loopStart et loopEnd.
      source.start(0, 0);

      entryGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.65);

      state.bgSource = source;
      state.bgBuffer = buffer;
      state.bgUniverseId = state.currentUniverse;
    } catch (_) {
      stopBackground();
    }
  }

  async function playOneShot(path, volume, kind = "sfx") {
    if (!path) return;

    const ctx = ensureAudioContext();
    if (!ctx) return;

    try {
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
    } catch (_) {}

    try {
      const buffer = await fetchDecodedBuffer(path);
      if (!buffer) return;

      const src = ctx.createBufferSource();
      src.buffer = buffer;

      const gain = ctx.createGain();
      gain.gain.value = clamp(volume, 0, 1);

      src.connect(gain);
      gain.connect(kind === "music" ? state.musicGain : state.sfxGain);

      src.start(0);
    } catch (_) {}
  }

  function duckBackground(ms = 1200, factor = 0.25) {
    const ctx = ensureAudioContext();
    if (!ctx || !state.musicGain) return;

    const now = ctx.currentTime;
    const current = state.musicEnabled ? state.musicVolume : 0;
    const ducked = current * clamp(factor, 0, 1);

    try {
      state.musicGain.gain.cancelScheduledValues(now);
      state.musicGain.gain.setValueAtTime(state.musicGain.gain.value, now);
      state.musicGain.gain.linearRampToValueAtTime(ducked, now + 0.08);
      state.musicGain.gain.linearRampToValueAtTime(current, now + ms / 1000);
    } catch (_) {}
  }

  function playChoice(universeId) {
    if (!state.sfxEnabled) return;

    const cfg = getUniverseAudio(universeId);
    const path = cfg?.choice || AUDIO_BANK.common.choice || "";
    playOneShot(path, state.sfxVolume, "sfx");
  }

  function playDeath() {
    if (!state.sfxEnabled) return;

    duckBackground(1200, 0.22);
    playOneShot(AUDIO_BANK.common.death, Math.min(1, state.sfxVolume + 0.08), "sfx");
  }

  function setMusicEnabled(enabled) {
    state.musicEnabled = !!enabled;
    writeBool("vrealms_music_enabled", state.musicEnabled);

    if (state.musicGain) {
      state.musicGain.gain.value = state.musicEnabled ? state.musicVolume : 0;
    }

    if (!state.musicEnabled) {
      stopBackground();
      return;
    }

    startUniverseBg(state.currentUniverse || localStorage.getItem("vrealms_universe") || "hell_king");
  }

  function setSfxEnabled(enabled) {
    state.sfxEnabled = !!enabled;
    writeBool("vrealms_sfx_enabled", state.sfxEnabled);

    if (state.sfxGain) {
      state.sfxGain.gain.value = state.sfxEnabled ? state.sfxVolume : 0;
    }
  }

  function setMusicVolume(value) {
    state.musicVolume = clamp(value, 0, 1);
    try { localStorage.setItem("vrealms_music_volume", String(state.musicVolume)); } catch (_) {}

    if (state.musicGain && state.musicEnabled) {
      state.musicGain.gain.value = state.musicVolume;
    }
  }

  function setSfxVolume(value) {
    state.sfxVolume = clamp(value, 0, 1);
    try { localStorage.setItem("vrealms_sfx_volume", String(state.sfxVolume)); } catch (_) {}

    if (state.sfxGain && state.sfxEnabled) {
      state.sfxGain.gain.value = state.sfxVolume;
    }
  }

  function init() {
    attachUnlockListeners();

    try {
      document.addEventListener("visibilitychange", async () => {
        const ctx = ensureAudioContext();
        if (!ctx) return;

        if (document.hidden) {
          try { await ctx.suspend(); } catch (_) {}
          return;
        }

        if (state.unlocked) {
          try { await ctx.resume(); } catch (_) {}
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
    }
  };
})();