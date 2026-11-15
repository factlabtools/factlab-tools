# 팩트랩 툴 (FactLab Tools)

브라우저에서 바로 쓰는 무료 생활 도구 모음. 정적 HTML/CSS/JS만 사용하며 빌드 도구·서버·외부 라이브러리가 필요 없습니다.

| 도구 | 페이지 | 상태 |
| --- | --- | --- |
| 세계 시계 · 스톱워치 · 타이머 | `index.html` | 공개 |
| 모두의 뽑기 (룰렛·사다리·뽑기·자리·게임) | `draw.html` | 공개 |
| PDF 합치기·나누기 | `pdf.html` | 공개 |
| 목표 용량 이미지 압축기 | `image.html` | 공개 |
| 2026 연봉 실수령·퇴직금 계산기 | `salary.html` | 공개 |
| 2026 실업급여·조기재취업수당 계산기 | `unemployment.html` | 공개 |
| 한능검 퀴즈 | — | 준비 중 |
| 연말정산 계산기 | — | 준비 중 |

## 구조

- `index.html` 탭 3종 도구 + 활용 팁 + FAQ (JSON-LD: WebApplication, ItemList, FAQPage)
- `unemployment.html` 실업급여 계산기 + 근거 표 + FAQ (JSON-LD: WebApplication, FAQPage)
- `app.js` 시계·스톱워치·타이머 (월드클록 Intl 기반, 스톱워치 rAF, 타이머 Date 기반)
- `draw.html` / `draw.js` 뽑기 스위트 (Canvas 룰렛·사다리, 추첨, 좌석, 미니게임)
- `pdf.html`/`pdf.js`/`pdf-core.js` PDF 병합·추출 (pdf-lib CDN)
- `image.html`/`image.js`/`image-core.js` 목표 용량 압축 (Canvas + JSZip CDN)
- `salary.html`/`salary.js`/`salary-calc.js`/`salary-table.js` 2026 연봉 실수령·퇴직금
- `calc.js` 실업급여 계산 로직 `compute()` — 순수 함수
- `style.css` 모바일 퍼스트, 다크 모드, 인쇄 스타일
- `privacy.html`, `robots.txt`, `sitemap.xml`, `llms.txt`, `404.html`

## 검증

```js
const {compute} = require('./calc.js');
compute({pay:3000000, age:'under50', period:'5to10', year:'2026', received:0}).total; // 13870080
compute({pay:4000000, age:'under50', period:'ge10',  year:'2026', received:0}).total; // 16344000
```

## 배포

GitHub Pages, `main` 브랜치 루트. 정적 파일이므로 별도 빌드 단계가 없습니다.
