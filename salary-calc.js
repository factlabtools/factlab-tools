/*!
 * 2026 연봉 실수령·퇴직금 계산 로직 (DOM 없이 동작하는 순수 계산부)
 *  - 원천징수 소득세: 국세청「근로소득 간이세액표」(소득세법 시행령 별표2, 개정 2026.2.27) 원문 값
 *  - 4대보험(근로자 부담): 국민연금 4.75% · 건강보험 3.595% · 장기요양 건보료의 13.14% · 고용보험 0.9%
 *  - 지방소득세: 소득세의 10%
 *  - 금액은 모두 원 단위, 보험료·세액은 10원 미만 절사(고지서·급여명세서 관행)
 */
(function (root) {
  'use strict';

  var RATES = {
    year: 2026,
    pension: 0.0475,            // 국민연금 근로자 부담 (총 9.5%)
    pensionMin: 410000,         // 기준소득월액 하한 (2026.7~2027.6)
    pensionMax: 6590000,        // 기준소득월액 상한 (2026.7~2027.6)
    health: 0.03595,            // 건강보험 근로자 부담 (총 7.19%)
    ltcOfHealth: 0.1314,        // 장기요양보험료 = 건강보험료 × 13.14% (=보수 × 0.9448%)
    employment: 0.009,          // 고용보험(실업급여) 근로자 부담 (총 1.8%)
    localTaxRate: 0.1,          // 지방소득세 = 소득세 × 10%
    mealLimit: 200000           // 비과세 식대 한도(월)
  };

  var TABLE = null;             // { map, base10000 }
  var TEN = function (x) { return Math.floor(x / 10) * 10; };

  /* ── 간이세액표 로딩 ───────────────────────────────────────── */
  function loadTable(data) {
    if (!data) return null;
    var map = Object.create(null);
    var rows = String(data.rows).split(';');
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r) continue;
      var c = r.indexOf(':');
      var key = +r.slice(0, c);
      var vals = r.slice(c + 1).split(',');
      var out = new Array(vals.length);
      for (var j = 0; j < vals.length; j++) out[j] = +vals[j] * 10;
      map[key] = out;
    }
    var base = String(data.base10000).split(',');
    var baseArr = new Array(base.length);
    for (var k = 0; k < base.length; k++) baseArr[k] = +base[k] * 10;
    return { map: map, base10000: baseArr, from: data.from, to: data.to };
  }

  function getTable() {
    if (TABLE) return TABLE;
    var g = root && root.FL_TAX2026;
    if (!g) return null;
    TABLE = loadTable(g);
    return TABLE;
  }

  /* ── 구간(키) 찾기: '월급여액 이상' 이면서 가장 큰 구간 ────────── */
  function findKeyKeys(map) {
    var keys = Object.keys(map).map(Number).sort(function (a, b) { return a - b; });
    return keys;
  }
  var KEY_CACHE = null;
  function keyOf(map, man) {
    if (!KEY_CACHE) KEY_CACHE = findKeyKeys(map);
    var lo = 0, hi = KEY_CACHE.length - 1, ans = -1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (KEY_CACHE[mid] <= man) { ans = KEY_CACHE[mid]; lo = mid + 1; } else { hi = mid - 1; }
    }
    return ans;
  }

  /* ── 원천징수 소득세(월) ──────────────────────────────────────
   * taxable: 비과세·학자금을 뺀 월급여액(원) / family: 공제대상가족 수 1~11
   */
  function lookupTax(taxable, family) {
    var T = getTable();
    if (!T) return null;
    var n = Math.min(11, Math.max(1, Math.round(family || 1)));
    if (!(taxable > 0)) return 0;
    if (taxable >= 10000000) {
      var base = T.base10000[n - 1] || 0;
      if (taxable === 10000000) return base;
      var d = taxable - 10000000, extra = 0;
      if (taxable <= 14000000) extra = 25000 + d * 0.98 * 0.35;
      else if (taxable <= 28000000) extra = 1397000 + (taxable - 14000000) * 0.98 * 0.38;
      else if (taxable <= 30000000) extra = 6610600 + (taxable - 28000000) * 0.98 * 0.40;
      else if (taxable <= 45000000) extra = 7394600 + (taxable - 30000000) * 0.40;
      else if (taxable <= 87000000) extra = 13394600 + (taxable - 45000000) * 0.42;
      else extra = 31034600 + (taxable - 87000000) * 0.45;
      return TEN(base + extra);
    }
    var man = Math.floor(taxable / 1000);
    if (man < T.from) return 0;                       // 77만원 미만: 원천징수 세액 없음
    var key = keyOf(T.map, man);
    if (key < 0) return 0;
    var row = T.map[key];
    return row[n - 1] || 0;
  }

  /* ── 4대보험(근로자 부담) ─────────────────────────────────── */
  function insurance(taxable) {
    var base = Math.min(RATES.pensionMax, Math.max(RATES.pensionMin, Math.floor(taxable / 1000) * 1000));
    var pension = TEN(base * RATES.pension);
    var health = TEN(taxable * RATES.health);
    var ltc = TEN(health * RATES.ltcOfHealth);
    var employment = TEN(taxable * RATES.employment);
    return {
      pensionBase: base,
      pension: pension,
      health: health,
      ltc: ltc,
      employment: employment,
      total: pension + health + ltc + employment
    };
  }

  /* ── 전체 계산 ───────────────────────────────────────────────
   * input = { annual, includeSeverance, mealAllowance, family }
   */
  function compute(input) {
    var annual = Math.max(0, Math.floor(input.annual || 0));
    var family = Math.min(11, Math.max(1, Math.round(input.family || 1)));
    var div = input.includeSeverance ? 13 : 12;
    var monthlyGross = Math.floor(annual / div);
    var meal = input.mealAllowance ? Math.min(RATES.mealLimit, Math.floor(monthlyGross / 2)) : 0;
    var taxable = Math.max(0, monthlyGross - meal);
    var ins = insurance(taxable);
    var incomeTax = lookupTax(taxable, family) || 0;
    var localTax = TEN(incomeTax * RATES.localTaxRate);
    var taxTotal = incomeTax + localTax;
    var net = monthlyGross - ins.total - taxTotal;
    var severance = monthlyGross;                    // 1년 근속 = 30일분 평균임금 ≒ 월 총급여
    return {
      annual: annual,
      includeSeverance: !!input.includeSeverance,
      family: family,
      divisor: div,
      monthlyGross: monthlyGross,
      meal: meal,
      taxable: taxable,
      pensionBase: ins.pensionBase,
      pension: ins.pension,
      health: ins.health,
      ltc: ins.ltc,
      employment: ins.employment,
      insuranceTotal: ins.total,
      incomeTax: incomeTax,
      localTax: localTax,
      taxTotal: taxTotal,
      deductionTotal: ins.total + taxTotal,
      netMonthly: net,
      netAnnual: net * 12,
      severance: severance,
      deductionRate: monthlyGross ? (ins.total + taxTotal) / monthlyGross : 0
    };
  }

  root.FL_SALARY = {
    RATES: RATES,
    compute: compute,
    lookupTax: lookupTax,
    insurance: insurance,
    loadTable: loadTable
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
