/* 2026 연봉 실수령액·퇴직금 계산기 — 화면 제어 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var form = $('salary-form');
  if (!form) return;

  var won = function (n) { return (Math.round(n) || 0).toLocaleString('ko-KR'); };
  var wonUnit = function (n) { return won(n) + '원'; };
  var manwon = function (n) { return (n / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 0 }) + '만원'; };
  var pct = function (n) { return (n * 100).toFixed(1) + '%'; };

  var last = null;

  function unitValue() {
    var el = form.querySelector('input[name="unit"]:checked');
    return el ? el.value : 'man';
  }

  function readInput() {
    var raw = parseFloat($('annual').value);
    if (isNaN(raw) || raw < 0) return null;
    var annual = unitValue() === 'man' ? raw * 10000 : raw;
    if (annual > 1000000000) annual = 1000000000;
    return {
      annual: Math.round(annual),
      includeSeverance: form.querySelector('input[name="severance"]:checked').value === 'included',
      mealAllowance: $('meal').checked,
      family: parseInt($('family').value, 10) || 1
    };
  }

  function setText(id, text) {
    var el = $(id);
    if (el) el.textContent = text;
  }

  function render(r) {
    last = r;
    if (!r) {
      ['res-net', 'res-gross', 'res-taxable', 'res-pension', 'res-health', 'res-ltc', 'res-emp',
        'res-itax', 'res-ltax', 'res-net2', 'res-severance', 'res-annual',
        'tb-annual', 'tb-gross', 'tb-meal', 'tb-taxable', 'tb-pbase', 'tb-ins', 'tb-itax', 'tb-ltax', 'tb-ded', 'tb-net']
        .forEach(function (id) { setText(id, '—'); });
      setText('res-formula', '연봉을 넣으면 바로 계산됩니다.');
      setText('res-sub', '공제 합계 —');
      setText('res-flag', '—');
      return;
    }

    setText('res-net', wonUnit(r.netMonthly));
    setText('res-formula', '세전 월급 ' + wonUnit(r.monthlyGross) + ' − 공제 ' + wonUnit(r.deductionTotal));
    setText('res-gross', wonUnit(r.monthlyGross));
    setText('res-taxable', wonUnit(r.taxable));
    setText('res-pension', '−' + wonUnit(r.pension));
    setText('res-health', '−' + wonUnit(r.health));
    setText('res-ltc', '−' + wonUnit(r.ltc));
    setText('res-emp', '−' + wonUnit(r.employment));
    setText('res-itax', '−' + wonUnit(r.incomeTax));
    setText('res-ltax', '−' + wonUnit(r.localTax));
    setText('res-net2', wonUnit(r.netMonthly));
    setText('res-sub', '4대보험 ' + wonUnit(r.insuranceTotal) + ' + 세금 ' + wonUnit(r.taxTotal) + ' = 공제 합계 ' + wonUnit(r.deductionTotal) + ' (' + pct(r.deductionRate) + ')');
    setText('res-severance', wonUnit(r.severance));
    setText('res-annual', wonUnit(r.netAnnual));
    setText('res-flag', r.includeSeverance
      ? '퇴직금 포함 연봉이라 월급은 연봉 ÷ 13입니다. 실수령 기준 월 ' + wonUnit(r.netMonthly) + '.'
      : '퇴직금 별도 연봉이라 월급은 연봉 ÷ 12입니다. 퇴직금은 회사가 따로 적립합니다.');

    setText('tb-annual', wonUnit(r.annual));
    setText('tb-div', String(r.divisor));
    setText('tb-gross', wonUnit(r.monthlyGross));
    setText('tb-meal', r.meal ? '−' + wonUnit(r.meal) : '없음');
    setText('tb-taxable', wonUnit(r.taxable));
    setText('tb-pbase', wonUnit(r.pensionBase) + (r.pensionBase === 6590000 ? ' (상한)' : r.pensionBase === 410000 ? ' (하한)' : ''));
    setText('tb-ins', wonUnit(r.insuranceTotal));
    setText('tb-fam', String(r.family));
    setText('tb-itax', wonUnit(r.incomeTax));
    setText('tb-ltax', wonUnit(r.localTax));
    setText('tb-ded', wonUnit(r.deductionTotal));
    setText('tb-net', wonUnit(r.netMonthly));

    var badge = $('res-badge');
    if (badge) badge.textContent = r.family > 1 ? '가족 ' + r.family + '명' : '본인 1명';
  }

  function validate() {
    var msg = $('form-msg');
    var inp = $('annual');
    var raw = parseFloat(inp.value);
    if (inp.value === '' || isNaN(raw)) { msg.textContent = '연봉을 숫자로 넣어 주세요.'; return false; }
    if (raw < 0) { msg.textContent = '연봉은 0원 이상이어야 합니다.'; return false; }
    var annual = unitValue() === 'man' ? raw * 10000 : raw;
    if (annual < 1000000) { msg.textContent = '연봉 100만원 이상부터 계산할 수 있습니다.'; return false; }
    if (annual > 1000000000) { msg.textContent = '연봉 10억원까지 계산합니다. 금액을 확인해 주세요.'; return false; }
    msg.textContent = '';
    return true;
  }

  function update() {
    if (!validate()) { render(null); return; }
    var r = FL_SALARY.compute(readInput());
    render(r);
    highlightRow(r);
  }

  var ROWS = [2400, 3000, 3600, 4000, 5000, 6000, 8000, 10000];
  function buildTable() {
    var body = document.querySelector('#salary-table tbody');
    if (!body || !window.FL_SALARY) return;
    var trs = body.querySelectorAll('tr');
    ROWS.forEach(function (man, i) {
      var r = FL_SALARY.compute({ annual: man * 10000, includeSeverance: false, mealAllowance: true, family: 1 });
      var tr = trs[i];
      if (!tr) return;
      var cells = tr.querySelectorAll('td');
      cells[0].textContent = man.toLocaleString('ko-KR') + '만원';
      cells[1].textContent = won(r.monthlyGross);
      cells[2].textContent = won(r.insuranceTotal);
      cells[3].textContent = won(r.taxTotal);
      cells[4].textContent = won(r.netMonthly);
      cells[5].textContent = won(r.netAnnual);
      tr.dataset.annual = String(man * 10000);
    });
  }

  function highlightRow(r) {
    var body = document.querySelector('#salary-table tbody');
    if (!body || !r) return;
    var best = null;
    body.querySelectorAll('tr').forEach(function (tr) {
      tr.classList.remove('is-selected');
      var a = parseInt(tr.dataset.annual, 10);
      if (isNaN(a)) return;
      if (best === null || Math.abs(a - r.annual) < Math.abs(best - r.annual)) best = a;
    });
    if (best !== null && Math.abs(best - r.annual) <= 3000000) {
      body.querySelectorAll('tr').forEach(function (tr) {
        if (parseInt(tr.dataset.annual, 10) === best && r.family === 1 && !r.includeSeverance) tr.classList.add('is-selected');
      });
    }
  }

  function copyResult() {
    if (!last) { update(); if (!last) return; }
    var r = last;
    var lines = [
      '[2026 연봉 실수령 계산] 연봉 ' + won(r.annual) + '원 · 퇴직금 ' + (r.includeSeverance ? '포함(÷13)' : '별도(÷12)') + ' · ' + (r.meal ? '식대 20만원 비과세' : '비과세 없음') + ' · 부양가족 ' + r.family + '명',
      '세전 월급 ' + wonUnit(r.monthlyGross) + ' (과세 기준 ' + wonUnit(r.taxable) + ')',
      '국민연금 ' + wonUnit(r.pension) + ' / 건강보험 ' + wonUnit(r.health) + ' / 장기요양 ' + wonUnit(r.ltc) + ' / 고용보험 ' + wonUnit(r.employment),
      '소득세 ' + wonUnit(r.incomeTax) + ' / 지방소득세 ' + wonUnit(r.localTax),
      '공제 합계 ' + wonUnit(r.deductionTotal) + ' (' + pct(r.deductionRate) + ')',
      '월 실수령 ' + wonUnit(r.netMonthly) + ' · 연 실수령 ' + wonUnit(r.netAnnual),
      '퇴직금 1년 ' + wonUnit(r.severance),
      '2026년 4대보험 요율·국세청 간이세액표 기준 · 팩트랩 툴'
    ];
    var text = lines.join('\n');
    var done = function () { flash('복사했습니다'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.top = '-1000px';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { alert(text); }
      document.body.removeChild(ta);
    }
  }

  function flash(msg) {
    var b = $('copy-btn');
    if (!b) return;
    var old = b.textContent;
    b.textContent = msg;
    setTimeout(function () { b.textContent = old; }, 1400);
  }

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', function (e) { e.preventDefault(); update(); });
  $('copy-btn').addEventListener('click', copyResult);
  $('reset-btn').addEventListener('click', function () {
    $('annual').value = '4000';
    form.querySelector('input[name="unit"][value="man"]').checked = true;
    form.querySelector('input[name="severance"][value="separate"]').checked = true;
    $('meal').checked = true;
    $('family').value = '1';
    $('form-msg').textContent = '';
    update();
  });

  // 간이세액표 데이터가 없으면 잘못된 0원이 나오므로 먼저 막는다
  var tableReady = false;
  try { tableReady = !!(window.FL_TAX2026 && window.FL_SALARY && FL_SALARY.lookupTax(3000000, 1) > 0); } catch (e) { tableReady = false; }
  if (!tableReady) {
    $('form-msg').textContent = '소득세 표(근로소득 간이세액표)를 불러오지 못했습니다. 새로고침해 주세요.';
    form.querySelectorAll('button, input, select').forEach(function (el) { el.disabled = true; });
    return;
  }

  buildTable();
  update();
})();
