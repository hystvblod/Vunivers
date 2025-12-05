// VRealms - engine/state.js
// Gère l'état de la partie : jauges, univers, vie/mort.

(function () {
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

  const VRState = {
    universeId: null,
    gauges: {},     // ex: { souls: 50, legions: 50, order: 50, surface: 50 }
    gaugeOrder: [], // ex: ["souls", "legions", "order", "surface"]
    alive: false,
    lastDeath: null,
    reignYears: 0,
cardsPlayed: 0,



    initFromConfig(universeId, config) {
      
      this.universeId = universeId;
      this.gauges = { ...(config.initialGauges || {}) };
      this.gaugeOrder = (config.gauges || []).map((g) => g.id);
      this.alive = true;
    },
applyGaugeDelta(deltaMap) {
  if (!this.alive) return;

  Object.entries(deltaMap || {}).forEach(([gaugeId, delta]) => {
    const current = this.gauges[gaugeId] ?? 50;
    const next = clamp(current + delta, 0, 100);
    this.gauges[gaugeId] = next;
  });

  // Vérifie la mort ET enregistre la cause
  this.lastDeath = null;
  for (const gaugeId of Object.keys(this.gauges)) {
    const v = this.gauges[gaugeId];
    if (v <= 0) {
      this.alive = false;
      this.lastDeath = { gaugeId, direction: "down" };
      break;
    }
    if (v >= 100) {
      this.alive = false;
      this.lastDeath = { gaugeId, direction: "up" };
      break;
    }
  }
},

resetRunMeta() {
  this.reignYears = 0;
  this.cardsPlayed = 0;
},

advanceAfterCard() {
  if (!this.alive) return;
  // 2 à 5 ans par décision, façon Reigns
  const deltaYears = 2 + Math.floor(Math.random() * 4); // 2,3,4,5
  this.reignYears += deltaYears;
  this.cardsPlayed += 1;
},


    isDead() {
      return !this.alive;
    }
  };

  window.VRState = VRState;
})();
