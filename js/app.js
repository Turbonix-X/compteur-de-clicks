// ===== Compteur de Clicks — Turbonix Entertainment =====

const MIN_MS = 100;             // 0,1 s
const MAX_MS = 5 * 3600 * 1000; // 5 h
const MIN_GOAL = 2;
const MAX_GOAL = 1000000;
const MIN_KEYS = 2;
const MAX_KEYS = 8;
const HISTORY_MAX = 60;
const RECENT_MAX = 10;
const RECORDS_MAX = 50;         // par mode
const TIMELINE_MAX = 60;        // nombre maximum de barres du dernier test
const COOLDOWN_MS = 1200;       // pause après un test, pour ne pas en relancer un sans le vouloir
const SAVE_EVERY_MS = 5000;     // sauvegarde pendant un long test
const GRACE_MS = 2000;          // Endurance : le temps de prendre son rythme, et la durée mesurée
const BUCKET_MS = 100;          // les clicks sont rangés par morceaux de 0,1 s
const RING_SIZE = 8192;         // doit rester une puissance de 2
const RING_MASK = RING_SIZE - 1;
const SAVE_KEY = "cdc-save-v1";
const PREFS_KEY = "tx-prefs";
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

const MODES = {
  time: {
    icon: "⏱️",
    name: "Chrono",
    desc: "Le plus de clicks possible avant la fin du temps.",
    hint: "Astuces : <kbd>Espace</kbd> pour lancer · <kbd>Échap</kbd> pour arrêter · sur téléphone, chaque doigt compte.",
    playing: "Clique ! Clique ! Clique !",
    unit: "clicks",
    presets: [1, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600, 18000].map((s) => s * 1000),
  },
  goal: {
    icon: "🏁",
    name: "Objectif",
    desc: "Fais le nombre de clicks que tu as choisi, le plus vite possible.",
    hint: "Astuces : <kbd>Espace</kbd> pour lancer · <kbd>Échap</kbd> pour arrêter · sur téléphone, chaque doigt compte.",
    playing: "Fonce jusqu’à l’objectif !",
    presets: [10, 50, 100, 200, 500, 1000, 5000, 10000],
  },
  targets: {
    icon: "🎯",
    name: "Cibles",
    desc: "Touche les cibles qui bougent, avant qu’elles ne s’échappent.",
    hint: "Astuces : <kbd>Espace</kbd> pour lancer · <kbd>Échap</kbd> pour arrêter · plus le niveau monte, plus les cibles sont rapides et s’échappent vite.",
    playing: "Vise bien !",
    unit: "touchées",
    presets: [5, 10, 15, 30, 60, 120, 300].map((s) => s * 1000),
  },
  alt: {
    icon: "🎹",
    name: "Alternance",
    desc: "Appuie sur tes touches ou tes boutons chacun leur tour, le plus vite possible.",
    hint: "Astuces : <kbd>Espace</kbd> pour te préparer · <kbd>Échap</kbd> pour arrêter · une erreur ne compte pas et casse ta série.",
    playing: "Suis le jaune !",
    unit: "points",
    presets: [5, 10, 15, 30, 60, 120, 300].map((s) => s * 1000),
  },
  endurance: {
    icon: "🔋",
    name: "Endurance",
    desc: "Tiens une vitesse le plus longtemps possible : si tu ralentis, c’est fini.",
    hint: "Astuces : <kbd>Espace</kbd> pour lancer · <kbd>Échap</kbd> pour arrêter · le trait blanc de la jauge marque la vitesse à tenir.",
    playing: "Prends ton rythme…",
    presets: [3, 5, 6, 8, 10, 12, 15, 20],
  },
};
const MODE_IDS = Object.keys(MODES);

// Du rang 1 au rang 10, selon la meilleure pointe (le plus de clicks en 1 seconde)
const RANKS = [
  { min: 0, icon: "🐌", name: "Escargot" },
  { min: 3, icon: "🐢", name: "Tortue" },
  { min: 5, icon: "🐭", name: "Souris" },
  { min: 7, icon: "🐇", name: "Lapin" },
  { min: 9, icon: "🦊", name: "Renard" },
  { min: 11, icon: "🐎", name: "Cheval" },
  { min: 13, icon: "🐆", name: "Guépard" },
  { min: 16, icon: "🦅", name: "Faucon" },
  { min: 20, icon: "⚡", name: "Éclair" },
  { min: 50, icon: "🚀", name: "Turbo" },
];

const ACHIEVEMENTS = [
  { cps: 10, icon: "🥉" },
  { cps: 100, icon: "🥈" },
  { cps: 500, icon: "🥇" },
  { cps: 1000, icon: "🏆" },
];

// Les formats des clés de records, pour vérifier les sauvegardes
const KEY_FORMATS = {
  time: /^\d+$/,
  goal: /^\d+$/,
  targets: /^\d+-\d+-\d+-\d+$/,
  alt: /^(keys|buttons)-\d+-\d+$/,
  endurance: /^\d+(\.\d+)?$/,
};

const $ = (id) => document.getElementById(id);
const els = {
  soundBtn: $("soundBtn"),
  vibBtn: $("vibBtn"),
  shareBtn: $("shareBtn"),
  clearBtn: $("clearBtn"),
  themeBtn: $("themeBtn"),
  modeTabs: $("modeTabs"),
  modeDesc: $("modeDesc"),
  zone: $("clickZone"),
  targetLayer: $("targetLayer"),
  timeLeft: $("timeLeft"),
  timeLabel: $("timeLabel"),
  liveCps: $("liveCps"),
  rightLabel: $("rightLabel"),
  tapBtn: $("tapBtn"),
  clickCount: $("clickCount"),
  tapLabel: $("tapLabel"),
  altRow: $("altRow"),
  zoneMsg: $("zoneMsg"),
  progressFill: $("progressFill"),
  gaugeMark: $("gaugeMark"),
  result: $("result"),
  quickPresets: $("quickPresets"),
  startBtn: $("startBtn"),
  stopBtn: $("stopBtn"),
  modeHint: $("modeHint"),
  recentList: $("recentList"),
  rankIcon: $("rankIcon"),
  rankStep: $("rankStep"),
  rankName: $("rankName"),
  rankBest: $("rankBest"),
  rankNextText: $("rankNextText"),
  rankNextValue: $("rankNextValue"),
  rankBar: $("rankBar"),
  lifetime: $("lifetime"),
  rankLadder: $("rankLadder"),
  achievements: $("achievements"),
  settingsSet: $("settingsSet"),
  panelGoal: $("panelGoal"),
  panelTargets: $("panelTargets"),
  panelAlt: $("panelAlt"),
  panelEndurance: $("panelEndurance"),
  panelDuration: $("panelDuration"),
  panelStart: $("panelStart"),
  goalInput: $("goalInput"),
  randGoalBtn: $("randGoalBtn"),
  levelRange: $("levelRange"),
  levelInput: $("levelInput"),
  sizeRange: $("sizeRange"),
  sizeInput: $("sizeInput"),
  countRange: $("countRange"),
  countInput: $("countInput"),
  altInput: $("altInput"),
  altKeysPanel: $("altKeysPanel"),
  altKeys: $("altKeys"),
  altButtonsPanel: $("altButtonsPanel"),
  altButtonCount: $("altButtonCount"),
  cpsInput: $("cpsInput"),
  durH: $("durH"),
  durM: $("durM"),
  durS: $("durS"),
  randDurBtn: $("randDurBtn"),
  durationText: $("durationText"),
  durationWarn: $("durationWarn"),
  startMode: $("startMode"),
  startInfo: $("startInfo"),
  keyboardOption: $("keyboardOption"),
  keyboardToggle: $("keyboardToggle"),
  rippleToggle: $("rippleToggle"),
  shakeToggle: $("shakeToggle"),
  clickSoundToggle: $("clickSoundToggle"),
  statsTitle: $("statsTitle"),
  resetBtn: $("resetBtn"),
  testTotal: $("testTotal"),
  bestCps: $("bestCps"),
  avgCps: $("avgCps"),
  clickTotal: $("clickTotal"),
  timeline: $("timeline"),
  timelineAxis: $("timelineAxis"),
  axisEnd: $("axisEnd"),
  timelineInfo: $("timelineInfo"),
  records: $("records"),
  history: $("history"),
  shareDialog: $("shareDialog"),
  challengeToggle: $("challengeToggle"),
  challengeLabel: $("challengeLabel"),
  shareLink: $("shareLink"),
  copyLinkBtn: $("copyLinkBtn"),
  fileWarn: $("fileWarn"),
  pasteLink: $("pasteLink"),
  loadLinkBtn: $("loadLinkBtn"),
  pasteError: $("pasteError"),
  exportBtn: $("exportBtn"),
  importInput: $("importInput"),
  confirmDialog: $("confirmDialog"),
  toast: $("toast"),
};

// ---------- Hasard ----------

const randBuf = new Uint32Array(4096);
let randPos = randBuf.length;
function random() {
  if (!window.crypto || !crypto.getRandomValues) return Math.random();
  if (randPos >= randBuf.length) {
    crypto.getRandomValues(randBuf);
    randPos = 0;
  }
  return randBuf[randPos++] / 4294967296;
}

// Entier aléatoire réparti de façon logarithmique (autant de petits que de grands nombres)
function randomLogInt(min, max) {
  return Math.round(Math.exp(Math.log(min) + random() * (Math.log(max) - Math.log(min))));
}

// ---------- État ----------

function defaultCfg() {
  return {
    time: { ms: 10000 },
    goal: { n: 100 },
    targets: { level: 20, size: 60, count: 3, ms: 30000 },
    // Sans vrai clavier (téléphone), on commence par les boutons à l'écran
    alt: {
      input: matchMedia("(pointer: coarse)").matches ? "buttons" : "keys",
      keys: [{ code: "KeyF", label: "F" }, { code: "KeyJ", label: "J" }],
      n: 2,
      ms: 10000,
    },
    endurance: { cps: 5 },
  };
}

function defaultStats() {
  return { tests: 0, clicks: 0, sumCps: 0, bestCps: 0, history: [], last: null };
}

function perMode(make) {
  return Object.fromEntries(MODE_IDS.map((m) => [m, make()]));
}

