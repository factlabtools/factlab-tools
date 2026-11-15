/* 목표 용량 지정 이미지 압축기 — Canvas 로컬 처리 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var drop = $('drop'), input = $('file-input'), listEl = $('files'),
      statusEl = $('status'), runBtn = $('run-btn'), zipBtn = $('zip-btn'),
      clearBtn = $('clear-btn'), badge = $('file-badge'), resultsEl = $('results');

  var MIN_Q = 0.40, MAX_ATTEMPTS = 7;
  var MAX_PIXELS = 16000000;     // 모바일 캔버스 안전선(약 1,600만 화소)
  var MAX_SIDE = 8192;

  var items = [];      // { id, file, name, size, url }
  var outputs = [];    // { id, name, blob, url, w, h, q, size, ok, passthrough, reason }
  var nextId = 1;
  var busy = false;

  function kb(n) {
    if (n >= 1048576) return (n / 1048576).toFixed(1) + 'MB';
    if (n >= 1024) return Math.round(n / 1024) + 'KB';
    return n + 'B';
  }
  function say(msg, kind) {
    statusEl.textContent = msg || '';
    statusEl.classList.toggle('ok', kind === 'ok');
  }

  /* ── 목표 용량 ────────────────────────────────────────────── */
  var targetKB = 500;
  function setTarget(kbVal, chipEl) {
    targetKB = Math.max(20, Math.min(40960, Math.round(kbVal)));
    var chips = document.querySelectorAll('#presets .chip');
    for (var i = 0; i < chips.length; i++) chips[i].classList.toggle('on', chips[i] === chipEl);
    $('custom-row').hidden = !(chipEl && chipEl.getAttribute('data-kb') === 'custom');
    var label = targetKB >= 1024 ? (targetKB / 1024) + 'MB' : targetKB + 'KB';
    $('target-help').innerHTML = '목표 <b>' + label + '</b> — 이 용량 이하가 되도록 품질을 자동으로 맞춥니다.';
    if (chipEl && chipEl.getAttribute('data-kb') === 'custom') $('target-kb').value = targetKB;
  }
  document.querySelectorAll('#presets .chip').forEach(function (c) {
    c.addEventListener('click', function () {
      var v = c.getAttribute('data-kb');
      if (v === 'custom') {
        setTarget(parseInt($('target-kb').value, 10) || 300, c);
        $('target-kb').focus();
      } else {
        setTarget(parseInt(v, 10), c);
      }
    });
  });
  $('target-kb').addEventListener('input', function () {
    setTarget(parseInt(this.value, 10) || 20, document.querySelector('#presets .chip[data-kb="custom"]'));
  });
  $('quality').addEventListener('input', function () {
    $('quality-val').textContent = this.value + '%';
  });

  function cfg() {
    var ls = document.querySelector('input[name="longside"]:checked');
    return {
      targetBytes: targetKB * 1024,
      longSide: ls ? parseInt(ls.value, 10) || 0 : 0,
      maxQuality: Math.max(MIN_Q + 0.01, (parseInt($('quality').value, 10) || 85) / 100),
      minQuality: MIN_Q,
      maxPixels: MAX_PIXELS,
      maxSide: MAX_SIDE
    };
  }

  var core = window.FL_IMGCORE || {};
  var searchQuality = core.searchQuality;
  var planScale = core.planScale;

  function toBlob(canvas, q) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) {
        if (b) resolve(b);
        else reject(new Error('이미지를 인코딩하지 못했습니다.'));
      }, 'image/jpeg', q);
    });
  }

  function loadSource(file) {
    if (window.createImageBitmap) {
      var opts = { imageOrientation: 'from-image' };
      return createImageBitmap(file, opts).catch(function () {
        return createImageBitmap(file);
      }).then(function (bmp) {
        return { width: bmp.width, height: bmp.height, ref: bmp, close: function () { if (bmp.close) bmp.close(); } };
      });
    }
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        resolve({
          width: img.naturalWidth, height: img.naturalHeight, ref: img,
          close: function () { URL.revokeObjectURL(url); }
        });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('이미지를 읽지 못했습니다.')); };
      img.src = url;
    });
  }

  function nameFor(name) {
    return String(name).replace(/\.[^.]+$/, '') + '_압축.jpg';
  }

  /* ── 한 장 압축 ───────────────────────────────────────────── */
  function compressOne(file, c) {
    return loadSource(file).then(function (src) {
      var baseW = src.width, baseH = src.height;
      var scale = planScale(baseW, baseH, c.longSide, c.maxPixels, c.maxSide);
      var attempt = 0;

      function finish(out) { src.close(); return out; }

      function step() {
        var w = Math.max(1, Math.round(baseW * scale));
        var h = Math.max(1, Math.round(baseH * scale));
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';                       // 투명 PNG → 흰 배경
        ctx.fillRect(0, 0, w, h);
        if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(src.ref, 0, 0, w, h);

        var encode = function (q) {
          return toBlob(canvas, q).then(function (b) { return { blob: b, size: b.size }; });
        };
        return searchQuality(encode, c.targetBytes, c.maxQuality, c.minQuality).then(function (hit) {
          if (hit) {
            return finish({
              ok: true, blob: hit.blob, size: hit.size, quality: hit.quality,
              width: w, height: h, name: nameFor(file.name)
            });
          }
          attempt++;
          if (attempt >= MAX_ATTEMPTS || Math.min(w, h) < 160) {
            return finish({
              ok: false, reason: '품질 ' + Math.round(MIN_Q * 100) + '%에서도 목표를 넘습니다. 긴 변 크기를 한 단계 낮추거나 목표를 조금 키워 주세요.',
              width: w, height: h, name: nameFor(file.name), size: null
            });
          }
          scale *= 0.85;
          return step();
        });
      }
      return step();
    }).catch(function (err) {
      return { ok: false, reason: (err && err.message) || '이미지를 처리하지 못했습니다.', name: nameFor(file.name) };
    });
  }

  /* ── 목록 ─────────────────────────────────────────────────── */
  function loadedBytes() {
    return items.reduce(function (a, it) { return a + it.size; }, 0);
  }
  function refreshChrome() {
    badge.textContent = items.length + '장 · ' + kb(loadedBytes());
    runBtn.disabled = busy || items.length === 0;
    clearBtn.disabled = busy || (items.length === 0 && outputs.length === 0);
    runBtn.textContent = busy ? '압축하는 중…' : '압축 시작' + (items.length ? ' (' + items.length + '장)' : '');
    zipBtn.hidden = !(outputs.filter(function (o) { return o.ok; }).length > 1);
  }

  function renderFiles() {
    listEl.innerHTML = '';
    items.forEach(function (it, idx) {
      var li = document.createElement('li');
      li.className = 'file-row no-range';
      li.setAttribute('data-id', it.id);
      var no = document.createElement('span');
      no.className = 'idx'; no.textContent = String(idx + 1); no.setAttribute('aria-hidden', 'true');
      var name = document.createElement('div');
      name.className = 'fname';
      var b = document.createElement('b'); b.textContent = it.name;
      var meta = document.createElement('span'); meta.className = 'fmeta'; meta.textContent = kb(it.size);
      name.appendChild(b); name.appendChild(meta);
      var btns = document.createElement('div');
      btns.className = 'fbtns';
      var rm = document.createElement('button');
      rm.type = 'button'; rm.className = 'iconbtn'; rm.textContent = '✕';
      rm.setAttribute('data-act', 'rm'); rm.setAttribute('aria-label', it.name + ' 목록에서 빼기');
      btns.appendChild(rm);
      li.appendChild(no); li.appendChild(name); li.appendChild(btns);
      listEl.appendChild(li);
    });
    refreshChrome();
  }

  listEl.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act="rm"]');
    if (!btn || busy) return;
    var li = btn.closest('.file-row');
    var id = parseInt(li.getAttribute('data-id'), 10);
    items = items.filter(function (it) { return it.id !== id; });
    renderFiles();
  });

  function addFiles(fileList) {
    var arr = Array.prototype.slice.call(fileList || []);
    var skipped = [];
    arr.forEach(function (f) {
      if (!/^image\//.test(f.type) && !/\.(jpe?g|png|webp|bmp|gif|avif)$/i.test(f.name)) { skipped.push(f.name); return; }
      items.push({ id: nextId++, file: f, name: f.name, size: f.size });
    });
    if (skipped.length) say('이미지가 아닌 파일 ' + skipped.length + '개는 건너뛰었습니다: ' + skipped.join(', '));
    else if (arr.length) say(arr.length + '장을 올렸습니다. 목표 용량을 확인하고 ‘압축 시작’을 누르세요.', 'ok');
    renderFiles();
  }

  /* ── 결과 ─────────────────────────────────────────────────── */
  function renderResults() {
    resultsEl.innerHTML = '';
    outputs.forEach(function (o) {
      var li = document.createElement('li');
      li.className = 'result-card-item' + (o.ok ? '' : ' is-error');

      var thumb = document.createElement('div');
      thumb.className = 'thumb';
      if (o.ok && o.blob) {
        var img = document.createElement('img');
        if (!o.url) o.url = URL.createObjectURL(o.blob);
        img.src = o.url; img.alt = ''; img.loading = 'lazy';
        thumb.appendChild(img);
      } else {
        thumb.textContent = '✕';
      }

      var body = document.createElement('div');
      body.className = 'rbody';
      var h = document.createElement('b'); h.textContent = o.ok ? o.name : (o.name || '실패');
      var meta = document.createElement('span');
      if (o.ok) {
        var saved = o.passthrough ? 0 : Math.max(0, 1 - (o.size / o.srcSize));
        meta.innerHTML = kb(o.srcSize) + ' → <b>' + kb(o.size) + '</b>'
          + (o.passthrough ? ' · 이미 목표 이하' : ' · −' + Math.round(saved * 100) + '%')
          + '<br>' + o.width + '×' + o.height + 'px'
          + (o.quality ? ' · 품질 ' + Math.round(o.quality * 100) + '%' : '');
      } else {
        meta.textContent = o.reason;
      }
      body.appendChild(h); body.appendChild(meta);
      if (o.ok && o.size <= (o.target || targetKB * 1024)) {
        var okBadge = document.createElement('span');
        okBadge.className = 'tiny-ok';
        okBadge.textContent = '목표 달성';
        body.appendChild(okBadge);
      }

      var act = document.createElement('div');
      act.className = 'ract';
      if (o.ok) {
        var a = document.createElement('a');
        a.className = 'btn';
        a.href = o.url || (o.url = URL.createObjectURL(o.blob));
        a.download = o.name;
        a.textContent = '내려받기';
        act.appendChild(a);
      }

      li.appendChild(thumb); li.appendChild(body); li.appendChild(act);
      resultsEl.appendChild(li);
    });
    refreshChrome();
  }

  function run() {
    if (busy || !items.length) return;
    busy = true;
    outputs.forEach(function (o) { if (o.url) URL.revokeObjectURL(o.url); });
    outputs = [];
    resultsEl.innerHTML = '';
    refreshChrome();
    var c = cfg();
    var queue = items.slice();
    var done = 0;

    function next() {
      if (!queue.length) {
        busy = false;
        var okN = outputs.filter(function (o) { return o.ok; }).length;
        say(okN + '장을 목표 ' + kb(c.targetBytes) + ' 이하로 압축했습니다.' + (outputs.length > okN ? ' ' + (outputs.length - okN) + '장은 목표를 맞추지 못했습니다.' : ''), okN ? 'ok' : undefined);
        renderResults();
        return;
      }
      var it = queue.shift();
      say('압축하는 중… ' + (done + 1) + '/' + items.length + ' · ' + it.name);
      compressOne(it.file, c).then(function (out) {
        out.id = it.id;
        out.srcSize = it.size;
        out.target = c.targetBytes;
        outputs.push(out);
        done++;
        renderResults();
        next();
      });
    }
    next();
  }

  function downloadZip() {
    var JSZipCtor = window.JSZip;
    if (!JSZipCtor) { say('ZIP 라이브러리를 불러오지 못했습니다. 한 장씩 내려받아 주세요.'); return; }
    var ok = outputs.filter(function (o) { return o.ok; });
    if (!ok.length) return;
    zipBtn.disabled = true;
    var zip = new JSZipCtor();
    var used = {};
    ok.forEach(function (o) {
      var name = o.name;
      if (used[name]) { name = name.replace(/\.jpg$/, '_' + o.id + '.jpg'); }
      used[name] = 1;
      zip.file(name, o.blob);
    });
    zip.generateAsync({ type: 'blob', compression: 'STORE' }).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = '압축이미지_' + ok.length + '장.zip';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 20000);
      zipBtn.disabled = false;
    }).catch(function () {
      say('ZIP을 만들지 못했습니다. 한 장씩 내려받아 주세요.');
      zipBtn.disabled = false;
    });
  }

  /* ── 이벤트 ───────────────────────────────────────────────── */
  drop.addEventListener('click', function () { if (!busy) input.click(); });
  drop.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!busy) input.click(); }
  });
  input.addEventListener('change', function () { addFiles(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
  });
  drop.addEventListener('drop', function (e) {
    if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
  });
  runBtn.addEventListener('click', run);
  zipBtn.addEventListener('click', downloadZip);
  clearBtn.addEventListener('click', function () {
    items = [];
    outputs.forEach(function (o) { if (o.url) URL.revokeObjectURL(o.url); });
    outputs = [];
    resultsEl.innerHTML = '';
    say('');
    renderFiles();
  });

  setTarget(500, document.querySelector('#presets .chip[data-kb="500"]'));
  renderFiles();

  /* ── 자체 점검 (?selftest=1) ──────────────────────────────── */
  if (/[?&]selftest=1/.test(location.search)) selfTest();

  function selfTest() {
    var box = $('selftest');
    box.hidden = false;
    box.innerHTML = '<h2 class="sec">자체 점검</h2><div class="panel"><ul id="st-log"></ul></div>';
    var log = $('st-log');
    var pass = 0, fail = 0;
    function chk(cond, msg) {
      var li = document.createElement('li');
      li.textContent = (cond ? 'PASS' : 'FAIL') + ' · ' + msg;
      li.style.color = cond ? 'var(--ok)' : 'var(--danger)';
      li.style.fontWeight = '600';
      log.appendChild(li);
      cond ? pass++ : fail++;
    }
    function done() {
      var li = document.createElement('li');
      li.textContent = '결과: PASS ' + pass + ' · FAIL ' + fail;
      li.style.fontWeight = '800';
      log.appendChild(li);
    }

    // 1) 탐색 로직: 품질이 낮을수록 작아지는 모형으로 최고 품질을 찾는지
    var model = function (q) {
      return Promise.resolve({ size: Math.round(300000 * Math.pow(q, 2.2)), blob: { size: Math.round(300000 * Math.pow(q, 2.2)) } });
    };
    searchQuality(model, 120000, 0.95, 0.40).then(function (hit) {
      chk(!!hit, '목표 120KB · 탐색 성공');
      chk(hit && hit.size <= 120000, '탐색 결과가 목표 이하 (' + (hit && hit.size) + 'B)');
      var higher = hit ? Math.round(300000 * Math.pow(Math.min(1, hit.quality + 0.02), 2.2)) : 0;
      chk(hit && higher > 120000, '한 단계 높은 품질은 목표를 넘음 → 최고 품질 선택 확인');
      return searchQuality(model, 10, 0.95, 0.40);
    }).then(function (hit) {
      chk(hit === null, '달성 불가한 목표(10B)는 null로 알려 줌');

      // 2) 실제 캔버스 압축: 사진 같은 합성 이미지를 만들어 목표 용량 이하로
      var W = 1600, H = 1200;
      var cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      var ctx = cv.getContext('2d');
      var grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#1d4ed8'); grad.addColorStop(0.5, '#f59e0b'); grad.addColorStop(1, '#10b981');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
      for (var i = 0; i < 120; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * W, Math.random() * H, 8 + Math.random() * 90, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + ((Math.random() * 255) | 0) + ',' + ((Math.random() * 255) | 0) + ',' +
          ((Math.random() * 255) | 0) + ',0.35)';
        ctx.fill();
      }
      return toBlob(cv, 0.95).then(function (srcBlob) {
        chk(srcBlob.size > 120 * 1024, '시험용 원본 생성 ' + kb(srcBlob.size) + ' (1600×1200 · 품질 95%)');
        var fake = new File([srcBlob], 'test.png', { type: 'image/png' });
        return compressOne(fake, {
          targetBytes: 60 * 1024, longSide: 0, maxQuality: 0.95, minQuality: 0.40,
          maxPixels: MAX_PIXELS, maxSide: MAX_SIDE
        });
      });
    }).then(function (out) {
      chk(out.ok, '캔버스 압축 실행 성공');
      if (out.ok) {
        chk(out.size <= 60 * 1024, '결과 ' + kb(out.size) + ' ≤ 목표 60KB');
        chk(out.width <= 1600 && out.height <= 1200, '결과 크기 ' + out.width + '×' + out.height + ' (원본 이하 유지)');
        chk(out.name === 'test_압축.jpg', '파일 이름 규칙 (' + out.name + ')');
      }
      done();
    }).catch(function (err) {
      var li = document.createElement('li');
      li.textContent = 'FAIL · 자체 점검 중 오류: ' + (err && err.message ? err.message : err);
      log.appendChild(li);
      done();
    });
  }
})();
