# 프로젝트/사이트명 변경: MangaDL → 온라인만화뷰어

## 왜

사용자 요청: 사이트명/프로젝트명을 "온라인만화뷰어"로 바꿔달라. 소스코드와 md 문서 전반에 반영.

## 바꿀 것 (사용자에게 보이는 이름)

| 파일 | 현재 | 변경 |
|---|---|---|
| `CLAUDE.md` | `# MangaDL` | `# 온라인만화뷰어` |
| `README.md` | `# MangaDL` | `# 온라인만화뷰어` |
| `docs/USAGE.md` | `# MangaDL 사용법` | `# 온라인만화뷰어 사용법` |
| `docs/CHANGELOG.md` | "MangaDL(FastAPI 웹 버전)에 추가/변경된 기능을..." | "온라인만화뷰어(FastAPI 웹 버전)에 추가/변경된 기능을..." |
| `static/index.html` | `<title>MangaDL</title>` | `<title>온라인만화뷰어</title>` |
| `static/index.html` | `<div class="wordmark">Manga<span>DL</span></div>` | `<div class="wordmark">온라인만화<span>뷰어</span></div>` (기존과 같은 2톤 배색 유지: 앞부분 강조색, 뒷부분 기본색) |
| `static/index.html` | `<footer>MangaDL &middot; ...</footer>` | `<footer>온라인만화뷰어 &middot; ...</footer>` |
| `static/style.css` | 1번째 줄 주석 `/* MangaDL — design tokens ... */` | `/* 온라인만화뷰어 — design tokens ... */` |
| `app/main.py` | `FastAPI(title="MangaDL", ...)` | `FastAPI(title="온라인만화뷰어", ...)` (description은 그대로 유지) |

## 범위에서 뺀 것 (이유)

- **`static/app.js`의 localStorage 키** (`mangadl_progress_v1`, `mangadl_reader_view_mode`,
  `mangadl_reader_direction`, `mangadl_reader_pages_per_view`) — 이름만 내부 식별자로
  쓰일 뿐 사용자에게 보이지 않는다. 여기를 바꾸면 브라우저에 이미 저장된 읽음
  표시·리더 설정이 새 키를 못 찾아 초기화(사실상 데이터 유실)된다. 브랜드명 변경의
  득보다 손실이 커서 그대로 둔다. (이 키를 언급하는 `docs/아키텍처.md`의 설명도
  동반해서 그대로 둔다.)
- **저장소/폴더 이름(`mangaDownload`)** — 파일시스템 경로 변경이라 영향 범위가 다르다
  (열려 있는 에디터/터미널 경로, git remote 이름 등). "소스코드와 md 문서"라는 요청
  범위 밖이라 이번엔 건드리지 않는다. 폴더/저장소 이름까지 바꾸고 싶으면 별도로
  말씀해달라.

## 승인 후 적용 순서

1. 위 표의 9곳을 수정.
2. 서버 기동 후 브라우저로 제목표시줄/헤더 워드마크/푸터/`/docs` 페이지 제목이
   "온라인만화뷰어"로 보이는지 확인.
3. 문제없으면 이 파일 그대로 두고, 사용자가 git commit을 지시하면 커밋.
