// ===== Compteur de Clicks — Turbonix Entertainment =====

const MIN_MS = 100;            // 0,1 s
const MAX_MS = 5 * 3600 * 1000; // 5 h
const DEFAULT_MS = 10000;
const HISTORY_MAX = 60;
const RECENT_MAX = 10;
const RECORDS_MAX = 50;
const TIMELINE_MAX = 60;       // nombre maximum de barres du dernier test
const COOLDOWN_MS = 900;       // pause après un test, pour ne pas en relancer un sans le vouloir
const SAVE_KEY = "cdc-save-v1";
const PREFS_KEY = "tx-prefs";
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

const PRESETS = [1, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600, 18000].map((s) => s * 1000);

// Le titre gagné selon la vitesse (clicks par seconde)
const RANKS = [
  [0, "🐢 Tortue"],
  [4, "🐇 Lapin"],
  [6, "🐆 Guépard"],
  [8, "⚡ Éclair"],
  [11, "🚀 Fusée"],
  [15, "🤖 Turbo-robot"],
];

const $ = (id) => document.getElementById(id);
const els = {
  soundBtn: $("soundBtn"),
  vibBtn: $("vibBtn"),
  shareBtn: $("shareBtn"),
  clearBtn: $("clearBtn"),
  themeBtn: $("themeBtn"),
  zone: $("clickZone"),
  timeLeft: $("timeLeft"),
  timeLabel: $("timeLabel"),
  liveCps: $("liveCps"),
  clickCount: $("clickCount"),
  zoneMsg: $("zoneMsg"),
  progressFill: $("progressFill"),
  result: $("result"),
  durationPresets: $("durationPresets"),
  startBtn: $("startBtn"),
  stopBtn: $("stopBtn"),
  recentList: $("recentList"),
  settingsSet: $("settingsSet"),
  durH: $("durH"),
  durM: $("durM"),
  durS: $("durS"),
  randDurBtn: $("randDurBtn"),
  durationText: $("durationText"),
  durationWarn: $("durationWarn"),
  startMode: $("startMode"),
  startInfo: $("startInfo"),
  keyboardToggle: $("keyboardToggle"),
  effectsToggle: $("effectsToggle"),
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

function defaultApp() {
  return {
    durationMs: DEFAULT_MS,
    startMode: "first",   // "first" : le chrono part au premier click · "countdown" : 3, 2, 1, go !
    keyboard: false,
    effects: true,
    tests: 0,
    totalClicks: 0,
    sumCps: 0,
    bestCps: 0,
    records: {},          // durée en ms → { c: clicks, t: date }
    recent: [],           // { d: durée, c: clicks, r: record ? }
    history: [],          // clicks/s, plus récent en premier
    last: null,           // { d, c, b: [clicks par morceau] }
    challenge: null,      // { d, c } reçu par un lien
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
  state: "idle",         // idle · armed · countdown · running · cooldown
  durationMs: DEFAULT_MS,
  count: 0,
  startAt: 0,
  endAt: 0,
  buckets: new Uint32Array(1),
  bucketMs: 1,
  ring: new Float64Array(8192), // heures des derniers clicks, pour la vitesse en direct
  ringPos: 0,
  endTimer: 0,
  raf: 0,
  shown: -1,
  lastTick: 0,
  lastBuzz: 0,
  timers: [],
};
const fxQueue = [];
let liveRipples = 0;
let zoneRect = null;
let wakeLock = null;

// ---------- Format ----------

const nf1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const fmtInt = (n) => Math.round(n).toLocaleString("fr-FR");
const fmtCps = (v) => (v >= 100 ? fmtInt(v) : nf2.format(v));

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

// Temps affiché en haut de la zone : « 9,4 » · « 4:59 » · « 4:59:59 »
function fmtClock(ms) {
  ms = Math.max(0, ms);
  if (ms >= 3600000) {
    const t = Math.ceil(ms / 1000);
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    return { text: `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`, label: "restant" };
  }
  if (ms >= 60000) {
    const t = Math.ceil(ms / 1000);
    return { text: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`, label: "restant" };
  }
  return { text: (Math.ceil(ms / 100) / 10).toLocaleString("fr-FR", { minimumFractionDigits: 1 }), label: "secondes" };
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

function rankOf(cps) {
  let r = RANKS[0][1];
  for (const [min, name] of RANKS) if (cps >= min) r = name;
  return r;
}

const cpsOf = (clicks, ms) => clicks / (ms / 1000);
const plural = (n, word) => `${fmtInt(n)} ${word}${n > 1 ? "s" : ""}`;

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

function celebrate(title, subtitle) {
  els.zone.classList.add("jackpot");
  const banner = document.createElement("div");
  banner.className = "banner";
  banner.innerHTML = `<span>${escapeHtml(title)}</span><small>${escapeHtml(subtitle)}</small>`;
  els.zone.appendChild(banner);
  setTimeout(() => {
    banner.remove();
    els.zone.classList.remove("jackpot");
  }, 3600);
  for (let k = 0; k < 4; k++) setTimeout(() => burst(els.zone, 40, true), k * 280);
  Sound.fanfare();
  Haptics.buzz([60, 40, 60, 40, 200]);
}

// Les ondes sont créées à l'image suivante (4 au plus par image, 24 à l'écran au plus),
// pour que les effets ne ralentissent jamais le comptage.
function flushFx() {
  if (!fxQueue.length) return;
  if (!zoneRect) zoneRect = els.zone.getBoundingClientRect();
  const n = Math.min(fxQueue.length, 4);
  for (let k = 0; k < n && liveRipples < 24; k++) {
    const { x, y } = fxQueue[fxQueue.length - 1 - k];
    const r = document.createElement("span");
    r.className = random() < 0.5 ? "click-ripple" : "click-ripple alt";
    r.style.left = `${x - zoneRect.left}px`;
    r.style.top = `${y - zoneRect.top}px`;
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

function setBusy(on) {
  document.body.classList.toggle("busy", on);
  els.zone.classList.toggle("rolling", on);
  els.startBtn.disabled = on;
  els.stopBtn.disabled = !on;
  els.settingsSet.disabled = on;
  els.durationPresets.querySelectorAll("button").forEach((b) => { b.disabled = on; });
}

function clearTimers() {
  run.timers.forEach(clearTimeout);
  run.timers = [];
  clearTimeout(run.endTimer);
  cancelAnimationFrame(run.raf);
}

async function lockScreen(on) {
  try {
    if (on && "wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* écran de veille non bloquable ici */ }
}

function resetHud(ms) {
  const clock = fmtClock(ms);
  els.timeLeft.textContent = clock.text;
  els.timeLabel.textContent = clock.label;
  els.liveCps.textContent = "0";
  els.clickCount.textContent = "0";
  els.clickCount.classList.remove("countdown");
  els.progressFill.style.transform = "scaleX(0)";
}

// Bouton principal ou Espace : prépare un test
function launch() {
  if (run.state !== "idle") return;
  prepare();
  if (app.startMode === "countdown") {
    countdown();
  } else {
    run.state = "armed";
    els.zone.classList.add("armed");
    els.zoneMsg.textContent = "À toi ! Le chrono part à ton premier click";
    Sound.click();
    els.zone.focus({ preventScroll: true });
  }
}

function prepare() {
  run.durationMs = app.durationMs;
  run.count = 0;
  run.shown = -1;
  run.ringPos = 0;
  run.ring.fill(-1e12);
  // Une barre par seconde (60 au plus), et au moins 10 barres pour un test court
  const d = run.durationMs;
  const n = Math.max(1, Math.min(TIMELINE_MAX, Math.max(Math.ceil(d / 1000), Math.min(10, Math.round(d / 100)))));
  run.buckets = new Uint32Array(n);
  run.bucketMs = run.durationMs / n;
  fxQueue.length = 0;
  zoneRect = els.zone.getBoundingClientRect();
  resetHud(run.durationMs);
  setBusy(true);
  els.result.innerHTML = `<span class="result-label">Test</span><span class="muted small">${escapeHtml(fmtDuration(run.durationMs))} · clique le plus vite possible !</span>`;
}

function countdown() {
  run.state = "countdown";
  els.zone.classList.remove("armed");
  els.zoneMsg.textContent = "Prépare-toi…";
  els.clickCount.classList.add("countdown");
  const steps = ["3", "2", "1"];
  steps.forEach((txt, k) => {
    run.timers.push(setTimeout(() => {
      els.clickCount.textContent = txt;
      if (!REDUCED) els.clickCount.animate([{ transform: "scale(1.6)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 350, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" });
      Sound.beep(660);
      Haptics.buzz(15);
    }, k * 800));
  });
  run.timers.push(setTimeout(() => {
    els.clickCount.classList.remove("countdown");
    els.clickCount.textContent = "0";
    Sound.beep(1320, 0.25);
    begin(performance.now());
  }, steps.length * 800));
}

function begin(t) {
  run.state = "running";
  run.startAt = t;
  run.endAt = t + run.durationMs;
  els.zone.classList.remove("armed");
  els.zoneMsg.textContent = "Clique ! Clique ! Clique !";
  if (app.startMode === "first") Sound.whoosh(0.5);
  Haptics.buzz(20);
  lockScreen(true);
  run.endTimer = setTimeout(() => finish(), run.durationMs + 20);
  run.raf = requestAnimationFrame(frame);
}

// Un click (ou un doigt, ou une touche). Volontairement minuscule : c'est lui qui
// décide combien de clicks par seconde le site peut encaisser.
function hit(t, x, y) {
  if (run.state === "running") {
    if (t >= run.endAt) { finish(); return; }
    run.count++;
    run.buckets[Math.min(run.buckets.length - 1, ((t - run.startAt) / run.bucketMs) | 0)]++;
    run.ring[run.ringPos] = t;
    run.ringPos = (run.ringPos + 1) & 8191;
    if (app.effects) {
      if (x !== undefined && fxQueue.length < 16) fxQueue.push({ x, y });
      if (t - run.lastTick > 35) { run.lastTick = t; Sound.tick(0.5); }
      if (t - run.lastBuzz > 60) { run.lastBuzz = t; Haptics.buzz(8); }
    }
    return;
  }
  if (run.state === "idle") {
    launch();
    if (app.startMode === "countdown") return;
  }
  if (run.state === "armed") {
    begin(t);
    hit(t, x, y); // ce premier click compte
  }
}

// Heure d'un événement, dans la même horloge que performance.now()
function stamp(e) {
  const now = performance.now();
  return e.timeStamp > 0 && Math.abs(e.timeStamp - now) < 1000 ? e.timeStamp : now;
}

// Vitesse en direct : le nombre de clicks pendant la dernière seconde
function liveCps(now) {
  const from = now - 1000;
  const ring = run.ring;
  let n = 0;
  let p = (run.ringPos - 1) & 8191;
  while (n < 8192 && ring[p] > from) {
    n++;
    p = (p - 1) & 8191;
  }
  const elapsed = now - run.startAt;
  return elapsed < 1000 && elapsed > 0 ? n * (1000 / Math.max(elapsed, 250)) : n;
}

function frame() {
  if (run.state !== "running") return;
  const now = performance.now();
  if (now >= run.endAt) { finish(); return; }
  if (run.count !== run.shown) {
    run.shown = run.count;
    els.clickCount.textContent = fmtInt(run.count);
    if (app.effects && !REDUCED) {
      els.clickCount.animate([{ transform: "scale(1.08)" }, { transform: "scale(1)" }], { duration: 120 });
    }
  }
  const clock = fmtClock(run.endAt - now);
  els.timeLeft.textContent = clock.text;
  els.timeLabel.textContent = clock.label;
  els.liveCps.textContent = fmtCps(liveCps(now));
  els.progressFill.style.transform = `scaleX(${(now - run.startAt) / run.durationMs})`;
  if (app.effects) flushFx();
  run.raf = requestAnimationFrame(frame);
}

function stop() {
  if (run.state === "idle" || run.state === "cooldown") return;
  clearTimers();
  lockScreen(false);
  run.state = "idle";
  setBusy(false);
  els.zone.classList.remove("armed");
  resetHud(app.durationMs);
  els.zoneMsg.textContent = "Test arrêté · clique ici pour recommencer";
  els.result.innerHTML = `<span class="result-label">Arrêté</span><span class="muted small">Ce test ne compte pas dans les statistiques.</span>`;
  toast("Test arrêté ⏹");
}

function finish() {
  if (run.state !== "running") return;
  clearTimers();
  lockScreen(false);
  run.state = "cooldown";
  fxQueue.length = 0;

  const d = run.durationMs;
  const c = run.count;
  const cps = cpsOf(c, d);
  const prev = app.records[d];
  const isRecord = c > 0 && (!prev || c > prev.c);
  const beatChallenge = app.challenge && app.challenge.d === d && c > app.challenge.c ? app.challenge : null;

  // Statistiques
  app.tests++;
  app.totalClicks += c;
  app.sumCps += cps;
  app.bestCps = Math.max(app.bestCps, cps);
  if (isRecord) app.records[d] = { c, t: Date.now() };
  trimRecords();
  app.history.unshift(cps);
  app.history.length = Math.min(app.history.length, HISTORY_MAX);
  app.recent.unshift({ d, c, r: isRecord && !!prev });
  app.recent.length = Math.min(app.recent.length, RECENT_MAX);
  app.last = { d, c, b: Array.from(run.buckets) };
  if (beatChallenge) app.challenge = null;
  commit();

  // Affichage
  els.clickCount.textContent = fmtInt(c);
  els.timeLeft.textContent = fmtClock(0).text;
  els.progressFill.style.transform = "scaleX(1)";
  els.liveCps.textContent = fmtCps(cps);
  els.zoneMsg.textContent = "Terminé !";
  setBusy(false);
  els.startBtn.disabled = true;

  let line = "";
  if (beatChallenge) line = `Défi réussi : tu as battu ${plural(beatChallenge.c, "click")} 🏆`;
  else if (isRecord && prev) line = `Nouveau record pour ${fmtDuration(d)} ! (avant : ${fmtInt(prev.c)})`;
  else if (prev) line = `Record pour ${fmtDuration(d)} : ${plural(prev.c, "click")}`;
  else if (c > 0) line = `Premier record pour ${fmtDuration(d)} !`;
  if (app.challenge && app.challenge.d === d && !beatChallenge) line += ` · Défi : bats ${plural(app.challenge.c, "click")}`;

  els.result.innerHTML = `<span class="result-label">Résultat</span><strong>${plural(c, "click")}</strong>` +
    `<span class="muted">en ${escapeHtml(fmtDuration(d))} · ${fmtCps(cps)} clicks/s · ${rankOf(cps)}</span>` +
    (line ? `<span class="muted small line">${escapeHtml(line)}</span>` : "");
  replay(els.result, "reveal");

  if (beatChallenge) {
    celebrate("DÉFI RÉUSSI !", `${plural(c, "click")} en ${fmtDuration(d)}`);
  } else if (isRecord && prev) {
    celebrate("NOUVEAU RECORD !", `${plural(c, "click")} en ${fmtDuration(d)}`);
  } else {
    replay(els.zone, "landed");
    burst(els.zone);
    Sound.chime();
    Haptics.buzz([20, 40, 30]);
  }

  renderStats();
  renderRecent();

  run.timers.push(setTimeout(() => {
    run.state = "idle";
    els.startBtn.disabled = false;
    els.zoneMsg.textContent = "Clique ici pour rejouer";
  }, COOLDOWN_MS));
}

// On garde les records des durées les plus jouées récemment, sans dépasser RECORDS_MAX
function trimRecords(a = app) {
  const keys = Object.keys(a.records);
  if (keys.length <= RECORDS_MAX) return;
  keys.sort((x, y) => a.records[x].t - a.records[y].t);
  keys.slice(0, keys.length - RECORDS_MAX).forEach((k) => delete a.records[k]);
}

// ---------- Durée ----------

function setDuration(ms, quiet) {
  const clamped = clampMs(ms);
  const over = ms > MAX_MS;
  const under = ms < MIN_MS;
  app.durationMs = clamped;
  els.durationWarn.classList.toggle("hidden", !over && !under);
  els.durationWarn.textContent = over ? "5 h maximum : la durée a été ramenée à 5 h." : "0,1 s minimum.";
  if (!quiet && (over || under)) [els.durH, els.durM, els.durS].forEach((i) => replay(i, "invalid"));
  renderDuration();
  commit();
}

function readDurationFields() {
  const h = Number(els.durH.value.replace(",", ".")) || 0;
  const m = Number(els.durM.value.replace(",", ".")) || 0;
  const s = Number(els.durS.value.replace(",", ".")) || 0;
  return Math.max(0, (h * 3600 + m * 60 + s) * 1000);
}

function renderDuration() {
  const { h, m, s } = splitMs(app.durationMs);
  els.durH.value = h;
  els.durM.value = m;
  els.durS.value = s;
  els.durationText.innerHTML = `Durée choisie : <strong>${escapeHtml(fmtDuration(app.durationMs))}</strong>`;
  els.startBtn.textContent = `⏱️ Lancer · ${fmtDuration(app.durationMs)}`;
  els.durationPresets.querySelectorAll("[data-ms]").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.ms) === app.durationMs);
  });
  if (run.state === "idle") {
    resetHud(app.durationMs);
    els.result.innerHTML = readyText();
  }
  renderRecords();
}

function renderPresets() {
  els.durationPresets.innerHTML = PRESETS.map((ms) => `<button class="chip" data-ms="${ms}">${fmtDuration(ms)}</button>`).join("");
}

function readyText() {
  const ch = app.challenge;
  const rec = app.records[app.durationMs];
  let extra = rec ? ` · ton record : ${plural(rec.c, "click")}` : "";
  if (ch && ch.d === app.durationMs) extra = ` · 🏆 Défi : bats ${plural(ch.c, "click")} !`;
  return `<span class="result-label">Prêt</span><span class="muted small">Test de ${escapeHtml(fmtDuration(app.durationMs))}${escapeHtml(extra)}</span>`;
}

function renderStartMode() {
  const countdownMode = app.startMode === "countdown";
  els.startMode.dataset.active = countdownMode ? "1" : "0";
  els.startMode.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.mode === app.startMode));
  els.startInfo.textContent = countdownMode
    ? "⏳ Compte à rebours : après « Lancer », un décompte 3, 2, 1 s’affiche, puis le chrono part tout seul. Les clicks pendant le décompte ne comptent pas."
    : "👆 Au premier click : après « Lancer » (ou directement en cliquant dans la zone), le chrono démarre à ton premier click, qui compte déjà. Aucune seconde perdue !";
}

// ---------- Statistiques ----------

function renderStats() {
  els.testTotal.textContent = fmtInt(app.tests);
  els.bestCps.textContent = app.tests ? fmtCps(app.bestCps) : "—";
  els.avgCps.textContent = app.tests ? fmtCps(app.sumCps / app.tests) : "—";
  els.clickTotal.textContent = fmtInt(app.totalClicks);
  renderTimeline();
  renderRecords();
  els.history.innerHTML = app.history.length
    ? app.history.map((v, k) => `<span class="history-item${k % 2 ? " alt" : ""}">${fmtCps(v)}/s</span>`).join("")
    : '<span class="muted">Aucun test pour l’instant.</span>';
}

function renderTimeline() {
  const last = app.last;
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
    return `<span class="tl-bar${k === peakIndex && peak > 0 ? " peak" : ""}" style="height:${h}%;animation-delay:${k * 8}ms" title="De ${from} à ${to} : ${fmtCps(r)} clicks/s"></span>`;
  }).join("");
  els.axisEnd.textContent = fmtDuration(last.d);
  els.timelineAxis.classList.remove("hidden");
  els.timelineInfo.textContent = `${plural(last.c, "click")} en ${fmtDuration(last.d)} · pic de vitesse : ${fmtCps(peak)} clicks/s`;
}

function renderRecords() {
  const keys = Object.keys(app.records).map(Number).sort((a, b) => a - b);
  if (!keys.length) {
    els.records.innerHTML = '<p class="muted records-empty">Pas encore de record : à toi de jouer !</p>';
    return;
  }
  els.records.innerHTML = `<table>
    <thead><tr><th>Durée</th><th>Record</th><th>Clicks/s</th><th>Le</th></tr></thead>
    <tbody>${keys.map((d) => {
      const r = app.records[d];
      const date = new Date(r.t).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
      return `<tr data-ms="${d}" class="${d === app.durationMs ? "active" : ""}" title="Rejouer ${fmtDuration(d)}">
        <td>${fmtDuration(d)}</td><td><strong>${fmtInt(r.c)}</strong></td><td>${fmtCps(cpsOf(r.c, d))}</td><td class="muted">${date}</td></tr>`;
    }).join("")}</tbody></table>`;
}

function renderRecent() {
  els.recentList.innerHTML = app.recent.length
    ? app.recent.map((r) => `
      <li class="recent-item">
        <span class="recent-obj">${fmtDuration(r.d)}</span>
        <span class="recent-arrow">→</span>
        <strong>${fmtInt(r.c)}${r.r ? " 🏆" : ""}</strong>
        <small class="muted">${fmtCps(cpsOf(r.c, r.d))} /s</small>
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
  return { v: 1, ...app };
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

const isCount = (n) => Number.isInteger(n) && n >= 0 && n < 1e12;
const isDuration = (d) => Number.isFinite(d) && d >= MIN_MS && d <= MAX_MS;

// Lit des données (sauvegarde ou fichier) en vérifiant tout
function sanitizeData(o) {
  const a = defaultApp();
  if (!o || typeof o !== "object") return a;
  if (isDuration(o.durationMs)) a.durationMs = clampMs(o.durationMs);
  a.startMode = o.startMode === "countdown" ? "countdown" : "first";
  a.keyboard = o.keyboard === true;
  a.effects = o.effects !== false;
  a.tests = isCount(o.tests) ? o.tests : 0;
  a.totalClicks = isCount(o.totalClicks) ? o.totalClicks : 0;
  a.sumCps = Number.isFinite(o.sumCps) && o.sumCps >= 0 ? o.sumCps : 0;
  a.bestCps = Number.isFinite(o.bestCps) && o.bestCps >= 0 ? o.bestCps : 0;
  if (o.records && typeof o.records === "object") {
    for (const [k, r] of Object.entries(o.records)) {
      const d = Number(k);
      if (isDuration(d) && r && isCount(r.c) && Number.isFinite(r.t)) a.records[d] = { c: r.c, t: r.t };
    }
  }
  if (Array.isArray(o.recent)) {
    a.recent = o.recent.filter((r) => r && isDuration(r.d) && isCount(r.c)).slice(0, RECENT_MAX).map((r) => ({ d: r.d, c: r.c, r: r.r === true }));
  }
  if (Array.isArray(o.history)) a.history = o.history.filter((v) => Number.isFinite(v) && v >= 0).slice(0, HISTORY_MAX);
  const l = o.last;
  if (l && isDuration(l.d) && isCount(l.c) && Array.isArray(l.b) && l.b.length <= TIMELINE_MAX && l.b.every(isCount)) a.last = { d: l.d, c: l.c, b: l.b };
  if (o.challenge && isDuration(o.challenge.d) && isCount(o.challenge.c)) a.challenge = { d: o.challenge.d, c: o.challenge.c };
  trimRecords(a);
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
  if (els.confirmDialog.returnValue !== "ok") return;
  try {
    localStorage.removeItem(SAVE_KEY);
    const all = JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
    delete all.sound;
    delete all.vibration;
    localStorage.setItem(PREFS_KEY, JSON.stringify(all));
  } catch (e) { /* stockage indisponible */ }
  stop();
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
      if (!data || typeof data !== "object" || !("durationMs" in data)) throw new Error("format");
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
  const o = { d: app.durationMs };
  if (app.startMode === "countdown") o.m = 1;
  if (app.keyboard) o.k = 1;
  if (!app.effects) o.f = 0;
  const rec = app.records[app.durationMs];
  if (rec && els.challengeToggle.checked) o.s = rec.c;
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
  if (!cfg || typeof cfg !== "object" || !isDuration(cfg.d)) throw new Error("lien invalide");
  app.durationMs = clampMs(cfg.d);
  app.startMode = cfg.m === 1 ? "countdown" : "first";
  app.keyboard = cfg.k === 1;
  app.effects = cfg.f !== 0;
  app.challenge = isCount(cfg.s) && cfg.s > 0 ? { d: app.durationMs, c: cfg.s } : null;
}

function extractCode(text) {
  const m = text.match(/[#?&]c=([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  const t = text.trim();
  return /^[zj][A-Za-z0-9_-]+$/.test(t) ? t : null;
}

async function loadCode(code) {
  stop();
  applyShare(await decodeShare(code));
  renderAll();
  commit();
}

function sharedToast() {
  return app.challenge
    ? `Défi chargé : bats ${plural(app.challenge.c, "click")} en ${fmtDuration(app.challenge.d)} ! 🏆`
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
  const rec = app.records[app.durationMs];
  els.challengeToggle.disabled = !rec;
  els.challengeLabel.textContent = rec
    ? `Lancer un défi avec mon record (${plural(rec.c, "click")} en ${fmtDuration(app.durationMs)})`
    : `Défi : pas encore de record pour ${fmtDuration(app.durationMs)}`;
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
  els.effectsToggle.checked = app.effects;
  els.durationWarn.classList.add("hidden");
  renderDuration();
  renderStartMode();
  els.zoneMsg.textContent = "Clique ici pour démarrer";
  renderStats();
  renderRecent();
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

// La zone : « pointerdown » réagit dès que le bouton ou le doigt touche l'écran
// (plus rapide que « click ») et compte chaque doigt séparément.
// Au repos sur téléphone, on attend un vrai tap (« click ») pour ne pas lancer
// un test quand on fait juste défiler la page.
let touchTapPending = false;
els.zone.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "touch" && run.state === "idle") {
    touchTapPending = true;
    return;
  }
  hit(stamp(e), e.clientX, e.clientY);
});
els.zone.addEventListener("click", (e) => {
  if (!touchTapPending) return;
  touchTapPending = false;
  if (run.state === "idle") hit(performance.now(), e.clientX, e.clientY);
});
els.zone.addEventListener("contextmenu", (e) => e.preventDefault());
els.zone.addEventListener("dblclick", (e) => e.preventDefault());
window.addEventListener("resize", () => { zoneRect = null; });
window.addEventListener("scroll", () => { zoneRect = null; }, { passive: true });

els.startBtn.addEventListener("click", launch);
els.stopBtn.addEventListener("click", stop);

els.durationPresets.addEventListener("click", (e) => {
  const b = e.target.closest("[data-ms]");
  if (!b || run.state !== "idle") return;
  Sound.click();
  setDuration(Number(b.dataset.ms));
});
[els.durH, els.durM, els.durS].forEach((input) => {
  input.addEventListener("change", () => setDuration(readDurationFields()));
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") setDuration(readDurationFields()); });
});
els.randDurBtn.addEventListener("click", () => {
  Sound.click();
  setDuration(randomLogInt(3, 120) * 1000);
});
els.startMode.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
  if (app.startMode === b.dataset.mode) return;
  Sound.click();
  app.startMode = b.dataset.mode;
  renderStartMode();
  commit();
}));
els.keyboardToggle.addEventListener("change", () => {
  app.keyboard = els.keyboardToggle.checked;
  commit();
});
els.effectsToggle.addEventListener("change", () => {
  app.effects = els.effectsToggle.checked;
  commit();
});

els.records.addEventListener("click", (e) => {
  const row = e.target.closest("tr[data-ms]");
  if (!row || run.state !== "idle") return;
  Sound.click();
  setDuration(Number(row.dataset.ms));
  els.zone.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "center" });
});

