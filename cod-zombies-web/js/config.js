/* =========================================================
   config.js — weapon / perk / streak definitions, settings,
   loadouts, keybinds. All values are original, gameplay-wise
   inspired by Black Ops 2 style.
   ========================================================= */

const WEAPONS = {
  /* ---------- PRIMARY ---------- */
  smg: {
    id:'smg', name:'PDW-77', alias:'SMG', slot:'primary', auto:true,
    damage:22, headMul:1.8, rpm:780, mag:35, reserve:210, reload:1.9,
    spread:1.5, hipSpread:3.4, adsSpread:0.35, recoil:0.85, recoilRecover:7,
    adsFov:0.82, adsTime:0.16, sprintTime:0.28, range:55, weight:1,
    kickPitch:[0.9,1.5], kickYaw:0.5, pellets:1, tracer:0xffe0a0,
    attachments: { optic:['none','reddot','reflex','acog'], barrel:['none','suppressor','extended'] }
  },
  ar: {
    id:'ar', name:'AN-94', alias:'ASSAULT RIFLE', slot:'primary', auto:true,
    damage:30, headMul:2.0, rpm:640, mag:30, reserve:240, reload:2.2,
    spread:1.3, hipSpread:3.2, adsSpread:0.22, recoil:1.15, recoilRecover:6,
    adsFov:0.78, adsTime:0.20, sprintTime:0.32, range:80, weight:1.15,
    kickPitch:[1.3,2.1], kickYaw:0.55, pellets:1, tracer:0xffd080,
    fireMode:'burst', burst:2, burstDelay:0.09,
    attachments: { optic:['none','reddot','reflex','acog'], barrel:['none','suppressor','extended'] }
  },
  lmg: {
    id:'lmg', name:'LSAT', alias:'LIGHT MACHINE GUN', slot:'primary', auto:true,
    damage:26, headMul:1.8, rpm:700, mag:75, reserve:300, reload:4.6,
    spread:1.9, hipSpread:4.6, adsSpread:0.4, recoil:1.0, recoilRecover:5,
    adsFov:0.85, adsTime:0.30, sprintTime:0.48, range:75, weight:1.6,
    kickPitch:[1.0,1.6], kickYaw:0.6, pellets:1, tracer:0xffb060,
    attachments: { optic:['none','reddot','acog'], barrel:['none','suppressor'] }
  },
  sniper: {
    id:'sniper', name:'DSR-50', alias:'SNIPER RIFLE', slot:'primary', auto:false,
    damage:110, headMul:2.0, rpm:55, mag:5, reserve:35, reload:3.4,
    spread:2.6, hipSpread:9.0, adsSpread:0.02, recoil:3.4, recoilRecover:4,
    adsFov:0.28, adsTime:0.34, sprintTime:0.55, range:200, weight:1.5,
    kickPitch:[4.5,5.5], kickYaw:0.8, pellets:1, scope:true, tracer:0xfff0c0,
    attachments: { optic:['none','variable_zoom'], barrel:['none','suppressor'] }
  },
  shotgun: {
    id:'shotgun', name:'M1216', alias:'SHOTGUN', slot:'primary', auto:false,
    damage:14, headMul:1.5, rpm:240, mag:8, reserve:64, reload:2.6,
    spread:4.0, hipSpread:10.0, adsSpread:3.0, recoil:2.2, recoilRecover:5,
    adsFov:0.86, adsTime:0.24, sprintTime:0.36, range:22, weight:1.4,
    kickPitch:[2.0,3.0], kickYaw:0.9, pellets:8, tracer:0xffa050,
    attachments: { optic:['none','reddot'], barrel:['none','extended'] }
  },
  marksman: {
    id:'marksman', name:'SVU-AS', alias:'MARKSMAN RIFLE', slot:'primary', auto:false,
    damage:65, headMul:2.2, rpm:200, mag:10, reserve:80, reload:2.4,
    spread:1.8, hipSpread:6.0, adsSpread:0.15, recoil:1.6, recoilRecover:6,
    adsFov:0.50, adsTime:0.26, sprintTime:0.42, range:150, weight:1.3,
    kickPitch:[2.6,3.4], kickYaw:0.6, pellets:1, tracer:0xffc0a0,
    attachments: { optic:['none','reddot','variable_zoom'], barrel:['none','suppressor'] }
  },
  lmg2: {
    id:'lmg2', name:'HAMR', alias:'LIGHT MACHINE GUN', slot:'primary', auto:true,
    damage:24, headMul:1.7, rpm:850, mag:100, reserve:400, reload:5.2,
    spread:2.2, hipSpread:5.0, adsSpread:0.5, recoil:1.3, recoilRecover:4,
    adsFov:0.88, adsTime:0.38, sprintTime:0.55, range:90, weight:1.8,
    kickPitch:[1.2,1.9], kickYaw:0.65, pellets:1, tracer:0xff9050,
    attachments: { optic:['none','reddot','acog'], barrel:['none','suppressor','extended'] }
  },
  smg3: {
    id:'smg3', name:'VECTOR', alias:'SMG · 45 ACP', slot:'primary', auto:true,
    damage:20, headMul:1.6, rpm:1100, mag:25, reserve:150, reload:2.0,
    spread:1.8, hipSpread:4.2, adsSpread:0.45, recoil:0.9, recoilRecover:9,
    adsFov:0.83, adsTime:0.15, sprintTime:0.26, range:42, weight:0.95,
    kickPitch:[0.8,1.3], kickYaw:0.4, pellets:1, tracer:0xffd0b0,
    attachments: { optic:['none','reddot','reflex'], barrel:['none','suppressor'] }
  },
  ar2: {
    id:'ar2', name:'M27', alias:'ASSAULT RIFLE · IAR', slot:'primary', auto:true,
    damage:32, headMul:2.0, rpm:720, mag:30, reserve:210, reload:2.3,
    spread:1.2, hipSpread:3.0, adsSpread:0.18, recoil:0.9, recoilRecover:7,
    adsFov:0.76, adsTime:0.22, sprintTime:0.34, range:85, weight:1.2,
    kickPitch:[1.1,1.8], kickYaw:0.5, pellets:1, tracer:0xffd8a0,
    attachments: { optic:['none','reddot','acog','variable_zoom'], barrel:['none','suppressor','extended'] }
  },
  sniper2: {
    id:'sniper2', name:'BARRETT', alias:'SNIPER · .50 CAL', slot:'primary', auto:false,
    damage:140, headMul:2.2, rpm:42, mag:7, reserve:42, reload:3.6,
    spread:2.2, hipSpread:8.0, adsSpread:0.015, recoil:4.2, recoilRecover:3,
    adsFov:0.22, adsTime:0.40, sprintTime:0.62, range:240, weight:1.7,
    kickPitch:[5.0,6.2], kickYaw:1.0, pellets:1, scope:true, tracer:0xfff0e0,
    attachments: { optic:['none','variable_zoom'], barrel:['none','suppressor'] }
  },
  shotgun2: {
    id:'shotgun2', name:'KSG', alias:'SHOTGUN · PUMP', slot:'primary', auto:false,
    damage:18, headMul:1.6, rpm:120, mag:12, reserve:96, reload:2.8,
    spread:5.0, hipSpread:12.0, adsSpread:2.5, recoil:2.8, recoilRecover:4,
    adsFov:0.82, adsTime:0.28, sprintTime:0.40, range:26, weight:1.5,
    kickPitch:[2.4,3.6], kickYaw:1.0, pellets:12, tracer:0xffa050,
    attachments: { optic:['none','reddot'], barrel:['none','extended'] }
  },
  /* ---------- SECONDARY ---------- */
  pistol: {
    id:'pistol', name:'FIVE-SEVEN', alias:'PISTOL', slot:'secondary', auto:false,
    damage:26, headMul:2.0, rpm:420, mag:20, reserve:120, reload:1.5,
    spread:1.4, hipSpread:2.6, adsSpread:0.3, recoil:1.0, recoilRecover:8,
    adsFov:0.88, adsTime:0.13, sprintTime:0.2, range:45, weight:0.6,
    kickPitch:[1.4,1.9], kickYaw:0.5, pellets:1, tracer:0xffe8b0,
    attachments: { optic:['none','reddot'], barrel:['none','suppressor'] }
  },
  knife: {
    id:'knife', name:'COMBAT KNIFE', alias:'MELEE', slot:'secondary', auto:false,
    damage:150, headMul:1, rpm:90, mag:1, reserve:0, reload:0.4,
    spread:0, hipSpread:0, adsSpread:0, recoil:0.4, recoilRecover:9,
    adsFov:1, adsTime:0.1, sprintTime:0.15, range:2.4, weight:0.3,
    kickPitch:[0.5,0.8], kickYaw:0.2, pellets:1, melee:true, tracer:0xffffff,
    attachments: { optic:['none'], barrel:['none'] }
  },
  launcher: {
    id:'launcher', name:'SMAW', alias:'LAUNCHER', slot:'secondary', auto:false,
    damage:180, headMul:1, rpm:40, mag:1, reserve:4, reload:2.6,
    spread:2.0, hipSpread:2.5, adsSpread:0.6, recoil:2.4, recoilRecover:6,
    adsFov:0.8, adsTime:0.3, sprintTime:0.5, range:200, weight:1.4,
    kickPitch:[3.2,4.0], kickYaw:0.7, pellets:1, rocket:true, tracer:0xff9040,
    attachments: { optic:['none'], barrel:['none'] }
  },
  revolver: {
    id:'revolver', name:'TITAN', alias:'REVOLVER', slot:'secondary', auto:false,
    damage:60, headMul:2.2, rpm:120, mag:6, reserve:42, reload:2.0,
    spread:1.2, hipSpread:3.0, adsSpread:0.25, recoil:2.6, recoilRecover:7,
    adsFov:0.84, adsTime:0.18, sprintTime:0.26, range:70, weight:0.8,
    kickPitch:[2.2,3.4], kickYaw:0.8, pellets:1, tracer:0xffd0a0,
    attachments: { optic:['none','reddot'], barrel:['none'] }
  },
  smg2: {
    id:'smg2', name:'MP7', alias:'SMG · PDW', slot:'secondary', auto:true,
    damage:18, headMul:1.7, rpm:950, mag:30, reserve:180, reload:2.0,
    spread:1.6, hipSpread:3.8, adsSpread:0.4, recoil:0.7, recoilRecover:8,
    adsFov:0.85, adsTime:0.14, sprintTime:0.24, range:40, weight:0.9,
    kickPitch:[0.7,1.2], kickYaw:0.45, pellets:1, tracer:0xffc8a0,
    attachments: { optic:['none','reddot'], barrel:['none','suppressor'] }
  },
  pistol2: {
    id:'pistol2', name:'G18', alias:'PISTOL · AUTO', slot:'secondary', auto:true,
    damage:18, headMul:1.8, rpm:1100, mag:33, reserve:165, reload:1.8,
    spread:1.8, hipSpread:4.0, adsSpread:0.5, recoil:1.4, recoilRecover:7,
    adsFov:0.86, adsTime:0.15, sprintTime:0.22, range:38, weight:0.7,
    kickPitch:[1.6,2.2], kickYaw:0.6, pellets:1, tracer:0xffd8b0,
    attachments: { optic:['none','reddot'], barrel:['none','suppressor'] }
  },
  shotgun3: {
    id:'shotgun3', name:'M1014', alias:'SHOTGUN · SEMI', slot:'secondary', auto:false,
    damage:16, headMul:1.6, rpm:200, mag:7, reserve:56, reload:2.4,
    spread:4.5, hipSpread:11.0, adsSpread:2.8, recoil:2.4, recoilRecover:5,
    adsFov:0.84, adsTime:0.26, sprintTime:0.38, range:24, weight:1.3,
    kickPitch:[2.2,3.2], kickYaw:0.95, pellets:10, tracer:0xffa050,
    attachments: { optic:['none','reddot'], barrel:['none','extended'] }
  }
};