function defaultApp() {
  return {
    mode: "time",
    cfg: defaultCfg(),
    startMode: "first",   // "first" : le chrono part au premier click · "countdown" : 3, 2, 1, go !
    keyboard: false,
    ripple: true,
    shake: true,
    clickSound: true,
    lifetime: 0,          // tous les clicks depuis le début
    peak: 0,              // meilleure pointe : le plus de clicks réussis en 1 seconde
    achieved: {},         // CPS du succès → date
    stats: perMode(defaultStats),
    records: perMode(() => ({})), // clé du réglage → { v: score, t: date, p?: précision }
    recent: [],           // { mo, k, v, cps, r }
    challenge: null,      // { mo, k, v } reçu par un lien
  };
}

let app = defaultApp();
const prefs = {
  theme: document.documentElement.dataset.theme,
  sound: true,
  vibration: true,
};

// Le test en cours. Tout ce qui sert pendant les clicks est préparé à l'avance :
// un click ne fait qu'ajouter 1 à quelques nombres, l'affichage suit à chaque image.
const run = {
  state: "idle",        // idle · armed · countdown · running · cooldown
  mode: "time",
  cfg: null,
  key: "",
  limited: true,        // le test a une durée fixe
  count: 0,
  misses: 0,            // Cibles : clicks à côté
  errors: 0,            // Alternance : mauvaises touches
  combo: 0,
  bestCombo: 0,
  next: 0,              // Alternance : la touche à presser
  startAt: 0,
  endAt: 0,
  buckets: new Uint32Array(Math.ceil(MAX_MS / BUCKET_MS) + 1),
  ring: new Float64Array(RING_SIZE), // heures des derniers clicks réussis
  head: 0,
  tail: 0,
  peak: 0,
  rank: 0,
  rankStart: 0,
  unlocked: [],
  shown: -1,
  shake: 0,
  danger: false,
  altDirty: false,
  lastTick: 0,
  lastBuzz: 0,
  lastSave: 0,
  lastLifetime: -1,
  touch: false,
  endTimer: 0,
  watch: 0,
  raf: 0,
  timers: [],
};
const fxQueue = [];
let altEls = [];
let liveRipples = 0;
let zoneRect = null;
let wakeLock = null;
let capturingKey = false;

const cfgNow = () => app.cfg[app.mode];
const hasDuration = (mode) => mode === "time" || mode === "targets" || mode === "alt";

// ---------- Format ----------

const nf1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const fmtInt = (n) => Math.round(n).toLocaleString("fr-FR");
const fmtCps = (v) => (v >= 100 ? fmtInt(v) : nf2.format(v));
const plural = (n, word) => `${fmtInt(n)} ${word}${n > 1 ? "s" : ""}`;
const cpsOf = (clicks, ms) => clicks / (Math.max(ms, 1) / 1000);

function splitMs(ms) {
  const tenths = Math.round(ms / 100);
  const h = Math.floor(tenths / 36000);
  const m = Math.floor((tenths % 36000) / 600);
  const s = (tenths % 600) / 10;
  return { h, m, s };
}

// 90 000 → « 1 min 30 s »
function fmtDuration(ms) {
  const { h, m, s } = splitMs(ms);
  const parts = [];
  if (h) parts.push(`${h} h`);
  if (m) parts.push(`${m} min`);
  if (s || !parts.length) parts.push(`${nf1.format(s)} s`);
  return parts.join(" ");
}

// Un temps réalisé : au centième sous la minute (« 12,34 s »)
function fmtPrecise(ms) {
  return ms < 60000 ? `${nf2.format(ms / 1000)} s` : fmtDuration(ms);
}

const pad2 = (n) => String(n).padStart(2, "0");

function clockParts(total) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

// Temps restant : « 9,4 » · « 4:59 » · « 4:59:59 »
function fmtClock(ms) {
  ms = Math.max(0, ms);
  if (ms >= 60000) return { text: clockParts(Math.ceil(ms / 1000)), label: "restant" };
  return { text: (Math.ceil(ms / 100) / 10).toLocaleString("fr-FR", { minimumFractionDigits: 1 }), label: "secondes" };
}

