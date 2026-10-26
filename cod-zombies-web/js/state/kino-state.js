/* =========================================================
   state/kino-state.js — explicit Zombies (Kino) game state
   machine + a tiny event bus. The survival mode keeps using
   Game.state; zombies mirrors into this so menus, rounds and
   the economy can react without polling.
   ========================================================= */

const KinoGameState = {
  STATES: Object.freeze({
    BOOT:'BOOT',
    MAIN_MENU:'MAIN_MENU',
    LOADING:'LOADING',
    PLAYING:'PLAYING',
    PAUSED:'PAUSED',
    GAME_OVER:'GAME_OVER'
  }),

  state:'BOOT',
  _listeners:{},

  /* Subscribe to a Zombies event; returns an unsubscribe function. */
  on(event, fn) {
    if (typeof fn !== 'function') return () => {};
    (this._listeners[event] || (this._listeners[event] = [])).push(fn);
    return () => this.off(event, fn);
  },

  /* Remove a previously registered listener. */
  off(event, fn) {
    const list = this._listeners[event];
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  },

  /* Emit an event to every listener (listener errors are isolated). */
  emit(event, payload) {
    const list = this._listeners[event];
    if (!list || list.length === 0) return;
    for (const fn of list.slice()) {
      try { fn(payload || {}); }
      catch (e) { console.error('KinoGameState listener error (' + event + '):', e); }
    }
  },

  /* Transition to a new state; emits state:changed when it actually moves. */
  set(next) {
    if (!next || !Object.values(this.STATES).includes(next)) return this.state;
    if (this.state === next) return this.state;
    const from = this.state;
    this.state = next;
    this.emit('state:changed', { from, to:next });
    return this.state;
  },

  /* True when the machine is in the requested state. */
  is(s) { return this.state === s; },

  /* True while a Kino run exists (loading, live, paused or game over). */
  inRun() {
    return this.state === this.STATES.LOADING ||
           this.state === this.STATES.PLAYING ||
           this.state === this.STATES.PAUSED ||
           this.state === this.STATES.GAME_OVER;
  },

  /* True only when gameplay input should be accepted. */
  isPlaying() { return this.state === this.STATES.PLAYING; }
};

/* Expose the state names for callers that prefer constants over strings. */
const KINO_STATE = KinoGameState.STATES;
