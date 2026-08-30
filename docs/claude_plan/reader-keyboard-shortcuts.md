# 리더 키보드 단축키: WASD 추가 + 회차/전체화면/목록 단축키

## 왜

`docs/plan.md` 4번: 리더에서 화살표로 상하좌우 이동하는데 WASD(a=왼쪽,
s=아래, d=오른쪽, w=위쪽)로도 되게 하고, 다음 화/이전 화/전체화면/회차 목록도
단축키로 쓰고 싶다는 요청. 좋은 키 배정 추천도 요청.

## 현재 상태

`static/app.js`에 리더용 `keydown` 리스너가 두 개 있다(뷰어 탭 1148번 줄,
온라인 보기 탭 1900번 줄 — 구조가 거의 동일):

- 페이지 넘김(paged) 모드: `ArrowRight`/`Space` = 다음 쪽, `ArrowLeft` = 이전
  쪽, `Home`/`End` = 처음/끝.
- 웹툰(scroll) 모드: `Space`/`PageDown`/`ArrowDown` = 아래로 스크롤,
  `PageUp`/`ArrowUp` = 위로 스크롤, `Home`/`End` = 맨 위/아래.
- 다음 화/이전 화/전체화면/목록으로는 버튼만 있고 단축키가 없다
  (`gotoRelativeEpisode`/`gotoOnlineRelativeEpisode`, `toggleImmersive`,
  `openTitle`/회차 목록 복귀).

## 배정할 키

| 키 | 동작 | 비고 |
|---|---|---|
| `A` / `D` | 이전 쪽 / 다음 쪽 (페이지 모드) | 기존 `ArrowLeft`/`ArrowRight`와 동일하게 동작 |
| `W` / `S` | 위로 / 아래로 스크롤 (웹툰 모드) | 기존 `ArrowUp`/`ArrowDown`(+PageUp/PageDown)과 동일 |
| `F` | 전체화면 토글 | 유튜브 등에서 널리 쓰는 관용 키 |
| `N` | 다음 화 | Next |
| `P` | 이전 화 | Previous |
| `L` | 회차 목록으로 | List |

- 대문자 입력(Shift/Caps Lock)도 동일하게 인식되도록 대소문자 구분 없이 처리.
- `Ctrl`/`Alt`/`Cmd`를 누른 조합(예: `Ctrl+S` 저장)은 브라우저 기본 동작을
  건드리지 않도록 무시하는 가드를 추가.
- 기존 화살표/Space/Home/End 단축키는 그대로 유지 — WASD는 대체가 아니라
  추가.
- `Esc`는 건드리지 않는다. 전체화면 중엔 브라우저가 이미 `Esc`로 전체화면을
  빠져나가고, 이 앱의 `fullscreenchange` 리스너가 뒤따라 `immersive` 상태를
  정리하고 있어서 별도 바인딩이 필요 없다.

## 바꿀 파일

- `static/app.js` — 뷰어 탭 `keydown` 리스너(1148번 줄 부근)와 온라인 보기 탭
  `keydown` 리스너(1900번 줄 부근) 두 곳 모두 위 표대로 수정.

## 승인 후 적용 순서

1. 위 두 리스너 수정.
2. 브라우저로 다운로드 뷰어·온라인 뷰어 양쪽에서 웹툰 모드(WSAD 스크롤,
   N/P/F/L)와 페이지 모드(A/D 페이지 넘김)를 각각 실제로 눌러서 확인.
3. 문제없으면 이 파일 그대로 두고, 사용자가 git commit을 지시하면 커밋.