// Temps écoulé, dans l'autre sens
function fmtElapsed(ms) {
  ms = Math.max(0, ms);
  if (ms >= 60000) return clockParts(Math.floor(ms / 1000));
  return (Math.floor(ms / 100) / 10).toLocaleString("fr-FR", { minimumFractionDigits: 1 });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function clampInt(v, min, max, fallback) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function clampMs(ms) {
  return Math.min(MAX_MS, Math.max(MIN_MS, Math.round(ms / 100) * 100));
}

function clampCps(v, fallback) {
  const n = Math.round(Number(v) * 2) / 2;
  return Number.isFinite(n) ? Math.min(100, Math.max(1, n)) : fallback;
}

function rankIndex(cps) {
  let r = 0;
  RANKS.forEach((rank, k) => { if (cps >= rank.min) r = k; });
  return r;
}

const rankText = (index) => `${RANKS[index].icon} ${RANKS[index].name}`;

// ---------- Records ----------

function recordKey(mode, cfg = app.cfg[mode]) {
  switch (mode) {
    case "goal": return String(cfg.n);
    case "targets": return `${cfg.level}-${cfg.size}-${cfg.count}-${cfg.ms}`;
    case "alt": return `${cfg.input}-${cfg.input === "keys" ? cfg.keys.length : cfg.n}-${cfg.ms}`;
    case "endurance": return String(cfg.cps);
    default: return String(cfg.ms);
  }
}

// Le réglage d'un record, en français
function keyLabel(mode, key) {
  const p = key.split("-");
  switch (mode) {
    case "goal": return plural(Number(key), "click");
    case "targets": return `Niv. ${p[0]} · ${p[1]} px · ${plural(Number(p[2]), "cible")} · ${fmtDuration(Number(p[3]))}`;
    case "alt": return `${p[0] === "keys" ? plural(Number(p[1]), "touche") : plural(Number(p[1]), "bouton")} · ${fmtDuration(Number(p[2]))}`;
    case "endurance": return `${nf1.format(Number(key))} CPS`;
    default: return fmtDuration(Number(key));
  }
}

function fmtScore(mode, v) {
  switch (mode) {
    case "goal":
    case "endurance": return fmtPrecise(v);
    case "targets": return plural(v, "cible");
    case "alt": return plural(v, "point");
    default: return plural(v, "click");
  }
}

// En Objectif on veut le temps le plus court, ailleurs le score le plus haut
const isBetter = (mode, v, old) => (mode === "goal" ? v < old : v > old);

function trimRecords(list) {
  const keys = Object.keys(list);
  if (keys.length <= RECORDS_MAX) return;
  keys.sort((x, y) => list[x].t - list[y].t);
  keys.slice(0, keys.length - RECORDS_MAX).forEach((k) => delete list[k]);
}

// ---------- Effets ----------

function replay(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

// Explosion de particules ; big = version feu d'artifice (étoiles, plus loin)
function burst(zone, amount = 26, big = false) {
  if (REDUCED) return;
  const palette = ["#ffd60a", "#9b6dff", "#ffffff", "#ffe766", "#c4a8ff"];
  for (let k = 0; k < amount; k++) {
    const p = document.createElement("span");
    p.className = big && k % 3 === 0 ? "particle star" : "particle";
    p.style.background = palette[k % palette.length];
    p.style.color = palette[k % palette.length];
    const size = (big ? 6 : 4) + random() * (big ? 10 : 7);
    p.style.width = p.style.height = `${size}px`;
    if (big) {
      p.style.left = `${20 + random() * 60}%`;
      p.style.top = `${25 + random() * 50}%`;
    }
    zone.appendChild(p);
    const angle = random() * Math.PI * 2;
    const dist = (big ? 90 : 70) + random() * (big ? 160 : 110);
    p.animate([
      { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) scale(0.2)`, opacity: 0 },
    ], { duration: 700 + random() * 500, easing: "cubic-bezier(.15,.7,.3,1)" }).onfinish = () => p.remove();
  }
}

let bannerTimer = 0;
function celebrate(title, subtitle) {
  clearTimeout(bannerTimer);
  els.zone.querySelectorAll(".banner").forEach((b) => b.remove());
  els.zone.classList.add("jackpot");
  const banner = document.createElement("div");
  banner.className = "banner";
  banner.innerHTML = `<span>${escapeHtml(title)}</span><small>${escapeHtml(subtitle)}</small>`;
  els.zone.appendChild(banner);
  bannerTimer = setTimeout(() => {
    banner.remove();
    els.zone.classList.remove("jackpot");
  }, 3600);
  for (let k = 0; k < 4; k++) setTimeout(() => burst(els.zone, 40, true), k * 280);
  Sound.fanfare();
  Haptics.buzz([60, 40, 60, 40, 200]);
}

function getRect() {
  if (!zoneRect) {
    const r = els.zone.getBoundingClientRect();
    zoneRect = { left: r.left + els.zone.clientLeft, top: r.top + els.zone.clientTop };
  }
  return zoneRect;
}

// Les ondes sont créées à l'image suivante (4 au plus par image, 24 à l'écran au plus),
// pour que les effets ne ralentissent jamais le comptage.
function flushFx() {
  if (!fxQueue.length) return;
  const rect = getRect();
  const n = Math.min(fxQueue.length, 4);
  for (let k = 0; k < n && liveRipples < 24 && !REDUCED; k++) {
    const { x, y, miss } = fxQueue[fxQueue.length - 1 - k];
    const r = document.createElement("span");
    r.className = `click-ripple${miss ? " miss" : random() < 0.5 ? " alt" : ""}`;
    r.style.left = `${x - rect.left}px`;
    r.style.top = `${y - rect.top}px`;
    els.zone.appendChild(r);
    liveRipples++;
    r.animate([
      { transform: "scale(0.3)", opacity: 0.9 },
      { transform: "scale(1.8)", opacity: 0 },
    ], { duration: 450, easing: "cubic-bezier(.2,.7,.3,1)" }).onfinish = () => {
      r.remove();
      liveRipples--;
    };
  }
  fxQueue.length = 0;
}

// ---------- Le test ----------

// Bloque les réglages (du lancement jusqu'à la fin de la pause qui suit le test)
function setLocked(on) {
  els.startBtn.disabled = on;
  els.settingsSet.disabled = on;
  els.modeTabs.querySelectorAll("button").forEach((b) => { b.disabled = on; });
  els.quickPresets.querySelectorAll("button").forEach((b) => { b.disabled = on; });
}

function clearTimers() {
  run.timers.forEach(clearTimeout);
  run.timers = [];
  clearTimeout(run.endTimer);
  clearInterval(run.watch);
  cancelAnimationFrame(run.raf);
}

async function lockScreen(on) {
  try {
    if (on && "wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* écran de veille non bloquable ici */ }
}

// Remet la zone au calme, quelle que soit la façon dont le test s'est terminé
function cleanupRun() {
  clearTimers();
  lockScreen(false);
  Targets.stop();
  fxQueue.length = 0;
  document.body.classList.remove("busy", "playing");
  els.zone.classList.remove("rolling", "armed", "danger", "shaking");
  els.stopBtn.disabled = true;
}

// Annule tout sans rien afficher (nouvelle sauvegarde, lien chargé…)
function resetRun() {
  cleanupRun();
  run.state = "idle";
  setLocked(false);
}

function setCount(n) {
  const text = fmtInt(n);
  els.clickCount.style.setProperty("--len", text.length);
  els.clickCount.textContent = text;
}

function setShake(level) {
  if (level === run.shake) return;
  run.shake = level;
  els.zone.classList.toggle("shaking", level > 0);
  els.zone.style.setProperty("--shake", level);
}

function tapLabel() {
  if (app.mode === "goal") return `sur ${fmtInt(app.cfg.goal.n)}`;
  if (app.mode === "endurance") return `objectif ${nf1.format(app.cfg.endurance.cps)} CPS`;
  return MODES[app.mode].unit;
}

function idleMessage(again) {
  if (app.mode === "alt" && app.cfg.alt.input === "buttons") return "Appuie sur le bouton jaune pour démarrer";
  if (app.mode === "alt") return "Clique ici, puis appuie sur ta première touche";
  return again ? "Clique ici pour rejouer" : "Clique ici pour démarrer";
}

function resetHud() {
  if (hasDuration(app.mode)) {
    const clock = fmtClock(cfgNow().ms);
    els.timeLeft.textContent = clock.text;
    els.timeLabel.textContent = clock.label;
  } else {
    els.timeLeft.textContent = fmtElapsed(0);
    els.timeLabel.textContent = app.mode === "endurance" ? "tenu" : "secondes";
  }
  els.liveCps.textContent = app.mode === "targets" ? "—" : "0";
  els.rightLabel.textContent = app.mode === "targets" ? "précision" : "CPS";
  setCount(0);
  els.clickCount.classList.remove("countdown");
  els.tapLabel.textContent = tapLabel();
  els.progressFill.style.transform = "scaleX(0)";
  setAltNext(0);
  setShake(0);
}

// Bouton principal, Espace ou click dans la zone : prépare un test
function launch() {
  if (run.state !== "idle") return;
  stopKeyCapture();
  prepare();
  const r = els.zone.getBoundingClientRect();
  if (r.top < 60 || r.bottom > innerHeight) els.zone.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "center" });
  if (run.mode === "targets" || app.startMode === "countdown") {
    countdown();
  } else {
    run.state = "armed";
    els.zone.classList.add("armed");
    els.zoneMsg.textContent = run.mode === "alt" ? "À toi ! Le chrono part à ton premier appui" : "À toi ! Le chrono part à ton premier click";
    Sound.click();
    els.zone.focus({ preventScroll: true });
  }
}

function prepare() {
  run.mode = app.mode;
  run.cfg = JSON.parse(JSON.stringify(cfgNow()));
  run.key = recordKey(run.mode);
  run.limited = hasDuration(run.mode);
  run.count = 0;
  run.misses = 0;
  run.errors = 0;
  run.combo = 0;
  run.bestCombo = 0;
  run.next = 0;
  run.peak = 0;
  run.rank = rankIndex(app.peak);
  run.rankStart = run.rank;
  run.unlocked = [];
  run.shown = -1;
  run.danger = false;
  run.altDirty = false;
  run.head = 0;
  run.tail = 0;
  run.ring.fill(-1e12);
  run.buckets.fill(0);
  fxQueue.length = 0;
  zoneRect = null;
  resetHud();
  setLocked(true);
  els.stopBtn.disabled = false;
  document.body.classList.add("busy");
  els.zone.classList.add("rolling");
  els.result.innerHTML = `<span class="result-label">Test</span><span class="muted small">${escapeHtml(keyLabel(run.mode, run.key))} · à toi de jouer !</span>`;
}

function countdown() {
  run.state = "countdown";
  els.zoneMsg.textContent = "Prépare-toi…";
  els.clickCount.classList.add("countdown");
  const steps = ["3", "2", "1"];
  steps.forEach((txt, k) => {
    run.timers.push(setTimeout(() => {
      els.clickCount.style.setProperty("--len", 1);
      els.clickCount.textContent = txt;
      if (!REDUCED) els.clickCount.animate([{ scale: 1.6, opacity: 0 }, { scale: 1, opacity: 1 }], { duration: 350, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" });
      Sound.beep(660);
      Haptics.buzz(15);
    }, k * 800));
  });
  run.timers.push(setTimeout(() => {
    els.clickCount.classList.remove("countdown");
    setCount(0);
    Sound.beep(1320, 0.25);
    begin(performance.now());
  }, steps.length * 800));
}

function begin(t) {
  run.state = "running";
  run.startAt = t;
  run.endAt = t + (run.limited ? run.cfg.ms : MAX_MS);
  run.lastSave = t;
  els.zone.classList.remove("armed");
  els.zoneMsg.textContent = MODES[run.mode].playing;
  document.body.classList.add("playing");
  if (run.mode === "targets") {
    Targets.start(els.targetLayer, els.zone.clientWidth, els.zone.clientHeight, run.cfg);
  }
  if (app.startMode === "first" && run.mode !== "targets") Sound.whoosh(0.5);
  Haptics.buzz(20);
  lockScreen(true);
  run.endTimer = setTimeout(() => finish(), run.endAt - performance.now() + 20);
  // Filet de sécurité si l'onglet est caché : l'Endurance doit quand même se terminer
  if (run.mode === "endurance") run.watch = setInterval(() => checkEndurance(performance.now()), 500);
  run.raf = requestAnimationFrame(frame);
}

// Un click réussi. Volontairement minuscule : c'est lui qui décide combien de
// clicks par seconde le site peut encaisser.
function countHit(t) {
  run.count++;
  const k = ((t - run.startAt) / BUCKET_MS) | 0;
  run.buckets[k < 0 ? 0 : k]++;
  // La meilleure pointe : combien de clicks dans la dernière seconde ?
  run.ring[run.head] = t;
  run.head = (run.head + 1) & RING_MASK;
  const from = t - 1000;
  while (run.ring[run.tail] <= from && run.tail !== run.head) run.tail = (run.tail + 1) & RING_MASK;
  let n = (run.head - run.tail) & RING_MASK;
  if (n === 0) { // la file est pleine : plus de 8 000 clicks dans la seconde
    run.tail = (run.tail + 1) & RING_MASK;
    n = RING_MASK;
  }
  if (n > run.peak) run.peak = n;
}

function clickFeedback(t, x, y, miss) {
  if (app.ripple && x !== undefined && fxQueue.length < 16) fxQueue.push({ x, y, miss });
  if (app.clickSound && t - run.lastTick > 35) { run.lastTick = t; Sound.tick(0.5); }
  if (t - run.lastBuzz > 60) { run.lastBuzz = t; Haptics.buzz(8); }
}

function pressTap(t, x, y) {
  countHit(t);
  clickFeedback(t, x, y);
  if (run.mode === "goal" && run.count >= run.cfg.n) finish(Math.max(1, t - run.startAt));
}

function pressTarget(t, x, y) {
  if (x === undefined) return;
  const rect = getRect();
  if (Targets.hit(x - rect.left, y - rect.top, run.touch ? 8 : 0)) {
    countHit(t);
    clickFeedback(t, x, y);
  } else {
    run.misses++;
    clickFeedback(t, x, y, true);
  }
}

function pressAlt(t, x, y, index) {
  if (index === undefined) return;
  if (index === run.next) {
    countHit(t);
    run.combo++;
    if (run.combo > run.bestCombo) run.bestCombo = run.combo;
    if (x === undefined) { // une touche du clavier : l'onde part de la touche à l'écran
      const r = altEls[index].getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top + r.height / 2;
    }
    clickFeedback(t, x, y);
    setAltNext((index + 1) % altEls.length);
  } else {
    run.errors++;
    run.combo = 0;
    replay(altEls[index], "wrong");
    if (app.clickSound) Sound.beep(180, 0.08);
    Haptics.buzz(30);
  }
  run.altDirty = true;
}

// Un appui, d'où qu'il vienne : souris, doigt ou touche du clavier
function press(t, x, y, index) {
  if (run.state === "idle") launch();
  if (run.state === "armed") {
    if (run.mode === "alt" && index !== 0) return; // il faut commencer par la première touche
    begin(t);
  }
  if (run.state !== "running") return;
  if (t >= run.endAt) { finish(); return; }
  app.lifetime++;
  if (run.mode === "targets") pressTarget(t, x, y);
  else if (run.mode === "alt") pressAlt(t, x, y, index);
  else pressTap(t, x, y);
}

// Heure d'un événement, dans la même horloge que performance.now()
function stamp(e) {
  const now = performance.now();
  return e.timeStamp > 0 && Math.abs(e.timeStamp - now) < 1000 ? e.timeStamp : now;
}

// Vitesse en direct : le nombre de clicks pendant la dernière seconde
function liveCps(now) {
  const from = now - 1000;
  while (run.ring[run.tail] <= from && run.tail !== run.head) run.tail = (run.tail + 1) & RING_MASK;
  const n = (run.head - run.tail) & RING_MASK;
  const elapsed = now - run.startAt;
  return elapsed < 1000 ? n * (1000 / Math.max(elapsed, 250)) : n;
}

// Heure du click qui se trouve « n » clicks en arrière
const clickBack = (n) => run.ring[(run.head - n) & RING_MASK];

// Endurance : sur les 2 dernières secondes, a-t-on fait assez de clicks ?
function checkEndurance(now) {
  if (run.state !== "running" || run.mode !== "endurance" || now - run.startAt < GRACE_MS) return;
  const needed = Math.ceil((run.cfg.cps * GRACE_MS) / 1000);
  const last = clickBack(needed);
  if (last <= now - GRACE_MS) {
    // On retrouve le moment exact où la vitesse a décroché
    finish(Math.max(GRACE_MS, last + GRACE_MS - run.startAt));
    return;
  }
  const danger = clickBack(Math.ceil(needed * 1.25)) <= now - GRACE_MS;
  if (danger !== run.danger) {
    run.danger = danger;
    els.zone.classList.toggle("danger", danger);
    els.zoneMsg.textContent = danger ? "Plus vite !" : "Tiens bon !";
  } else if (els.zoneMsg.textContent === MODES.endurance.playing) {
    els.zoneMsg.textContent = "Tiens bon !";
  }
}

function frame() {
  if (run.state !== "running") return;
  const now = performance.now();
  if (now >= run.endAt) { finish(); return; }
  if (run.mode === "endurance") {
    checkEndurance(now);
    if (run.state !== "running") return;
  }
  if (run.mode === "targets") Targets.update(now);
  draw(now);
  if (now - run.lastSave > SAVE_EVERY_MS) {
    run.lastSave = now;
    save();
  }
  run.raf = requestAnimationFrame(frame);
}

// Tout ce qui s'affiche pendant le test : au plus une fois par image
function draw(now) {
  const elapsed = now - run.startAt;
  const speed = liveCps(now);
  if (run.count !== run.shown) {
    run.shown = run.count;
    setCount(run.count);
    if (!REDUCED) els.tapBtn.animate([{ scale: 1.06 }, { scale: 1 }], { duration: 120 });
  }
  if (app.lifetime !== run.lastLifetime) renderLifetime();
  if (run.limited) {
    const clock = fmtClock(run.endAt - now);
    els.timeLeft.textContent = clock.text;
    els.timeLabel.textContent = clock.label;
  } else {
    els.timeLeft.textContent = fmtElapsed(elapsed);
  }

  let progress = elapsed / (run.endAt - run.startAt);
  if (run.mode === "goal") progress = run.count / run.cfg.n;
  if (run.mode === "endurance") progress = Math.min(1, speed / (run.cfg.cps * 2));
  els.progressFill.style.transform = `scaleX(${progress})`;

  if (run.mode === "targets") {
    const shots = run.count + run.misses;
    els.liveCps.textContent = shots ? `${Math.round((run.count / shots) * 100)} %` : "—";
  } else {
    els.liveCps.textContent = fmtCps(Math.round(speed * 10) / 10);
  }
  if (run.mode === "alt" && run.altDirty) {
    run.altDirty = false;
    els.zoneMsg.textContent = `Série : ${fmtInt(run.combo)} · Erreurs : ${fmtInt(run.errors)}`;
  }
  // Le bouton se met à trembler à partir de 7 CPS, de plus en plus fort
  setShake(app.shake && run.mode !== "targets" && speed >= 7 ? Math.min(6, Math.ceil((speed - 6) / 3)) : 0);
  flushFx();
  checkProgress();
}

function stop() {
  if (run.state === "idle" || run.state === "cooldown") return;
  checkProgress();
  cleanupRun();
  run.state = "idle";
  setLocked(false);
  resetHud();
  renderLifetime();
  commit();
  els.zoneMsg.textContent = idleMessage(true);
  els.result.innerHTML = `<span class="result-label">Arrêté</span><span class="muted small">Ce test ne compte pas dans les statistiques, mais tes clicks restent au compteur.</span>`;
  toast("Test arrêté ⏹");
}

// Meilleure pointe, rang et succès : vérifiés à chaque image et à la fin du test
function checkProgress() {
  if (run.peak <= app.peak) return;
  app.peak = run.peak;
  const rank = rankIndex(app.peak);
  const gotRank = rank > run.rank;
  if (gotRank) run.rank = rank;
  const won = ACHIEVEMENTS.filter((a) => app.peak >= a.cps && !app.achieved[a.cps]);
  won.forEach((a) => {
    app.achieved[a.cps] = Date.now();
    run.unlocked.push(a);
  });
  if (won.length) toast(`Succès débloqué : ${won[won.length - 1].cps} CPS ${won[won.length - 1].icon}`);
  else if (gotRank) toast(`Nouveau rang : ${rankText(rank)} !`);
  renderRank(gotRank || won.length > 0);
}

// Regroupe les morceaux de 0,1 s en quelques barres pour le graphique
function compressBuckets(d) {
  const raw = Math.max(1, Math.min(run.buckets.length, Math.ceil(d / BUCKET_MS)));
  const bars = Math.max(1, Math.min(TIMELINE_MAX, Math.max(Math.ceil(d / 1000), Math.min(10, raw))));
  const out = new Array(bars).fill(0);
  for (let k = 0; k < raw; k++) out[Math.min(bars - 1, Math.floor((k * bars) / raw))] += run.buckets[k];
  return out;
}

// Fin du test. « d » est le temps réalisé, pour les modes qui n'ont pas de durée fixe.
function finish(d) {
  if (run.state !== "running") return;
  const mode = run.mode;
  const escaped = mode === "targets" ? Targets.escaped : 0;
  checkProgress();
  const peakOfRun = run.peak;
  const unlocked = run.unlocked;
  cleanupRun();
  run.state = "cooldown";

  const c = run.count;
  const reachedGoal = mode !== "goal" || c >= run.cfg.n;
  const ms = run.limited ? run.cfg.ms : (d === undefined ? MAX_MS : d);
  const cps = cpsOf(c, ms);
  const shots = c + run.misses;
  const precision = shots ? Math.round((c / shots) * 100) : 0;

  // Le score de ce test (null : pas de score, ex. Endurance sans aucun click)
  let score = c;
  if (mode === "goal") score = reachedGoal ? ms : null;
  if (mode === "endurance") score = c > 0 ? ms : null;

  const list = app.records[mode];
  const prev = list[run.key];
  const isRecord = score !== null && score > 0 && (!prev || isBetter(mode, score, prev.v));
  const ch = app.challenge;
  const beatChallenge = ch && ch.mo === mode && ch.k === run.key && score !== null && isBetter(mode, score, ch.v) ? ch : null;

  // Statistiques
  const st = app.stats[mode];
  st.tests++;
  st.clicks += c;
  st.sumCps += cps;
  st.bestCps = Math.max(st.bestCps, cps);
  st.history.unshift(mode === "endurance" ? ms : cps);
  st.history.length = Math.min(st.history.length, HISTORY_MAX);
  st.last = { d: ms, c, b: compressBuckets(ms) };
  if (isRecord) {
    list[run.key] = { v: score, t: Date.now() };
    if (mode === "targets") list[run.key].p = precision;
    trimRecords(list);
  }
  if (score !== null) {
    app.recent.unshift({ mo: mode, k: run.key, v: score, cps, r: isRecord && !!prev });
    app.recent.length = Math.min(app.recent.length, RECENT_MAX);
  }
  if (beatChallenge) app.challenge = null;
  commit();

  // Affichage
  setCount(c);
  els.timeLeft.textContent = run.limited ? fmtClock(0).text : fmtElapsed(ms);
  els.progressFill.style.transform = `scaleX(${mode === "endurance" ? 0 : 1})`;
  els.liveCps.textContent = mode === "targets" ? (shots ? `${precision} %` : "—") : fmtCps(Math.round(cps * 10) / 10);
  els.zoneMsg.textContent = mode === "endurance" ? "Tu as décroché !" : "Terminé !";
  if (mode === "goal" && !reachedGoal) els.zoneMsg.textContent = "Temps écoulé !";

  els.result.innerHTML = resultHtml({ mode, c, ms, cps, score, precision, escaped, peakOfRun, prev, isRecord, beatChallenge });
  replay(els.result, "reveal");

  const label = keyLabel(mode, run.key);
  if (beatChallenge) {
    celebrate("DÉFI RÉUSSI !", `${fmtScore(mode, score)} · ${label}`);
  } else if (unlocked.length) {
    celebrate("SUCCÈS !", `${unlocked[unlocked.length - 1].cps} CPS débloqué ${unlocked[unlocked.length - 1].icon}`);
  } else if (rankIndex(app.peak) > run.rankStart) {
    celebrate("NOUVEAU RANG !", rankText(rankIndex(app.peak)));
  } else if (isRecord && prev) {
    celebrate("NOUVEAU RECORD !", `${fmtScore(mode, score)} · ${label}`);
  } else {
    replay(els.zone, "landed");
    burst(els.zone);
    Sound.chime();
    Haptics.buzz([20, 40, 30]);
  }

  renderStats();
  renderRecent();
  renderLifetime();

  run.timers.push(setTimeout(() => {
    run.state = "idle";
    setLocked(false);
    els.zoneMsg.textContent = idleMessage(true);
  }, COOLDOWN_MS));
}

function resultHtml({ mode, c, ms, cps, score, precision, escaped, peakOfRun, prev, isRecord, beatChallenge }) {
  const rank = rankText(rankIndex(peakOfRun));
  let main = fmtScore(mode, c);
  let sub = `en ${fmtDuration(ms)} · ${fmtCps(cps)} CPS · ${rank}`;
  if (mode === "goal") {
    main = score === null ? "Temps écoulé" : fmtPrecise(ms);
    sub = `${plural(c, "click")} · ${fmtCps(cps)} CPS · ${rank}`;
  } else if (mode === "targets") {
    main = `${plural(c, "cible")} touchée${c > 1 ? "s" : ""}`;
    sub = `Précision : ${precision} % · ${plural(escaped, "cible")} échappée${escaped > 1 ? "s" : ""} · ${fmtCps(cps)} CPS`;
  } else if (mode === "alt") {
    sub = `${plural(run.errors, "erreur")} · meilleure série : ${fmtInt(run.bestCombo)} · ${fmtCps(cps)} CPS · ${rank}`;
  } else if (mode === "endurance") {
    main = score === null ? "Aucun click" : fmtPrecise(ms);
    sub = `tenu à ${nf1.format(run.cfg.cps)} CPS ou plus · ${plural(c, "click")} · ${rank}`;
  }

  const label = keyLabel(mode, run.key);
  let line = "";
  if (beatChallenge) line = `Défi réussi : tu as battu ${fmtScore(mode, beatChallenge.v)} 🏆`;
  else if (isRecord && prev) line = `Nouveau record pour ${label} ! (avant : ${fmtScore(mode, prev.v)})`;
  else if (prev) line = `Record pour ${label} : ${fmtScore(mode, prev.v)}`;
  else if (isRecord) line = `Premier record pour ${label} !`;
  const ch = app.challenge;
  if (ch && ch.mo === mode && ch.k === run.key) line += `${line ? " · " : ""}Défi : bats ${fmtScore(mode, ch.v)}`;

  return `<span class="result-label">Résultat</span><strong>${escapeHtml(main)}</strong>` +
    `<span class="muted">${escapeHtml(sub)}</span>` +
    (line ? `<span class="muted small line">${escapeHtml(line)}</span>` : "");
}

// ---------- Réglages ----------

function setDuration(ms, quiet) {
  const over = ms > MAX_MS;
  const under = ms < MIN_MS;
  cfgNow().ms = clampMs(ms);
  els.durationWarn.classList.toggle("hidden", !over && !under);
  els.durationWarn.textContent = over ? "5 h maximum : la durée a été ramenée à 5 h." : "0,1 s minimum.";
  if (!quiet && (over || under)) [els.durH, els.durM, els.durS].forEach((i) => replay(i, "invalid"));
  configChanged();
}

function readDurationFields() {
  const read = (el) => Number(el.value.replace(",", ".")) || 0;
  return Math.max(0, (read(els.durH) * 3600 + read(els.durM) * 60 + read(els.durS)) * 1000);
}

function configChanged() {
  renderConfig();
  commit();
}

function quickValue() {
  const cfg = cfgNow();
  if (app.mode === "goal") return cfg.n;
  if (app.mode === "endurance") return cfg.cps;
  return cfg.ms;
}

function quickLabel(v) {
  if (app.mode === "goal") return fmtInt(v);
  if (app.mode === "endurance") return `${v} CPS`;
  return fmtDuration(v);
}

function applyQuick(v) {
  if (app.mode === "goal") {
    app.cfg.goal.n = v;
    configChanged();
  } else if (app.mode === "endurance") {
    app.cfg.endurance.cps = v;
    configChanged();
  } else {
    setDuration(v);
  }
}

function startLabel() {
  const icon = MODES[app.mode].icon;
  const cfg = cfgNow();
  switch (app.mode) {
    case "goal": return `${icon} Lancer · ${plural(cfg.n, "click")}`;
    case "targets": return `${icon} Lancer · niveau ${cfg.level}`;
    case "endurance": return `${icon} Lancer · ${nf1.format(cfg.cps)} CPS`;
    default: return `${icon} Lancer · ${fmtDuration(cfg.ms)}`;
  }
}

function readyText() {
  const key = recordKey(app.mode);
  const label = keyLabel(app.mode, key);
  const rec = app.records[app.mode][key];
  const ch = app.challenge;
  let extra = rec ? ` · ton record : ${fmtScore(app.mode, rec.v)}` : "";
  if (ch && ch.mo === app.mode && ch.k === key) extra = ` · 🏆 Défi : bats ${fmtScore(app.mode, ch.v)} !`;
  return `<span class="result-label">Prêt</span><span class="muted small">${escapeHtml(label)}${escapeHtml(extra)}</span>`;
}

function setRange(range, value) {
  range.value = value;
  const min = Number(range.min);
  const max = Number(range.max);
  range.style.setProperty("--fill", `${((value - min) / (max - min)) * 100}%`);
}

// La touche à presser est en jaune
function setAltNext(index) {
  if (altEls[run.next]) altEls[run.next].classList.remove("next");
  run.next = index;
  if (altEls[index]) altEls[index].classList.add("next");
}

function renderAltRow() {
  const alt = app.cfg.alt;
  const show = app.mode === "alt";
  els.altRow.classList.toggle("hidden", !show);
  els.altRow.innerHTML = "";
  altEls = [];
  if (!show) return;
  const labels = alt.input === "keys" ? alt.keys.map((k) => k.label) : Array.from({ length: alt.n }, (_, k) => String(k + 1));
  altEls = labels.map((label, k) => {
    const el = document.createElement(alt.input === "keys" ? "span" : "button");
    el.className = "alt-key";
    el.textContent = label;
    if (alt.input === "buttons") {
      el.type = "button";
      el.tabIndex = -1;
      el.dataset.alt = k;
    }
    el.addEventListener("animationend", () => el.classList.remove("wrong"));
    els.altRow.appendChild(el);
    return el;
  });
  run.next = 0;
  altEls[0].classList.add("next");
}

function renderAltSettings() {
  const alt = app.cfg.alt;
  const useKeys = alt.input === "keys";
  els.altInput.dataset.active = useKeys ? "0" : "1";
  els.altInput.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.input === alt.input));
  els.altKeysPanel.classList.toggle("hidden", !useKeys);
  els.altButtonsPanel.classList.toggle("hidden", useKeys);
  els.altKeys.innerHTML = alt.keys.map((k, i) => `
    <span class="key-chip"><span>${escapeHtml(k.label)}</span>
      <button type="button" class="key-del" data-del="${i}" aria-label="Retirer la touche ${escapeHtml(k.label)}" ${alt.keys.length <= MIN_KEYS ? "disabled" : ""}>✕</button>
    </span>`).join("") +
    (alt.keys.length < MAX_KEYS ? `<button type="button" id="addKeyBtn" class="btn btn-small key-add${capturingKey ? " listening" : ""}">${capturingKey ? "Appuie sur une touche…" : "➕ Ajouter une touche"}</button>` : "");
  els.altButtonCount.innerHTML = [2, 3, 4, 5, 6, 7, 8].map((n) => `<button type="button" class="chip${n === alt.n ? " active" : ""}" data-n="${n}">${n}</button>`).join("");
}

// Tout ce qui dépend des réglages du mode choisi
function renderConfig() {
  const cfg = cfgNow();
  if (hasDuration(app.mode)) {
    const { h, m, s } = splitMs(cfg.ms);
    els.durH.value = h;
    els.durM.value = m;
    els.durS.value = s;
    els.durationText.innerHTML = `Durée choisie : <strong>${escapeHtml(fmtDuration(cfg.ms))}</strong>`;
  }
  els.goalInput.value = app.cfg.goal.n;
  els.cpsInput.value = app.cfg.endurance.cps;
  const t = app.cfg.targets;
  setRange(els.levelRange, t.level);
  els.levelInput.value = t.level;
  setRange(els.sizeRange, t.size);
  els.sizeInput.value = t.size;
  setRange(els.countRange, t.count);
  els.countInput.value = t.count;
  renderAltSettings();
  els.startBtn.textContent = startLabel();
  const current = quickValue();
  els.quickPresets.querySelectorAll("[data-v]").forEach((b) => b.classList.toggle("active", Number(b.dataset.v) === current));
  if (run.state === "idle") {
    renderAltRow();
    resetHud();
    els.zoneMsg.textContent = idleMessage(false);
    els.result.innerHTML = readyText();
  }
  renderRecords();
}

// Tout ce qui change avec le mode
function renderMode() {
  const mode = app.mode;
  const info = MODES[mode];
  els.modeTabs.querySelectorAll("[data-mode]").forEach((b) => {
    const on = b.dataset.mode === mode;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on);
  });
  els.modeDesc.textContent = info.desc;
  els.modeHint.innerHTML = info.hint;
  MODE_IDS.forEach((m) => els.zone.classList.toggle(`mode-${m}`, m === mode));
  els.zone.classList.toggle("plain", mode === "targets" || mode === "alt");
  els.gaugeMark.classList.toggle("hidden", mode !== "endurance");
  els.panelGoal.classList.toggle("hidden", mode !== "goal");
  els.panelTargets.classList.toggle("hidden", mode !== "targets");
  els.panelAlt.classList.toggle("hidden", mode !== "alt");
  els.panelEndurance.classList.toggle("hidden", mode !== "endurance");
  els.panelDuration.classList.toggle("hidden", !hasDuration(mode));
  els.panelStart.classList.toggle("hidden", mode === "targets");
  els.keyboardOption.classList.toggle("hidden", mode === "targets" || mode === "alt");
  els.durationWarn.classList.add("hidden");
  els.statsTitle.textContent = `Statistiques · ${info.name}`;
  els.quickPresets.innerHTML = info.presets.map((v) => `<button class="chip" data-v="${v}">${quickLabel(v)}</button>`).join("");
  zoneRect = null;
  renderConfig();
  renderStats();
}

function renderTabs() {
  els.modeTabs.innerHTML = MODE_IDS.map((m) => `
    <button class="tab" role="tab" data-mode="${m}"><span class="badge" aria-hidden="true">${MODES[m].icon}</span>${MODES[m].name}</button>`).join("");
}

function setMode(mode) {
  if (run.state !== "idle" || mode === app.mode || !MODES[mode]) return;
  stopKeyCapture();
  app.mode = mode;
  Sound.click();
  renderMode();
  commit();
}

function renderStartMode() {
  const countdownMode = app.startMode === "countdown";
  els.startMode.dataset.active = countdownMode ? "1" : "0";
  els.startMode.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.mode === app.startMode));
  els.startInfo.textContent = countdownMode
    ? "⏳ Compte à rebours : après « Lancer », un décompte 3, 2, 1 s’affiche, puis le chrono part tout seul. Les clicks pendant le décompte ne comptent pas."
    : "👆 Au premier click : le chrono démarre à ton premier click, qui compte déjà. Aucune seconde perdue !";
}

// ---------- Touches de l'Alternance ----------

function keyCapLabel(e) {
  const names = { Space: "Espace", ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", Backspace: "Retour" };
  if (names[e.code]) return names[e.code];
  return (e.key.length === 1 ? e.key.toUpperCase() : e.key).slice(0, 10);
}

const isReservedKey = (e) => /^(Escape|Tab|Enter|NumpadEnter|CapsLock|ContextMenu|F\d+|(Meta|OS|Control|Alt|Shift)(Left|Right)?)$/.test(e.code) || !e.code;

function startKeyCapture() {
  capturingKey = true;
  renderAltSettings();
}

function stopKeyCapture() {
  if (!capturingKey) return;
  capturingKey = false;
  renderAltSettings();
}

function captureKey(e) {
  const keys = app.cfg.alt.keys;
  if (e.key === "Escape") {
    stopKeyCapture();
    return;
  }
  if (isReservedKey(e)) {
    toast("Cette touche n’est pas disponible, choisis-en une autre.");
    return;
  }
  if (keys.some((k) => k.code === e.code)) {
    toast("Cette touche est déjà dans ta liste.");
    return;
  }
  keys.push({ code: e.code, label: keyCapLabel(e) });
  capturingKey = false;
  Sound.click();
  configChanged();
}

// ---------- Statistiques ----------

function renderLifetime() {
  run.lastLifetime = app.lifetime;
  els.lifetime.textContent = fmtInt(app.lifetime);
}

function renderRank(full) {
  const index = rankIndex(app.peak);
  const rank = RANKS[index];
  const next = RANKS[index + 1];
  els.rankBest.textContent = app.peak ? `Meilleure pointe : ${fmtInt(app.peak)} CPS` : "Lance un test pour gagner ton rang !";
  if (next) {
    els.rankNextText.textContent = `Prochain rang : ${next.icon} ${next.name}`;
    els.rankNextValue.textContent = `${fmtInt(app.peak)} / ${next.min} CPS`;
    els.rankBar.style.width = `${((app.peak - rank.min) / (next.min - rank.min)) * 100}%`;
  } else {
    els.rankNextText.textContent = "Rang maximum : personne ne va plus vite !";
    els.rankNextValue.textContent = `${fmtInt(app.peak)} CPS`;
    els.rankBar.style.width = "100%";
  }
  if (!full) return;
  els.rankIcon.textContent = rank.icon;
  els.rankStep.textContent = `Rang ${index + 1} sur ${RANKS.length}`;
  els.rankName.textContent = rank.name;
  els.rankLadder.innerHTML = RANKS.map((r, k) => `
    <li class="rung${k < index ? " done" : ""}${k === index ? " current" : ""}">
      <span class="rung-icon" aria-hidden="true">${r.icon}</span>
      <span class="rung-name">${r.name}</span>
      <span class="rung-min">${r.min ? `${r.min} CPS` : "départ"}</span>
    </li>`).join("");
  els.achievements.innerHTML = ACHIEVEMENTS.map((a) => {
    const when = app.achieved[a.cps];
    const text = when ? `Le ${new Date(when).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}` : `${fmtInt(a.cps)} clicks en 1 seconde`;
    return `<div class="achievement${when ? " won" : ""}">
      <span class="achievement-icon" aria-hidden="true">${when ? a.icon : "🔒"}</span>
      <span class="achievement-text"><strong>${fmtInt(a.cps)} CPS</strong><small>${text}</small></span>
    </div>`;
  }).join("");
}

function renderStats() {
  const st = app.stats[app.mode];
  els.testTotal.textContent = fmtInt(st.tests);
  els.bestCps.textContent = st.tests ? fmtCps(st.bestCps) : "—";
  els.avgCps.textContent = st.tests ? fmtCps(st.sumCps / st.tests) : "—";
  els.clickTotal.textContent = fmtInt(st.clicks);
  renderTimeline();
  renderRecords();
  els.history.innerHTML = st.history.length
    ? st.history.map((v, k) => `<span class="history-item${k % 2 ? " alt" : ""}">${app.mode === "endurance" ? fmtPrecise(v) : `${fmtCps(v)} CPS`}</span>`).join("")
    : '<span class="muted">Aucun test pour l’instant.</span>';
}

function renderTimeline() {
  const last = app.stats[app.mode].last;
  if (!last || !last.b.length) {
    els.timeline.className = "timeline empty";
    els.timeline.textContent = "Lance un test pour voir ta vitesse ici.";
    els.timelineAxis.classList.add("hidden");
    els.timelineInfo.textContent = "";
    return;
  }
  const bucketMs = last.d / last.b.length;
  const rates = last.b.map((n) => cpsOf(n, bucketMs));
  const peak = Math.max(...rates);
  const peakIndex = rates.indexOf(peak);
  els.timeline.className = "timeline";
  els.timeline.innerHTML = rates.map((r, k) => {
    const from = fmtDuration(k * bucketMs);
    const to = fmtDuration((k + 1) * bucketMs);
    const h = peak > 0 ? Math.max(2, (r / peak) * 100) : 2;
    return `<span class="tl-bar${k === peakIndex && peak > 0 ? " peak" : ""}" style="height:${h}%;animation-delay:${k * 8}ms" title="De ${from} à ${to} : ${fmtCps(r)} CPS"></span>`;
  }).join("");
  els.axisEnd.textContent = fmtDuration(last.d);
  els.timelineAxis.classList.remove("hidden");
  els.timelineInfo.textContent = `${plural(last.c, "click")} en ${fmtDuration(last.d)} · pic de vitesse : ${fmtCps(peak)} CPS`;
}

function renderRecords() {
  const mode = app.mode;
  const list = app.records[mode];
  const keys = Object.keys(list);
  if (!keys.length) {
    els.records.innerHTML = '<p class="muted records-empty">Pas encore de record : à toi de jouer !</p>';
    return;
  }
  // Les réglages simples sont triés par valeur, les autres du plus récent au plus ancien
  if (mode === "time" || mode === "goal" || mode === "endurance") keys.sort((a, b) => Number(a) - Number(b));
  else keys.sort((a, b) => list[b].t - list[a].t);
  const current = recordKey(mode);
  const third = mode === "targets" ? "Précision" : "CPS";
  const headTitle = { time: "Durée", goal: "Objectif", targets: "Réglage", alt: "Réglage", endurance: "Vitesse" }[mode];
  els.records.innerHTML = `<table>
    <thead><tr><th>${headTitle}</th><th>Record</th>${mode === "endurance" ? "" : `<th>${third}</th>`}<th>Le</th></tr></thead>
    <tbody>${keys.map((k) => {
      const r = list[k];
      const date = new Date(r.t).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
      let extra = "";
      if (mode === "targets") extra = `<td>${r.p === undefined ? "—" : `${r.p} %`}</td>`;
      else if (mode === "goal") extra = `<td>${fmtCps(cpsOf(Number(k), r.v))}</td>`;
      else if (mode === "time") extra = `<td>${fmtCps(cpsOf(r.v, Number(k)))}</td>`;
      else if (mode === "alt") extra = `<td>${fmtCps(cpsOf(r.v, Number(k.split("-")[2])))}</td>`;
      return `<tr data-key="${escapeHtml(k)}" class="${k === current ? "active" : ""}" title="Remettre ce réglage">
        <td>${escapeHtml(keyLabel(mode, k))}</td><td><strong>${escapeHtml(fmtScore(mode, r.v))}</strong></td>${extra}<td class="muted">${date}</td></tr>`;
    }).join("")}</tbody></table>`;
}

// Clique sur un record : on remet son réglage
function applyRecordKey(mode, key) {
  const p = key.split("-").map(Number);
  const cfg = app.cfg[mode];
  if (mode === "goal") cfg.n = clampInt(key, MIN_GOAL, MAX_GOAL, cfg.n);
  else if (mode === "endurance") cfg.cps = clampCps(key, cfg.cps);
  else if (mode === "time") cfg.ms = clampMs(Number(key));
  else if (mode === "targets") {
    cfg.level = clampInt(p[0], 1, 100, cfg.level);
    cfg.size = clampInt(p[1], 20, 150, cfg.size);
    cfg.count = clampInt(p[2], 1, 20, cfg.count);
    cfg.ms = clampMs(p[3]);
  } else if (mode === "alt") {
    const [input] = key.split("-");
    cfg.input = input === "buttons" ? "buttons" : "keys";
    if (cfg.input === "buttons") cfg.n = clampInt(p[1], MIN_KEYS, MAX_KEYS, cfg.n);
    cfg.ms = clampMs(p[2]);
  }
}

function renderRecent() {
  els.recentList.innerHTML = app.recent.length
    ? app.recent.map((r) => `
      <li class="recent-item" title="${escapeHtml(MODES[r.mo].name)} · ${escapeHtml(keyLabel(r.mo, r.k))}">
        <span aria-hidden="true">${MODES[r.mo].icon}</span>
        <span class="recent-obj">${escapeHtml(MODES[r.mo].name)}</span>
        <span class="recent-arrow">→</span>
        <strong>${escapeHtml(fmtScore(r.mo, r.v))}${r.r ? " 🏆" : ""}</strong>
        <small class="muted">${fmtCps(r.cps)} CPS</small>
      </li>`).join("")
    : '<li class="muted small">Aucun test pour l’instant.</li>';
}

// ---------- Sauvegarde ----------

let saveTimer = null;
function commit() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 300);
}

function serialize() {
  return { v: 2, ...app };
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(serialize())); } catch (e) { /* stockage indisponible */ }
}

function savePrefs() {
  try {
    const all = JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...all, ...prefs }));
  } catch (e) { /* stockage indisponible */ }
}

const isCount = (n) => Number.isInteger(n) && n >= 0 && n < 1e15;
const isPositive = (n) => Number.isFinite(n) && n >= 0;
const isDuration = (d) => Number.isFinite(d) && d >= MIN_MS && d <= MAX_MS;

function sanitizeKeys(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const k of list) {
    if (!k || typeof k.code !== "string" || !/^[A-Za-z0-9]{1,24}$/.test(k.code) || typeof k.label !== "string" || !k.label) continue;
    if (out.some((o) => o.code === k.code) || out.length >= MAX_KEYS) continue;
    out.push({ code: k.code, label: k.label.slice(0, 10) });
  }
  return out.length >= MIN_KEYS ? out : null;
}

// Les réglages d'un mode, vérifiés un par un
function sanitizeCfg(mode, o) {
  const d = defaultCfg()[mode];
  if (!o || typeof o !== "object") return d;
  if ("ms" in d && isDuration(o.ms)) d.ms = clampMs(o.ms);
  if (mode === "goal") d.n = clampInt(o.n, MIN_GOAL, MAX_GOAL, d.n);
  if (mode === "endurance") d.cps = clampCps(o.cps, d.cps);
  if (mode === "targets") {
    d.level = clampInt(o.level, 1, 100, d.level);
    d.size = clampInt(o.size, 20, 150, d.size);
    d.count = clampInt(o.count, 1, 20, d.count);
  }
  if (mode === "alt") {
    if (o.input === "keys" || o.input === "buttons") d.input = o.input;
    d.keys = sanitizeKeys(o.keys) || d.keys;
    d.n = clampInt(o.n, MIN_KEYS, MAX_KEYS, d.n);
  }
  return d;
}

function sanitizeLast(l) {
  if (!l || !isPositive(l.d) || l.d <= 0 || !isCount(l.c) || !Array.isArray(l.b)) return null;
  if (!l.b.length || l.b.length > TIMELINE_MAX || !l.b.every(isCount)) return null;
  return { d: l.d, c: l.c, b: l.b };
}

function sanitizeStats(o) {
  const s = defaultStats();
  if (!o || typeof o !== "object") return s;
  if (isCount(o.tests)) s.tests = o.tests;
  if (isCount(o.clicks)) s.clicks = o.clicks;
  if (isPositive(o.sumCps)) s.sumCps = o.sumCps;
  if (isPositive(o.bestCps)) s.bestCps = o.bestCps;
  if (Array.isArray(o.history)) s.history = o.history.filter(isPositive).slice(0, HISTORY_MAX);
  s.last = sanitizeLast(o.last);
  return s;
}

function sanitizeRecords(mode, o) {
  const out = {};
  if (!o || typeof o !== "object") return out;
  for (const [k, r] of Object.entries(o)) {
    if (!KEY_FORMATS[mode].test(k) || !r || !isPositive(r.v) || !Number.isFinite(r.t)) continue;
    out[k] = { v: r.v, t: r.t };
    if (mode === "targets" && Number.isFinite(r.p)) out[k].p = Math.max(0, Math.min(100, Math.round(r.p)));
  }
  trimRecords(out);
  return out;
}

function sanitizeChallenge(c) {
  if (!c || !MODES[c.mo] || typeof c.k !== "string" || !KEY_FORMATS[c.mo].test(c.k) || !isPositive(c.v) || c.v <= 0) return null;
  return { mo: c.mo, k: c.k, v: c.v };
}

// Convertit une sauvegarde de la première version (un seul mode, le Chrono)
function upgradeOld(o) {
  const records = {};
  if (o.records && typeof o.records === "object") {
    for (const [k, r] of Object.entries(o.records)) if (r && isCount(r.c)) records[k] = { v: r.c, t: r.t };
  }
  const recent = Array.isArray(o.recent)
    ? o.recent.filter((r) => r && isDuration(r.d) && isCount(r.c)).map((r) => ({ mo: "time", k: String(r.d), v: r.c, cps: cpsOf(r.c, r.d), r: r.r === true }))
    : [];
  return {
    mode: "time",
    cfg: { time: { ms: o.durationMs } },
    startMode: o.startMode,
    keyboard: o.keyboard,
    ripple: o.effects,
    shake: o.effects,
    clickSound: o.effects,
    lifetime: o.totalClicks,
    stats: { time: { tests: o.tests, clicks: o.totalClicks, sumCps: o.sumCps, bestCps: o.bestCps, history: o.history, last: o.last } },
    records: { time: records },
    recent,
    challenge: o.challenge ? { mo: "time", k: String(o.challenge.d), v: o.challenge.c } : null,
  };
}

// Lit des données (sauvegarde ou fichier) en vérifiant tout
function sanitizeData(input) {
  const a = defaultApp();
  if (!input || typeof input !== "object") return a;
  const o = input.cfg ? input : upgradeOld(input);
  if (MODES[o.mode]) a.mode = o.mode;
  MODE_IDS.forEach((m) => {
    a.cfg[m] = sanitizeCfg(m, o.cfg && o.cfg[m]);
    a.stats[m] = sanitizeStats(o.stats && o.stats[m]);
    a.records[m] = sanitizeRecords(m, o.records && o.records[m]);
  });
  a.startMode = o.startMode === "countdown" ? "countdown" : "first";
  a.keyboard = o.keyboard === true;
  a.ripple = o.ripple !== false;
  a.shake = o.shake !== false;
  a.clickSound = o.clickSound !== false;
  if (isCount(o.lifetime)) a.lifetime = o.lifetime;
  if (isCount(o.peak)) a.peak = o.peak;
  if (o.achieved && typeof o.achieved === "object") {
    ACHIEVEMENTS.forEach((ac) => { if (Number.isFinite(o.achieved[ac.cps])) a.achieved[ac.cps] = o.achieved[ac.cps]; });
  }
  if (Array.isArray(o.recent)) {
    a.recent = o.recent
      .filter((r) => r && MODES[r.mo] && typeof r.k === "string" && KEY_FORMATS[r.mo].test(r.k) && isPositive(r.v) && isPositive(r.cps))
      .slice(0, RECENT_MAX)
      .map((r) => ({ mo: r.mo, k: r.k, v: r.v, cps: r.cps, r: r.r === true }));
  }
  a.challenge = sanitizeChallenge(o.challenge);
  return a;
}

function loadSave() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY));
    if (p) {
      prefs.sound = p.sound !== false;
      prefs.vibration = p.vibration !== false;
    }
  } catch (e) { /* rien à charger */ }
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (data && typeof data === "object") app = sanitizeData(data);
  } catch (e) { /* sauvegarde illisible : on garde les valeurs par défaut */ }
}

function askClearSave() {
  els.confirmDialog.returnValue = "";
  els.confirmDialog.showModal();
}

els.confirmDialog.addEventListener("close", () => {
  const answer = els.confirmDialog.returnValue;
  if (answer === "counter") {
    app.lifetime = 0;
    renderLifetime();
    commit();
    toast("Compteur de clicks remis à zéro 🗑️");
    return;
  }
  if (answer !== "ok") return;
  try {
    localStorage.removeItem(SAVE_KEY);
    const all = JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
    delete all.sound;
    delete all.vibration;
    localStorage.setItem(PREFS_KEY, JSON.stringify(all));
  } catch (e) { /* stockage indisponible */ }
  clearTimeout(saveTimer);
  resetRun();
  app = defaultApp();
  prefs.sound = prefs.vibration = true;
  renderAll();
  toast("Sauvegarde effacée 🗑️");
});

// ---------- Fichier de sauvegarde ----------

function exportFile() {
  const blob = new Blob([JSON.stringify(serialize(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "compteur-de-clicks-sauvegarde.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast("Fichier téléchargé 💾");
}

function importFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== "object" || !("cfg" in data || "durationMs" in data)) throw new Error("format");
      resetRun();
      app = sanitizeData(data);
      renderAll();
      commit();
      els.shareDialog.close();
      toast("Sauvegarde chargée depuis le fichier ✔");
    } catch (e) {
      toast("Ce fichier n’est pas une sauvegarde valide.");
    }
  };
  reader.readAsText(file);
}

// ---------- Lien de partage ----------

function b64urlEncode(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str) {
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function deflate(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

// Configuration réduite au minimum pour un lien court
function shareConfig() {
  const o = { mo: app.mode, c: cfgNow() };
  if (app.startMode === "countdown") o.m = 1;
  if (app.keyboard) o.k = 1;
  const rec = app.records[app.mode][recordKey(app.mode)];
  if (rec && els.challengeToggle.checked) o.s = rec.v;
  return o;
}

async function encodeShare() {
  const json = JSON.stringify(shareConfig());
  const plain = "j" + b64urlEncode(new TextEncoder().encode(json));
  if (!("CompressionStream" in window)) return plain;
  try {
    const packed = "z" + b64urlEncode(await deflate(json));
    return packed.length < plain.length ? packed : plain;
  } catch (e) {
    return plain;
  }
}

async function decodeShare(code) {
  const bytes = b64urlDecode(code.slice(1));
  const json = code[0] === "z" ? await inflate(bytes) : new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

// Un lien change les réglages (et lance un défi) mais garde les stats de la personne
function applyShare(cfg) {
  if (!cfg || typeof cfg !== "object") throw new Error("lien invalide");
  // Les premiers liens ne contenaient qu'une durée
  const data = isDuration(cfg.d) ? { mo: "time", c: { ms: cfg.d }, m: cfg.m, k: cfg.k, s: cfg.s } : cfg;
  if (!MODES[data.mo] || !data.c || typeof data.c !== "object") throw new Error("lien invalide");
  app.mode = data.mo;
  app.cfg[data.mo] = sanitizeCfg(data.mo, data.c);
  app.startMode = data.m === 1 ? "countdown" : "first";
  app.keyboard = data.k === 1;
  app.challenge = isPositive(data.s) && data.s > 0 ? { mo: data.mo, k: recordKey(data.mo), v: data.s } : null;
}

function extractCode(text) {
  const m = text.match(/[#?&]c=([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  const t = text.trim();
  return /^[zj][A-Za-z0-9_-]+$/.test(t) ? t : null;
}

async function loadCode(code) {
  const cfg = await decodeShare(code);
  applyShare(cfg);
  resetRun();
  renderAll();
  commit();
}

function sharedToast() {
  const ch = app.challenge;
  return ch
    ? `Défi chargé : bats ${fmtScore(ch.mo, ch.v)} ! 🏆`
    : "Réglages chargés depuis le lien 🔗";
}

async function refreshShareLink() {
  els.shareLink.value = "Création du lien…";
  const code = await encodeShare();
  els.shareLink.value = `${location.href.split("#")[0]}#c=${code}`;
}

async function openShare() {
  els.pasteError.classList.add("hidden");
  els.pasteLink.value = "";
  els.fileWarn.classList.toggle("hidden", location.protocol !== "file:");
  const key = recordKey(app.mode);
  const rec = app.records[app.mode][key];
  const label = keyLabel(app.mode, key);
  els.challengeToggle.disabled = !rec;
  els.challengeLabel.textContent = rec
    ? `Lancer un défi avec mon record (${fmtScore(app.mode, rec.v)})`
    : `Défi : pas encore de record pour ${label}`;
  els.shareDialog.showModal();
  await refreshShareLink();
  els.shareLink.select();
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(els.shareLink.value);
  } catch (e) {
    els.shareLink.select();
    document.execCommand("copy");
  }
  toast("Lien copié ! 🔗");
}

async function loadPasted() {
  const code = extractCode(els.pasteLink.value);
  try {
    if (!code) throw new Error("vide");
    await loadCode(code);
    els.shareDialog.close();
    toast(sharedToast());
  } catch (e) {
    els.pasteError.textContent = "Ce lien ne contient pas de configuration valide.";
    els.pasteError.classList.remove("hidden");
  }
}

async function loadFromHash() {
  const code = extractCode(location.hash);
  if (!code) return;
  try {
    await loadCode(code);
    toast(sharedToast());
  } catch (e) {
    toast("Le lien de configuration est invalide.");
  }
  history.replaceState(null, "", location.pathname + location.search);
}

// ---------- Préférences, thème, notifications ----------

function renderPrefs() {
  Sound.enabled = prefs.sound;
  Haptics.enabled = prefs.vibration;
  els.soundBtn.classList.toggle("off", !prefs.sound);
  els.soundBtn.setAttribute("aria-pressed", prefs.sound);
  els.soundBtn.title = prefs.sound ? "Sons activés" : "Sons coupés";
  els.vibBtn.classList.toggle("off", !prefs.vibration);
  els.vibBtn.setAttribute("aria-pressed", prefs.vibration);
  els.vibBtn.title = prefs.vibration
    ? (navigator.vibrate ? "Vibrations activées" : "Vibrations activées (sur téléphone uniquement)")
    : "Vibrations coupées";
}

let toastTimer = null;
function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600);
}

function renderAll() {
  els.keyboardToggle.checked = app.keyboard;
  els.rippleToggle.checked = app.ripple;
  els.shakeToggle.checked = app.shake;
  els.clickSoundToggle.checked = app.clickSound;
  renderStartMode();
  renderMode();
  renderRecent();
  renderRank(true);
  renderLifetime();
  renderPrefs();
}

// ---------- Événements ----------

els.soundBtn.addEventListener("click", () => {
  prefs.sound = !prefs.sound;
  renderPrefs();
  savePrefs();
  Sound.click();
  toast(prefs.sound ? "Sons activés 🔊" : "Sons coupés 🔇");
});
els.vibBtn.addEventListener("click", () => {
  prefs.vibration = !prefs.vibration;
  renderPrefs();
  savePrefs();
  Haptics.buzz(30);
  toast(prefs.vibration ? "Vibrations activées 📳" : "Vibrations coupées");
});
els.themeBtn.addEventListener("click", () => {
  prefs.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = prefs.theme;
  savePrefs();
});
els.shareBtn.addEventListener("click", openShare);
els.clearBtn.addEventListener("click", askClearSave);

const altIndexOf = (target) => {
  const b = target.closest ? target.closest("[data-alt]") : null;
  return b ? Number(b.dataset.alt) : undefined;
};

// La zone : « pointerdown » réagit dès que le bouton ou le doigt touche l'écran
// (plus rapide que « click ») et compte chaque doigt séparément.
// Au repos sur téléphone, on attend un vrai tap (« click ») pour ne pas lancer
// un test quand on fait juste défiler la page.
let touchTapPending = false;
els.zone.addEventListener("pointerdown", (e) => {
  run.touch = e.pointerType === "touch";
  if (run.touch && run.state === "idle") {
    touchTapPending = true;
    return;
  }
  touchTapPending = false;
  press(stamp(e), e.clientX, e.clientY, altIndexOf(e.target));
});
els.zone.addEventListener("pointercancel", () => { touchTapPending = false; });
els.zone.addEventListener("click", (e) => {
  if (!touchTapPending) return;
  touchTapPending = false;
  if (run.state === "idle") press(performance.now(), e.clientX, e.clientY, altIndexOf(e.target));
});
els.zone.addEventListener("contextmenu", (e) => e.preventDefault());
els.zone.addEventListener("dblclick", (e) => e.preventDefault());
window.addEventListener("resize", () => {
  zoneRect = null;
  if (run.state === "running" && run.mode === "targets") Targets.resize(els.zone.clientWidth, els.zone.clientHeight);
});
window.addEventListener("scroll", () => { zoneRect = null; }, { passive: true });
window.addEventListener("pagehide", save);

els.startBtn.addEventListener("click", launch);
els.stopBtn.addEventListener("click", stop);

els.modeTabs.addEventListener("click", (e) => {
  const b = e.target.closest("[data-mode]");
  if (b) setMode(b.dataset.mode);
});
els.quickPresets.addEventListener("click", (e) => {
  const b = e.target.closest("[data-v]");
  if (!b || run.state !== "idle") return;
  Sound.click();
  applyQuick(Number(b.dataset.v));
});

[els.durH, els.durM, els.durS].forEach((input) => {
  input.addEventListener("change", () => setDuration(readDurationFields()));
});
els.randDurBtn.addEventListener("click", () => {
  Sound.click();
  setDuration(randomLogInt(3, 120) * 1000);
});

els.goalInput.addEventListener("change", () => {
  app.cfg.goal.n = clampInt(els.goalInput.value, MIN_GOAL, MAX_GOAL, app.cfg.goal.n);
  configChanged();
});
els.randGoalBtn.addEventListener("click", () => {
  Sound.click();
  app.cfg.goal.n = randomLogInt(10, 2000);
  configChanged();
});
els.cpsInput.addEventListener("change", () => {
  app.cfg.endurance.cps = clampCps(els.cpsInput.value, app.cfg.endurance.cps);
  configChanged();
});

// Chaque réglage des cibles a un curseur et une case liés
[
  [els.levelRange, els.levelInput, "level", 1, 100],
  [els.sizeRange, els.sizeInput, "size", 20, 150],
  [els.countRange, els.countInput, "count", 1, 20],
].forEach(([range, input, key, min, max]) => {
  const apply = (el) => {
    app.cfg.targets[key] = clampInt(el.value, min, max, app.cfg.targets[key]);
    configChanged();
  };
  range.addEventListener("input", () => apply(range));
  input.addEventListener("change", () => apply(input));
});

els.altInput.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
  if (app.cfg.alt.input === b.dataset.input) return;
  Sound.click();
  stopKeyCapture();
  app.cfg.alt.input = b.dataset.input;
  configChanged();
}));
els.altKeys.addEventListener("click", (e) => {
  const del = e.target.closest("[data-del]");
  if (del) {
    if (app.cfg.alt.keys.length <= MIN_KEYS) return;
    Sound.click();
    app.cfg.alt.keys.splice(Number(del.dataset.del), 1);
    configChanged();
  } else if (e.target.closest("#addKeyBtn")) {
    Sound.click();
    if (capturingKey) stopKeyCapture();
    else startKeyCapture();
  }
});
els.altButtonCount.addEventListener("click", (e) => {
  const b = e.target.closest("[data-n]");
  if (!b) return;
  Sound.click();
  app.cfg.alt.n = Number(b.dataset.n);
  configChanged();
});