/* Attachment definitions — modify weapon stats when equipped */
const ATTACHMENTS = {
  optic: {
    none:   { name:'NONE',              spreadMult:1.0, recoilMult:1.0, rangeMult:1.0, adsMult:1.0 },
    reddot: { name:'RED DOT',           spreadMult:0.95, recoilMult:1.05, rangeMult:1.0, adsMult:0.98 },
    reflex: { name:'REFLEX SIGHT',      spreadMult:0.9,  recoilMult:1.1,  rangeMult:1.0, adsMult:0.95 },
    acog:   { name:'ACOG 4x',           spreadMult:0.85, recoilMult:1.15, rangeMult:1.15, adsMult:0.85 },
    variable_zoom:{ name:'VARIABLE ZOOM', spreadMult:0.8, recoilMult:1.2, rangeMult:1.25, adsMult:0.75 }
  },
  barrel: {
    none:     { name:'NONE',            dmgMult:1.0, rangeMult:1.0, recoilMult:1.0 },
    suppressor:{ name:'SUPPRESSOR',     dmgMult:0.9, rangeMult:0.85, recoilMult:0.9 },
    extended: { name:'EXTENDED BARREL', dmgMult:1.1, rangeMult:1.15, recoilMult:1.05 }
  }
};

/* Score per kill (BO2 scorestreak points instead of pure kill counts) */
const SCORE = {
  kill:100, headshot:150, assist:50, revenge:125, streakBonus:250
};

