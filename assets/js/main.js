/* ============================================================
   main.js — arranque, scroll, revelaciones e interacción
   Regla: el contenido es visible por defecto. Nada depende de que
   una transición llegue a dispararse (hay red de seguridad a los 3 s).
   ============================================================ */
(function () {
  'use strict';

  var doc = document.documentElement;
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = typeof window.gsap !== 'undefined';
  var hasST = hasGsap && typeof window.ScrollTrigger !== 'undefined';

  doc.classList.add('js');
  if (hasST) gsap.registerPlugin(ScrollTrigger);

  var hero = document.querySelector('.hero');

  // En una demo el sitio tiene que abrir siempre por el principio: si el
  // navegador restaura el scroll, un F5 a mitad de reunión arranca por
  // donde se quedó en lugar de por el hero.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  /* ============================================================
     Scroll suave (Lenis)
     ============================================================ */
  var lenis = null;
  if (!REDUCED && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ duration: 1.05, smoothWheel: true, wheelMultiplier: 0.9 });
    if (hasST) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
    }
  }

  function goTo(target) {
    var el = document.querySelector(target);
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: -70 });
    else el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href === '#' || href === '#contenido') return;
    if (!document.querySelector(href)) return;
    e.preventDefault();
    goTo(href);
  });

  /* ============================================================
     Arranque
     ============================================================ */
  (function boot() {
    var boot = document.getElementById('boot');
    var bar = document.getElementById('bootBar');
    if (!boot) return;

    if (REDUCED) { boot.classList.add('is-done'); heroIn(true); return; }

    var finished = false;
    function finish(instant) {
      if (finished) return;
      finished = true;
      boot.classList.add('is-done');
      document.body.classList.remove('is-booting');
      heroIn(instant);
    }

    document.body.classList.add('is-booting');
    var t0 = performance.now();
    (function step(now) {
      var p = Math.min(1, (now - t0) / 1000);
      if (bar) bar.style.width = ((1 - Math.pow(1 - p, 3)) * 100).toFixed(1) + '%';
      if (p < 1) requestAnimationFrame(step);
      else finish(false);
    })(t0);

    // En una pestaña oculta requestAnimationFrame no corre: sin este relevo
    // por temporizador el arranque no terminaría nunca.
    setTimeout(function () { finish(document.hidden); }, 1500);
  })();

  // Última red: el hero queda en su estado final aunque no corra nada más.
  setTimeout(function () {
    if (hero) hero.classList.remove('is-armed');
  }, 3000);

  /* ============================================================
     Entrada del hero (la única coreografía de carga)
     Va con clases y transiciones CSS a propósito: una librería de
     animación se congela en pestañas ocultas y dejaría el hero en blanco.
     ============================================================ */
  (function armHero() {
    var lines = document.querySelectorAll('.hero__title .line');
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].querySelector('span')) continue;
      var inner = document.createElement('span');
      while (lines[i].firstChild) inner.appendChild(lines[i].firstChild);
      lines[i].appendChild(inner);
    }
    if (hero && !REDUCED) hero.classList.add('is-armed');
  })();

  function heroIn(instant) {
    if (!hero) return;
    if (instant || REDUCED) { hero.classList.remove('is-armed'); return; }
    requestAnimationFrame(function () { hero.classList.add('is-ready'); });
    // pase lo que pase, a los 2,6 s el hero está en su estado final
    setTimeout(function () { hero.classList.remove('is-armed'); }, 2600);
  }

  /* ============================================================
     Revelaciones por IntersectionObserver (fiables, con red)
     ============================================================ */
  var revealed = [];
  function observe(nodes, opts) {
    opts = opts || {};
    var cls = opts.cls || 'is-in';
    var list = Array.prototype.slice.call(nodes);
    if (!list.length) return;

    if (REDUCED || !('IntersectionObserver' in window)) {
      list.forEach(function (n) { n.classList.add(cls); });
      return;
    }
    list.forEach(function (n) { revealed.push([n, cls]); });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var idx = list.indexOf(en.target);
        var delay = opts.stagger ? Math.min(idx, 8) * opts.stagger : 0;
        setTimeout(function () { en.target.classList.add(cls); }, delay);
        io.unobserve(en.target);
      });
    }, { threshold: opts.threshold || 0.15, rootMargin: opts.rootMargin || '0px 0px -8% 0px' });

    list.forEach(function (n) { io.observe(n); });
  }
  // red de seguridad global
  setTimeout(function () {
    revealed.forEach(function (pair) { pair[0].classList.add(pair[1]); });
  }, 3000);

  /* h2: revelado con máscara, no un fade genérico */
  (function headings() {
    var hs = document.querySelectorAll('.h2, .work__title, .steps__head .h3');
    Array.prototype.forEach.call(hs, function (h) { h.classList.add('mask-up'); });
    observe(hs, { cls: 'is-in', threshold: 0.2 });
  })();

  /* filas de cifras: entran desplazadas desde el filete */
  (function figures() {
    var f = document.querySelectorAll('.fig, .reach__list li, .watch__bullets li, .contact__data > div');
    Array.prototype.forEach.call(f, function (n) { n.classList.add('row-in'); });
    observe(f, { cls: 'is-in', threshold: 0.35, stagger: 55 });
  })();

  /* bandas de obra: la foto se asienta, los datos entran después */
  observe(document.querySelectorAll('.work'), { threshold: 0.12, rootMargin: '0px 0px -12% 0px' });

  /* expediente: la línea superior se dibuja paso a paso */
  observe(document.querySelectorAll('.steps__list li'), { cls: 'is-on', threshold: 0.4, stagger: 90 });

  /* bloques de texto sueltos */
  (function softBlocks() {
    var b = document.querySelectorAll(
      '.readout__note, .works__intro, .reach__lead, .watch__lead, .contact__lead, .plot, .form, .work__spec, .work__mark'
    );
    Array.prototype.forEach.call(b, function (n) { n.classList.add('soft-in'); });
    observe(b, { cls: 'is-in', threshold: 0.15 });
  })();

  /* ============================================================
     Contadores
     ============================================================ */
  (function counters() {
    var nums = document.querySelectorAll('.num');
    if (!nums.length) return;

    // Separador de miles propio: toLocaleString('es-ES') no agrupa en compilaciones
    // de Chrome con ICU reducido y dejaba "9979" en lugar de "9.979".
    function miles(n) {
      return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function run(el) {
      var to = parseFloat(el.dataset.to || '0');
      var sep = el.hasAttribute('data-sep');
      if (REDUCED) {
        el.textContent = sep ? miles(to) : String(to);
        return;
      }
      var t0 = performance.now(), dur = 1500;
      (function step(now) {
        var p = Math.min(1, (now - t0) / dur);
        var e = 1 - Math.pow(1 - p, 4);
        var v = Math.round(to * e);
        el.textContent = sep ? miles(v) : String(v);
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    }

    if (!('IntersectionObserver' in window) || REDUCED) {
      Array.prototype.forEach.call(nums, run);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        run(en.target);
        io.unobserve(en.target);
      });
    }, { threshold: 0.6 });
    Array.prototype.forEach.call(nums, function (n) { io.observe(n); });
    setTimeout(function () {
      Array.prototype.forEach.call(nums, function (n) {
        if (n.textContent === '0') run(n);
      });
    }, 3000);
  })();

  /* ============================================================
     Manifiesto: las palabras se encienden con el scroll
     ============================================================ */
  (function manifesto() {
    var el = document.getElementById('manifesto');
    if (!el) return;
    var words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map(function (w) { return '<span class="w">' + w + '</span>'; }).join(' ');
    var spans = el.querySelectorAll('.w');

    if (REDUCED || !hasST) {
      Array.prototype.forEach.call(spans, function (s) { s.classList.add('on'); });
      return;
    }

    ScrollTrigger.create({
      trigger: el,
      start: 'top 78%',
      end: 'bottom 58%',
      scrub: 0.4,
      onUpdate: function (self) {
        var n = Math.round(self.progress * spans.length * 1.12);
        for (var i = 0; i < spans.length; i++) spans[i].classList.toggle('on', i < n);
      }
    });
    // si ScrollTrigger no llega a actualizar, se enciende igualmente
    setTimeout(function () {
      var lit = el.querySelectorAll('.w.on').length;
      var r = el.getBoundingClientRect();
      if (!lit && r.top < window.innerHeight * 0.5) {
        Array.prototype.forEach.call(spans, function (s) { s.classList.add('on'); });
      }
    }, 3000);
  })();

  /* ============================================================
     Capacidades: lista sticky sincronizada con el esquema
     ============================================================ */
  (function capabilities() {
    var items = document.querySelectorAll('.cap__item');
    var schems = document.querySelectorAll('.schem');
    if (!items.length) return;

    function activate(n) {
      Array.prototype.forEach.call(items, function (it) {
        it.classList.toggle('is-on', it.dataset.cap === String(n));
      });
      Array.prototype.forEach.call(schems, function (s) {
        var on = s.dataset.schem === String(n);
        if (on && !s.classList.contains('is-on')) {
          // reiniciar el trazado
          s.classList.remove('is-on');
          void s.offsetWidth;
        }
        s.classList.toggle('is-on', on);
      });
    }
    activate(1);

    if (REDUCED || !('IntersectionObserver' in window)) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) activate(en.target.dataset.cap);
      });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    Array.prototype.forEach.call(items, function (it) { io.observe(it); });
  })();

  /* ============================================================
     Navegación
     ============================================================ */
  (function nav() {
    var nav = document.getElementById('nav');
    if (!nav) return;
    var lastY = window.scrollY, ticking = false;

    function update() {
      var y = window.scrollY;
      nav.classList.toggle('is-solid', y > 40);
      if (y > 320 && y > lastY + 6) nav.classList.add('is-hidden');
      else if (y < lastY - 6 || y < 320) nav.classList.remove('is-hidden');
      lastY = y;
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();

    var clock = document.getElementById('navClock');
    if (clock) {
      (function tick() {
        var d = new Date();
        clock.textContent =
          ('0' + d.getHours()).slice(-2) + ':' +
          ('0' + d.getMinutes()).slice(-2) + ':' +
          ('0' + d.getSeconds()).slice(-2);
        setTimeout(tick, 1000);
      })();
    }
  })();

  /* ============================================================
     Cursor
     ============================================================ */
  (function cursor() {
    var el = document.getElementById('cursor');
    if (!el || REDUCED) return;
    if (!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;

    var x = window.innerWidth / 2, y = window.innerHeight / 2, tx = x, ty = y;
    window.addEventListener('pointermove', function (e) {
      tx = e.clientX; ty = e.clientY;
      el.classList.add('is-on');
    }, { passive: true });
    document.addEventListener('pointerleave', function () { el.classList.remove('is-on'); });

    var SEL = 'a,button,input,select,textarea,#globeCanvas,.work__fig';
    document.addEventListener('pointerover', function (e) {
      if (e.target.closest && e.target.closest(SEL)) el.classList.add('is-link');
    });
    document.addEventListener('pointerout', function (e) {
      if (e.target.closest && e.target.closest(SEL)) el.classList.remove('is-link');
    });

    (function loop() {
      requestAnimationFrame(loop);
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    })();
  })();

  /* ============================================================
     Distintivo de prediseño (tecla P para ocultar o mostrar)
     ============================================================ */
  (function badge() {
    var badge = document.getElementById('badge');
    var hide = document.getElementById('badgeHide');
    if (!badge) return;
    function toggle() { badge.classList.toggle('is-off'); }
    if (hide) hide.addEventListener('click', toggle);
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'p' && e.key !== 'P') return;
      var t = e.target.tagName;
      if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
      toggle();
    });
  })();

  /* ============================================================
     Formulario (boceto: no envía)
     ============================================================ */
  (function form() {
    var f = document.getElementById('form');
    var note = document.getElementById('formNote');
    if (!f) return;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!note) return;
      note.textContent = 'Boceto de diseño: aquí iría el envío al correo de Ecosar. Todavía no se manda nada.';
      note.style.color = 'oklch(0.780 0.165 62)';
    });
  })();

  /* refrescar medidas cuando cargan las imágenes */
  window.addEventListener('load', function () {
    if (hasST) ScrollTrigger.refresh();
  });
})();
