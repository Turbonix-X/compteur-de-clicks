// ===== Les cibles qui bougent (mode Cibles) =====
// Les positions sont calculées ici et le click est vérifié par le calcul :
// le résultat ne dépend pas de la vitesse d'affichage.

const Targets = (() => {
  const MIN_LEVEL = 1;
  const MAX_LEVEL = 100;
  let layer = null;
  let list = [];
  let width = 0;
  let height = 0;
  let last = 0;
  let escaped = 0;
  let speed = 0;
  let life = 0;
  let turnEvery = 0;
  let radius = 0;

  // Passe d'une valeur à l'autre de façon régulière entre le niveau 1 et le niveau 100
  function curve(level, from, to) {
    const k = (level - MIN_LEVEL) / (MAX_LEVEL - MIN_LEVEL);
    return from * Math.pow(to / from, k);
  }

  function aim(t) {
    const angle = Math.random() * Math.PI * 2;
    t.vx = Math.cos(angle) * speed;
    t.vy = Math.sin(angle) * speed;
    t.turn = turnEvery * (0.6 + Math.random() * 0.8);
  }

  function clampRadius() {
    return Math.max(6, Math.min(radius, Math.min(width, height) / 2 - 2));
  }

  function place(t) {
    const r = clampRadius();
    let best = null;
    // Quelques essais pour éviter de poser une cible sur une autre
    for (let k = 0; k < 8; k++) {
      const x = r + Math.random() * (width - 2 * r);
      const y = r + Math.random() * (height - 2 * r);
      best = { x, y };
      if (list.every((o) => o === t || Math.hypot(o.x - x, o.y - y) > r * 2.2)) break;
    }
    t.x = best.x;
    t.y = best.y;
    t.r = r;
    t.age = 0;
    aim(t);
    t.el.style.width = t.el.style.height = `${r * 2}px`;
    t.el.style.opacity = 1;
    draw(t);
    t.el.animate([{ scale: 0.2, opacity: 0 }, { scale: 1, opacity: 1 }], { duration: 160, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" });
  }

  function draw(t) {
    t.el.style.transform = `translate3d(${t.x - t.r}px, ${t.y - t.r}px, 0)`;
  }

  function start(element, w, h, options) {
    stop();
    layer = element;
    width = w;
    height = h;
    escaped = 0;
    radius = options.size / 2;
    // Sur un petit écran, les cibles vont moins vite : la difficulté reste la même
    speed = curve(options.level, 25, 900) * Math.min(1.2, Math.max(0.5, w / 800));
    life = curve(options.level, 7000, 700);
    turnEvery = curve(options.level, 3000, 300);
    last = performance.now();
    list = Array.from({ length: options.count }, () => {
      const el = document.createElement("span");
      el.className = "target";
      layer.appendChild(el);
      return { el, x: -1e4, y: -1e4, r: radius, vx: 0, vy: 0, age: 0, turn: 0 };
    });
    list.forEach(place);
  }

  function stop() {
    list.forEach((t) => t.el.remove());
    list = [];
  }

  function update(now) {
    // Si l'onglet était caché, on ne compte pas ce temps-là
    const dt = Math.min(50, now - last);
    last = now;
    for (const t of list) {
      t.age += dt;
      if (t.age >= life) {
        escaped++;
        place(t);
        continue;
      }
      t.turn -= dt;
      if (t.turn <= 0) aim(t);
      t.x += (t.vx * dt) / 1000;
      t.y += (t.vy * dt) / 1000;
      if (t.x < t.r) { t.x = t.r; t.vx = Math.abs(t.vx); }
      if (t.x > width - t.r) { t.x = width - t.r; t.vx = -Math.abs(t.vx); }
      if (t.y < t.r) { t.y = t.r; t.vy = Math.abs(t.vy); }
      if (t.y > height - t.r) { t.y = height - t.r; t.vy = -Math.abs(t.vy); }
      // La cible s'efface doucement juste avant de s'échapper
      const left = (life - t.age) / life;
      t.el.style.opacity = left < 0.25 ? 0.35 + (left / 0.25) * 0.65 : 1;
      draw(t);
    }
  }

  // Touche-t-on une cible en (x, y) ? La cible touchée réapparaît ailleurs.
  function hit(x, y, tolerance) {
    const dt = Math.min(50, performance.now() - last);
    for (let k = list.length - 1; k >= 0; k--) {
      const t = list[k];
      const dx = x - (t.x + (t.vx * dt) / 1000);
      const dy = y - (t.y + (t.vy * dt) / 1000);
      const reach = t.r + tolerance;
      if (dx * dx + dy * dy <= reach * reach) {
        place(t);
        return true;
      }
    }
    return false;
  }

  function resize(w, h) {
    width = w;
    height = h;
    list.forEach((t) => {
      t.r = clampRadius();
      t.x = Math.max(t.r, Math.min(width - t.r, t.x));
      t.y = Math.max(t.r, Math.min(height - t.r, t.y));
      t.el.style.width = t.el.style.height = `${t.r * 2}px`;
      draw(t);
    });
  }

  return {
    start, stop, update, hit, resize,
    get escaped() { return escaped; },
  };
})();