const LETHALS = { frag:{ name:'FRAG', count:2, fuse:3.2, cookable:true }, semtex:{ name:'SEMTIX', count:2, fuse:2.2, sticky:true, cookable:false }, claymore:{ name:'CLAYMORE', count:1, fuse:0, mine:true, sticky:true, cookable:false } };
const TACTICALS = { flash:{ name:'FLASHBANG', count:2 }, stun:{ name:'STUN GRENADE', count:2 }, smoke:{ name:'SMOKE GRENADE', count:2, count:2 } };

const PERKS = {
  scavenger:{ name:'SCAVENGER', desc:'Recover ammo from kills & crates' },
  lightweight:{ name:'LIGHTWEIGHT', desc:'+15% movement speed, faster ADS' },
  toughness:{ name:'TOUGHNESS', desc:'Reduced flinch when hit' },
  dexterity:{ name:'DEXTERITY', desc:'Faster reload / weapon swap / melee' },
  ghost:{ name:'GHOST', desc:'Undetected by UAV while moving' },
  fastHands:{ name:'FAST HANDS', desc:'Faster throwable / streak use' },
  marathon:{ name:'MARATHON', desc:'Longer sprint duration' },
  deadSilence:{ name:'DEAD SILENCE', desc:'Silent footsteps' },
  flak:{ name:'FLAK JACKET', desc:'Reduced explosive damage' },
  bandolier:{ name:'BANDOLIER', desc:'+1 lethal & tactical capacity' },
  hardline:{ name:'HARDLINE', desc:'Streaks cost 20% fewer points' },
  secondary:{ name:'SECONDARY', desc:'+20% secondary weapon damage' }
};

