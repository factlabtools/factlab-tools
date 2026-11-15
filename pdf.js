/* PDF 합치기·나누기 — 브라우저 안에서만 처리 (pdf-lib) */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var drop = $('drop');
  var input = $('file-input');
  var listEl = $('files');
  var statusEl = $('status');
  var mergeBtn = $('merge-btn');
  var clearBtn = $('clear-btn');
  var badge = $('file-badge');
  var resultEl = $('result');

  var items = [];          // { id, name, size, doc, pageCount, range, error }
  var nextId = 1;
  var lastUrl = null;
  var busy = false;

  var lib = function () { return window.PDFLib; };
  var kb = function (n) {
    if (n >= 1048576) return (n / 1048576).toFixed(1) + 'MB';
    if (n >= 1024) return Math.round(n / 1024) + 'KB';
    return n + 'B';
  };
  function say(msg, kind) {
    statusEl.textContent = msg || '';
    statusEl.classList.toggle('ok', kind === 'ok');
  }

  var core = window.FL_PDFCORE || {};
  var parseRanges = core.parseRanges;
  function mergeItems(list) { return core.mergeItems(list, window.PDFLib); }

  /* ── 목록 그리기 ────────────────────────────────────────────── */
  function totalPages() {
    var n = 0;
    items.forEach(function (it) {
      if (it.error) return;
      try { n += parseRanges(it.range, it.pageCount).length; }
      catch (e) { n += 0; }
    });
    return n;
  }

  function refreshChrome() {
    var usable = items.filter(function (it) { return !it.error; });
    badge.textContent = usable.length + '개 파일 · ' + totalPages() + '페이지';
    mergeBtn.disabled = busy || usable.length === 0;
    clearBtn.disabled = busy || items.length === 0;
    mergeBtn.textContent = busy ? '합치는 중…' : (usable.length > 1 ? usable.length + '개 PDF 합치기' : 'PDF 합치기');
  }

  function render() {
    listEl.innerHTML = '';
    items.forEach(function (it, idx) {
      var li = document.createElement('li');
      li.className = 'file-row' + (it.error ? ' is-error' : '');
      li.setAttribute('data-id', it.id);

      var no = document.createElement('span');
      no.className = 'idx';
      no.textContent = it.error ? '!' : String(idx + 1);
      no.setAttribute('aria-hidden', 'true');

      var name = document.createElement('div');
      name.className = 'fname';
      var b = document.createElement('b');
      b.textContent = it.name;
      var meta = document.createElement('span');
      meta.className = 'fmeta';
      meta.textContent = it.error ? it.error : (it.pageCount + '페이지 · ' + kb(it.size));
      name.appendChild(b);
      name.appendChild(meta);

      var range = document.createElement('label');
      range.className = 'frange';
      var rs = document.createElement('span');
      rs.textContent = '포함할 페이지';
      var ri = document.createElement('input');
      ri.type = 'text';
      ri.inputMode = 'text';
      ri.autocomplete = 'off';
      ri.placeholder = '전체 (예: 1-3,5)';
      ri.value = it.range || '';
      ri.disabled = !!it.error;
      ri.setAttribute('aria-label', it.name + ' 에서 포함할 페이지');
      ri.addEventListener('input', function () {
        it.range = ri.value;
        try { parseRanges(ri.value, it.pageCount); ri.classList.remove('bad'); }
        catch (e) { ri.classList.add('bad'); }
        refreshChrome();
      });
      range.appendChild(rs);
      range.appendChild(ri);

      var btns = document.createElement('div');
      btns.className = 'fbtns';
      [['up', '↑', '위로', idx === 0], ['down', '↓', '아래로', idx === items.length - 1], ['rm', '✕', '목록에서 빼기', false]]
        .forEach(function (spec) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'iconbtn';
          btn.textContent = spec[1];
          btn.setAttribute('aria-label', it.name + ' ' + spec[2]);
          btn.setAttribute('data-act', spec[0]);
          btn.disabled = spec[3];
          btns.appendChild(btn);
        });

      li.appendChild(no);
      li.appendChild(name);
      li.appendChild(range);
      li.appendChild(btns);
      listEl.appendChild(li);
    });
    refreshChrome();
  }

  listEl.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn || busy) return;
    var li = btn.closest('.file-row');
    var id = parseInt(li.getAttribute('data-id'), 10);
    var i = items.findIndex(function (it) { return it.id === id; });
    if (i < 0) return;
    var act = btn.getAttribute('data-act');
    if (act === 'up' && i > 0) { var t = items[i - 1]; items[i - 1] = items[i]; items[i] = t; }
    if (act === 'down' && i < items.length - 1) { var u = items[i + 1]; items[i + 1] = items[i]; items[i] = u; }
    if (act === 'rm') items.splice(i, 1);
    render();
  });

  /* 파일 → ArrayBuffer (구형 브라우저는 FileReader로 대체) */
  function readBytes(file) {
    if (file.arrayBuffer) return file.arrayBuffer();
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = function () { reject(new Error('파일을 읽지 못했습니다.')); };
      fr.readAsArrayBuffer(file);
    });
  }

  /* ── 파일 받기 ─────────────────────────────────────────────── */
  function addFiles(fileList) {
    var PDFLib = lib();
    if (!PDFLib) { say('PDF 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로고침해 주세요.'); return; }
    var arr = Array.prototype.slice.call(fileList || []);
    if (!arr.length) return;
    var skipped = [];
    var jobs = [];
    arr.forEach(function (f) {
      var isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
      if (!isPdf) { skipped.push(f.name); return; }
      var item = { id: nextId++, name: f.name, size: f.size, doc: null, pageCount: 0, range: '', error: null };
      items.push(item);
      jobs.push(
        readBytes(f).then(function (buf) {
          return PDFLib.PDFDocument.load(buf, { updateMetadata: false, throwOnInvalidObject: false });
        }).then(function (doc) {
          item.doc = doc;
          item.pageCount = doc.getPageCount();
          if (!item.pageCount) item.error = '페이지가 없는 PDF입니다.';
        }).catch(function (err) {
          item.error = /encrypt/i.test(String(err && err.message)) ? '암호가 걸린 PDF라 열 수 없습니다.' : 'PDF를 읽지 못했습니다.';
        })
      );
    });
    if (skipped.length) say('PDF가 아닌 파일 ' + skipped.length + '개는 건너뛰었습니다: ' + skipped.join(', '));
    else say('파일을 읽는 중…');
    render();
    Promise.all(jobs).then(function () {
      render();
      var ok = items.filter(function (it) { return !it.error; }).length;
      if (ok) say('준비됐습니다. 순서와 페이지를 확인한 뒤 ‘PDF 합치기’를 누르세요.', 'ok');
      else if (items.length) say('읽을 수 있는 PDF가 없습니다. 암호가 걸린 파일인지 확인해 주세요.');
    });
  }

  /* ── 합치기 ────────────────────────────────────────────────── */
  function doMerge() {
    if (busy) return;
    var usable = items.filter(function (it) { return !it.error; });
    if (!usable.length) { say('먼저 PDF 파일을 올려 주세요.'); return; }
    var plan = [];
    for (var i = 0; i < usable.length; i++) {
      var it = usable[i];
      try {
        plan.push({ doc: it.doc, pages: parseRanges(it.range, it.pageCount), name: it.name });
      } catch (e) {
        say(it.name + ' — ' + e.message);
        var row = listEl.querySelector('[data-id="' + it.id + '"] input');
        if (row) { row.classList.add('bad'); row.focus(); }
        return;
      }
    }
    busy = true;
    refreshChrome();
    say('합치는 중…');
    mergeItems(plan).then(function (bytes) {
      var blob = new Blob([bytes], { type: 'application/pdf' });
      var pages = plan.reduce(function (a, p) { return a + p.pages.length; }, 0);
      var fname = '합친PDF_' + pages + '페이지.pdf';
      if (lastUrl) URL.revokeObjectURL(lastUrl);
      lastUrl = URL.createObjectURL(blob);
      $('result-name').textContent = fname;
      $('result-meta').textContent = plan.length + '개 파일의 ' + pages + '페이지를 합쳤습니다 · ' + kb(blob.size) + ' · 원본 페이지 크기 유지';
      $('result-badge').textContent = '완성';
      var a = $('download-link');
      a.href = lastUrl;
      a.download = fname;
      resultEl.hidden = false;
      triggerDownload(lastUrl, fname);
      say(pages + '페이지 PDF를 만들었습니다. 내려받기가 시작됩니다.', 'ok');
      resultEl.scrollIntoView({ block: 'nearest' });
    }).catch(function (err) {
      say('합치지 못했습니다: ' + (err && err.message ? err.message : '알 수 없는 오류'));
    }).then(function () {
      busy = false;
      refreshChrome();
    });
  }

  function triggerDownload(url, name) {
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /* ── 이벤트 ───────────────────────────────────────────────── */
  drop.addEventListener('click', function () { if (!busy) input.click(); });
  drop.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!busy) input.click(); }
  });
  input.addEventListener('change', function () {
    addFiles(input.files);
    input.value = '';
  });
  ['dragenter', 'dragover'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
  });
  drop.addEventListener('drop', function (e) {
    if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
  });
  mergeBtn.addEventListener('click', doMerge);
  clearBtn.addEventListener('click', function () {
    items = [];
    if (lastUrl) { URL.revokeObjectURL(lastUrl); lastUrl = null; }
    resultEl.hidden = true;
    say('');
    render();
  });

  if (!lib()) {
    say('PDF 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로고침해 주세요.');
    mergeBtn.disabled = true;
  }
  refreshChrome();

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
    var PDFLib = lib();
    chk(!!PDFLib, 'pdf-lib 로드');
    if (!PDFLib) return;
    chk(JSON.stringify(parseRanges('1-3,5', 5)) === '[0,1,2,4]', '범위 "1-3,5" → 1·2·3·5페이지');
    chk(JSON.stringify(parseRanges('3-', 5)) === '[2,3,4]', '범위 "3-" → 3페이지부터 끝까지');
    chk(JSON.stringify(parseRanges('-2', 5)) === '[0,1]', '범위 "-2" → 처음부터 2페이지까지');
    chk(JSON.stringify(parseRanges('', 3)) === '[0,1,2]', '빈 범위 → 전체 페이지');
    var threw = false;
    try { parseRanges('9', 5); } catch (e) { threw = true; }
    chk(threw, '범위 초과(9 > 5페이지) → 오류로 막힘');

    var A, B;
    PDFLib.PDFDocument.create().then(function (doc) {
      A = doc;
      for (var i = 0; i < 3; i++) doc.addPage([595, 842]);
      return PDFLib.PDFDocument.create();
    }).then(function (doc) {
      B = doc;
      for (var i = 0; i < 2; i++) doc.addPage([400, 600]);
      return mergeItems([{ doc: A, pages: [0, 1, 2] }, { doc: B, pages: [1] }]);
    }).then(function (bytes) {
      chk(bytes && bytes.length > 500, '3페이지 + 1페이지 병합 결과 생성 (' + bytes.length + '바이트)');
      return PDFLib.PDFDocument.load(bytes);
    }).then(function (out) {
      chk(out.getPageCount() === 4, '병합 결과 페이지 수 4');
      var s = out.getPage(0).getSize();
      chk(Math.round(s.width) === 595 && Math.round(s.height) === 842, '1페이지 크기 595×842 유지');
      var s4 = out.getPage(3).getSize();
      chk(Math.round(s4.width) === 400 && Math.round(s4.height) === 600, '4페이지(B의 2페이지) 크기 400×600 유지');
      return mergeItems([{ doc: B, pages: parseRanges('1-2', 2) }]);
    }).then(function (bytes) {
      return PDFLib.PDFDocument.load(bytes);
    }).then(function (out) {
      chk(out.getPageCount() === 2, '한 파일에서 1-2 추출 → 2페이지');
      var li = document.createElement('li');
      li.textContent = '결과: PASS ' + pass + ' · FAIL ' + fail;
      li.style.fontWeight = '800';
      log.appendChild(li);
    }).catch(function (err) {
      var li = document.createElement('li');
      li.textContent = 'FAIL · 자체 점검 중 오류: ' + (err && err.message ? err.message : err);
      log.appendChild(li);
    });
  }
})();
