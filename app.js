(function (global) {
  'use strict';
  var doc = global.document;
  if (!doc) return;

  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = '0' + n; return n; }
  function store(key, val) {
    try {
      if (val === undefined) return global.localStorage.getItem(key);
      global.localStorage.setItem(key, val);
    } catch (e) {}
    return null;
  }

  /* ───────────────────────── 탭 ───────────────────────── */
  function initTabs() {
    var tabs = $$('.tab');
    if (!tabs.length) return;
    function activate(id, updateHash) {
      tabs.forEach(function (t) {
        var on = t.getAttribute('data-tab') === id;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        var p = doc.getElementById('panel-' + t.getAttribute('data-tab'));
        if (p) p.hidden = !on;
      });
      if (updateHash && global.history && global.history.replaceState) {
        try { global.history.replaceState(null, '', '#' + id); } catch (e) {}
      }
    }
    tabs.forEach(function (t, i) {
      t.tabIndex = t.getAttribute('aria-selected') === 'true' ? 0 : -1;
      t.addEventListener('click', function () { activate(t.getAttribute('data-tab'), true); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, next = null;
        if (k === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
        else if (k === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (k === 'Home') next = tabs[0];
        else if (k === 'End') next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); next.focus(); activate(next.getAttribute('data-tab'), true); }
      });
    });
    var h = (global.location.hash || '').replace('#', '');
    if (h && doc.getElementById('panel-' + h)) activate(h, false);
  }

  /* ───────────────────────── 세계 시계 ───────────────────────── */
  var CITIES = [
    { id: 'seoul', ko: '서울', en: 'Seoul', tz: 'Asia/Seoul' },
    { id: 'tokyo', ko: '도쿄', en: 'Tokyo', tz: 'Asia/Tokyo' },
    { id: 'osaka', ko: '오사카', en: 'Osaka', tz: 'Asia/Tokyo' },
    { id: 'beijing', ko: '베이징', en: 'Beijing', tz: 'Asia/Shanghai' },
    { id: 'hongkong', ko: '홍콩', en: 'Hong Kong', tz: 'Asia/Hong_Kong' },
    { id: 'taipei', ko: '타이베이', en: 'Taipei', tz: 'Asia/Taipei' },
    { id: 'singapore', ko: '싱가포르', en: 'Singapore', tz: 'Asia/Singapore' },
    { id: 'bangkok', ko: '방콕', en: 'Bangkok', tz: 'Asia/Bangkok' },
    { id: 'hanoi', ko: '하노이', en: 'Hanoi', tz: 'Asia/Ho_Chi_Minh' },
    { id: 'newdelhi', ko: '뉴델리', en: 'New Delhi', tz: 'Asia/Kolkata' },
    { id: 'dubai', ko: '두바이', en: 'Dubai', tz: 'Asia/Dubai' },
    { id: 'moscow', ko: '모스크바', en: 'Moscow', tz: 'Europe/Moscow' },
    { id: 'istanbul', ko: '이스탄불', en: 'Istanbul', tz: 'Europe/Istanbul' },
    { id: 'paris', ko: '파리', en: 'Paris', tz: 'Europe/Paris' },
    { id: 'london', ko: '런던', en: 'London', tz: 'Europe/London' },
    { id: 'berlin', ko: '베를린', en: 'Berlin', tz: 'Europe/Berlin' },
    { id: 'rome', ko: '로마', en: 'Rome', tz: 'Europe/Rome' },
    { id: 'newyork', ko: '뉴욕', en: 'New York', tz: 'America/New_York' },
    { id: 'chicago', ko: '시카고', en: 'Chicago', tz: 'America/Chicago' },
    { id: 'denver', ko: '덴버', en: 'Denver', tz: 'America/Denver' },
    { id: 'la', ko: '로스앤젤레스', en: 'Los Angeles', tz: 'America/Los_Angeles' },
    { id: 'vancouver', ko: '밴쿠버', en: 'Vancouver', tz: 'America/Vancouver' },
    { id: 'honolulu', ko: '호놀룰루', en: 'Honolulu', tz: 'Pacific/Honolulu' },
    { id: 'saopaulo', ko: '상파울루', en: 'São Paulo', tz: 'America/Sao_Paulo' },
    { id: 'sydney', ko: '시드니', en: 'Sydney', tz: 'Australia/Sydney' },
    { id: 'melbourne', ko: '멜버른', en: 'Melbourne', tz: 'Australia/Melbourne' },
    { id: 'auckland', ko: '오클랜드', en: 'Auckland', tz: 'Pacific/Auckland' }
  ];
  var DEFAULT_CITIES = ['seoul', 'tokyo', 'singapore', 'sydney', 'newyork', 'london', 'paris', 'la'];

  function initClock() {
    var grid = $('#clock-grid');
    if (!grid) return;
    var KEY_C = 'factlab.clock.cities';
    var KEY_F = 'factlab.clock.hour12';
    var byId = {};
    CITIES.forEach(function (c) { byId[c.id] = c; });

    var selected = [];
    try {
      var raw = store(KEY_C);
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr)) selected = arr.filter(function (id) { return !!byId[id]; });
      }
    } catch (e) { selected = []; }
    if (!selected.length) selected = DEFAULT_CITIES.slice();

    var hour12 = store(KEY_F) === '1';
    var fmtCache = {}, offCache = {}, dateCache = {};
    function fmtFor(tz) {
      if (!fmtCache[tz]) fmtCache[tz] = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
      });
      return fmtCache[tz];
    }
    function dateFor(tz) {
      if (!dateCache[tz]) dateCache[tz] = new Intl.DateTimeFormat('ko-KR', {
        timeZone: tz, month: 'long', day: 'numeric', weekday: 'short'
      });
      return dateCache[tz];
    }
    function offFor(tz) {
      if (!offCache[tz]) offCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' });
      return offCache[tz];
    }
    function offsetMin(tz, d) {
      var parts = offFor(tz).formatToParts(d);
      var v = '';
      for (var i = 0; i < parts.length; i++) if (parts[i].type === 'timeZoneName') v = parts[i].value;
      var m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(v);
      if (!m) return 0;
      return (m[1] === '-' ? -1 : 1) * (parseInt(m[2], 10) * 60 + parseInt(m[3] || '0', 10));
    }
    function relLabel(tz, d) {
      var seoul = byId['seoul'].tz;
      if (tz === seoul) return { text: '기준 도시', same: true };
      var diff = offsetMin(tz, d) - offsetMin(seoul, d);
      if (diff === 0) return { text: '서울과 같음', same: true };
      var a = Math.abs(diff), h = Math.floor(a / 60), mi = a % 60;
      return { text: '서울 ' + (diff > 0 ? '+' : '-') + h + '시간' + (mi ? ' ' + mi + '분' : ''), same: false };
    }

    function save() { store(KEY_C, JSON.stringify(selected)); }

    function buildCard(city) {
      var el = doc.createElement('article');
      el.className = 'clock';
      el.setAttribute('data-id', city.id);
      el.innerHTML =
        '<button class="x" type="button" aria-label="' + city.ko + ' 삭제" title="삭제">×</button>' +
        '<div class="city">' + city.ko + '</div>' +
        '<span class="tz">' + city.en + ' · ' + city.tz + '</span>' +
        '<div class="time num">--:--:--</div>' +
        '<div class="meta"><span class="date">—</span><span class="off">—</span></div>';
      el.querySelector('.x').addEventListener('click', function () {
        selected = selected.filter(function (id) { return id !== city.id; });
        save(); renderAll();
        msg('‘' + city.ko + '’을(를) 목록에서 뺐습니다.');
      });
      return el;
    }

    function renderAll() {
      grid.innerHTML = '';
      selected.forEach(function (id) { grid.appendChild(buildCard(byId[id])); });
      tick(true);
    }

    var lastPaint = {};
    function tick(force) {
      var d = new Date();
      selected.forEach(function (id) {
        var city = byId[id];
        var el = grid.querySelector('[data-id="' + id + '"]');
        if (!el) return;
        var p = fmtFor(city.tz).formatToParts(d);
        var H = 0, M = '00', S = '00';
        for (var i = 0; i < p.length; i++) {
          if (p[i].type === 'hour') H = parseInt(p[i].value, 10) % 24;
          else if (p[i].type === 'minute') M = p[i].value;
          else if (p[i].type === 'second') S = p[i].value;
        }
        var hh = String(H);
        var timeHTML = hour12
          ? '<small>' + (H < 12 ? '오전' : '오후') + '</small>' + pad(H % 12 || 12) + ':' + M + ':' + S
          : pad(H) + ':' + M + ':' + S;
        var dateText = dateFor(city.tz).format(d);
        var rel = relLabel(city.tz, d);
        var night = H < 6 || H >= 18;
        var tEl = el.querySelector('.time');
        var dEl = el.querySelector('.date');
        var oEl = el.querySelector('.off');
        var key = id + '|' + (hour12 ? 12 : 24);
        var stamp = timeHTML + dateText + rel.text;
        if (force || lastPaint[key] !== stamp) {
          tEl.innerHTML = timeHTML;
          dEl.textContent = dateText + ' · ' + (night ? '🌙 밤' : '☀️ 낮');
          oEl.textContent = rel.text;
          oEl.className = 'off' + (rel.same ? ' same' : '');
          el.classList.toggle('is-night', night);
          lastPaint[key] = stamp;
        }
      });
    }

    function msg(text) {
      var m = $('#clock-msg');
      if (m) { m.textContent = text; }
    }

    /* 도시 검색 */
    var input = $('#city-search'), addBtn = $('#city-add'), list = $('#city-list');
    if (list) {
      list.innerHTML = CITIES.map(function (c) { return '<option value="' + c.ko + '">' + c.en + '</option>'; }).join('');
    }
    function findCity(q) {
      if (!q) return null;
      var s = q.trim().toLowerCase();
      if (!s) return null;
      for (var i = 0; i < CITIES.length; i++) {
        var c = CITIES[i];
        if (c.ko.toLowerCase() === s || c.en.toLowerCase() === s || c.id === s ||
            (c.ko + ' (' + c.en + ')').toLowerCase() === s) return c;
      }
      for (var j = 0; j < CITIES.length; j++) {
        var c2 = CITIES[j];
        if (c2.ko.indexOf(s) >= 0 || c2.en.toLowerCase().indexOf(s) === 0) return c2;
      }
      return null;
    }
    function addCity() {
      var city = findCity(input.value);
      if (!city) { msg('도시를 찾지 못했습니다. 예: 도쿄, London, New York'); return; }
      if (selected.indexOf(city.id) >= 0) { msg('이미 목록에 있습니다.'); return; }
      selected.push(city.id);
      save(); renderAll();
      input.value = '';
      msg('‘' + city.ko + '’을(를) 추가했습니다.');
    }
    if (addBtn) addBtn.addEventListener('click', addCity);
    if (input) {
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addCity(); } });
      input.addEventListener('change', function () { if (findCity(input.value)) addCity(); });
    }

    /* 12/24시간 */
    var fmtInputs = $$('input[name="hformat"]');
    fmtInputs.forEach(function (r) {
      r.checked = (r.value === '12') === hour12;
      r.addEventListener('change', function () {
        hour12 = (r.value === '12');
        store(KEY_F, hour12 ? '1' : '0');
        tick(true);
      });
    });

    renderAll();
    setInterval(tick, 200);
  }

  /* ───────────────────────── 스톱워치 ───────────────────────── */
  function initStopwatch() {
    var root = doc.getElementById('panel-stopwatch');
    if (!root) return;
    var elH = $('#sw-h'), elM = $('#sw-m'), elS = $('#sw-s'), elMs = $('#sw-ms');
    var toggle = $('#sw-toggle'), lapBtn = $('#sw-lap'), resetBtn = $('#sw-reset');
    var lapsWrap = $('#laps-wrap'), lapList = $('#lap-list');
    var copyBtn = $('#lap-copy'), csvBtn = $('#lap-csv');
    var running = false, startedAt = 0, base = 0, raf = 0, laps = [];

    function elapsed() { return base + (running ? (global.performance.now() - startedAt) : 0); }
    function split(ms) {
      var cs = Math.floor(ms / 10);
      return { h: Math.floor(cs / 360000), m: Math.floor(cs / 6000) % 60, s: Math.floor(cs / 100) % 60, cs: cs % 100 };
    }
    function paintClock() {
      var t = split(elapsed());
      elH.textContent = pad(t.h);
      elM.textContent = pad(t.m);
      elS.textContent = pad(t.s);
      elMs.textContent = '.' + pad(t.cs);
    }
    function loop() {
      paintClock();
      if (running) raf = global.requestAnimationFrame(loop);
    }
    function fmtShort(ms) {
      var t = split(ms);
      return (t.h ? pad(t.h) + ':' : '') + pad(t.m) + ':' + pad(t.s) + '.' + pad(t.cs);
    }
    function fmtLong(ms) {
      var t = split(ms);
      return pad(t.h) + ':' + pad(t.m) + ':' + pad(t.s) + '.' + pad(t.cs);
    }

    function renderLaps() {
      lapsWrap.hidden = laps.length === 0;
      copyBtn.disabled = csvBtn.disabled = laps.length === 0;
      lapList.innerHTML = '';
      if (!laps.length) { lapsWrap.hidden = true; return; }
      var best = -1, worst = -1;
      if (laps.length >= 2) {
        var min = Infinity, max = -Infinity, minI = 0, maxI = 0;
        laps.forEach(function (l, i) {
          if (l.split < min) { min = l.split; minI = i; }
          if (l.split > max) { max = l.split; maxI = i; }
        });
        if (min !== max) { best = minI; worst = maxI; }
      }
      laps.forEach(function (l, i) {
        var row = doc.createElement('div');
        row.className = 'lap' + (i === best ? ' best' : i === worst ? ' worst' : '');
        var tag = i === best ? '<span class="tag">최단</span>' : i === worst ? '<span class="tag">최장</span>' : '';
        row.innerHTML = '<span>#' + l.n + '</span><span>' + fmtShort(l.split) + tag +
          '</span><span>' + fmtLong(l.total) + '</span>';
        lapList.appendChild(row);
      });
      lapList.scrollTop = lapList.scrollHeight;
    }

    function start() {
      if (running) return;
      running = true;
      startedAt = global.performance.now();
      toggle.textContent = '일시정지';
      toggle.className = 'btn btn-lg';
      lapBtn.disabled = false;
      loop();
    }
    function pause() {
      if (!running) return;
      base += global.performance.now() - startedAt;
      running = false;
      if (raf) global.cancelAnimationFrame(raf);
      toggle.textContent = '계속';
      toggle.className = 'btn btn-primary btn-lg';
      lapBtn.disabled = true;
      paintClock();
    }
    function reset() {
      running = false;
      if (raf) global.cancelAnimationFrame(raf);
      base = 0; laps = [];
      toggle.textContent = '시작';
      toggle.className = 'btn btn-primary btn-lg';
      lapBtn.disabled = true;
      renderLaps();
      paintClock();
    }
    function lap() {
      if (!running) return;
      var total = elapsed();
      var prev = laps.length ? laps[laps.length - 1].total : 0;
      laps.push({ n: laps.length + 1, split: total - prev, total: total });
      renderLaps();
    }

    toggle.addEventListener('click', function () { running ? pause() : start(); });
    lapBtn.addEventListener('click', lap);
    resetBtn.addEventListener('click', reset);

    function lapStats() {
      var best = -1, worst = -1;
      if (laps.length >= 2) {
        var min = Infinity, max = -Infinity, minI = 0, maxI = 0;
        laps.forEach(function (l, i) {
          if (l.split < min) { min = l.split; minI = i; }
          if (l.split > max) { max = l.split; maxI = i; }
        });
        if (min !== max) { best = minI; worst = maxI; }
      }
      return { best: best, worst: worst };
    }
    function lapText() {
      var s = lapStats();
      var lines = ['스톱워치 랩 기록 (팩트랩 툴)'];
      laps.forEach(function (l, i) {
        var tag = i === s.best ? ' [최단]' : i === s.worst ? ' [최장]' : '';
        lines.push('#' + l.n + '\t구간 ' + fmtLong(l.split) + '\t누적 ' + fmtLong(l.total) + tag);
      });
      lines.push('총 ' + fmtLong(elapsed()) + ' · ' + laps.length + '랩');
      return lines.join('\n');
    }
    function lapCsv() {
      var rows = ['lap,split_seconds,split,total_seconds,total'];
      laps.forEach(function (l) {
        rows.push([l.n, (l.split / 1000).toFixed(2), fmtLong(l.split), (l.total / 1000).toFixed(2), fmtLong(l.total)].join(','));
      });
      return rows.join('\n');
    }
    function copy(text, btn) {
      var done = function () {
        var old = btn.textContent;
        btn.textContent = '복사됨';
        setTimeout(function () { btn.textContent = old; }, 1500);
      };
      if (global.navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallback(); });
      } else { fallback(); }
      function fallback() {
        var ta = doc.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', '');
        ta.style.position = 'fixed'; ta.style.top = '-1000px';
        doc.body.appendChild(ta); ta.select();
        try { doc.execCommand('copy'); done(); } catch (e) {}
        doc.body.removeChild(ta);
      }
    }
    copyBtn.addEventListener('click', function () { copy(lapText(), copyBtn); });
    csvBtn.addEventListener('click', function () { copy(lapCsv(), csvBtn); });

    doc.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      if (root.hidden) return;
      if (e.code === 'Space') { e.preventDefault(); running ? pause() : start(); }
      else if (e.key === 'l' || e.key === 'L') { e.preventDefault(); lap(); }
      else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); reset(); }
    });

    reset();
  }

  /* ───────────────────────── 타이머 ───────────────────────── */
  function initTimer() {
    var card = doc.getElementById('timer-card');
    if (!card) return;
    var disp = $('#t-time'), bar = $('#t-bar'), toggle = $('#t-toggle'), plus = $('#t-plus'), resetBtn = $('#t-reset');
    var hIn = $('#t-h'), mIn = $('#t-m'), sIn = $('#t-s'), setBtn = $('#t-set'), status = $('#t-status');
    var progress = $('.progress'), soundToggle = $('#sound-toggle'), presets = $$('#t-presets .chip');
    var total = 300000, remain = 300000, running = false, endAt = 0, timer = 0, done = false, audio = null;
    var TITLE = doc.title;

    function pad2(n) { return pad(n); }
    function fmt(ms, withHours) {
      var s = Math.ceil(ms / 1000);
      var h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = s % 60;
      if (withHours || h > 0) return pad2(h) + ':' + pad2(m) + ':' + pad2(ss);
      return pad2(m) + ':' + pad2(ss);
    }
    function paint() {
      disp.textContent = fmt(remain, total >= 3600000);
      var pct = total > 0 ? Math.min(100, Math.max(0, (1 - remain / total) * 100)) : 0;
      bar.style.width = pct.toFixed(1) + '%';
      progress.setAttribute('aria-valuenow', String(Math.round(pct)));
      progress.setAttribute('aria-valuetext', fmt(remain, total >= 3600000) + ' 남음');
    }
    function setStatus(text) { if (status) status.textContent = text; }
    function readInputs() {
      var h = Math.max(0, Math.min(99, parseInt(hIn.value, 10) || 0));
      var m = Math.max(0, Math.min(59, parseInt(mIn.value, 10) || 0));
      var s = Math.max(0, Math.min(59, parseInt(sIn.value, 10) || 0));
      return (h * 3600 + m * 60 + s) * 1000;
    }
    function syncInputs(ms) {
      var s = Math.round(ms / 1000);
      hIn.value = String(Math.floor(s / 3600));
      mIn.value = String(Math.floor(s / 60) % 60);
      sIn.value = String(s % 60);
    }
    function markPreset(ms) {
      presets.forEach(function (b) {
        b.classList.toggle('on', Number(b.getAttribute('data-min')) * 60000 === ms);
      });
    }
    function ensureAudio() {
      var Ctx = global.AudioContext || global.webkitAudioContext;
      if (!Ctx) return null;
      if (!audio) audio = new Ctx();
      if (audio.state === 'suspended') audio.resume();
      return audio;
    }
    function beep() {
      if (soundToggle && !soundToggle.checked) return;
      var ctx = ensureAudio();
      if (!ctx) return;
      for (var i = 0; i < 3; i++) {
        var t0 = ctx.currentTime + i * 0.42;
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = i === 2 ? 1046.5 : 880;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.25, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.36);
        o.connect(g); g.connect(ctx.destination);
        o.start(t0); o.stop(t0 + 0.4);
      }
    }
    function tick() {
      remain = endAt - Date.now();
      if (remain <= 0) { finish(); return; }
      paint();
      doc.title = '⏲️ ' + fmt(remain, total >= 3600000) + ' 남음 · 팩트랩 툴';
      var endClock = new Date(endAt);
      setStatus('진행 중 · 종료 예정 ' + pad2(endClock.getHours()) + ':' + pad2(endClock.getMinutes()) +
        (endClock.getHours() < 12 ? ' (오전)' : ' (오후)'));
    }
    function start() {
      if (remain <= 0) {
        var ms = readInputs();
        if (ms <= 0) { setStatus('시간을 먼저 설정해 주세요. 프리셋을 누르거나 시·분·초를 입력하세요.'); return; }
        total = remain = ms;
      }
      ensureAudio();
      done = false;
      card.classList.remove('done');
      running = true;
      endAt = Date.now() + remain;
      toggle.textContent = '일시정지';
      toggle.className = 'btn btn-lg';
      paint();
      clearInterval(timer);
      timer = setInterval(tick, 100);
      tick();
    }
    function pause() {
      if (!running) return;
      running = false;
      remain = Math.max(0, endAt - Date.now());
      clearInterval(timer);
      toggle.textContent = '계속';
      toggle.className = 'btn btn-primary btn-lg';
      paint();
      doc.title = '⏲️ ' + fmt(remain, total >= 3600000) + ' 일시정지 · 팩트랩 툴';
      setStatus('일시정지됨 · 남은 시간 ' + fmt(remain, total >= 3600000));
    }
    function finish() {
      running = false;
      clearInterval(timer);
      remain = 0;
      done = true;
      paint();
      card.classList.add('done');
      toggle.textContent = '다시 시작';
      toggle.className = 'btn btn-primary btn-lg';
      doc.title = '⏰ 시간 종료! · 팩트랩 툴';
      setStatus('시간이 끝났습니다. ‘다시 시작’을 누르면 같은 시간으로 다시 시작합니다.');
      beep();
    }
    function reset() {
      running = false;
      clearInterval(timer);
      done = false;
      card.classList.remove('done');
      var ms = readInputs();
      total = remain = ms > 0 ? ms : 300000;
      toggle.textContent = '시작';
      toggle.className = 'btn btn-primary btn-lg';
      paint();
      doc.title = TITLE;
      setStatus('시작하면 남은 시간이 탭 제목에 표시됩니다. 종료 시 비프음이 울립니다.');
      markPreset(total);
    }
    function applyPreset(ms) {
      running = false;
      clearInterval(timer);
      done = false;
      card.classList.remove('done');
      total = remain = ms;
      syncInputs(ms);
      markPreset(ms);
      paint();
      doc.title = TITLE;
      start();
    }

    presets.forEach(function (b) {
      b.addEventListener('click', function () { applyPreset(Number(b.getAttribute('data-min')) * 60000); });
    });
    setBtn.addEventListener('click', function () {
      var ms = readInputs();
      if (ms <= 0) { setStatus('1초 이상 입력해 주세요.'); return; }
      running = false;
      clearInterval(timer);
      done = false;
      card.classList.remove('done');
      total = remain = ms;
      markPreset(ms);
      paint();
      doc.title = TITLE;
      setStatus('설정됨 · ' + fmt(ms, ms >= 3600000) + ' · 시작을 누르세요.');
    });
    toggle.addEventListener('click', function () {
      if (running) pause();
      else if (done) { remain = total; start(); }
      else start();
    });
    plus.addEventListener('click', function () {
      if (done) { done = false; card.classList.remove('done'); total = 60000; remain = 60000; paint(); return; }
      total += 60000;
      if (running) endAt += 60000; else remain += 60000;
      paint();
      if (running) tick();
    });
    resetBtn.addEventListener('click', reset);

    doc.addEventListener('visibilitychange', function () {
      if (doc.visibilityState === 'visible' && running) tick();
    });

    reset();
  }

  function boot() {
    initTabs();
    initClock();
    initStopwatch();
    initTimer();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