const STREAKS = {
  uav:         { id:'uav',  name:'UAV',            cost:425 },
  hunter:      { id:'hunter',name:'HUNTER KILLER', cost:525 },
  carepackage: { id:'carepackage', name:'CARE PACKAGE', cost:700 },
  sentry:      { id:'sentry', name:'SENTRY GUN',    cost:875 },
  hellstorm:   { id:'hellstorm', name:'HELLSTORM MISSILE', cost:950 },
  chopper:     { id:'chopper', name:'ATTACK CHOPPER', cost:1200 },
  lodestar:    { id:'lodestar', name:'LODESTAR',    cost:1400 },
  vtol:        { id:'vtol', name:'VTOL WARSHIP',    cost:1750 },
  nuke:        { id:'nuke', name:'TACTICAL NUKE', cost:3000 },
  none:        { id:'none', name:'NONE',           cost:999999 }
};

const MAPS = {
  cargo17:  { id:'cargo17',  name:'CARGO 17',  desc:'CARGO SHIP',   builder:'buildCargo17' },
  downtown: { id:'downtown', name:'DOWNTOWN',  desc:'CITY BLOCK',   builder:'buildDowntown' },
  blacksite:{ id:'blacksite',name:'BLACKSITE', desc:'MILITARY BASE',builder:'buildBlacksite' },
  mirage:   { id:'mirage',   name:'MIRAGE',    desc:'DESERT TOWN',  builder:'buildMirage' },
  nuketown: { id:'nuketown', name:'NUKETOWN',  desc:'SUBURBIA',     builder:'buildNuketown' },
};

/* ---------------- Keybinds ---------------- */
const DEFAULT_BINDS = {
  forward:'KeyW', back:'KeyS', left:'KeyA', right:'KeyD',
  jump:'Space', crouch:'ControlLeft', prone:'KeyZ', sprint:'ShiftLeft',
  reload:'KeyR', melee:'KeyV', use:'KeyF', inspect:'KeyB',
  interact:'KeyF', repair:'KeyE', weapon_swap:'KeyX',
  weapon1:'Digit1', weapon2:'Digit2', weapon3:'Digit3',
  streak1:'Digit1', streak2:'Digit2', streak3:'Digit3', streak4:'Digit4',
  frag:'KeyG', tactical:'KeyQ', lastweapon:'KeyX', pause:'Escape'
};
const PRESETS = {
  default:  {},
  tactical: { crouch:'KeyC', prone:'ControlLeft', jump:'Space' },
  southpaw: { crouch:'KeyC', prone:'ShiftLeft' }
};

/* ---------------- Persistence ---------------- */
const Store = {
  get(key, def) {
    try { const v = localStorage.getItem('bo2web_'+key); return v ? JSON.parse(v) : def; }
    catch(e) { return def; }
  },
  set(key, val) {
    try { localStorage.setItem('bo2web_'+key, JSON.stringify(val)); } catch(e) {}
  }
};

