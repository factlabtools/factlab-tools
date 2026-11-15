/* 팩트랩 툴 — 모두의 뽑기 (룰렛·사다리·뽑기·자리·미니게임) */
(function (global) {
  'use strict';
  var doc = global.document;

  function mod(a, n) { return ((a % n) + n) % n; }
  function shuffle(arr, rnd) {
    rnd = rnd || Math.random;
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* ══════════════ 순수 로직 (테스트 대상) ══════════════ */
  function rouletteIndex(rotation, n) {
    if (!n || n < 1) return 0;
    var step = 2 * Math.PI / n;
    return Math.floor(mod(-rotation, 2 * Math.PI) / step) % n;
  }

  function makeLadder(n, rows, rnd) {
    rnd = rnd || Math.random;
    var rungs = [];
    for (var r = 0; r < rows; r++) {
      var cols = [];
      for (var c = 0; c < n - 1; c++) cols.push(c);
      shuffle(cols, rnd);
      var used = {}, row = [];
      for (var k = 0; k < cols.length; k++) {
        var c2 = cols[k];
        if (used[c2 - 1] || used[c2] || used[c2 + 1]) continue;
        used[c2] = true;
        row.push(c2);
      }
      row.sort(function (a, b) { return a - b; });
      rungs.push(row);
    }
    return { n: n, rows: rows, rungs: rungs };
  }

  /* 시작 열 → 도착 열 (각 행의 가로대를 따라 이동) */
  function traceColumns(ladder, start) {
    var c = start;
    for (var r = 0; r < ladder.rows; r++) {
      var row = ladder.rungs[r] || [];
      if (row.indexOf(c) >= 0) c = c + 1;
      else if (row.indexOf(c - 1) >= 0) c = c - 1;
    }
    return c;
  }

  function solveLadder(ladder) {
    var out = [];
    for (var s = 0; s < ladder.n; s++) out.push(traceColumns(ladder, s));
    return out;
  }

  /* 경로 좌표: {c, r} — r은 0(위) ~ rows(아래), 가로 이동은 r+0.5 */
  function tracePath(ladder, start) {
    var pts = [{ c: start, r: 0 }];
    var c = start;
    for (var r = 0; r < ladder.rows; r++) {
      var row = ladder.rungs[r] || [];
      var y = r + 0.5;
      if (row.indexOf(c) >= 0) {
        pts.push({ c: c, r: y }); c++; pts.push({ c: c, r: y });
      } else if (row.indexOf(c - 1) >= 0) {
        pts.push({ c: c, r: y }); c--; pts.push({ c: c, r: y });
      }
    }
    pts.push({ c: c, r: ladder.rows });
    return { points: pts, end: c };
  }

  function pickUnique(n, k, rnd) {
    if (n <= 0 || k <= 0) return [];
    k = Math.min(k, n);
    var pool = [];
    for (var i = 1; i <= n; i++) pool.push(i);
    shuffle(pool, rnd);
    return pool.slice(0, k);
  }

  function pickWithRepeat(n, k, rnd) {
    rnd = rnd || Math.random;
    var out = [];
    if (n <= 0 || k <= 0) return out;
    for (var i = 0; i < k; i++) out.push(1 + Math.floor(rnd() * n));
    return out;
  }

  function splitTeams(list, teams, rnd) {
    if (!list.length || teams < 1) return [];
    teams = Math.min(teams, list.length);
    var pool = shuffle(list.slice(), rnd);
    var out = [];
    for (var i = 0; i < teams; i++) out.push([]);
    pool.forEach(function (item, i) { out[i % teams].push(item); });
    return out;
  }

  function drawLotto(rnd) {
    var pool = [];
    for (var i = 1; i <= 45; i++) pool.push(i);
    shuffle(pool, rnd);
    return pool.slice(0, 6).sort(function (a, b) { return a - b; });
  }

  var Core = {
    rouletteIndex: rouletteIndex,
    makeLadder: makeLadder,
    traceColumns: traceColumns,
    solveLadder: solveLadder,
    tracePath: tracePath,
    pickUnique: pickUnique,
    pickWithRepeat: pickWithRepeat,
    splitTeams: splitTeams,
    drawLotto: drawLotto,
    shuffle: shuffle
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
  global.FactlabDraw = Core;

  /* ══════════════ 여기서부터 화면 ══════════════ */
  if (!doc) return;

  var PALETTE = ['#2563eb', '#0ea5e9', '#14b8a6', '#22c55e', '#eab308',
                 '#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#6366f1'];
  function $(s, r) { return (r || doc).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }
  function lines(v) {
    return String(v || '').split('\n').map(function (s) { return s.trim(); }).filter(function (s) { return s; });
  }
  function msg(el, text) { if (el) el.textContent = text || ''; }
  function esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function now() { var d = new Date(); return d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes(); }

  function copyText(text, btn) {
    var old = btn ? btn.textContent : '';
    function done() {
      if (!btn) return;
      btn.textContent = '복사됨';
      setTimeout(function () { btn.textContent = old; }, 1500);
    }
    if (global.navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else fallback();
    function fallback() {
      var ta = doc.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.top = '-1000px';
      doc.body.appendChild(ta); ta.select();
      try { doc.execCommand('copy'); done(); } catch (e) {}
      doc.body.removeChild(ta);
    }
  }

  function fitCanvas(cv, w, h) {
    var ctx = cv.getContext('2d');
    if (cv.__lw !== w || cv.__lh !== h || !cv.__dpr) {
      var dpr = Math.min(2, global.devicePixelRatio || 1);
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.aspectRatio = w + ' / ' + h;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cv.__lw = w; cv.__lh = h; cv.__dpr = dpr;
    }
    return ctx;
  }

  /* ───────────── 룰렛 ───────────── */
  function initRoulette() {
    var cv = $('#r-wheel');
    if (!cv) return;
    var W = 360, R = 168, cx = W / 2, cy = W / 2;
    var ctx = fitCanvas(cv, W, W);
    var itemsEl = $('#r-items'), spinBtn = $('#r-spin'), resultEl = $('#r-result'),
        histEl = $('#r-history'), clearBtn = $('#r-clear'), msgEl = $('#r-msg');
    var rot = 0, spinning = false;

    function items() {
      var arr = lines(itemsEl.value);
      return arr.length ? arr : ['항목 1', '항목 2'];
    }
    function draw(rotation) {
      var list = items(), n = list.length, step = 2 * Math.PI / n;
      ctx.clearRect(0, 0, W, W);
      for (var i = 0; i < n; i++) {
        var a0 = -Math.PI / 2 + rotation + i * step;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, a0, a0 + step);
        ctx.closePath();
        ctx.fillStyle = PALETTE[i % PALETTE.length];
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a0 + step / 2);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        var fs = n <= 6 ? 19 : n <= 12 ? 15 : n <= 20 ? 12.5 : 10.5;
        ctx.font = '700 ' + fs + 'px system-ui,"Apple SD Gothic Neo","Malgun Gothic",sans-serif';
        ctx.fillStyle = '#fff';
        var label = list[i];
        var maxW = R * 0.78;
        var guard = 0;
        while (ctx.measureText(label).width > maxW && label.length > 1 && guard++ < 40) label = label.slice(0, -1);
        if (label !== list[i] && label.length > 1) label = label.slice(0, -1) + '…';
        ctx.fillText(label, R - 16, 0);
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.12)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#111827';
      ctx.font = '800 13px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('START', cx, cy);

      /* 고정 포인터 */
      ctx.beginPath();
      ctx.moveTo(cx - 13, 2);
      ctx.lineTo(cx + 13, 2);
      ctx.lineTo(cx, 26);
      ctx.closePath();
      ctx.fillStyle = '#111827';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    function addHistory(text) {
      if (!histEl) return;
      var li = doc.createElement('li');
      var b = doc.createElement('b');
      b.textContent = text;
      var sp = doc.createElement('span');
      sp.textContent = now();
      li.appendChild(b); li.appendChild(sp);
      histEl.insertBefore(li, histEl.firstChild);
      while (histEl.children.length > 20) histEl.removeChild(histEl.lastChild);
    }

    function spin() {
      if (spinning) return;
      var list = items();
      if (list.length < 2) { msg(msgEl, '항목을 2개 이상 입력해 주세요.'); return; }
      msg(msgEl, '');
      spinning = true;
      spinBtn.disabled = true;
      itemsEl.disabled = true;
      resultEl.textContent = '돌리는 중…';
      resultEl.className = 'r-result spinning';
      var start = rot;
      var target = start + Math.PI * 2 * (4 + Math.random() * 3) + Math.random() * Math.PI * 2;
      var t0 = global.performance.now(), dur = 4200;
      function frame(t) {
        var p = Math.min(1, (t - t0) / dur);
        var e = 1 - Math.pow(1 - p, 3);
        rot = start + (target - start) * e;
        draw(rot);
        if (p < 1) global.requestAnimationFrame(frame);
        else {
          rot = mod(target, Math.PI * 2);
          draw(rot);
          spinning = false;
          spinBtn.disabled = false;
          itemsEl.disabled = false;
          var idx = rouletteIndex(rot, list.length);
          resultEl.textContent = list[idx];
          resultEl.className = 'r-result hit';
          addHistory(list[idx]);
        }
      }
      global.requestAnimationFrame(frame);
    }

    spinBtn.addEventListener('click', spin);
    itemsEl.addEventListener('input', function () {
      if (spinning) return;
      var n = lines(itemsEl.value).length;
      msg(msgEl, n === 1 ? '항목을 2개 이상 입력해 주세요.' : '');
      if (!spinning) { resultEl.textContent = '—'; resultEl.className = 'r-result'; }
      draw(rot);
    });
    if (clearBtn) clearBtn.addEventListener('click', function () { histEl.innerHTML = ''; });
    $$('#r-presets .chip').forEach(function (b) {
      b.addEventListener('click', function () {
        if (spinning) return;
        itemsEl.value = b.getAttribute('data-items').split('|').join('\n');
        rot = 0; draw(rot);
        resultEl.textContent = '—'; resultEl.className = 'r-result';
        msg(msgEl, '');
      });
    });
    draw(rot);
  }

  /* ───────────── 사다리 ───────────── */
  function initLadder() {
    var cv = $('#l-canvas');
    if (!cv) return;
    var namesEl = $('#l-names'), resultsEl = $('#l-results'), outEl = $('#l-out'),
        msgEl = $('#l-msg'), genBtn = $('#l-gen'), allBtn = $('#l-all'), oneBtn = $('#l-one'), copyBtn = $('#l-copy');
    var state = null, raf = 0, busy = false;

    function setup() {
      var names = lines(namesEl.value);
      if (names.length < 2) { msg(msgEl, '참가자를 2명 이상 입력해 주세요.'); return null; }
      if (names.length > 10) { msg(msgEl, '참가자는 최대 10명까지 가능합니다.'); return null; }
      var results = lines(resultsEl.value);
      if (results.length && results.length !== names.length) {
        msg(msgEl, '결과 개수(' + results.length + ')가 참가자 수(' + names.length + ')와 같아야 합니다.');
        return null;
      }
      if (!results.length) results = names.map(function (_, i) { return (i + 1) + '번'; });
      msg(msgEl, '');
      var rows = names.length <= 5 ? 9 : names.length <= 8 ? 11 : 13;
      var ladder = makeLadder(names.length, rows);
      var traces = [];
      for (var i = 0; i < names.length; i++) traces.push(tracePath(ladder, i));
      return { ladder: ladder, names: names, results: results, traces: traces,
               progress: new Array(names.length).fill(0), revealed: new Array(names.length).fill(false) };
    }

    function geom() {
      var n = state.ladder.n;
      var W = 900, top = 54, bottom = 46, rowH = 30;
      var H = top + state.ladder.rows * rowH + bottom;
      return { W: W, H: H, top: top, rowH: rowH, colW: W / n, bottomY: top + state.ladder.rows * rowH };
    }

    function px(g, c, r) {
      return { x: g.colW * (c + 0.5), y: g.top + r * g.rowH };
    }

    function truncate(ctx, text, maxW) {
      if (ctx.measureText(text).width <= maxW) return text;
      var t = text;
      var guard = 0;
      while (t.length > 1 && ctx.measureText(t + '…').width > maxW && guard++ < 40) t = t.slice(0, -1);
      return t + '…';
    }

    function drawScene() {
      if (!state) return;
      var g = geom();
      var ctx = fitCanvas(cv, g.W, g.H);
      ctx.clearRect(0, 0, g.W, g.H);
      var L = state.ladder;

      /* 이름 · 결과 */
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 15px system-ui,"Apple SD Gothic Neo","Malgun Gothic",sans-serif';
      for (var i = 0; i < L.n; i++) {
        var x = g.colW * (i + 0.5);
        ctx.fillStyle = '#334155';
        ctx.fillText(truncate(ctx, state.names[i], g.colW - 12), x, 22);
        ctx.fillStyle = '#64748b';
        ctx.fillText(truncate(ctx, state.results[i], g.colW - 12), x, g.H - 20);
      }

      /* 사다리 기본 */
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (var c = 0; c < L.n; c++) {
        var p0 = px(g, c, 0), p1 = px(g, c, L.rows);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      }
      for (var r = 0; r < L.rows; r++) {
        var row = L.rungs[r] || [];
        for (var k = 0; k < row.length; k++) {
          var a = px(g, row[k], r + 0.5), b = px(g, row[k] + 1, r + 0.5);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }

      /* 경로 강조 */
      for (var i2 = 0; i2 < state.traces.length; i2++) {
        var prog = state.progress[i2];
        if (prog <= 0) continue;
        var pts = state.traces[i2].points.map(function (pt) { return px(g, pt.c, pt.r); });
        drawPartial(ctx, pts, prog, PALETTE[i2 % PALETTE.length], 4.5);
      }
    }

    function drawPartial(ctx, pts, prog, color, width) {
      var total = 0, segs = [];
      for (var i = 1; i < pts.length; i++) {
        var dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
        var len = Math.sqrt(dx * dx + dy * dy);
        segs.push({ a: pts[i - 1], b: pts[i], len: len });
        total += len;
      }
      var target = total * Math.min(1, Math.max(0, prog));
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      var acc = 0;
      for (var j = 0; j < segs.length; j++) {
        var s = segs[j];
        if (acc + s.len <= target) {
          ctx.lineTo(s.b.x, s.b.y);
          acc += s.len;
        } else {
          var rest = target - acc;
          var t = s.len ? rest / s.len : 0;
          ctx.lineTo(s.a.x + (s.b.x - s.a.x) * t, s.a.y + (s.b.y - s.a.y) * t);
          break;
        }
      }
      ctx.stroke();
      if (prog >= 1) {
        ctx.beginPath();
        ctx.arc(pts[pts.length - 1].x, pts[pts.length - 1].y, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
    }

    function renderResults() {
      if (!state) return;
      var html = state.traces.map(function (tr, i) {
        var done = state.revealed[i];
        return '<div class="res-row' + (done ? ' done' : '') + '">' +
          '<span class="dot" style="background:' + PALETTE[i % PALETTE.length] + '"></span>' +
          '<span class="who">' + esc(state.names[i]) + '</span>' +
          '<span class="arrow">→</span>' +
          '<span class="what">' + (done ? '<b>' + esc(state.results[tr.end]) + '</b>' : '?') + '</span></div>';
      }).join('');
      outEl.innerHTML = html;
      var allDone = state.revealed.every(function (v) { return v; });
      if (copyBtn) copyBtn.disabled = !allDone;
    }

    function animateOne(i, delay, cb) {
      var t0 = global.performance.now() + (delay || 0), dur = 900;
      function frame(t) {
        var p = Math.min(1, Math.max(0, (t - t0) / dur));
        state.progress[i] = p;
        drawScene();
        if (p < 1) global.requestAnimationFrame(frame);
        else { state.revealed[i] = true; renderResults(); if (cb) cb(); }
      }
      global.requestAnimationFrame(frame);
    }

    function buildAndDraw() {
      state = setup();
      if (!state) return;
      drawScene();
      renderResults();
      if (copyBtn) copyBtn.disabled = true;
      busy = false;
    }

    genBtn.addEventListener('click', function () {
      buildAndDraw();
    });
    allBtn.addEventListener('click', function () {
      if (!state) buildAndDraw();
      if (!state || busy) return;
      busy = true;
      state.progress = state.progress.map(function () { return 0; });
      state.revealed = state.revealed.map(function () { return false; });
      state.traces.forEach(function (_, i) { animateOne(i, i * 110, function () { busy = false; }); });
    });
    oneBtn.addEventListener('click', function () {
      if (!state) buildAndDraw();
      if (!state) return;
      var idx = state.revealed.findIndex(function (v) { return !v; });
      if (idx < 0) {
        state.progress = state.progress.map(function () { return 0; });
        state.revealed = state.revealed.map(function () { return false; });
        idx = 0;
        renderResults();
      }
      animateOne(idx, 0);
    });
    if (copyBtn) copyBtn.addEventListener('click', function () {
      if (!state) return;
      var text = '사다리 타기 결과 (팩트랩 툴)\n' + state.traces.map(function (tr, i) {
        return state.names[i] + ' → ' + state.results[tr.end];
      }).join('\n');
      copyText(text, copyBtn);
    });

    namesEl.addEventListener('input', buildAndDraw);
    resultsEl.addEventListener('input', buildAndDraw);
    buildAndDraw();
  }

  /* ───────────── 뽑기 · 제비 ───────────── */
  function initPick() {
    var root = doc.getElementById('panel-pick');
    if (!root) return;
    var modeInputs = $$('input[name="p-mode"]', root);
    var panels = { number: $('#p-panel-number'), name: $('#p-panel-name'), lots: $('#p-panel-lots') };
    var out = $('#p-out'), histList = $('#p-history'), msgEl = $('#p-msg');

    function mode() {
      for (var i = 0; i < modeInputs.length; i++) if (modeInputs[i].checked) return modeInputs[i].value;
      return 'number';
    }
    function syncMode() {
      var m = mode();
      Object.keys(panels).forEach(function (k) { if (panels[k]) panels[k].hidden = (k !== m); });
      msg(msgEl, '');
    }
    modeInputs.forEach(function (r) { r.addEventListener('change', syncMode); });

    var histCopyBtn = doc.getElementById('p-hist-copy');
    function syncHist() {
      if (!histCopyBtn) return;
      histCopyBtn.disabled = !histList || histList.children.length === 0;
    }
    function addHistory(text) {
      if (!histList) return;
      var li = doc.createElement('li');
      var b = doc.createElement('b');
      b.textContent = text;
      var sp = doc.createElement('span');
      sp.textContent = now();
      li.appendChild(b); li.appendChild(sp);
      histList.insertBefore(li, histList.firstChild);
      while (histList.children.length > 15) histList.removeChild(histList.lastChild);
      syncHist();
    }
    function chips(list) {
      return '<div class="chips-out">' + list.map(function (v, i) {
        return '<span class="pill" style="animation-delay:' + (i * 40) + 'ms">' + esc(v) + '</span>';
      }).join('') + '</div>';
    }

    /* 번호 뽑기 */
    var fromEl = $('#p-from'), toEl = $('#p-to'), cntEl = $('#p-count'), uniqEl = $('#p-unique'),
        goBtn = $('#p-go'), copyBtn = $('#p-copy');
    var lastText = '';

    goBtn.addEventListener('click', function () {
      var from = Math.max(1, parseInt(fromEl.value, 10) || 1);
      var to = parseInt(toEl.value, 10) || 10;
      if (to < from) { msg(msgEl, '끝 번호가 시작 번호보다 작습니다.'); return; }
      var count = Math.max(1, parseInt(cntEl.value, 10) || 1);
      var size = to - from + 1;
      var unique = uniqEl.checked;
      if (count > size && unique) { msg(msgEl, '중복 없이 뽑으려면 인원(' + count + ')이 번호 개수(' + size + ') 이하여야 합니다.'); return; }
      msg(msgEl, '');
      var picked;
      if (unique) {
        picked = pickUnique(size, count).map(function (v) { return v + from - 1; });
      } else {
        picked = pickWithRepeat(size, count).map(function (v) { return v + from - 1; });
      }
      out.innerHTML = '<p class="out-label">뽑힌 번호 ' + count + '개</p>' + chips(picked);
      lastText = picked.join(', ');
      if (copyBtn) copyBtn.disabled = false;
      addHistory(picked.join(', '));
    });
    if (copyBtn) copyBtn.addEventListener('click', function () { copyText(lastText, copyBtn); });

    /* 이름 뽑기 */
    var nameEl = $('#n-names'), nCnt = $('#n-count'), nGo = $('#n-go'), nOut = $('#n-out'), nCopy = $('#n-copy');
    var lastNames = '';
    if (nGo) nGo.addEventListener('click', function () {
      var list = lines(nameEl.value);
      if (list.length < 1) { msg(msgEl, '이름을 한 줄에 하나씩 입력해 주세요.'); return; }
      var count = Math.max(1, parseInt(nCnt.value, 10) || 1);
      if (count > list.length) { msg(msgEl, '인원(' + count + ')이 이름 수(' + list.length + ')보다 많습니다.'); return; }
      msg(msgEl, '');
      var picked = shuffle(list.slice()).slice(0, count);
      nOut.innerHTML = '<p class="out-label">당첨 ' + count + '명</p>' + chips(picked);
      lastNames = picked.join(', ');
      if (nCopy) nCopy.disabled = false;
      addHistory(picked.join(', '));
    });
    if (nCopy) nCopy.addEventListener('click', function () { copyText(lastNames, nCopy); });

    /* 제비뽑기 */
    var lotsTotal = $('#lots-total'), lotsPass = $('#lots-pass'), lotsGo = $('#lots-go'),
        lotsGrid = $('#lots-grid'), lotsReveal = $('#lots-reveal'), lotsOut = $('#lots-out');
    var lotsState = null;
    if (lotsGo) lotsGo.addEventListener('click', function () {
      var total = Math.max(2, Math.min(50, parseInt(lotsTotal.value, 10) || 10));
      var pass = Math.max(0, Math.min(total, parseInt(lotsPass.value, 10) || 3));
      lotsTotal.value = total; lotsPass.value = pass;
      var arr = [];
      for (var i = 0; i < total; i++) arr.push(i < pass ? '통과' : '꽝');
      shuffle(arr);
      lotsState = arr;
      lotsGrid.innerHTML = '';
      arr.forEach(function (_, i) {
        var b = doc.createElement('button');
        b.type = 'button';
        b.className = 'lot-card';
        b.textContent = String(i + 1);
        b.setAttribute('data-i', String(i));
        b.addEventListener('click', function () { reveal(b); });
        lotsGrid.appendChild(b);
      });
      lotsGrid.hidden = false;
      if (lotsReveal) lotsReveal.hidden = false;
      msg(msgEl, '');
      if (lotsOut) lotsOut.textContent = '제비 ' + total + '장 (통과 ' + pass + ' · 꽝 ' + (total - pass) + ') — 카드를 눌러 확인하세요.';
    });
    function reveal(btn) {
      var i = Number(btn.getAttribute('data-i'));
      var v = lotsState[i];
      btn.classList.add(v === '통과' ? 'pass' : 'fail');
      btn.innerHTML = '<small>' + (i + 1) + '</small>' + v;
      btn.disabled = true;
      var all = $$('.lot-card', lotsGrid).every(function (b) { return b.disabled; });
      if (all) addHistory('제비 ' + lotsState.length + '장 전부 공개 (통과 ' + lotsState.filter(function (v2) { return v2 === '통과'; }).length + ')');
    }
    if (lotsReveal) lotsReveal.addEventListener('click', function () {
      $$('.lot-card', lotsGrid).forEach(function (b) { if (!b.disabled) reveal(b); });
    });

    if (histList) {
      var clearHist = $('#p-clear');
      if (clearHist) clearHist.addEventListener('click', function () {
        histList.innerHTML = '';
        syncHist();
        msg(msgEl, '이력을 지웠습니다.');
      });
    }
    if (histCopyBtn) histCopyBtn.addEventListener('click', function () {
      if (!histList) return;
      var linesOut = $$('li', histList).map(function (li) { return '- ' + li.textContent.replace(/\s+/g, ' ').trim(); });
      copyText('뽑기 이력 (팩트랩 툴)\n' + linesOut.join('\n'), histCopyBtn);
    });
    syncMode();
    syncHist();
  }

  /* ───────────── 자리 · 모둠 ───────────── */
  function initSeat() {
    var grid = $('#s-grid');
    if (!grid) return;
    var rowsEl = $('#s-rows'), colsEl = $('#s-cols'), namesEl = $('#s-names'),
        assignBtn = $('#s-assign'), printBtn = $('#s-print'), copyBtn = $('#s-copy'), msgEl = $('#s-msg');
    var excluded = {};
    var assigned = null;

    function dims() {
      var r = Math.max(1, Math.min(12, parseInt(rowsEl.value, 10) || 5));
      var c = Math.max(1, Math.min(10, parseInt(colsEl.value, 10) || 6));
      rowsEl.value = r; colsEl.value = c;
      return { r: r, c: c };
    }
    function build() {
      var d = dims();
      assigned = null;
      grid.style.gridTemplateColumns = 'repeat(' + d.c + ', minmax(0, 1fr))';
      grid.innerHTML = '';
      for (var i = 0; i < d.r * d.c; i++) {
        var b = doc.createElement('button');
        b.type = 'button';
        b.className = 'seat' + (excluded[i] ? ' off' : '');
        b.setAttribute('data-i', String(i));
        b.innerHTML = '<span class="seat-no">' + (i + 1) + '</span><span class="seat-name"></span>';
        b.addEventListener('click', function () {
          var idx = this.getAttribute('data-i');
          excluded[idx] = !excluded[idx];
          this.classList.toggle('off', !!excluded[idx]);
          assigned = null;
          $$('.seat', grid).forEach(function (s) { s.querySelector('.seat-name').textContent = ''; s.classList.remove('filled'); });
          msg(msgEl, '제외 좌석을 바꿨습니다. 다시 배정해 주세요.');
        });
        grid.appendChild(b);
      }
      msg(msgEl, '');
    }

    assignBtn.addEventListener('click', function () {
      var d = dims();
      var seats = [];
      for (var i = 0; i < d.r * d.c; i++) if (!excluded[i]) seats.push(i);
      var names = lines(namesEl.value);
      if (names.length > seats.length) {
        msg(msgEl, '이름 ' + names.length + '명인데 남는 자리가 ' + seats.length + '개입니다. 제외 좌석을 줄이세요.');
        return;
      }
      var pool = names.length ? shuffle(names.slice()) : [];
      assigned = {};
      seats.forEach(function (seatIdx, k) { if (k < pool.length) assigned[seatIdx] = pool[k]; });
      $$('.seat', grid).forEach(function (el) {
        var idx = Number(el.getAttribute('data-index') || el.getAttribute('data-i'));
        var nm = assigned[idx];
        el.querySelector('.seat-name').textContent = nm || '';
        el.classList.toggle('filled', !!nm);
      });
      msg(msgEl, names.length ? names.length + '명을 ' + seats.length + '자리에 배정했습니다.' : '이름을 입력하면 자리에 이름이 들어갑니다.');
    });
    if (copyBtn) copyBtn.addEventListener('click', function () {
      var d = dims();
      var rows = [];
      for (var r = 0; r < d.r; r++) {
        var line = [];
        for (var c = 0; c < d.c; c++) {
          var idx = r * d.c + c;
          line.push(excluded[idx] ? '제외' : ((assigned && assigned[idx]) || '-'));
        }
        rows.push(line.join('\t'));
      }
      copyText('자리 배정 결과 (팩트랩 툴)\n' + rows.join('\n'), copyBtn);
    });
    if (printBtn) printBtn.addEventListener('click', function () { global.print(); });
    rowsEl.addEventListener('change', build);
    colsEl.addEventListener('change', build);

    /* 모둠 */
    var tmNames = $('#tm-names'), tmCount = $('#tm-count'), tmGo = $('#tm-go'), tmOut = $('#tm-out'), tmCopy = $('#tm-copy');
    var lastTeams = null;
    if (tmGo) tmGo.addEventListener('click', function () {
      var names = lines(tmNames.value);
      if (names.length < 2) { msg(msgEl, '모둠을 나누려면 이름을 2명 이상 입력해 주세요.'); return; }
      var teams = Math.max(2, Math.min(10, parseInt(tmCount.value, 10) || 2));
      tmCount.value = teams;
      var result = splitTeams(names, teams);
      lastTeams = result;
      tmOut.innerHTML = result.map(function (group, i) {
        return '<div class="team"><h4>' + (i + 1) + '모둠 <span>' + group.length + '명</span></h4><ul>' +
          group.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></div>';
      }).join('');
      if (tmCopy) tmCopy.disabled = false;
      msg(msgEl, '');
    });
    if (tmCopy) tmCopy.addEventListener('click', function () {
      if (!lastTeams) return;
      var text = '모둠 편성 결과 (팩트랩 툴)\n' + lastTeams.map(function (g, i) {
        return (i + 1) + '모둠: ' + g.join(', ');
      }).join('\n');
      copyText(text, tmCopy);
    });

    build();
  }

  /* ───────────── 미니 게임 · 로또 ───────────── */
  function initGames() {
    var diceOut = $('#dice-out');
    if (!diceOut) return;
    var DICE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

    /* 주사위 */
    var diceCount = $('#dice-count'), diceBtn = $('#dice-roll');
    diceBtn.addEventListener('click', function () {
      var n = Math.max(1, Math.min(6, parseInt(diceCount.value, 10) || 2));
      diceCount.value = n;
      var ticks = 0;
      diceBtn.disabled = true;
      var spin = setInterval(function () {
        var faces = [];
        for (var i = 0; i < n; i++) faces.push(1 + Math.floor(Math.random() * 6));
        diceOut.innerHTML = faces.map(function (f) { return '<span class="die">' + DICE[f - 1] + '</span>'; }).join('');
        if (++ticks > 8) {
          clearInterval(spin);
          diceBtn.disabled = false;
          var sum = faces.reduce(function (a, b) { return a + b; }, 0);
          diceOut.innerHTML = faces.map(function (f) { return '<span class="die">' + DICE[f - 1] + '</span>'; }).join('') +
            '<span class="sum">합계 ' + sum + '</span>';
        }
      }, 65);
    });

    /* 동전 */
    var coinCount = $('#coin-count'), coinBtn = $('#coin-toss'), coinOut = $('#coin-out');
    if (coinBtn) coinBtn.addEventListener('click', function () {
      var n = Math.max(1, Math.min(20, parseInt(coinCount.value, 10) || 5));
      coinCount.value = n;
      var arr = [];
      for (var i = 0; i < n; i++) arr.push(Math.random() < 0.5 ? '앞' : '뒤');
      var front = arr.filter(function (v) { return v === '앞'; }).length;
      coinOut.innerHTML = arr.map(function (v) {
        return '<span class="coin ' + (v === '앞' ? 'front' : 'back') + '">' + v + '</span>';
      }).join('') + '<span class="sum">앞 ' + front + ' · 뒤 ' + (n - front) + '</span>';
    });

    /* 로또 */
    var lottoGames = $('#lotto-games'), lottoBtn = $('#lotto-go'), lottoOut = $('#lotto-out'), lottoCopy = $('#lotto-copy');
    var lastLotto = '';
    if (lottoBtn) lottoBtn.addEventListener('click', function () {
      var games = Math.max(1, Math.min(5, parseInt(lottoGames.value, 10) || 5));
      lottoGames.value = games;
      var all = [];
      for (var g = 0; g < games; g++) all.push(drawLotto());
      lottoOut.innerHTML = all.map(function (nums, i) {
        return '<div class="lotto-row"><b>' + (String.fromCharCode(65 + i)) + '</b>' +
          nums.map(function (n) { return '<span class="ball n' + Math.min(5, Math.floor((n - 1) / 10)) + '">' + n + '</span>'; }).join('') + '</div>';
      }).join('');
      lastLotto = all.map(function (nums, i) {
        return String.fromCharCode(65 + i) + ': ' + nums.join(', ');
      }).join('\n');
      if (lottoCopy) lottoCopy.disabled = false;
    });
    if (lottoCopy) lottoCopy.addEventListener('click', function () { copyText('로또 6/45 번호 (팩트랩 툴)\n' + lastLotto, lottoCopy); });
  }

  function boot() {
    initRoulette();
    initLadder();
    initPick();
    initSeat();
    initGames();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
