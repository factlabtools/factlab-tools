/*!
 * PDF 병합 핵심부 (DOM 없이 동작) — pdf.html에서 pdf-lib와 함께 씁니다.
 * 테스트에서도 이 파일을 그대로 불러 씁니다.
 */
(function (root) {
  'use strict';

  /* 페이지 범위 해석: "1-3,5" / "3-" / "-2" / "" → 0부터 시작하는 인덱스 배열 */
  function parseRanges(str, max) {
    var s = String(str == null ? '' : str).replace(/\s+/g, '');
    if (!s) {
      var all = [];
      for (var i = 0; i < max; i++) all.push(i);
      return all;
    }
    if (!/^[0-9,\-]+$/.test(s)) throw new Error('숫자와 붙임표(-), 쉼표만 쓸 수 있습니다.');
    var parts = s.split(',');
    var seen = Object.create(null);
    var out = [];
    for (var p = 0; p < parts.length; p++) {
      var t = parts[p];
      if (!t) continue;
      var a, b;
      if (t.indexOf('-') > 0) {
        var pair = t.split('-');
        a = parseInt(pair[0], 10);
        b = pair[1] === '' || pair[1] == null ? max : parseInt(pair[1], 10);
      } else if (t.charAt(0) === '-') {
        a = 1; b = parseInt(t.slice(1), 10);
      } else {
        a = parseInt(t, 10); b = a;
      }
      if (!a || !b || isNaN(a) || isNaN(b)) throw new Error('‘' + t + '’ 구간을 읽을 수 없습니다.');
      if (a > b) { var tmp = a; a = b; b = tmp; }
      if (a < 1 || b > max) throw new Error('이 파일은 ' + max + '페이지입니다. ‘' + t + '’는 범위를 벗어납니다.');
      for (var k = a; k <= b; k++) {
        if (!seen[k]) { seen[k] = 1; out.push(k - 1); }
      }
    }
    if (!out.length) throw new Error('남길 페이지가 없습니다.');
    return out;
  }

  /* 병합: list = [{ doc, pages:[0-based,...] }, ...] → Promise<Uint8Array> */
  function mergeItems(list, lib) {
    var PDFLib = lib || root.PDFLib;
    if (!PDFLib) return Promise.reject(new Error('PDF 라이브러리를 불러오지 못했습니다.'));
    return PDFLib.PDFDocument.create().then(function (out) {
      var chain = Promise.resolve();
      list.forEach(function (item) {
        chain = chain.then(function () {
          return out.copyPages(item.doc, item.pages).then(function (pages) {
            pages.forEach(function (pg) { out.addPage(pg); });
          });
        });
      });
      return chain.then(function () {
        out.setTitle('팩트랩 툴로 합친 PDF');
        out.setProducer('팩트랩 툴 PDF 합치기 (pdf-lib)');
        out.setCreator('FactLab Tools');
        out.setCreationDate(new Date());
        out.setModificationDate(new Date());
        return out.save({ useObjectStreams: false, addDefaultPage: false });
      });
    });
  }

  root.FL_PDFCORE = { parseRanges: parseRanges, mergeItems: mergeItems };
})(typeof globalThis !== 'undefined' ? globalThis : this);
