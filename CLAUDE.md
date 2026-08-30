# MangaDL

특정 게시판형 만화 사이트(`/bbs/board.php?bo_table=toons`)에서 작품을 검색·다운로드하고,
받은 파일을 브라우저에서 바로 읽을 수 있는 FastAPI 웹 앱. 다운로드 없이 사이트에서
바로 검색해서 읽는 온라인 뷰어 탭도 있다. 원래는 하드코딩된 값을 스크립트 상단에서
고쳐가며 실행하는 단일 파일 크롤러(`cwraling_download_manga_img_site2.py`)였던 것을
재구성했다.

## 실행

```bash
.venv\Scripts\pip.exe install -r requirements.txt
.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

`http://127.0.0.1:8000` 접속. API 문서는 `/docs`.

## 문서 지도

| 필요한 것 | 문서 |
|---|---|
| 사용법(설치~REST API) | [`docs/USAGE.md`](docs/USAGE.md) |
| 뷰어 세부 기능 설명 | [`docs/VIEWER_FEATURES.md`](docs/VIEWER_FEATURES.md) |
| 변경 이력 | [`docs/CHANGELOG.md`](docs/CHANGELOG.md) |
| **아키텍처/구현 세부사항**(코드를 고치기 전에 볼 것) | [`docs/아키텍처.md`](docs/아키텍처.md) |
| UI 디자인 시스템 원본 | [`docs/design.md`](docs/design.md) |
| 알려진 문제·개선 아이디어 | [`docs/개선사항.md`](docs/개선사항.md) |

## 한눈에 보는 구조

```
app/        FastAPI 백엔드 — main.py(라우트), jobs.py(다운로드 작업 큐),
            crawler.py(크롤링/다운로드), online.py(온라인 보기), library.py(뷰어 조회)
static/     프런트엔드 — index.html, style.css, app.js (바닐라 JS, 프레임워크 없음)
docs/       사용자 문서 · 아키텍처 · 디자인 시스템 원본
downloads/  실행 시 생성되는 다운로드 결과물 (gitignore 대상)
```

세부 책임 분담, 상태 관리 방식, 알아두면 좋은 구현상의 함정(gotcha)은
[`docs/아키텍처.md`](docs/아키텍처.md)에 정리했다.

## Claude와 협업할 때

- 새 기능 추가나 구조 변경 요청을 받으면, 코드를 바로 고치지 말고 먼저 무엇을
  어떻게 바꿀지 `docs/claude_plan/` 아래에 파일로 정리해 알려주고, 승인을
  받은 뒤에 수정한다. 오타 수정 같은 사소한 보완은 바로 진행해도 된다.
  - 요청 하나당 `docs/claude_plan/`에 짧은 설명적인 이름의 `.md` 파일
    하나(예: `online-viewer-date.md`)를 만들거나 갱신해 무엇을 왜 바꿀지
    적고, 채팅에는 어떤 파일을 보면 되는지만 알려준다.
  - 승인받아 적용을 마친 계획 파일은 지우지 않고 그대로 둔다(작업 이력).
- git commit은 사용자가 별도로 지시했을 때만 한다. 테스트가 끝났다고 자동으로
  커밋하지 않는다.

## 참고

- [[project_datapipline_kafka_airflow]] 메모는 다른 프로젝트(`dataPipline`)의
  CLAUDE.md 관례(초보자 학습 커리큘럼)를 다룬다. 이 프로젝트의 CLAUDE.md는 그와 무관하게
  일반적인 코드베이스 안내 문서다.
