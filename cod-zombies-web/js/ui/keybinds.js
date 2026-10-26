/* =========================================================
   ui/keybinds.js — Kino action registry + rebinding screen.
   All lookups go through Settings.data.binds (same store as the
   existing settings screen), so rebinds persist and Input stays
   in sync after Input.rebind().
   ========================================================= */

const KeybindManager = {
  /* Actions required by the Zombies vertical slice (plus shared FPS ones). */
  ACTIONS: [
    { id:'forward',     label:'MOVE FORWARD' },
    { id:'back',        label:'MOVE BACK' },
    { id:'left',        label:'STRAFE LEFT' },
    { id:'right',       label:'STRAFE RIGHT' },
    { id:'jump',        label:'JUMP' },
    { id:'crouch',      label:'CROUCH' },
    { id:'sprint',      label:'SPRINT' },
    { id:'interact',    label:'INTERACT / USE' },
    { id:'repair',      label:'REPAIR BARRICADE' },
    { id:'reload',      label:'RELOAD' },
    { id:'weapon_swap', label:'SWAP WEAPON' },
    { id:'pause',       label:'PAUSE' }
  ],

  /* Resolve the current key code for an action. */
  resolve(action) {
    return Settings.bind(action);
  },

  /* True while the action's resolved key is held. */
  down(action) {
    return !!Input.keys[this.resolve(action)];
  },

  /* True once per key press (consumes the edge, like Input.pressed). */
  pressed(action) {
    return Input.pressed(action);
  },

  /* True once per key release. */
  up(action) {
    return Input.up(action);
  },

  /* Rebind an action, persist it, and refresh both input maps. */
  setBind(action, code) {
    if (!action || !code) return false;
    Settings.data.binds[action] = code;
    Settings.apply();
    Input.rebind();
    this.refreshUI();
    return true;
  },

  /* Build the Keybinds screen rows inside the given container id. */
  bindUI(hostId) {
    const host = document.getElementById(hostId || 'keybind-list');
    if (!host) return;
    host.innerHTML = '';
    for (const a of this.ACTIONS) {
      const row = document.createElement('div');
      row.className = 'set-row';
      const lab = document.createElement('label');
      lab.textContent = a.label;
      const btn = document.createElement('button');
      btn.className = 'keybind';
      btn.dataset.action = a.id;
      btn.textContent = this.keyLabel(this.resolve(a.id));
      btn.onclick = () => {
        host.querySelectorAll('.keybind').forEach(b => b.classList.remove('listening'));
        btn.classList.add('listening');
        btn.textContent = 'PRESS KEY…';
        AudioFX.ui();
        Input.captureNext((code) => {
          this.setBind(a.id, code);
          btn.classList.remove('listening');
          AudioFX.uiBack();
        });
      };
      row.appendChild(lab);
      row.appendChild(btn);
      host.appendChild(row);
    }
  },

  /* Refresh every rendered keybind button from persisted binds. */
  refreshUI() {
    document.querySelectorAll('#keybind-list .keybind').forEach(btn => {
      const action = btn.dataset.action;
      if (action) btn.textContent = this.keyLabel(this.resolve(action));
      btn.classList.remove('listening');
    });
  },

  /* Human-readable label for a KeyboardEvent.code. */
  keyLabel(code) {
    if (!code) return '—';
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6);
    const map = {
      ControlLeft:'L-CTRL', ControlRight:'R-CTRL', ShiftLeft:'L-SHIFT', ShiftRight:'R-SHIFT',
      AltLeft:'L-ALT', AltRight:'R-ALT', Space:'SPACE', Escape:'ESC', Tab:'TAB',
      CapsLock:'CAPS', ArrowUp:'↑', ArrowDown:'↓', ArrowLeft:'←', ArrowRight:'→',
      Mouse0:'LMB', Mouse2:'RMB', Enter:'ENTER', Backspace:'BKSP'
    };
    return map[code] || code.toUpperCase();
  }
};
