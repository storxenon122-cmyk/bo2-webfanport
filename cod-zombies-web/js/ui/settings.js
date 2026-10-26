/* =========================================================
   ui/settings.js — settings persistence + live application.
   Wraps the existing Settings store (config.js) so FOV,
   sensitivity and master volume apply without a reload.
   ========================================================= */

const SettingsManager = {
  DEFAULTS: { volume:0.8, sensitivity:1.0, fov:75 },

  /* Wire the settings UI once and make sure every key exists. */
  init() {
    let changed = false;
    for (const k in this.DEFAULTS) {
      if (Settings.data[k] === undefined) { Settings.data[k] = this.DEFAULTS[k]; changed = true; }
    }
    if (changed) Settings.apply();
    this.bindUI();
    this.applyVolume();
  },

  /* Read a setting value (falls back to this manager's defaults). */
  get(key) {
    return Settings.data[key] !== undefined ? Settings.data[key] : this.DEFAULTS[key];
  },

  /* Write a setting, persist it, and apply it live. */
  set(key, value) {
    Settings.data[key] = value;
    Settings.apply();
    this.applyLive(key);
    this.refresh();
  },

  /* Apply one changed setting to the running game without a restart. */
  applyLive(key) {
    if (key === 'fov') {
      if (typeof Game !== 'undefined' && Game.camera) {
        Game.camera.fov = Settings.data.fov;
        Game.camera.updateProjectionMatrix();
      }
    } else if (key === 'volume') {
      this.applyVolume();
    }
    /* sensitivity is read every frame from Settings.data by Game.update() */
  },

  /* Push the master volume into the audio synthesizer. */
  applyVolume() {
    if (typeof AudioFX !== 'undefined' && AudioFX.setVolume) {
      AudioFX.setVolume(this.get('volume'));
    }
  },

  /* Bind the range/toggle inputs that belong to this manager. */
  bindUI() {
    const vol = document.getElementById('set-vol');
    if (vol && !vol._smBound) {
      vol._smBound = true;
      vol.oninput = (e) => {
        const v = parseFloat(e.target.value);
        Settings.data.volume = v;
        Settings.apply();
        this.applyVolume();
        this.refresh();
      };
    }
  },

  /* Refresh the settings widgets from persisted data. */
  refresh() {
    const vol = document.getElementById('set-vol');
    const vv = document.getElementById('val-vol');
    if (vol) vol.value = this.get('volume');
    if (vv) vv.textContent = Math.round(this.get('volume') * 100) + '%';
  }
};