const Settings = {
  data: Object.assign({
    sensitivity:1.0, fov:75, brightness:1.0, motionBlur:true, volume:0.8,
    quality:'medium', preset:'default', map:'cargo17',
    binds:{}
  }, Store.get('settings', {})),

  apply() {
    delete this.data.touch;
    delete this.data.gyro;
    delete this.data.useGyro;
    this.data.binds = Object.assign({}, DEFAULT_BINDS, PRESETS[this.data.preset] || {}, this.data.binds);
    Store.set('settings', this.data);
  },
  reset() {
    this.data = Object.assign({ sensitivity:1.0, fov:75, brightness:1.0, motionBlur:true,
      volume:0.8, quality:'medium', preset:'default', map:'cargo17', binds:{} });
    this.apply();
  },
  bind(action) { return this.data.binds[action] || DEFAULT_BINDS[action]; }
};
Settings.apply();

/* ---------------- Loadouts ---------------- */
const DEFAULT_CLASSES = [
  { name:'ASSAULT',  primary:'ar',     secondary:'pistol',  lethal:'frag',  tactical:'flash',
    perk1:'toughness', perk2:'scavenger', perk3:'fastHands', streaks:['uav','hunter','hellstorm','nuke'],
    attachments:{ optic:'reddot', barrel:'none' }, camo:'default' },
  { name:'RUNNER',   primary:'smg',    secondary:'knife',   lethal:'semtex',tactical:'stun',
    perk1:'lightweight', perk2:'dexterity', perk3:'marathon', streaks:['uav','hunter','carepackage','nuke'],
    attachments:{ optic:'reflex', barrel:'suppressor' }, camo:'woodland' },
  { name:'SUPPORT',  primary:'lmg',    secondary:'pistol',  lethal:'frag',  tactical:'flash',
    perk1:'flak', perk2:'ghost', perk3:'deadSilence', streaks:['uav','carepackage','lodestar','nuke'],
    attachments:{ optic:'acog', barrel:'extended' }, camo:'desert' },
  { name:'RECON',    primary:'sniper', secondary:'launcher',lethal:'frag',  tactical:'stun',
    perk1:'toughness', perk2:'dexterity', perk3:'scavenger', streaks:['uav','hunter','carepackage','nuke'],
    attachments:{ optic:'variable_zoom', barrel:'none' }, camo:'digital' },
  { name:'BREACHER', primary:'shotgun',secondary:'revolver', lethal:'semtex',tactical:'stun',
    perk1:'flak', perk2:'scavenger', perk3:'deadSilence', streaks:['hunter','carepackage','uav','nuke'],
    attachments:{ optic:'reddot', barrel:'extended' }, camo:'default' },
  { name:'MARKSMAN', primary:'marksman',secondary:'smg2', lethal:'frag', tactical:'flash',
    perk1:'toughness', perk2:'ghost', perk3:'fastHands', streaks:['uav','hunter','carepackage','nuke'],
    attachments:{ optic:'variable_zoom', barrel:'suppressor' }, camo:'woodland' },
  { name:'GUNNER',   primary:'lmg2',   secondary:'pistol',  lethal:'frag',  tactical:'stun',
    perk1:'flak', perk2:'marathon', perk3:'deadSilence', streaks:['carepackage','hellstorm','vtol','nuke'],
    attachments:{ optic:'acog', barrel:'extended' }, camo:'desert' },
  { name:'WILDCARD', primary:'smg2',   secondary:'revolver',lethal:'frag',  tactical:'flash',
    perk1:'lightweight', perk2:'dexterity', perk3:'marathon', streaks:['hunter','uav','carepackage','nuke'],
    attachments:{ optic:'reddot', barrel:'none' }, camo:'default' }
];

const Loadout = {
  active: Store.get('activeClass', 0),
  classes: Store.get('classes', JSON.parse(JSON.stringify(DEFAULT_CLASSES))),
  get current() { return this.classes[this.active]; },
  save() { Store.set('classes', this.classes); Store.set('activeClass', this.active); },
  reset() {
    this.classes = JSON.parse(JSON.stringify(DEFAULT_CLASSES));
    this.active = 0; this.save();
  }
};

/* ---------------- Map rotation ---------------- */
const MapRotation = {
  current: Store.get('map', 'cargo17'),
  set(id) { this.current = id; Store.set('map', id); },
  get() { return MAPS[this.current] || MAPS.cargo17; }
};
