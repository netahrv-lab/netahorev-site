/* netahorev.com: the snail, the trail, and the sidenotes. No dependencies. */
(() => {
  const doc = document.documentElement;
  const rtl = doc.dir === 'rtl';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lines = [];
  try { lines = JSON.parse(document.getElementById('snail-lines').textContent); } catch (e) { /* no lines, no talking */ }

  /* "Nudge curve": slow start, linear burst, long decaying tail (10/65/25 distance over 20/18/62 time). */
  function nudge(t) {
    if (t < 0.2) { const u = t / 0.2; return 0.10 * u * u * u; }
    if (t < 0.38) { const u = (t - 0.2) / 0.18; return 0.10 + 0.65 * u; }
    const u = (t - 0.38) / 0.62; return 0.75 + 0.25 * (1 - Math.pow(1 - u, 4));
  }

  /* ---------- speech ---------- */
  let lineIndex = 0;
  function talk(btn) {
    if (!lines.length) return;
    let say = btn.querySelector('.say');
    if (!say) { say = document.createElement('span'); say.className = 'say'; say.setAttribute('role', 'status'); btn.appendChild(say); }
    say.textContent = lines[lineIndex++ % lines.length];
    say.hidden = false;
    btn.classList.add('is-shy');
    clearTimeout(btn._t1); clearTimeout(btn._t2);
    btn._t1 = setTimeout(() => btn.classList.remove('is-shy'), 900);
    btn._t2 = setTimeout(() => { say.hidden = true; }, 3200);
  }
  document.querySelectorAll('.snail').forEach((b) => b.addEventListener('click', () => talk(b)));

  /* ---------- hero trail: the snail walks to whichever stop you point at ---------- */
  const path = document.querySelector('.path');
  const wrap = path && path.querySelector('.path__snail-wrap');
  const wide = matchMedia('(min-width: 900px)');
  if (path && wrap && path.querySelector('.path__line')) {
    const stops = [...path.querySelectorAll('li')];
    /* two trails: a wavy one across on desktop (1000x170 box), a winding one down on phones (1000x1000 box) */
    let line, total, vbH, stopLen, sizeW = 23, sizeH = 27;
    function setup() {
      const desk = wide.matches;
      line = path.querySelector(desk ? '.path__line--d' : '.path__line--m') || path.querySelector('.path__line');
      vbH = desk ? 170 : 1000;
      total = line.getTotalLength();
      stopLen = stops.map((li) => {
        const x = parseFloat(desk ? li.dataset.px : li.dataset.mx), y = parseFloat(desk ? li.dataset.py : li.dataset.my);
        let best = 0, bestD = Infinity;
        for (let i = 0; i <= 600; i++) {
          const l = (i / 600) * total, p = line.getPointAtLength(l);
          const d = (p.x - x) ** 2 + (p.y - y) ** 2;
          if (d < bestD) { bestD = d; best = l; }
        }
        return best;
      });
      const box = wrap.getBoundingClientRect();
      sizeW = box.width / 2 || 23; sizeH = (box.width * 42 / 64) || 27;
    }
    setup();
    let at = 0, raf = 0;
    const svgFlip = wrap.querySelector('svg');
    if (rtl && svgFlip) svgFlip.style.transform = 'scaleX(-1)';
    function place(l) {
      const W = path.clientWidth, H = wide.matches ? 170 : path.clientHeight;
      const p = line.getPointAtLength(l), q = line.getPointAtLength(Math.min(total, l + 4));
      const sx = W / 1000, sy = H / vbH;
      let x = p.x * sx; const y = p.y * sy;
      let ang = Math.atan2((q.y - p.y) * sy, (q.x - p.x) * sx) * 180 / Math.PI;
      if (rtl) { x = W - x; ang = -ang; }
      if (wide.matches) {
        ang = Math.max(-28, Math.min(28, ang));
      } else {
        /* on the vertical trail: stay upright, just face the way it's crawling */
        const dx = (q.x - p.x) * (rtl ? -1 : 1);
        if (svgFlip && Math.abs(dx) > 0.05) svgFlip.style.transform = dx > 0 ? 'scaleX(1)' : 'scaleX(-1)';
        ang = 0;
      }
      wrap.style.transform = `translate(${x - sizeW}px, ${y - sizeH}px) rotate(${ang}deg)`;
    }
    /* phones have no hover: the snail crawls down the trail as you scroll past it */
    let follow = 0, followRaf = 0, userWalk = 0;
    function scrollWalk() {
      if (wide.matches || reduce || Date.now() - userWalk < 1800) return;
      const r = path.getBoundingClientRect();
      const t = Math.min(1, Math.max(0, (innerHeight * 0.55 - r.top) / r.height));
      follow = Math.max(stopLen[0], t * total);
      cancelAnimationFrame(followRaf);
      const ease = () => {
        at += (follow - at) * 0.12;
        place(at);
        const snail = wrap.querySelector('.snail');
        if (Math.abs(follow - at) > 0.5) { snail.classList.add('is-moving'); followRaf = requestAnimationFrame(ease); }
        else snail.classList.remove('is-moving');
      };
      followRaf = requestAnimationFrame(ease);
    }
    addEventListener('scroll', scrollWalk, { passive: true });
    function walkTo(target) {
      cancelAnimationFrame(raf);
      const from = at, dist = target - from;
      if (Math.abs(dist) < 1) return;
      const snail = wrap.querySelector('.snail');
      if (reduce) { at = target; place(at); return; }
      const dur = Math.min(1700, 520 + Math.abs(dist) * 1.1);
      const t0 = performance.now();
      snail.classList.add('is-moving');
      const step = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        at = from + dist * nudge(t);
        place(at);
        if (t < 1) raf = requestAnimationFrame(step); else snail.classList.remove('is-moving');
      };
      raf = requestAnimationFrame(step);
    }
    place(0);
    stops.forEach((li, i) => {
      const a = li.querySelector('a');
      a.addEventListener('mouseenter', () => walkTo(stopLen[i]));
      a.addEventListener('focus', () => walkTo(stopLen[i]));
      a.addEventListener('touchstart', () => { userWalk = Date.now(); walkTo(stopLen[i]); }, { passive: true });
    });
    addEventListener('resize', () => place(at));
    wide.addEventListener('change', () => { cancelAnimationFrame(raf); setup(); at = 0; place(0); walkTo(stopLen[0]); });
    /* after the trail finishes drawing, the snail sets off toward the first stop */
    setTimeout(() => { if (at === 0) walkTo(stopLen[0]); }, reduce ? 0 : 2100);
  }

  /* ---------- top trail: reading progress, appears once the hero trail scrolls away ---------- */
  const bar = document.querySelector('.topbar');
  let ticking = false, idle;
  const barSnail = bar && bar.querySelector('.trail .snail');
  function progress() {
    const max = doc.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    bar.style.setProperty('--p', p.toFixed(4));
    ticking = false;
  }
  if (bar) {
    addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(progress); ticking = true; }
      if (barSnail && !reduce) {
        barSnail.classList.add('is-moving');
        clearTimeout(idle); idle = setTimeout(() => barSnail.classList.remove('is-moving'), 240);
      }
    }, { passive: true });
    addEventListener('resize', progress);
    progress();
    const hero = document.querySelector('.hero');
    if (hero && 'IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => bar.classList.toggle('is-trailing', !e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 })
        .observe(path || hero);
    }
  }

  /* ---------- top nav: mark the section in view ---------- */
  const navLinks = [...document.querySelectorAll('.topnav a')];
  if (navLinks.length && 'IntersectionObserver' in window) {
    const byId = new Map(navLinks.map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        navLinks.forEach((a) => a.removeAttribute('aria-current'));
        const a = byId.get(e.target.id); if (a) a.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    byId.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }

  /* ---------- sidenotes: pointing at a number lights its note in the margin ---------- */
  document.querySelectorAll('.sn-ref').forEach((ref) => {
    const note = ref.nextElementSibling;
    if (!note) return;
    const on = () => { ref.classList.add('is-lit'); note.classList.add('is-lit'); };
    const off = () => { ref.classList.remove('is-lit'); note.classList.remove('is-lit'); };
    ref.addEventListener('mouseenter', on); ref.addEventListener('mouseleave', off);
  });
})();
