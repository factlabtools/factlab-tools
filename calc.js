(function (global) {
  'use strict';

  var LIMITS = {
    '2026': { cap: 68100, floor: 66048, capBasis: '기초일액 상한 113,500원 × 60%',
              floorBasis: '2026년 최저임금 10,320원 × 8시간 × 80%' },
    '2025': { cap: 66000, floor: 64192, capBasis: '기초일액 상한 110,000원 × 60%',
              floorBasis: '2025년 최저임금 10,030원 × 8시간 × 80%' }
  };

  var DAYS = {
    'under50': { 'lt1': 120, '1to3': 150, '3to5': 180, '5to10': 210, 'ge10': 240 },
    'over50':  { 'lt1': 120, '1to3': 180, '3to5': 210, '5to10': 240, 'ge10': 270 }
  };

  var PERIOD_LABEL = {
    'lt1': '1년 미만', '1to3': '1년 이상 3년 미만', '3to5': '3년 이상 5년 미만',
    '5to10': '5년 이상 10년 미만', 'ge10': '10년 이상'
  };
  var AGE_LABEL = { 'under50': '만 50세 미만', 'over50': '만 50세 이상·장애인' };

  var won = new Intl.NumberFormat('ko-KR');

  /* pay(원) · age · period · year · received(이미 받은 일수) → 계산 결과 */
  function compute(input) {
    var pay = Number(input.pay);
    var year = LIMITS[input.year] ? input.year : '2026';
    var age = DAYS[input.age] ? input.age : 'under50';
    var period = DAYS[age][input.period] ? input.period : '1to3';

    if (!isFinite(pay) || pay <= 0) {
      return { ok: false, error: '최근 3개월 월평균 세전 급여를 입력해 주세요.' };
    }

    var lim = LIMITS[year];
    var dayAvg = pay / 30;
    var sixty = dayAvg * 0.6;
    var base = Math.floor(sixty);
    var amount, applied, appliedLabel;

    if (base < lim.floor) { amount = lim.floor; applied = 'floor'; appliedLabel = '하한액 적용'; }
    else if (base > lim.cap) { amount = lim.cap; applied = 'cap'; appliedLabel = '상한액 적용'; }
    else { amount = base; applied = 'avg'; appliedLabel = '평균임금 60% 적용'; }

    var days = DAYS[age][period];
    var month30 = amount * 30;
    var total = amount * days;

    var received = Math.round(Number(input.received) || 0);
    if (received < 0) received = 0;
    if (received > days) received = days;
    var remain = days - received;
    var eligible = remain * 2 >= days;
    var earlyAmount = eligible ? Math.floor(remain / 2) * amount : 0;
    var paidSoFar = amount * received;

    return {
      ok: true, year: year, age: age, period: period,
      pay: pay, dayAvg: dayAvg, sixty: sixty, base: base,
      amount: amount, applied: applied, appliedLabel: appliedLabel,
      cap: lim.cap, floor: lim.floor,
      month30: month30, days: days, total: total,
      received: received, remain: remain, eligible: eligible,
      earlyAmount: earlyAmount, paidSoFar: paidSoFar,
      withEarly: paidSoFar + earlyAmount,
      needRemain: Math.ceil(days / 2)
    };
  }

  function formatWon(n) { return won.format(Math.round(n)); }

  function summary(r) {
    if (!r.ok) return '';
    var t = [];
    t.push('2026 실업급여 계산 결과 (' + (r.year === '2026' ? '2026-01-01 이후 이직자' : '2025년 이직자') + ')');
    t.push('· 월평균 세전 급여: ' + formatWon(r.pay) + '원');
    t.push('· 나이/가입기간: ' + AGE_LABEL[r.age] + ' / ' + PERIOD_LABEL[r.period]);
    t.push('· 1일 구직급여: ' + formatWon(r.amount) + '원 (' + r.appliedLabel + ')');
    t.push('· 30일 환산: ' + formatWon(r.month30) + '원');
    t.push('· 소정급여일수: ' + r.days + '일');
    t.push('· 총 예상 수령액: ' + formatWon(r.total) + '원');
    if (r.earlyAmount > 0) t.push('· 조기재취업수당 예상: ' + formatWon(r.earlyAmount) + '원 (잔여 ' + r.remain + '일)');
    t.push('※ 2026년 기준 추정치 · 최종 금액은 고용센터 심사로 결정됩니다.');
    return t.join('\n');
  }

  var calc = { compute: compute, DAYS: DAYS, LIMITS: LIMITS, PERIOD_LABEL: PERIOD_LABEL,
               AGE_LABEL: AGE_LABEL, formatWon: formatWon, summary: summary };
  if (typeof module !== 'undefined' && module.exports) module.exports = calc;
  global.FactlabCalc = calc;

  if (typeof document === 'undefined') return;

  function $(id) { return document.getElementById(id); }

  function init() {
    var form = $('calc-form');
    if (!form) return;

    var payInput = $('pay');
    var unitInputs = form.querySelectorAll('input[name="unit"]');
    var yearInputs = form.querySelectorAll('input[name="year"]');
    var ageInputs = form.querySelectorAll('input[name="age"]');
    var periodSelect = $('period');
    var range = $('received');
    var msg = $('form-msg');
    var lastPayWon = 3000000;

    function unit() {
      for (var i = 0; i < unitInputs.length; i++) if (unitInputs[i].checked) return unitInputs[i].value;
      return 'man';
    }
    function radioValue(list, fallback) {
      for (var i = 0; i < list.length; i++) if (list[i].checked) return list[i].value;
      return fallback;
    }
    function syncPayFromInput() {
      var v = Number(payInput.value);
      if (!isFinite(v) || v <= 0) return null;
      lastPayWon = unit() === 'man' ? Math.round(v * 10000) : Math.round(v);
      return lastPayWon;
    }
    function setPayDisplay(wonValue) {
      lastPayWon = wonValue;
      if (unit() === 'man') payInput.value = String(Math.round(wonValue / 10000 * 100) / 100);
      else payInput.value = String(wonValue);
    }

    function render() {
      var pay = syncPayFromInput();
      var year = radioValue(yearInputs, '2026');
      var age = radioValue(ageInputs, 'under50');
      var period = periodSelect.value;
      var r = compute({ pay: pay == null ? 0 : pay, age: age, period: period, year: year, received: range.value });

      if (!r.ok) {
        msg.textContent = r.error;
        $('res-amount').innerHTML = '—';
        $('res-badge').textContent = '';
        $('res-badge').className = 'badge';
        return;
      }
      msg.textContent = '';

      $('res-amount').innerHTML = formatWon(r.amount) + '<small>원</small>';
      var b = $('res-badge');
      b.textContent = r.appliedLabel;
      b.className = 'badge ' + r.applied;

      $('res-formula').innerHTML =
        '월 ' + formatWon(r.pay) + '원 ÷ 30 × 60% = ' + formatWon(r.sixty) + '원 → ' +
        (r.applied === 'cap' ? '상한 ' + formatWon(r.cap) + '원 적용' :
         r.applied === 'floor' ? '하한 ' + formatWon(r.floor) + '원 적용' :
         '평균임금의 60% 그대로 적용');

      $('res-30').innerHTML = formatWon(r.month30) + '<em>원</em>';
      $('res-days').innerHTML = r.days + '<em>일</em>';
      $('res-total').innerHTML = formatWon(r.total) + '<em>원</em>';
      $('res-total-sub').textContent = formatWon(r.amount) + '원 × ' + r.days + '일 · 30일 환산 월 ' + formatWon(r.month30) + '원';

      range.max = String(r.days);
      if (Number(range.value) > r.days) range.value = String(r.days);
      $('range-max').textContent = r.days + '일';
      $('early-remain').textContent = r.remain + '일 (소정급여일수의 ' + Math.round(r.remain / r.days * 100) + '%)';
      var flag = $('early-flag');
      if (r.eligible) {
        flag.className = 'early-flag ok';
        flag.innerHTML = '지급 요건 충족 — 잔여 ' + r.remain + '일은 소정급여일수의 절반(' + formatWon(r.needRemain) +
          '일) 이상입니다. 재취업 후 12개월 이상 계속 고용되면 신청할 수 있습니다.';
      } else {
        flag.className = 'early-flag no';
        flag.innerHTML = '요건 미달 — 잔여일수가 소정급여일수의 절반(' + r.needRemain + '일) 이상 남아 있어야 합니다. 지금은 ' +
          r.remain + '일 남았습니다.';
      }
      $('early-amount').innerHTML = formatWon(r.earlyAmount) + '<em>원</em>';
      $('early-total').textContent = '수급액 ' + formatWon(r.paidSoFar) + '원 + 수당 ' + formatWon(r.earlyAmount) +
        '원 = ' + formatWon(r.withEarly) + '원';

      $('tb-pay').textContent = formatWon(r.pay) + '원';
      $('tb-avg').textContent = formatWon(r.dayAvg) + '원';
      $('tb-sixty').textContent = formatWon(r.sixty) + '원';
      $('tb-amount').innerHTML = formatWon(r.amount) + '원 <span style="color:var(--muted);font-weight:700">(' + r.appliedLabel + ')</span>';
      $('tb-days').textContent = AGE_LABEL[r.age] + ' · ' + PERIOD_LABEL[r.period] + ' → ' + r.days + '일';
      $('tb-total').textContent = formatWon(r.total) + '원';

      var rows = document.querySelectorAll('#days-table tbody tr');
      for (var i = 0; i < rows.length; i++) {
        rows[i].classList.toggle('is-selected',
          rows[i].getAttribute('data-age') === r.age && rows[i].getAttribute('data-period') === r.period);
      }

      if (global.history && global.history.replaceState) {
        var q = '?pay=' + Math.round(r.pay) + '&age=' + r.age + '&period=' + r.period +
                '&year=' + r.year + (r.received ? '&recv=' + r.received : '');
        try { global.history.replaceState(null, '', q); } catch (e) {}
      }
    }

    function fromUrl() {
      var p = new URLSearchParams(global.location.search);
      if (p.get('year') && LIMITS[p.get('year')]) {
        for (var i = 0; i < yearInputs.length; i++) yearInputs[i].checked = (yearInputs[i].value === p.get('year'));
      }
      if (p.get('age') && DAYS[p.get('age')]) {
        for (var j = 0; j < ageInputs.length; j++) ageInputs[j].checked = (ageInputs[j].value === p.get('age'));
      }
      if (p.get('period') && PERIOD_LABEL[p.get('period')]) periodSelect.value = p.get('period');
      if (p.get('pay')) {
        var v = Number(p.get('pay'));
        if (isFinite(v) && v > 0) setPayDisplay(v);
      }
      if (p.get('recv')) range.value = p.get('recv');
    }

    form.addEventListener('input', render);
    form.addEventListener('change', render);
    form.addEventListener('submit', function (e) { e.preventDefault(); render(); });

    for (var u = 0; u < unitInputs.length; u++) {
      unitInputs[u].addEventListener('change', function () { setPayDisplay(lastPayWon); render(); });
    }

    var copyBtn = $('copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var pay = syncPayFromInput();
        var r = compute({ pay: pay || 0, age: radioValue(ageInputs, 'under50'), period: periodSelect.value,
                          year: radioValue(yearInputs, '2026'), received: range.value });
        var text = summary(r);
        var done = function () {
          copyBtn.textContent = '복사 완료';
          setTimeout(function () { copyBtn.textContent = '결과 복사'; }, 1600);
        };
        if (global.navigator && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
        } else { fallbackCopy(text, done); }
      });
    }
    function fallbackCopy(text, done) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.top = '-1000px';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
      document.body.removeChild(ta);
    }

    var resetBtn = $('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        payInput.value = '300';
        for (var i = 0; i < unitInputs.length; i++) unitInputs[i].checked = (unitInputs[i].value === 'man');
        for (var j = 0; j < yearInputs.length; j++) yearInputs[j].checked = (yearInputs[j].value === '2026');
        for (var k = 0; k < ageInputs.length; k++) ageInputs[k].checked = (ageInputs[k].value === 'under50');
        periodSelect.value = '5to10';
        range.value = '0';
        lastPayWon = 3000000;
        render();
      });
    }

    fromUrl();
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : globalThis);
