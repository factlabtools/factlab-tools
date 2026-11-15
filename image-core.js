/*!
 * 이미지 압축 핵심부 — 인코더를 주입받아 목표 용량을 맞추는 탐색만 담당합니다.
 * (실제 인코딩은 image.js가 Canvas로 합니다.)
 */
(function (root) {
  'use strict';

  /* encode(q) → Promise<{ blob, size }>
   * 목표 이하를 만족하는 가장 높은 품질을 이진 탐색으로 찾습니다.
   * 최저 품질에서도 목표를 넘으면 null (호출한 쪽이 크기를 줄여 재시도).
   */
  function searchQuality(encode, target, maxQ, minQ, steps) {
    var MAX_STEPS = steps || 8;
    return encode(minQ).then(function (first) {
      if (!first || first.size > target) return null;
      var best = { quality: minQ, blob: first.blob, size: first.size };
      function step(lo, hi, n) {
        if (n >= MAX_STEPS || hi - lo < 0.015) return Promise.resolve(best);
        var mid = (lo + hi) / 2;
        return encode(mid).then(function (r) {
          if (r && r.size <= target) {
            best = { quality: mid, blob: r.blob, size: r.size };
            return step(mid, hi, n + 1);
          }
          return step(lo, mid, n + 1);
        });
      }
      return step(minQ, maxQ, 0);
    });
  }

  /* 긴 변 기준 배율 + 캔버스 안전 한도 */
  function planScale(w, h, longSide, maxPixels, maxSide) {
    var scale = 1;
    if (longSide) scale = Math.min(1, longSide / Math.max(w, h));
    if (maxPixels) scale = Math.min(scale, Math.sqrt(maxPixels / (w * h)));
    if (maxSide) scale = Math.min(scale, maxSide / Math.max(w, h));
    if (!(scale > 0) || !isFinite(scale)) scale = 1;
    return scale;
  }

  root.FL_IMGCORE = { searchQuality: searchQuality, planScale: planScale };
})(typeof globalThis !== 'undefined' ? globalThis : this);
