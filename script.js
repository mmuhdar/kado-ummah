/* =====================================================================
   Yaumul Milad untuk Ummah — script.js
   Vanilla JS, tanpa library. Tiap modul berdiri sendiri di dalam satu IIFE
   supaya tidak ada variabel global.
   ===================================================================== */
(() => {
  'use strict';

  const root = document.documentElement;
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => motionQuery.matches;

  /* ------------------------------------------------------------------
     Pecah judul menjadi kata-kata bertopeng (untuk reveal per kata)
     ------------------------------------------------------------------ */
  function splitWords(el) {
    let index = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(' '); return; }
            const mask = document.createElement('span');
            const inner = document.createElement('span');
            mask.className = 'mask';
            inner.className = 'mask__in';
            inner.style.setProperty('--i', index++);
            inner.textContent = part;
            mask.append(inner);
            frag.append(mask);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child);
        }
      });
    };
    walk(el);
  }

  /* ------------------------------------------------------------------
     Reveal saat scroll (IntersectionObserver)
     ------------------------------------------------------------------ */
  const Reveal = (() => {
    let io = null;

    const show = (el) => {
      el.classList.add('in');
      el.dispatchEvent(new Event('revealed'));
    };

    function init() {
      // judul section: kata demi kata
      $$('.section__title').forEach(splitWords);

      // jeda bertingkat untuk anak-anak dalam wadah [data-stagger]
      $$('[data-stagger]').forEach((box) => {
        $$('[data-reveal]', box).forEach((el, i) => el.style.setProperty('--d', `${i * 130}ms`));
      });

      if (reduced() || !('IntersectionObserver' in window)) {
        $$('[data-reveal], .frame, .sign').forEach(show);
        return;
      }

      io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          show(entry.target);
          io.unobserve(entry.target);
        });
      }, { threshold: 0.14, rootMargin: '0px 0px -7% 0px' });

      // elemen di hero menunggu gerbang dibuka, jadi tidak ikut diamati
      $$('[data-reveal], .frame, .sign')
        .filter((el) => !el.closest('.hero'))
        .forEach((el) => io.observe(el));
    }

    return { init, show };
  })();

  /* ------------------------------------------------------------------
     Efek mengetik halus (hanya kalimat pembuka surat)
     ------------------------------------------------------------------ */
  const Typed = (() => {
    function init() {
      const el = $('#typed');
      if (!el) return;
      const live = $('.typed__live', el);
      const text = $('.typed__ghost', el).textContent.trim();

      if (reduced()) { live.textContent = text; el.classList.add('is-done'); return; }

      let started = false;
      el.addEventListener('revealed', () => {
        if (started) return;
        started = true;
        let i = 0;
        const step = () => {
          i += 1;
          live.textContent = text.slice(0, i);
          if (i >= text.length) { el.classList.add('is-done'); return; }
          const ch = text[i - 1];
          const pause = (ch === ',' || ch === '.') ? 380 : rand(48, 92);
          setTimeout(step, pause);
        };
        setTimeout(step, 600);
      });
    }
    return { init };
  })();

  /* ------------------------------------------------------------------
     Parallax sangat halus (rAF + throttle)
     ------------------------------------------------------------------ */
  const Parallax = (() => {
    const items = [];
    let ticking = false;

    const update = () => {
      ticking = false;
      const vh = window.innerHeight;
      items.forEach(({ el, host, factor }) => {
        const r = host.getBoundingClientRect();
        if (r.bottom < -40 || r.top > vh + 40) return;
        const offset = (r.top + r.height / 2 - vh / 2) * -factor;
        const limit = r.height * 0.05;             // sama dengan kelebihan hasil scale(1.1)
        el.style.transform = `translate3d(0, ${clamp(offset, -limit, limit).toFixed(1)}px, 0) scale(1.1)`;
      });
    };
    const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };

    function init() {
      if (reduced()) return;
      $$('[data-parallax]').forEach((el) => {
        items.push({ el, host: el.parentElement, factor: parseFloat(el.dataset.parallax) || 0.05 });
      });
      if (!items.length) return;
      window.addEventListener('scroll', request, { passive: true });
      window.addEventListener('resize', request, { passive: true });
      request();
    }
    return { init };
  })();

  /* ------------------------------------------------------------------
     Partikel halus di latar (canvas ringan, ≤ 34 butir)
     ------------------------------------------------------------------ */
  const Dust = (() => {
    const canvas = $('#dust');
    const ctx = canvas && canvas.getContext('2d');
    const COLORS = ['138,33,71', '154,118,131', '93,106,73'];   // marun, mauve, hijau daun
    let w = 0, h = 0, parts = [], raf = 0, last = 0, enabled = false;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const make = (anywhere) => ({
      x: rand(0, w),
      y: anywhere ? rand(0, h) : h + 12,
      r: rand(1.1, 2.6),
      vy: rand(5, 13),                 // px per detik, naik pelan
      sway: rand(6, 16),
      ph: rand(0, Math.PI * 2),
      a: rand(0.28, 0.6),
      star: Math.random() < 0.3,
      c: COLORS[(Math.random() * COLORS.length) | 0],
    });

    const drawStar = (x, y, r) => {
      ctx.beginPath();
      ctx.moveTo(x, y - r * 2.4);
      ctx.quadraticCurveTo(x, y, x + r * 2.4, y);
      ctx.quadraticCurveTo(x, y, x, y + r * 2.4);
      ctx.quadraticCurveTo(x, y, x - r * 2.4, y);
      ctx.quadraticCurveTo(x, y, x, y - r * 2.4);
      ctx.fill();
    };

    const frame = (t) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      ctx.clearRect(0, 0, w, h);
      parts.forEach((p, i) => {
        p.y -= p.vy * dt;
        p.ph += dt * 0.6;
        const x = p.x + Math.sin(p.ph) * p.sway;
        const fade = clamp(Math.min(p.y, h - p.y) / 80, 0, 1);   // memudar di tepi atas/bawah
        ctx.fillStyle = `rgba(${p.c},${(p.a * fade).toFixed(3)})`;
        if (p.star) drawStar(x, p.y, p.r); else { ctx.beginPath(); ctx.arc(x, p.y, p.r, 0, 6.2832); ctx.fill(); }
        if (p.y < -12) parts[i] = make(false);
      });
      raf = requestAnimationFrame(frame);
    };

    const play = () => {
      if (!enabled || raf || reduced() || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const pause = () => { cancelAnimationFrame(raf); raf = 0; };

    function start() {
      if (!ctx || reduced()) return;
      enabled = true;
      resize();
      const count = w < 600 ? 22 : 34;
      parts = Array.from({ length: count }, () => make(true));
      play();
    }

    function init() {
      if (!ctx) return;
      document.addEventListener('visibilitychange', () => (document.hidden ? pause() : play()));
      let t;
      window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { if (enabled) resize(); }, 200); });
      motionQuery.addEventListener('change', () => {
        if (reduced()) { pause(); ctx.clearRect(0, 0, w, h); } else if (enabled) { play(); }
      });
    }
    return { init, start };
  })();

  /* ------------------------------------------------------------------
     Tombol Aamiin: kelopak dan bintang jatuh pelan
     ------------------------------------------------------------------ */
  const Amin = (() => {
    const COLORS = ['#8a2147', '#a8405f', '#9a7683', '#d3b3bb', '#5d6a49'];
    const MESSAGE = 'Semoga Allah mengabulkannya, untukmu, untuk Hana, dan untuk si kecil yang kita nantikan.';

    function fall(box) {
      const vw = window.innerWidth, vh = window.innerHeight;
      const room = 44 - box.childElementCount;
      const count = clamp(room, 0, window.innerWidth < 600 ? 22 : 30);

      for (let n = 0; n < count; n++) {
        const el = document.createElement('i');
        const star = Math.random() < 0.3;
        const size = star ? rand(10, 18) : rand(9, 16);
        el.className = `petal ${star ? 'petal--star' : 'petal--leaf'}`;
        el.style.width = `${size}px`;
        el.style.height = `${star ? size : size * 1.5}px`;
        el.style.background = COLORS[(Math.random() * COLORS.length) | 0];
        box.append(el);

        const x0 = rand(-10, vw);
        const drift = rand(-90, 90);
        const amp = rand(14, 42);
        const ph = rand(0, 6.28);
        const spin = rand(180, 520) * (Math.random() < 0.5 ? -1 : 1);
        const rot0 = rand(0, 360);
        const steps = 6;
        const frames = Array.from({ length: steps + 1 }, (_, k) => {
          const t = k / steps;
          const x = x0 + drift * t + Math.sin(t * 6.28 + ph) * amp;
          const y = -30 + (vh + 60) * t;
          return {
            transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${(rot0 + spin * t).toFixed(0)}deg)`,
            opacity: t === 0 ? 0 : t > 0.88 ? 0 : 0.92,
            offset: t,
          };
        });
        const anim = el.animate(frames, {
          duration: rand(6500, 10000),
          delay: rand(0, 2400),
          easing: 'cubic-bezier(.35,.12,.55,1)',
          fill: 'both',
        });
        anim.onfinish = () => el.remove();
      }
    }

    function init() {
      const btn = $('#amin'), after = $('#aminAfter'), box = $('#petals');
      if (!btn) return;
      btn.addEventListener('click', () => {
        if (!after.textContent) after.textContent = MESSAGE;
        after.classList.add('is-on');
        if (!reduced()) fall(box);
      });
    }
    return { init };
  })();

  /* ------------------------------------------------------------------
     Gerbang pembuka
     ------------------------------------------------------------------ */
  const Gate = (() => {
    function startHero() {
      const hero = $('.hero');
      hero.classList.add('in');
      $$('[data-reveal]', hero).forEach((el, i) => {
        if (!el.style.getPropertyValue('--d')) el.style.setProperty('--d', `${800 + i * 140}ms`);
        el.classList.add('in');
      });
      $$('.frame', hero).forEach((el) => el.classList.add('in'));
    }

    function init() {
      const gate = $('#gate'), btn = $('#open'), main = $('#main');
      if (!gate || !btn) { root.classList.remove('is-locked'); return; }

      main.inert = true;                       // konten belum bisa difokuskan sebelum dibuka
      main.setAttribute('tabindex', '-1');
      let opened = false;

      btn.addEventListener('click', () => {
        if (opened) return;
        opened = true;
        window.scrollTo(0, 0);
        gate.classList.add('is-opening');

        const quick = reduced();
        setTimeout(() => {
          root.classList.add('is-open');
          startHero();
          Dust.start();
        }, quick ? 0 : 750);

        setTimeout(() => {
          gate.classList.add('is-gone');
          root.classList.remove('is-locked');
          main.inert = false;
          main.focus({ preventScroll: true });
        }, quick ? 60 : 2300);
      });
    }
    return { init };
  })();

  /* ------------------------------------------------------------------ */
  Reveal.init();
  Typed.init();
  Parallax.init();
  Dust.init();
  Amin.init();
  Gate.init();
})();