els.startMode.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
  if (app.startMode === b.dataset.mode) return;
  Sound.click();
  app.startMode = b.dataset.mode;
  renderStartMode();
  commit();
}));
[
  [els.keyboardToggle, "keyboard"],
  [els.rippleToggle, "ripple"],
  [els.shakeToggle, "shake"],
  [els.clickSoundToggle, "clickSound"],
].forEach(([toggle, key]) => toggle.addEventListener("change", () => {
  app[key] = toggle.checked;
  commit();
}));

els.records.addEventListener("click", (e) => {
  const row = e.target.closest("tr[data-key]");
  if (!row || run.state !== "idle") return;
  Sound.click();
  applyRecordKey(app.mode, row.dataset.key);
  configChanged();
  els.zone.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "center" });
});

els.resetBtn.addEventListener("click", () => {
  if (run.state !== "idle") return;
  app.stats = perMode(defaultStats);
  app.records = perMode(() => ({}));
  app.recent = [];
  renderStats();
  renderRecent();
  els.result.innerHTML = readyText();
  commit();
  toast("Statistiques remises à zéro (rang, succès et compteur gardés)");
});

els.challengeToggle.addEventListener("change", refreshShareLink);
els.copyLinkBtn.addEventListener("click", copyLink);
els.loadLinkBtn.addEventListener("click", loadPasted);
els.pasteLink.addEventListener("keydown", (e) => { if (e.key === "Enter") loadPasted(); });
els.exportBtn.addEventListener("click", exportFile);
els.importInput.addEventListener("change", () => {
  if (els.importInput.files[0]) importFile(els.importInput.files[0]);
  els.importInput.value = "";
});
window.addEventListener("hashchange", loadFromHash);

