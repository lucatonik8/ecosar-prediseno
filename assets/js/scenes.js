/* ============================================================
   scenes.js — visualizadores en canvas 2D
   · plot   : curva de producción diaria
   · globe  : esfera de puntos con arcos de presencia
   · panel  : filas de supervisión de la cartera
   · certs  : marquesina de certificaciones
   Todos son decorativos (aria-hidden) y se pausan fuera de pantalla.
   ============================================================ */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- utilidades ---------- */
  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function fitCanvas(cv) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = cv.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width * dpr));
    var h = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return { w: r.width, h: r.height, dpr: dpr };
  }
  function onScreen(el, cb) {
    if (!('IntersectionObserver' in window)) { cb(true); return; }
    new IntersectionObserver(function (e) { cb(e[0].isIntersecting); }, { threshold: 0.05 }).observe(el);
  }
  function noise1(x) {
    return (Math.sin(x * 12.9898) * 43758.5453) % 1;
  }
  function miles(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  /* ============================================================
     1. Curva de producción
     ============================================================ */
  (function plot() {
    var cv = document.getElementById('plotCanvas');
    var out = document.getElementById('plotVal');
    if (!cv) return;
    var ctx = cv.getContext('2d');
    if (!ctx) return;

    var PEAK = 1180;             // kW pico de la planta ilustrativa
    var START = 5.6, END = 21.4; // horas de sol representadas

    // Curva determinista: campana + nubes.
    function production(h) {
      if (h < START || h > END) return 0;
      var x = (h - START) / (END - START);
      var bell = Math.pow(Math.sin(Math.PI * x), 1.45);
      var cloud =
        0.10 * Math.sin(h * 2.7 + 1.2) +
        0.06 * Math.sin(h * 6.1 + 0.4) +
        0.04 * Math.sin(h * 11.3 + 2.9);
      var dip = h > 14.6 && h < 15.9 ? -0.22 * Math.sin((h - 14.6) / 1.3 * Math.PI) : 0;
      return Math.max(0, bell * (1 + cloud) + dip) * PEAK;
    }

    var head = 0;      // 0..1 posición del cabezal de lectura
    var running = false;
    onScreen(cv, function (v) { running = v; });

    function render() {
      var m = fitCanvas(cv);
      var W = cv.width, H = cv.height, d = m.dpr;
      var padL = 8 * d, padR = 8 * d, padT = 42 * d, padB = 26 * d;
      var gw = W - padL - padR, gh = H - padT - padB;

      var ink3 = css('--ink-3') || '#8a95a6';
      var hair = css('--hair') || '#3a4453';
      var signal = css('--signal') || '#ffab52';
      var live = css('--live') || '#6fd8e8';

      ctx.clearRect(0, 0, W, H);

      // rejilla
      ctx.strokeStyle = hair;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      for (var i = 0; i <= 4; i++) {
        var y = Math.round(padT + (gh * i) / 4) + 0.5;
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // horas
      ctx.fillStyle = ink3;
      ctx.font = (9 * d) + 'px "Martian Mono", ui-monospace, monospace';
      ctx.textBaseline = 'top';
      var hours = [6, 9, 12, 15, 18, 21];
      for (var k = 0; k < hours.length; k++) {
        var hx = padL + gw * ((hours[k] - START) / (END - START));
        ctx.fillText(('0' + hours[k]).slice(-2) + 'h', hx - 8 * d, H - padB + 7 * d);
      }

      var toX = function (t) { return padL + gw * t; };
      // con las nubes la curva puede pasar del pico nominal: hace falta aire arriba
      var toY = function (v) { return padT + gh * (1 - v / (PEAK * 1.32)); };

      // La curva completa se dibuja siempre: un panel de supervisión nunca
      // aparece vacío. El cabezal solo marca por dónde va la lectura.
      var N = 240;
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(0));
      for (var j = 0; j <= N; j++) {
        var tt = j / N;
        ctx.lineTo(toX(tt), toY(production(START + tt * (END - START))));
      }
      ctx.lineTo(toX(1), toY(0));
      ctx.closePath();
      var grad = ctx.createLinearGradient(0, padT, 0, padT + gh);
      grad.addColorStop(0, 'oklch(0.78 0.165 62 / 0.30)');
      grad.addColorStop(1, 'oklch(0.78 0.165 62 / 0.02)');
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      for (var j2 = 0; j2 <= N; j2++) {
        var t2 = j2 / N;
        var px = toX(t2), py = toY(production(START + t2 * (END - START)));
        if (j2 === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = signal;
      ctx.lineWidth = 1.8 * d;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // cabezal
      if (head > 0.001 && head < 0.999) {
        var cx = toX(head);
        ctx.strokeStyle = live;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx, padT); ctx.lineTo(cx, padT + gh); ctx.stroke();
        ctx.globalAlpha = 1;
        var cy = toY(production(START + head * (END - START)));
        ctx.fillStyle = live;
        ctx.beginPath(); ctx.arc(cx, cy, 3 * d, 0, Math.PI * 2); ctx.fill();
      }

      if (out) {
        var val = production(START + head * (END - START));
        out.textContent = miles(Math.round(val)) + ' kW';
      }
    }

    var last = 0;
    function loop(now) {
      requestAnimationFrame(loop);
      if (!running) return;
      if (now - last < 33) return;      // ~30 fps es de sobra
      last = now;
      head += 0.0032;
      if (head > 1) head = 0;
      render();
    }

    if (REDUCED) { head = 1; render(); window.addEventListener('resize', render); }
    else requestAnimationFrame(loop);
  })();

  /* ============================================================
     2. Globo de presencia
     ============================================================ */
  (function globe() {
    var cv = document.getElementById('globeCanvas');
    if (!cv) return;
    var ctx = cv.getContext('2d');
    if (!ctx) return;

    var SITES = [
      { n: 'Oviedo',    lat: 43.36, lon: -5.85, home: true },
      { n: 'Madrid',    lat: 40.42, lon: -3.70 },
      { n: 'Lisboa',    lat: 38.72, lon: -9.14 },
      { n: 'Rabat',     lat: 34.02, lon: -6.84 },
      { n: 'Nuakchot',  lat: 18.08, lon: -15.98 },
      { n: 'Varsovia',  lat: 52.23, lon: 21.01 },
      { n: 'Moscú',     lat: 55.75, lon: 37.62 },
      { n: 'Amán',      lat: 31.95, lon: 35.93 },
      { n: 'Doha',      lat: 25.28, lon: 51.53 },
      { n: 'Ciudad de México', lat: 19.43, lon: -99.13 },
      { n: 'São Paulo', lat: -23.55, lon: -46.63 },
      { n: 'Atacama',   lat: -26.25, lon: -69.62 },
      { n: 'Til-Til',   lat: -33.08, lon: -70.93 }
    ];
    var HOME = SITES[0];

    function toXYZ(lat, lon) {
      var a = lat * Math.PI / 180, b = lon * Math.PI / 180;
      return [Math.cos(a) * Math.cos(b), Math.sin(a), Math.cos(a) * Math.sin(b)];
    }

    // nube de puntos por espiral de Fibonacci
    var DOTS = [];
    (function () {
      var N = 1500, gr = Math.PI * (3 - Math.sqrt(5));
      for (var i = 0; i < N; i++) {
        var y = 1 - (i / (N - 1)) * 2;
        var r = Math.sqrt(Math.max(0, 1 - y * y));
        var th = gr * i;
        DOTS.push([Math.cos(th) * r, y, Math.sin(th) * r]);
      }
    })();

    var TILT = -0.42;
    var spin = 2.1, spinV = 0, dragging = false, lastX = 0;
    var running = false;
    onScreen(cv, function (v) { running = v; });

    function rotate(p, ang) {
      var c = Math.cos(ang), s = Math.sin(ang);
      var x = p[0] * c - p[2] * s;
      var z = p[0] * s + p[2] * c;
      var y = p[1];
      var ct = Math.cos(TILT), st = Math.sin(TILT);
      return [x, y * ct - z * st, y * st + z * ct];
    }

    function slerp(a, b, t) {
      var d = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
      var o = Math.acos(d);
      if (o < 1e-4) return a.slice();
      var s = Math.sin(o);
      var k1 = Math.sin((1 - t) * o) / s, k2 = Math.sin(t * o) / s;
      return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
    }

    var phase = 0;

    function render() {
      var m = fitCanvas(cv);
      var W = cv.width, H = cv.height, d = m.dpr;
      var cx = W / 2, cy = H / 2;
      var R = Math.min(W, H) * 0.38;

      var hair = css('--hair') || '#3a4453';
      var ink3 = css('--ink-3') || '#8a95a6';
      var signal = css('--signal') || '#ffab52';
      var live = css('--live') || '#6fd8e8';

      ctx.clearRect(0, 0, W, H);

      // meridiano exterior
      ctx.strokeStyle = hair;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;

      // puntos
      for (var i = 0; i < DOTS.length; i++) {
        var p = rotate(DOTS[i], spin);
        if (p[2] < -0.02) continue;
        var depth = p[2];
        var x = cx + p[0] * R, y = cy - p[1] * R;
        ctx.globalAlpha = 0.14 + depth * 0.72;
        ctx.fillStyle = ink3;
        var s = (0.65 + depth * 1.15) * d;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;

      // arcos desde Oviedo
      var h3 = toXYZ(HOME.lat, HOME.lon);
      for (var k = 1; k < SITES.length; k++) {
        var t3 = toXYZ(SITES[k].lat, SITES[k].lon);
        var seg = 46;
        var travel = (phase + k * 0.11) % 1;
        ctx.beginPath();
        var started = false;
        for (var j = 0; j <= seg; j++) {
          var u = j / seg;
          var q = slerp(h3, t3, u);
          var lift = 1 + 0.30 * Math.sin(Math.PI * u);
          var pr = rotate([q[0] * lift, q[1] * lift, q[2] * lift], spin);
          var vis = rotate(q, spin)[2] > -0.12;
          var px = cx + pr[0] * R, py = cy - pr[1] * R;
          if (vis) {
            if (!started) { ctx.moveTo(px, py); started = true; }
            else ctx.lineTo(px, py);
          } else { started = false; }
        }
        ctx.strokeStyle = signal;
        ctx.globalAlpha = 0.22;
        ctx.lineWidth = 1 * d;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // pulso viajero
        var qt = slerp(h3, t3, travel);
        var liftT = 1 + 0.30 * Math.sin(Math.PI * travel);
        var pt = rotate([qt[0] * liftT, qt[1] * liftT, qt[2] * liftT], spin);
        if (rotate(qt, spin)[2] > -0.08) {
          ctx.fillStyle = live;
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.arc(cx + pt[0] * R, cy - pt[1] * R, 1.9 * d, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // marcadores
      ctx.font = (9.5 * d) + 'px "Martian Mono", ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      for (var s2 = 0; s2 < SITES.length; s2++) {
        var site = SITES[s2];
        var pm = rotate(toXYZ(site.lat, site.lon), spin);
        if (pm[2] < 0.06) continue;
        var mx = cx + pm[0] * R, my = cy - pm[1] * R;
        var col = site.home ? signal : live;
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.globalAlpha = Math.min(1, 0.35 + pm[2]);

        ctx.beginPath();
        ctx.arc(mx, my, (site.home ? 3.4 : 2.4) * d, 0, Math.PI * 2);
        ctx.fill();

        if (site.home) {
          var pulse = (phase * 2) % 1;
          ctx.globalAlpha = (1 - pulse) * 0.7;
          ctx.lineWidth = 1 * d;
          ctx.beginPath();
          ctx.arc(mx, my, (3.4 + pulse * 13) * d, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (pm[2] > 0.42) {
          ctx.globalAlpha = Math.min(1, (pm[2] - 0.42) * 3.2);
          ctx.lineWidth = 1;
          ctx.strokeStyle = hair;
          ctx.beginPath();
          ctx.moveTo(mx + 5 * d, my);
          ctx.lineTo(mx + 13 * d, my);
          ctx.stroke();
          ctx.fillStyle = site.home ? signal : ink3;
          ctx.fillText(site.n, mx + 17 * d, my + 0.5 * d);
        }
        ctx.globalAlpha = 1;
      }
    }

    /* arrastre */
    cv.addEventListener('pointerdown', function (e) {
      // en táctil no se captura: el dedo sobre el globo tiene que poder
      // seguir haciendo scroll de la página
      if (e.pointerType === 'touch') return;
      dragging = true; lastX = e.clientX;
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX;
      lastX = e.clientX;
      spinV = dx * 0.006;
      spin += spinV;
    });
    ['pointerup', 'pointercancel'].forEach(function (ev) {
      cv.addEventListener(ev, function () { dragging = false; });
    });

    var last = 0;
    function loop(now) {
      requestAnimationFrame(loop);
      if (!running) return;
      if (now - last < 26) return;
      last = now;
      if (!dragging) {
        spinV *= 0.94;
        spin += spinV + 0.0016;
      }
      phase = (phase + 0.0036) % 1;
      render();
    }

    if (REDUCED) { render(); window.addEventListener('resize', render); }
    else requestAnimationFrame(loop);
  })();

  /* ============================================================
     3. Panel de supervisión
     ============================================================ */
  (function panel() {
    var host = document.getElementById('panelRows');
    if (!host) return;

    var ROWS = [
      { n: 'PV Til-Til · Santiago de Chile', base: 942, unit: 'kW', s: 'ok' },
      { n: 'Ayto. Tardelcuende · Soria', base: 311, unit: 'kW', s: 'ok' },
      { n: 'Nave Urbaser · Asturias', base: 78, unit: 'kW', s: 'ok' },
      { n: 'C.P. Santa Clara · Oviedo', base: 46, unit: 'kW', s: 'avi', tag: 'Rama 3 · −18 %' },
      { n: 'C.P. Vega Grande · Gijón', base: 0, unit: 'ACS', s: 'ok', fixed: 'En servicio' }
    ];

    host.innerHTML = ROWS.map(function (r, i) {
      return '<li>' +
        '<span class="p-name">' + r.n + '</span>' +
        '<span class="p-val" data-i="' + i + '">' + (r.fixed || (r.base + ' ' + r.unit)) + '</span>' +
        '<span class="p-tag" data-s="' + r.s + '">' + (r.tag || 'Normal') + '</span>' +
        '</li>';
    }).join('');

    if (REDUCED) return;

    var vals = host.querySelectorAll('.p-val');
    var running = false;
    onScreen(host, function (v) { running = v; });

    var tick = 0;
    setInterval(function () {
      if (!running) return;
      tick++;
      for (var i = 0; i < vals.length; i++) {
        var r = ROWS[+vals[i].dataset.i];
        if (r.fixed) continue;
        var wob = Math.sin(tick * 0.4 + i * 1.9) * 0.035 + (noise1(tick + i) - 0.5) * 0.02;
        var v = Math.max(0, Math.round(r.base * (1 + wob)));
        vals[i].textContent = miles(v) + ' ' + r.unit;
      }
    }, 1400);
  })();

  /* ============================================================
     4. Marquesina de certificaciones
     ============================================================ */
  (function certs() {
    var track = document.getElementById('marqueeTrack');
    if (!track) return;
    var items = [
      'Empresa instaladora de gas',
      'Empresa instaladora RITE',
      'Mantenedora de instalaciones térmicas',
      'ISO 9001',
      'Calidad, medio ambiente y PRL',
      'Parque Científico y Tecnológico de Gijón',
      'Constituida en 2005',
      'Delegación en Madrid'
    ];
    var run = items.map(function (t) { return '<span>' + t + '</span>'; }).join('');
    track.innerHTML = run + run;   // duplicado para el bucle sin costura
    if (!REDUCED) track.classList.add('is-running');
  })();
})();
