/* =========================================================
   systems/points.js — Zombies point economy.
   Starting balance, configurable awards, purchases with
   explicit failure reasons, and points:changed events.
   ========================================================= */

const PointsEconomy = {
  DEFAULTS: {
    starting: 500,
    awards: { hit:10, kill:60, headshotKill:100, boardRepair:10 }
  },

  starting: 500,
  awards: { hit:10, kill:60, headshotKill:100, boardRepair:10 },
  total: 500,
  earned: 0,
  spent: 0,
  multiplier: 1,

  /* Reset the wallet and merge optional award overrides. */
  init(cfg) {
    cfg = cfg || {};
    this.starting = cfg.starting != null ? cfg.starting : this.DEFAULTS.starting;
    this.awards = Object.assign({}, this.DEFAULTS.awards, cfg.awards || {});
    this.total = this.starting;
    this.earned = 0;
    this.spent = 0;
    this.multiplier = 1;
    this._emit();
  },

  /* Award points for a configured event; returns the amount granted. */
  award(type, times) {
    const base = this.awards[type];
    if (!base) return 0;
    const n = times == null ? 1 : times;
    const amount = Math.round(base * n * this.multiplier);
    if (amount === 0) return 0;
    this.total += amount;
    this.earned += amount;
    this._emit();
    return amount;
  },

  /* Add an arbitrary amount (round bonus, debug, etc.). */
  add(amount, label) {
    const n = Math.round(amount || 0);
    if (!n) return 0;
    this.total += n;
    if (n > 0) this.earned += n; else this.spent += -n;
    this._emit();
    KinoGameState.emit('points:changed', { total:this.total, delta:n, label:label || 'bonus' });
    return n;
  },

  /* True when the wallet can cover a cost. */
  canAfford(cost) { return this.total >= cost; },

  /* Spend points; returns true only if the purchase succeeded. */
  spend(cost, label) {
    const c = Math.max(0, Math.round(cost || 0));
    if (this.total < c) return false;
    this.total -= c;
    this.spent += c;
    this._emit();
    KinoGameState.emit('points:changed', { total:this.total, delta:-c, label:label || 'purchase' });
    return true;
  },

  /* Attempt a purchase; returns {ok, reason, cost, label}. */
  purchase(cost, label) {
    const c = Math.max(0, Math.round(cost || 0));
    if (this.total >= c) {
      this.total -= c;
      this.spent += c;
      this._emit();
      KinoGameState.emit('points:changed', { total:this.total, delta:-c, label:label || 'purchase' });
      return { ok:true, cost:c, label:label || 'purchase' };
    }
    const reason = 'NOT ENOUGH POINTS';
    KinoGameState.emit('purchase:failed', {
      reason, cost:c, label:label || 'purchase', total:this.total
    });
    return { ok:false, reason, cost:c, label:label || 'purchase' };
  },

  /* Temporarily scale future awards (double-points placeholder). */
  setMultiplier(v) { this.multiplier = Math.max(0, v || 1); },

  /* Emit the canonical points:changed payload. */
  _emit() {
    KinoGameState.emit('points:changed', {
      total:this.total, earned:this.earned, spent:this.spent, multiplier:this.multiplier
    });
  }
};