// Clavier : Espace lance, Échap arrête. En Alternance, tes touches font le jeu.
// Avec l'option « clavier », chaque touche enfoncée compte comme un click
// (rester appuyé ne compte qu'une fois).
function isTyping(target) {
  if (!(target instanceof Element)) return false;
  return target.closest("textarea, select, [contenteditable]") ||
    (target.matches("input") && !["range", "checkbox", "radio", "button", "color"].includes(target.type));
}
document.addEventListener("keydown", (e) => {
  if (document.querySelector("dialog[open]")) return;
  if (capturingKey) {
    e.preventDefault();
    if (!e.repeat) captureKey(e);
    return;
  }
  if (isTyping(e.target)) return;
  if (e.key === "Escape") {
    stop();
    return;
  }
  const shortcut = e.ctrlKey || e.metaKey || e.altKey || isReservedKey(e);
  const active = run.state === "armed" || run.state === "running";
  if (active && !shortcut) {
    if (app.mode === "alt" && app.cfg.alt.input === "keys") {
      const index = app.cfg.alt.keys.findIndex((k) => k.code === e.code);
      if (index >= 0 || e.code === "Space") e.preventDefault();
      if (index >= 0 && !e.repeat) press(stamp(e), undefined, undefined, index);
      return;
    }
    if (app.keyboard && (app.mode === "time" || app.mode === "goal" || app.mode === "endurance")) {
      e.preventDefault();
      if (!e.repeat) press(stamp(e));
      return;
    }
  }
  if (e.code === "Space" || (e.key === "Enter" && e.target === els.zone)) {
    e.preventDefault();
    if (!e.repeat && run.state === "idle") launch();
  }
});
document.addEventListener("keyup", (e) => {
  if (e.code === "Space" && !isTyping(e.target) && !document.querySelector("dialog[open]")) e.preventDefault();
});

$("year").textContent = new Date().getFullYear();

// ---------- Démarrage ----------

renderTabs();
loadSave();
renderAll();
loadFromHash();
