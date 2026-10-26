/* =========================================================
   systems/round-manager.js — Zombies round pacing.
   Owns the round counter, concurrent-alive cap, spawn budget,
   health scaling and the short intermission between rounds.
   ========================================================= */

const RoundManager = {
  round: 0,
  active: false,
  maxAlive: 4,
  spawnBudget: 0,
  spawned: 0,
  killed: 0,
  healthScale: 1,
  spawnInterval: 2.2,
  intermission: 0,

  /* Reset pacing state for a brand-new Kino run. */
  init() {
    this.round = 0;
    this.active = false;
    this.maxAlive = 4;
    this.spawnBudget = 0;
    this.spawned = 0;
    this.killed = 0;
    this.healthScale = 1;
    this.spawnInterval = 2.2;
    this.intermission = 0;
  },

  /* Start Round 1 immediately (called once the Kino map is loaded). */
  start() {
    this.active = true;
    this._beginRound(1);
  },

  /* Public: number of zombies still alive this round. */
  aliveCount() {
    return (typeof Zombies !== 'undefined' && Zombies.aliveCount) ? Zombies.aliveCount() : 0;
  },

  /* Public: alive + still-unspawned zombies (for the HUD). */
  remaining() {
    return this.aliveCount() + Math.max(0, this.spawnBudget);
  },

  /* True while the spawner may consume another budget slot. */
  canSpawn() {
    return this.active && this.intermission <= 0 && this.spawnBudget > 0 &&
           this.aliveCount() < this.maxAlive;
  },

  /* Consume one spawn-budget slot; returns true if a zombie may spawn. */
  consumeSpawn() {
    if (!this.canSpawn()) return false;
    this.spawnBudget--;
    this.spawned++;
    return true;
  },

  /* Register a zombie death so the round can close when both pools empty. */
  notifyKill() {
    this.killed++;
  },

  /* Per-frame pacing: intermission countdown and round-complete detection. */
  update(dt) {
    if (!this.active || !KinoGameState.isPlaying()) return;
    if (this.intermission > 0) {
      this.intermission -= dt;
      if (this.intermission <= 0) this._beginRound(this.round + 1);
      return;
    }
    if (this.spawnBudget <= 0 && this.aliveCount() === 0) this._endRound();
  },

  /* -------- internals -------- */
  _beginRound(n) {
    this.round = n;
    this.maxAlive = Math.min(4 + n * 2, 14);
    this.spawnBudget = Math.min(6 + n * 4, 30);
    this.killed = 0;
    this.spawned = 0;
    this.healthScale = 1 + (n - 1) * 0.28;
    this.spawnInterval = Math.max(0.7, 1.6 - n * 0.05);
    this.intermission = 0;
    KinoGameState.emit('round:start', {
      round:n, maxAlive:this.maxAlive, budget:this.spawnBudget,
      healthScale:this.healthScale
    });
    if (typeof Zombies !== 'undefined' && Zombies.beginRound) {
      Zombies.beginRound(n, { healthScale:this.healthScale, interval:this.spawnInterval });
    }
    if (typeof HUD !== 'undefined' && HUD.announce) HUD.announce('ROUND ' + n, 'SURVIVE');
    if (typeof AudioFX !== 'undefined' && AudioFX.announce) AudioFX.announce();
    if (typeof KinoHUD !== 'undefined' && KinoHUD.roundBanner) KinoHUD.roundBanner(n);
  },

  _endRound() {
    KinoGameState.emit('round:end', {
      round:this.round, kills:this.killed
    });
    if (typeof HUD !== 'undefined' && HUD.announce)
      HUD.announce('ROUND ' + this.round + ' CLEARED', 'NEXT WAVE IN 5');
    this.intermission = 5;
  }
};
