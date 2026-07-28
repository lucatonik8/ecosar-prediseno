/* ============================================================
   hero-gl.js — campo fotovoltaico raymarcheado (WebGL 1, sin librerías)
   Un solo contexto WebGL en toda la página.
   Degrada a un gradiente pintado si no hay contexto o si falla el shader.
   ============================================================ */
(function () {
  'use strict';

  var canvas = document.getElementById('heroGl');
  if (!canvas) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var VERT = [
    'attribute vec2 aPos;',
    'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var FRAG = [
    'precision highp float;',
    'uniform vec2  uRes;',
    'uniform float uTime;',
    'uniform vec2  uMouse;',
    'uniform float uScroll;',

    'const float PX = 6.4;',
    'const float PZ = 4.4;',

    'mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }',

    'float sdBox(vec3 p, vec3 b){',
    '  vec3 q = abs(p) - b;',
    '  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);',
    '}',

    'float hash21(vec2 p){',
    '  p = fract(p * vec2(123.34, 456.21));',
    '  p += dot(p, p + 45.32);',
    '  return fract(p.x * p.y);',
    '}',

    /* ---- escena: paneles + estructura ---- */
    'vec2 mapScene(vec3 p){',
    '  vec3 q = p;',
    '  vec2 cell = floor(q.xz / vec2(PX, PZ) + 0.5);',
    '  q.x -= PX * cell.x;',
    '  q.z -= PZ * cell.y;',
    /*   los seguidores no van todos exactamente igual */
    '  float tilt = 0.50 + 0.05 * sin(cell.y * 1.7 + cell.x * 0.9) + 0.05 * sin(uTime * 0.11 + cell.y * 0.3);',
    '  vec3 pp = q - vec3(0.0, 1.66, 0.0);',
    '  pp.yz = rot(tilt) * pp.yz;',
    '  float dPanel = sdBox(pp, vec3(2.55, 0.045, 1.44));',
    '  float dTube  = sdBox(q - vec3(0.0, 1.16, 0.0), vec3(2.62, 0.055, 0.055));',
    '  float dPost  = sdBox(vec3(abs(q.x) - 1.75, q.y - 0.60, q.z), vec3(0.07, 0.62, 0.07));',
    '  float dStruct = min(dTube, dPost);',
    '  vec2 res = vec2(dPanel, 1.0);',
    '  if (dStruct < res.x) res = vec2(dStruct, 2.0);',
    '  return res;',
    '}',

    'vec3 calcNormal(vec3 p){',
    '  vec2 e = vec2(0.0015, 0.0);',
    '  return normalize(vec3(',
    '    mapScene(p + e.xyy).x - mapScene(p - e.xyy).x,',
    '    mapScene(p + e.yxy).x - mapScene(p - e.yxy).x,',
    '    mapScene(p + e.yyx).x - mapScene(p - e.yyx).x));',
    '}',

    'vec3 skyColor(vec3 rd, vec3 sunDir){',
    '  float h = clamp(rd.y * 0.5 + 0.5, 0.0, 1.0);',
    '  vec3 low  = vec3(0.520, 0.268, 0.108);',
    '  vec3 mid  = vec3(0.098, 0.106, 0.150);',
    '  vec3 high = vec3(0.030, 0.038, 0.062);',
    '  vec3 c = mix(low, mid, smoothstep(0.470, 0.585, h));',
    '  c = mix(c, high, smoothstep(0.570, 0.900, h));',
    '  float d = max(dot(rd, sunDir), 0.0);',
    '  c += vec3(1.00, 0.74, 0.40) * pow(d, 800.0) * 7.0;',
    '  c += vec3(0.90, 0.50, 0.20) * pow(d, 9.0) * 0.30;',
    '  return c;',
    '}',

    /* sombra blanda barata: solo se usa en el suelo */
    'float shadow(vec3 ro, vec3 rd){',
    '  float res = 1.0, t = 0.08;',
    '  for (int i = 0; i < 20; i++){',
    '    float h = mapScene(ro + rd * t).x;',
    '    res = min(res, 9.0 * h / t);',
    '    t += clamp(h, 0.10, 1.4);',
    '    if (res < 0.02 || t > 26.0) break;',
    '  }',
    '  return clamp(res, 0.0, 1.0);',
    '}',

    'void main(){',
    '  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;',
    '  float t = uTime;',

    /* ---- cámara: por encima del campo, mirando hacia el sol bajo ---- */
    '  vec3 ro = vec3(1.3 * sin(t * 0.045) + uMouse.x * 1.0, 3.95 + uScroll * 7.5, t * 1.45);',
    '  float pitch = -0.150 - uScroll * 0.26 + uMouse.y * 0.035;',
    '  float yaw   = uMouse.x * 0.070 + sin(t * 0.03) * 0.02;',
    '  vec3 fw = normalize(vec3(sin(yaw), pitch, cos(yaw)));',
    '  vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));',
    '  vec3 up = cross(fw, rt);',
    '  vec3 rd = normalize(uv.x * rt + uv.y * up + 1.42 * fw);',

    '  vec3 sunDir = normalize(vec3(-0.50, 0.125 + 0.02 * sin(t * 0.04), 1.0));',
    '  vec3 col = skyColor(rd, sunDir);',

    /* ---- suelo analítico ---- */
    '  float tGround = (rd.y < -0.0008) ? (-ro.y / rd.y) : 1e9;',
    '  float tMax = min(tGround, 105.0);',

    /* ---- raymarch de los paneles, acotado por el suelo ---- */
    '  float tt = 0.05;',
    '  float mat = 0.0;',
    '  for (int i = 0; i < 96; i++){',
    '    vec3 p = ro + rd * tt;',
    '    vec2 h = mapScene(p);',
    '    if (h.x < 0.0016 * tt + 0.0012){ mat = h.y; break; }',
    '    tt += h.x * 0.62;',
    '    if (tt > tMax) break;',
    '  }',

    '  vec3 pos; vec3 nor;',
    '  bool hit = false;',
    '  if (mat > 0.5 && tt < tMax){',
    '    pos = ro + rd * tt; nor = calcNormal(pos); hit = true;',
    '  } else if (tGround < 105.0){',
    '    tt = tGround; pos = ro + rd * tt; nor = vec3(0.0, 1.0, 0.0); mat = 0.0; hit = true;',
    '  }',

    '  if (hit){',
    '    float diff = clamp(dot(nor, sunDir), 0.0, 1.0);',
    '    vec3 ref = reflect(rd, nor);',
    '    vec3 base; float spec; float rough;',

    '    if (mat < 0.5){',
    /*     suelo: tierra oscura con grano */
    '      float g = hash21(floor(pos.xz * 3.0));',
    '      base = mix(vec3(0.085, 0.072, 0.060), vec3(0.125, 0.104, 0.084), g);',
    '      spec = 0.03; rough = 1.0;',
    '      float sh = shadow(pos + nor * 0.05, sunDir);',
    '      diff *= sh;',
    '    } else if (mat < 1.5){',
    /*     vidrio del panel: casi negro azulado, muy especular */
    '      base = vec3(0.014, 0.019, 0.034);',
    '      spec = 1.0; rough = 0.05;',
    '    } else {',
    /*     estructura: aluminio mate */
    '      base = vec3(0.34, 0.35, 0.39);',
    '      spec = 0.20; rough = 0.55;',
    '    }',

    '    vec3 lit = base * (vec3(1.00, 0.66, 0.36) * diff * 1.45 + vec3(0.10, 0.13, 0.20) * 0.9);',

    /*   reflexión del cielo: es lo que hace brillar el campo, pero si se */
    /*   deja suelta el vidrio se vuelve beige. Fresnel afilado y tinte frío. */
    '    float fres = pow(1.0 - clamp(dot(nor, -rd), 0.0, 1.0), 5.0);',
    '    vec3 refCol = skyColor(ref, sunDir);',
    '    if (mat > 0.5 && mat < 1.5) refCol *= vec3(0.80, 0.86, 1.00);',
    '    lit += refCol * spec * (0.05 + 0.95 * fres);',

    /*   destello especular directo del sol */
    '    float sp = pow(clamp(dot(ref, sunDir), 0.0, 1.0), mix(12.0, 3000.0, 1.0 - rough));',
    '    lit += vec3(1.0, 0.78, 0.46) * sp * spec * 3.4;',

    /*   niebla hacia el color del cielo */
    '    float fog = 1.0 - exp(-pow(tt * 0.0132, 1.75));',
    '    col = mix(lit, skyColor(rd, sunDir), fog);',
    '  }',

    /* ---- acabado: viñeta, grano y curva ---- */
    '  float vig = 1.0 - 0.42 * dot(uv * vec2(0.78, 1.0), uv * vec2(0.78, 1.0));',
    '  col *= clamp(vig, 0.0, 1.0);',
    '  col += (hash21(gl_FragCoord.xy + fract(t) * 91.7) - 0.5) * 0.016;',
    '  col = col / (col + vec3(0.72));',
    '  col = pow(max(col, 0.0), vec3(0.4545));',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* ---------- fallback pintado ---------- */
  function paintFallback() {
    canvas.style.background =
      'radial-gradient(120% 80% at 22% 96%, oklch(0.42 0.13 52) 0%, oklch(0.20 0.05 40) 34%, oklch(0.135 0.022 255) 72%)';
  }

  var gl = null;
  try {
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' }) ||
         canvas.getContext('experimental-webgl', { antialias: false, alpha: false });
  } catch (e) { gl = null; }

  if (!gl) { paintFallback(); return; }

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('[hero-gl] shader:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { paintFallback(); return; }

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[hero-gl] link:', gl.getProgramInfoLog(prog));
    paintFallback(); return;
  }
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  var uRes = gl.getUniformLocation(prog, 'uRes');
  var uTime = gl.getUniformLocation(prog, 'uTime');
  var uMouse = gl.getUniformLocation(prog, 'uMouse');
  var uScroll = gl.getUniformLocation(prog, 'uScroll');

  /* ---------- calidad adaptativa ---------- */
  var quality = Math.min(window.devicePixelRatio || 1, 1.5) * 0.60;
  var minQuality = 0.30;
  var cssW = 0, cssH = 0;

  function resize() {
    var r = canvas.getBoundingClientRect();
    cssW = r.width; cssH = r.height;
    var w = Math.max(2, Math.round(cssW * quality));
    var h = Math.max(2, Math.round(cssH * quality));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(uRes, canvas.width, canvas.height);
  }

  var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  var scroll = 0;
  function readScroll() {
    var hero = canvas.parentElement;
    var r = hero.getBoundingClientRect();
    scroll = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height)));
  }

  var visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
    }, { threshold: 0 }).observe(canvas);
  }

  var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(canvas); else window.addEventListener('resize', resize);
  resize();

  function draw(timeSeconds) {
    gl.uniform1f(uTime, timeSeconds);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.uniform1f(uScroll, scroll);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  if (reduced) {
    // un solo fotograma, sin bucle
    requestAnimationFrame(function () { resize(); draw(14.0); });
    document.documentElement.classList.add('gl-static');
    return;
  }

  var start = performance.now();
  var slowFrames = 0, checked = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) return;

    var t0 = performance.now();
    readScroll();
    mouse.x += (mouse.tx - mouse.x) * 0.045;
    mouse.y += (mouse.ty - mouse.y) * 0.045;
    draw((now - start) / 1000);

    // Degradar la resolución si el equipo no llega. Se mide sobre 90 fotogramas.
    if (checked < 90) {
      checked++;
      if (performance.now() - t0 > 13) slowFrames++;
      if (checked === 90 && slowFrames > 34 && quality > minQuality) {
        quality = Math.max(minQuality, quality * 0.68);
        checked = 0; slowFrames = 0;
        resize();
      }
    }
  }
  requestAnimationFrame(frame);
})();