els.resetBtn.addEventListener("click", () => {
  if (run.state !== "idle") return;
  const keep = defaultApp();
  ["tests", "totalClicks", "sumCps", "bestCps", "records", "recent", "history", "last"].forEach((k) => { app[k] = keep[k]; });
  renderStats();
  renderRecent();
  els.result.innerHTML = readyText();
  commit();
  toast("Statistiques remises à zéro");
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

// Clavier : Espace lance, Échap arrête. Avec l'option « clavier », chaque touche
// enfoncée pendant le test compte comme un click (rester appuyé ne compte qu'une fois).
function isTyping(target) {
  if (!(target instanceof Element)) return false;
  return target.closest("textarea, select, [contenteditable]") ||
    (target.matches("input") && !["range", "checkbox", "radio", "button", "color"].includes(target.type));
}
document.addEventListener("keydown", (e) => {
  if (isTyping(e.target) || document.querySelector("dialog[open]")) return;
  if (e.key === "Escape") {
    stop();
    return;
  }
  const counting = run.state === "running" || (run.state === "armed" && app.startMode === "first");
  if (app.keyboard && counting) {
    e.preventDefault();
    if (!e.repeat) hit(stamp(e));
    return;
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

renderPresets();
loadSave();
renderAll();
loadFromHash();
