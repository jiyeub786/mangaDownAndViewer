ㅇ---
version: alpha
name: Binance-design-analysis
description: 깊은 검정에 가까운 캔버스를 기반으로 하는 자신감 있는 금융 플랫폼 인터페이스로, Binance 고유의 노란색(#FCD535)이 모든 주요 CTA, 브랜드 액센트, 가치 강조 순간을 담당합니다. 타이포그래피는 Binance의 커스텀 BinanceNova / BinancePlex 서체를 다소 낮은 굵기로 사용합니다 — 이 시스템은 굵은 두께보다 크기와 노란색의 강도를 신뢰합니다. 마케팅/제품 표면은 기본적으로 다크 테마이며, 거래성 표면(암호화폐 구매, 입금, 거래소)은 동일한 노란색 CTA와 회청색 헤어라인을 공유하는 라이트 테마로 전환됩니다. 트레이딩 초록색(상승)과 빨간색(하락) 액센트가 두 모드 모두에서 가격 방향 신호로 이어집니다.

colors:
  primary: "#fcd535"
  primary-active: "#f0b90b"
  primary-disabled: "#3a3a1f"
  ink: "#181a20"
  body: "#eaecef"
  body-on-light: "#181a20"
  muted: "#707a8a"
  muted-strong: "#929aa5"
  hairline-on-light: "#eaecef"
  hairline-on-dark: "#2b3139"
  border-strong: "#cdd1d6"
  canvas-light: "#ffffff"
  canvas-dark: "#0b0e11"
  surface-card-dark: "#1e2329"
  surface-elevated-dark: "#2b3139"
  surface-soft-light: "#fafafa"
  surface-strong-light: "#f5f5f5"
  on-primary: "#181a20"
  on-dark: "#ffffff"
  trading-up: "#0ecb81"
  trading-down: "#f6465d"
  accent-turquoise: "#2dbdb6"
  info: "#3b82f6"
  info-ring: "#3b82f6"

typography:
  hero-display:
    fontFamily: "BinanceNova, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: 64px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -1px
  display-lg:
    fontFamily: "BinanceNova, sans-serif"
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -0.5px
  display-md:
    fontFamily: "BinanceNova, sans-serif"
    fontSize: 40px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.3px
  display-sm:
    fontFamily: "BinanceNova, sans-serif"
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0
  title-lg:
    fontFamily: "BinanceNova, sans-serif"
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0
  title-md:
    fontFamily: "BinanceNova, sans-serif"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: 0
  title-sm:
    fontFamily: "BinanceNova, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0
  number-display:
    fontFamily: "BinancePlex, BinanceNova, sans-serif"
    fontSize: 40px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -0.3px
  number-md:
    fontFamily: "BinancePlex, BinanceNova, sans-serif"
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  number-sm:
    fontFamily: "BinancePlex, BinanceNova, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  body-md:
    fontFamily: "BinanceNova, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  body-sm:
    fontFamily: "BinanceNova, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  caption:
    fontFamily: "BinanceNova, sans-serif"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  button:
    fontFamily: "BinanceNova, sans-serif"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1
    letterSpacing: 0
  nav-link:
    fontFamily: "BinanceNova, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0

rounded:
  xs: 2px
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
  pill: 9999px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 80px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 12px 24px
    height: 40px
  button-primary-active:
    backgroundColor: "{colors.primary-active}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  button-primary-disabled:
    backgroundColor: "{colors.primary-disabled}"
    textColor: "{colors.muted}"
    rounded: "{rounded.md}"
  button-primary-pill:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: 14px 32px
  button-secondary-on-dark:
    backgroundColor: "{colors.surface-card-dark}"
    textColor: "{colors.on-dark}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 12px 24px
  button-secondary-on-light:
    backgroundColor: "{colors.canvas-light}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 12px 24px
  button-tertiary-text:
    backgroundColor: transparent
    textColor: "{colors.body}"
    typography: "{typography.button}"
  button-trading-up:
    backgroundColor: "{colors.trading-up}"
    textColor: "{colors.on-dark}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: 8px 20px
  button-trading-down:
    backgroundColor: "{colors.trading-down}"
    textColor: "{colors.on-dark}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: 8px 20px
  button-subscribe:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: 6px 16px
    height: 28px
  text-link:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    typography: "{typography.body-md}"
  top-nav-dark:
    backgroundColor: "{colors.canvas-dark}"
    textColor: "{colors.on-dark}"
    typography: "{typography.nav-link}"
    height: 64px
  top-nav-light:
    backgroundColor: "{colors.canvas-light}"
    textColor: "{colors.ink}"
    typography: "{typography.nav-link}"
    height: 64px
  hero-band-dark:
    backgroundColor: "{colors.canvas-dark}"
    textColor: "{colors.on-dark}"
    typography: "{typography.hero-display}"
    padding: 80px
  stat-callout-card:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    typography: "{typography.number-display}"
  trust-badge:
    backgroundColor: "{colors.surface-card-dark}"
    textColor: "{colors.on-dark}"
    typography: "{typography.title-sm}"
    rounded: "{rounded.lg}"
    padding: 16px 20px
  markets-table-card:
    backgroundColor: "{colors.surface-card-dark}"
    textColor: "{colors.on-dark}"
    typography: "{typography.body-md}"
    rounded: "{rounded.xl}"
    padding: 24px
  markets-row:
    backgroundColor: transparent
    textColor: "{colors.on-dark}"
    typography: "{typography.number-md}"
    padding: 12px 0
  price-up-cell:
    backgroundColor: transparent
    textColor: "{colors.trading-up}"
    typography: "{typography.number-md}"
  price-down-cell:
    backgroundColor: transparent
    textColor: "{colors.trading-down}"
    typography: "{typography.number-md}"
  search-input-on-dark:
    backgroundColor: "{colors.surface-card-dark}"
    textColor: "{colors.on-dark}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: 10px 16px
    height: 40px
  text-input-on-light:
    backgroundColor: "{colors.canvas-light}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 10px 16px
    height: 40px
  funds-safu-band:
    backgroundColor: "{colors.canvas-dark}"
    textColor: "{colors.primary}"
    typography: "{typography.display-lg}"
    padding: 80px
  feature-photo-card:
    backgroundColor: "{colors.surface-card-dark}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.xl}"
  qr-promo-card:
    backgroundColor: "{colors.surface-card-dark}"
    textColor: "{colors.on-dark}"
    typography: "{typography.title-md}"
    rounded: "{rounded.xl}"
    padding: 32px
  faq-row:
    backgroundColor: transparent
    textColor: "{colors.on-dark}"
    typography: "{typography.title-sm}"
    rounded: "{rounded.md}"
    padding: 20px 0
  cta-band-dark:
    backgroundColor: "{colors.surface-card-dark}"
    textColor: "{colors.on-dark}"
    typography: "{typography.display-sm}"
    rounded: "{rounded.xl}"
    padding: 48px
  arena-hero-gradient:
    backgroundColor: "{colors.canvas-dark}"
    textColor: "{colors.primary}"
    typography: "{typography.display-lg}"
    padding: 80px
  cookie-consent-card:
    backgroundColor: "{colors.canvas-light}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: 16px
  buy-crypto-amount-card:
    backgroundColor: "{colors.canvas-light}"
    textColor: "{colors.ink}"
    typography: "{typography.number-display}"
    rounded: "{rounded.lg}"
    padding: 24px
  steps-card:
    backgroundColor: "{colors.canvas-light}"
    textColor: "{colors.ink}"
    typography: "{typography.title-sm}"
    rounded: "{rounded.lg}"
    padding: 24px
  price-chart-card:
    backgroundColor: "{colors.canvas-light}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: 24px
  conversion-cell:
    backgroundColor: transparent
    textColor: "{colors.body-on-light}"
    typography: "{typography.body-md}"
  trader-row:
    backgroundColor: transparent
    textColor: "{colors.on-dark}"
    typography: "{typography.body-md}"
    padding: 12px 0
  footer-light:
    backgroundColor: "{colors.surface-soft-light}"
    textColor: "{colors.body-on-light}"
    typography: "{typography.body-md}"
    padding: 64px
---

## 개요

Binance는 권위와 에너지를 동시에 전달하려는 금융 트레이딩 플랫폼처럼 읽힙니다. 기본 분위기는
**검정에 가까운 깊은 캔버스**(`{colors.canvas-dark}` — #0b0e11)이며, 그 위에 흰색 타이포그래피와
단 하나의 편재하는 액센트 컬러가 얹힙니다: **Binance Yellow**(`{colors.primary}` — #FCD535). 이
노란색이 브랜드가 해야 할 무거운 일 대부분을 담당합니다 — 모든 주요 CTA, 모든 가치 주장 헤드라인
("FUNDS ARE SAFU"), 모든 "Sign Up" 필(pill), 특징적인 등급 표시자, 그리고 워드마크 자체까지. 별도의
2차 브랜드 컬러는 없습니다. 이 시스템은 노란색의 강도가 브랜드 역할을 해낼 것이라 신뢰하며, 실제로도
그렇게 해냅니다.

타이포그래피는 Binance의 커스텀 서체인 **BinanceNova**(디스플레이 + 본문)와
**BinancePlex**(숫자/금융 데이터 표시)를 사용합니다. BinanceNova는 디스플레이 헤드라인, 섹션
타이틀, 본문 카피를 담당합니다. BinancePlex는 가격 티커, 큰 통계 숫자(거래량, 사용자 수, 상금
풀) 등 숫자가 "표 형식으로 신뢰감 있게" 보여야 하는 모든 곳에 등장합니다. 두 서체 모두 다소 낮은
굵기로 사용됩니다 — 디스플레이 크기는 굵기 600~700을 사용(숫자가 한눈에 읽혀야 하는 트레이딩
플랫폼 특성상 일반적인 마케팅 시스템보다 굵음), 본문은 400을 유지합니다.

이 제품은 **멀티 테마**입니다: 마케팅 표면(홈페이지, 스마트 머니, 선물 아레나)은 기본적으로
다크이고, 거래성 표면(암호화폐 구매, 입금, 출금)은 라이트 테마로 전환됩니다. 동일한 노란색 CTA와
회청색 헤어라인(`{colors.hairline-on-light}` — #eaecef)이 두 모드 모두를 관통합니다 — 캔버스,
표면, 텍스트 톤만 바뀝니다. 트레이딩 **초록색**(`{colors.trading-up}` — #0ecb81)과
**빨간색**(`{colors.trading-down}` — #f6465d)은 두 모드 전반의 테이블, 차트, 가격 티커에서 가격
방향을 신호합니다.

**주요 특징:**
- 단일 액센트 컬러: `{colors.primary}`(#FCD535)가 브랜드의 모든 강조를 담당 — 주요 CTA, 히어로
  헤드라인, 브랜드 마크, 배지. 다크에서는 강조를 위해 절제해서, 거래성 다이얼로그에서는 편재적으로
  사용됩니다.
- 커스텀 서체 조합: `BinanceNova`(디스플레이 + 본문)와 `BinancePlex`(숫자, 가격, 금융 데이터). 큰
  통계 숫자는 표 형식 일관성을 위해 항상 BinancePlex로 렌더링됩니다.
- 멀티 테마: 마케팅 페이지는 기본 다크(`{colors.canvas-dark}`); 거래성 페이지는 라이트로 전환
  (`{colors.canvas-light}`). 노란색 CTA와 트레이딩 초록/빨강은 두 모드에서 공유됩니다.
- 다크 배경 위의 라이트 푸터: 홈페이지는 상단 본문이 다크임에도 푸터에는
  `{colors.surface-soft-light}`(#fafafa)를 사용합니다 — 페이지를 시각적으로 마무리하려는 의도적인
  반전입니다.
- 트레이딩 의미 체계: 가격 변화에는 초록 상승 / 빨강 하락(`{colors.trading-up}` /
  `{colors.trading-down}`)을 배지 배경이 아니라 텍스트 컬러로 적용합니다.
- 카드 표면: 다크에서 떠 있는 카드는 `{colors.surface-card-dark}`(#1e2329), 라이트에서는
  `{colors.canvas-light}`. 그라디언트 표면이나 대기감 있는 배경은 없음 — 전체적으로 평평한 색상
  블록.
- 테두리 반경은 작음~중간: 주요 버튼은 `{rounded.md}`(6px), 입력창과 콘텐츠 카드는
  `{rounded.lg}`(8px), 떠 있는 카드 컨테이너는 `{rounded.xl}`(12px), 눈에 띄는 기능 CTA는
  `{rounded.pill}`.
- 간격은 4의 배수 스케일을 따름; 주요 에디토리얼 밴드는 `{spacing.section}`(80px)에 위치 — 제품
  페이지가 더 밀도 높은 레이아웃을 필요로 하기 때문에 일반적인 마케팅 전용 사이트보다 다소
  타이트함.

## Colors (색상)

### 브랜드 & 액센트
- **Binance Yellow**(`{colors.primary}` — #FCD535): 유일한 브랜드 컬러. 주요 CTA 배경, 워드마크,
  브랜드 주장 헤드라인("FUNDS ARE SAFU"), 신뢰 배지("No.1 Trading Volume"),
  `{component.stat-callout-card}`의 큰 통계 숫자, 인라인 링크에 사용됩니다.
- **Binance Yellow Active**(`{colors.primary-active}` — #f0b90b): 누름/호버 시 더 진한 변형. 약간
  더 채도 높은 노란색.
- **Binance Yellow Disabled**(`{colors.primary-disabled}` — #3a3a1f): 다크 캔버스 위 비활성 CTA에
  사용되는 채도 낮춘 어두운 노란색.
- **Accent Turquoise**(`{colors.accent-turquoise}` — #2dbdb6): Smart Money의 "Check Now" CTA에서
  다크 표면 위에 매우 절제되어 사용되는 작은 2차 액센트. 시스템 전체 컬러가 아니라 단일 제품
  실험으로 취급할 것.

### Surface (표면)

이 시스템은 제품 맥락에 대응하는 두 가지 캔버스 모드를 가집니다.

**다크 모드 (마케팅 기본값):**
- **Canvas Dark**(`{colors.canvas-dark}` — #0b0e11): 기본 페이지 바닥면. 살짝 따뜻한 톤이 섞인
  검정에 가까운 색 — 순수한 검정은 절대 아님.
- **Surface Card Dark**(`{colors.surface-card-dark}` — #1e2329): 카드, 내비게이션 드롭다운, 다크
  캔버스 위 2차 버튼, 마켓 테이블.
- **Surface Elevated Dark**(`{colors.surface-elevated-dark}` — #2b3139): 한 단계 더 밝은 톤으로,
  중첩 카드, 호버된 내비게이션 항목, 차트 배경 패널에 사용.

**라이트 모드 (거래성):**
- **Canvas Light**(`{colors.canvas-light}` — #ffffff): 거래성 페이지(암호화폐 구매, 입금 폼, 계정
  다이얼로그)의 페이지 바닥면.
- **Surface Soft Light**(`{colors.surface-soft-light}` — #fafafa): 푸터 표면 및 비활성 상태.
- **Surface Strong Light**(`{colors.surface-strong-light}` — #f5f5f5): 절제된 맥락에서의 폼 입력
  배경.

### 헤어라인 & 테두리
- **Hairline on Light**(`{colors.hairline-on-light}` — #eaecef): 라이트 표면의 1px 테두리 톤.
  Dembrandt의 빈도 분석에서 가장 많이 등장하는 토큰(1,022회)으로 확인됨 — Binance는 헤어라인을
  아낌없이 사용합니다.
- **Hairline on Dark**(`{colors.hairline-on-dark}` — #2b3139): 다크 표면의 1px 테두리 톤.
  `{colors.surface-elevated-dark}`와 동일한 헥스값 — 테두리가 잉크 선이 아니라 표면의 단차처럼
  느껴집니다.
- **Border Strong**(`{colors.border-strong}` — #cdd1d6): 비활성 2차 버튼에 사용되는 더 강한 테두리
  톤.

### 텍스트
- **Ink**(`{colors.ink}` — #181a20): 라이트 표면 위 가장 강한 텍스트. 거래성 페이지의 디스플레이
  헤드라인.
- **Body on Dark**(`{colors.body}` — #eaecef): 다크 캔버스 위 기본 본문 텍스트 — 의도적으로 순백이
  아니라 약간 더 차가운 톤.
- **Body on Light**(`{colors.body-on-light}` — #181a20): ink와 동일 — 라이트 모드 본문 텍스트는
  ink 토큰을 재사용.
- **Muted**(`{colors.muted}` — #707a8a): 푸터 링크, 브레드크럼, 캡션, 테이블 컬럼 헤더. 라이트와
  다크 캔버스 모두에서 동작.
- **Muted Strong**(`{colors.muted-strong}` — #929aa5): 강조된 라벨을 위한 2단계 muted 톤.
- **On Primary**(`{colors.on-primary}` — #181a20): 노란색 주요 CTA 위의 검정 텍스트.
- **On Dark**(`{colors.on-dark}` — #ffffff): 다크 캔버스 위 고대비 헤드라인을 위한 순백.

### 트레이딩 의미 체계
- **Trading Up**(`{colors.trading-up}` — #0ecb81): 가격 상승 초록색. 테이블, 차트, 인라인 티커
  화살표에서 텍스트 컬러로 사용. 버튼 배경으로는 절대 사용하지 않음.
- **Trading Down**(`{colors.trading-down}` — #f6465d): 가격 하락 빨간색. trading-up과 동일한 사용
  규칙.

### Info / Focus
- **Info**(`{colors.info}` — #3b82f6): 인라인 정보 배지 및 포커스 링의 기본 컬러. dembrandt가 찾아낸
  Tailwind `--tw-ring-color` 토큰 — 입력창 포커스에 사용.

## Typography (타이포그래피)

### 서체 패밀리
이 시스템은 디스플레이와 본문에 **BinanceNova**를, 숫자/금융 데이터에는 **BinancePlex**를
사용합니다. 두 서체 모두 Binance의 라이선스 커스텀 서체입니다. 폴백 스택은
`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`를 따릅니다.

이 구분은 장식이 아니라 기능적입니다:
- BinanceNova → 에디토리얼 타입(헤드라인, 문단, 버튼 라벨, 내비게이션)
- BinancePlex → 표 형식 숫자 타입(가격, 거래량, 퍼센트, 통계 카운터, 상금 풀)

두 서체를 섞어 쓰는 것은 선택 사항이 아닙니다 — 가격 티커에 BinanceNova를 쓰면 트레이딩 플랫폼
특유의 성격을 잃고, 문단에 BinancePlex를 쓰면 모노스페이스처럼 차갑게 느껴집니다.

### 위계

| 토큰 | 크기 | 굵기 | 줄 높이 | 자간 | 용도 |
|---|---|---|---|---|---|
| `{typography.hero-display}` | 64px | 700 | 1.1 | -1px | 홈페이지 h1 ("316,258,026 USERS TRUST US") |
| `{typography.display-lg}` | 48px | 700 | 1.1 | -0.5px | 브랜드 주장 헤드라인("FUNDS ARE SAFU"), 상금 풀 히어로("Futures Masters Arena") |
| `{typography.display-md}` | 40px | 600 | 1.15 | -0.3px | 긴 스크롤 페이지의 섹션 제목 |
| `{typography.display-sm}` | 32px | 600 | 1.2 | 0 | CTA 밴드 헤드라인("Secure, Low-Fee Trading on Binance") |
| `{typography.title-lg}` | 24px | 600 | 1.3 | 0 | 하위 섹션 타이틀 |
| `{typography.title-md}` | 20px | 600 | 1.35 | 0 | QR 프로모 카드, 기능 카드 타이틀 |
| `{typography.title-sm}` | 16px | 600 | 1.4 | 0 | 신뢰 배지, FAQ 행, 스텝 라벨 |
| `{typography.number-display}` | 40px | 700 | 1.1 | -0.3px | 큰 통계 숫자(15,000 BTC, $429,423,449) — BinancePlex |
| `{typography.number-md}` | 16px | 500 | 1.4 | 0 | 마켓 테이블 가격, 테이블 셀 — BinancePlex |
| `{typography.number-sm}` | 14px | 500 | 1.4 | 0 | 인라인 가격, % 변동 — BinancePlex |
| `{typography.body-md}` | 14px | 400 | 1.5 | 0 | 기본 본문 텍스트 — BinanceNova |
| `{typography.body-sm}` | 13px | 400 | 1.5 | 0 | 쿠키 동의 텍스트, 푸터 본문 |
| `{typography.caption}` | 12px | 500 | 1.4 | 0 | 작은 메타 라벨 |
| `{typography.button}` | 14px | 600 | 1 | 0 | 표준 CTA 버튼 라벨 |
| `{typography.nav-link}` | 14px | 500 | 1.4 | 0 | 상단 내비게이션 메뉴 항목 |

### 원칙
디스플레이 크기는 굵기 700을 사용 — 대부분의 마케팅 시스템보다 무겁습니다. 트레이딩
플랫폼이기에 타당한 선택입니다: 숫자는 한눈에 읽혀야 하고, 헤드라인은 차트 시각화와 밀도 높은
데이터 테이블과 경쟁해야 합니다. 이 시스템은 Airtable이나 Stripe처럼 디스플레이 굵기를 400으로
낮추지 않습니다.

`{typography.number-display}`와 더 작은 숫자 변형들은 본문 타입이 BinanceNova를 쓰는 맥락에서도
항상 **BinancePlex**를 사용합니다. 가격, 거래량, 통계 카운터는 맥락과 무관하게 BinancePlex로
렌더링됩니다 — 이는 시스템의 "신뢰할 수 있는 숫자" 보이스입니다.

### 서체 대체재 참고
BinanceNova와 BinancePlex를 사용할 수 없는 경우, **Inter**가 BinanceNova에 가장 가까운
오픈소스 대체재이며, **JetBrains Mono** 또는 **IBM Plex Sans**가 BinancePlex의 대체재입니다
(표 형식 모노스페이스 정확도가 더 중요한지, 휴머니스트 비례가 더 중요한지에 따라 선택). 디스플레이
헤드라인은 BinanceNova의 더 타이트한 캡 하이트에 맞추기 위해 줄 높이를 약 3% 낮춰 조정하세요.

## Layout (레이아웃)

### 간격 시스템
- **기본 단위:** 4px.
- **토큰:** `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.md}` 16px ·
  `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.xxl}` 48px · `{spacing.section}` 80px.
- **섹션 패딩(수직):** `{spacing.section}`(80px) — 마케팅 밴드와 밀도 높은 제품 표면(마켓 테이블,
  FAQ 아코디언)을 섞어 쓰기 때문에 여유로운 마케팅 전용 사이트(96px)보다 다소 타이트함.
- **카드 내부 패딩:** 콘텐츠 카드와 마켓 테이블은 `{spacing.lg}`(24px); QR 프로모 카드와 CTA
  밴드는 `{spacing.xl}`(32px); 신뢰 배지와 테이블 행은 `{spacing.md}`(16px).
- **거터:** 3열 그리드의 카드 사이는 `{spacing.lg}`(24px); 푸터 컬럼 거터와 밀도 높은 FAQ
  목록 내부는 `{spacing.md}`(16px).

### 그리드 & 컨테이너
- **최대 콘텐츠 너비:** 마케팅 페이지는 약 1280px 중앙 정렬; 수평 밀도가 중요한 제품 표면(마켓,
  스마트 머니 테이블)은 약 1440px.
- **에디토리얼 본문:** 단일 12컬럼 그리드; 제품 페이지는 종종 8/4 분할(메인 패널 + 사이드 레일)
  사용.
- **마켓 테이블:** 5컬럼 헤더(Pair / Last Price / 24h Change / 24h Volume / Action), 첫 번째
  컬럼은 코인 아이콘 + 심볼 페어를 포함.
- **푸터:** 데스크톱에서 6컬럼 링크 목록, 태블릿에서 2단, 모바일에서 1단으로 줄바꿈.

### 여백 철학
Binance는 일반적인 마케팅 사이트보다 밀도가 높습니다 — 긴 스크롤 페이지는 히어로 밴드, 마켓
테이블, FAQ 아코디언, 기능 그리드를 여백을 많이 두지 않고 섞습니다. 이 시스템은 시각적 구분 작업을
여백이 아니라 대비(다크 캔버스 대비 노란색, 빨강 대비 초록 가격 셀)에 맡깁니다. 여백이 등장하는
곳에서는 언제나 균일하게 — 모든 주요 밴드 사이에 `{spacing.section}`을 적용합니다.

## Elevation & Depth (입체감)

| 레벨 | 처리 | 용도 |
|---|---|---|
| 평면(Flat) | 그림자 없음, 테두리 없음 | 본문 섹션, 상단 내비게이션, 히어로 밴드, 푸터 |
| 옅은 헤어라인 | `{colors.hairline-on-dark}` 또는 `{colors.hairline-on-light}` 1px | 입력창, 테이블 구분선, FAQ 행 구분선, 2차 버튼 |
| 카드 표면 | 다크 캔버스 위에는 `{colors.surface-card-dark}` 배경, 라이트 맥락에서는 `{colors.canvas-light}` — 그림자 없음 | 모든 떠 있는 카드(markets-table-card, QR-promo-card, feature-photo-card, trust-badges) |
| 옅은 드롭 섀도우 | 카드가 이미지 위에 있을 때만 보이는 희미한 그림자 | 거래성 페이지의 buy-crypto-amount-card에 절제되어 사용 |
| 포커스 링 | `0 0 0 2px {colors.info-ring}` 50% 알파 | 입력창 + 버튼 키보드 포커스 상태 |

입체감 철학은 **색 블록으로 구분되는 평면 표면**입니다. Binance는 무거운 드롭 섀도우나
글래스모피즘을 쓰지 않습니다 — 입체감은 `{colors.canvas-dark}`와 `{colors.surface-card-dark}`
사이의 대비(명도 12단계 차이로 명확한 단차처럼 읽힘)에서 나옵니다.

### 장식적 입체감
- **노랑 → 다크 수직 그라디언트 배경**은 Futures Arena 히어로에 사용: `{colors.primary}`가
  `{colors.canvas-dark}`로 페이드됩니다. 이는 시스템 전체의 시그니처가 아니라 제품 출시/이벤트
  히어로 표면에 쓰이는 단일 페이지 처리입니다.
- 큰 통계 블록 옆의 **코인 스택 일러스트레이션**(3D 렌더링된 암호화폐 코인, 트로피 아이콘). 이는
  토큰이 아니라 일러스트레이션이며, 디자인 시스템 표면이 아니라 콘텐츠로 취급해야 합니다.

## Shapes (형태)

### 테두리 반경 스케일

| 토큰 | 값 | 용도 |
|---|---|---|
| `{rounded.xs}` | 2px | 거의 사용 안 함 — 아주 작은 배지 전용 |
| `{rounded.sm}` | 4px | 작은 인라인 버튼(subscribe, 인라인 trading-up / trading-down) |
| `{rounded.md}` | 6px | 표준 CTA 버튼, 주요 버튼, 주요 입력 필드 |
| `{rounded.lg}` | 8px | 검색 입력창, 콘텐츠 카드, 신뢰 배지, 하위 카드 |
| `{rounded.xl}` | 12px | 떠 있는 카드 컨테이너(markets-table-card, QR-promo-card, CTA 밴드) |
| `{rounded.pill}` | 9999px | 눈에 띄는 기능 CTA(다크의 "Sign Up" 필, futures-arena "Join Now") |
| `{rounded.full}` | 9999px / 50% | 코인 아이콘, 아바타 |

Binance의 반경 위계는 일반적인 마케팅 시스템보다 타이트합니다 — 대부분의 표면이 6~12px입니다.
필(pill) 반경은 "이것이 페이지 상단의 액션이다"를 알리기 위한 의도적인 예외입니다.

### 사진 & 아이콘
- 코인 아이콘은 24×24 또는 32×32의 둥근 글리프로 렌더링됩니다(원형 아웃라인 위 50% 반경 +
  코인 브랜드 컬러가 안에 들어가는 경우가 많음).
- 3D 렌더링된 코인 스택과 트로피 일러스트레이션은 옅은 바닥 그림자를 가진 풀컬러
  일러스트레이션입니다 — 플랫 아이콘이 아닙니다.
- 사진 콘텐츠(앱 사용 장면 섹션)는 `{rounded.xl}`(12px) 모서리로 크롭되며, 모바일에서는
  풀블리드입니다.

## Components (컴포넌트)

### 상단 내비게이션

**`top-nav-dark`** — 다크 캔버스 위의 마케팅 상단 내비게이션. 높이 64px,
`{colors.canvas-dark}` 배경. 왼쪽에 노란색 Binance 워드마크, 주요 가로 메뉴(Buy Crypto,
Markets, Trade, Futures, Earn, Square, Smart Money, Campaigns), 오른쪽에 언어 선택기,
라이트/다크 토글, "Log In" 텍스트 링크, "Sign Up" `{component.button-primary}`가 배치됩니다.
워드마크는 "BINANCE" 타입에 `{colors.primary}`를 사용합니다.

**`top-nav-light`** — 라이트 캔버스(암호화폐 구매, 입금 페이지) 위의 거래성 상단
내비게이션. 레이아웃은 동일하지만 `{colors.canvas-light}` 배경과 `{colors.ink}` 메뉴
항목을 사용합니다.

### 버튼

**`button-primary`** — 시그니처 주요 CTA. 배경 `{colors.primary}`, 텍스트
`{colors.on-primary}`(노란색 위 검정 — 시스템의 상징적 조합), 타입 `{typography.button}`,
패딩 12px × 24px, 높이 40px, 반경 `{rounded.md}`(6px). 눌림 상태: `button-primary-active`는
`{colors.primary-active}`(#f0b90b)로 진해짐. 비활성 상태: `button-primary-disabled`는
`{colors.primary-disabled}`로 채도가 낮아짐.

**`button-primary-pill`** — 주요 CTA의 더 큰 필(pill) 변형으로, 페이지 상단 가입 유도
순간과 제품 출시 히어로(Futures Arena "Join Now")에 사용됩니다. 동일한 노랑 + 검정 조합,
패딩 14px × 32px, 반경 `{rounded.pill}`(9999px). 절제해서 사용 — 필은 "이것이 바로 그
액션이다"라는 신호입니다.

**`button-secondary-on-dark`** — `{colors.canvas-dark}` 위에서 덜 강조되는 액션에 사용.
배경 `{colors.surface-card-dark}`, 텍스트 `{colors.on-dark}`, 반경 `{rounded.md}`.

**`button-secondary-on-light`** — 라이트 캔버스 대응 버전. 배경 `{colors.canvas-light}`에
`{colors.hairline-on-light}` 1px 테두리, 텍스트 `{colors.ink}`.

**`button-tertiary-text`** — 배경 없는 인라인 텍스트 버튼. 상단 내비게이션의 "Log In"과
인라인 "Read More" 링크에 사용.

**`button-trading-up`** — 가격 상승 신호(구매/롱 액션)에 사용되는 솔리드 초록 버튼. 배경
`{colors.trading-up}`, 텍스트 `{colors.on-dark}`, 반경 `{rounded.sm}`(4px), 패딩 8px ×
20px. 밀도 높은 트레이딩 인터페이스에 등장하므로 `{component.button-primary}`보다 작고
타이트합니다.

**`button-trading-down`** — 판매/숏 액션을 위한 대칭적인 빨강 변형. 형태는 동일, 배경만
`{colors.trading-down}`.

**`button-subscribe`** — Smart Money 상위 트레이더 테이블에서 트레이더를 구독하는 데
사용되는 컴팩트한 노란색 CTA. 주요 CTA보다 높이가 낮고(28px) 패딩이 타이트함 — 밀도 높은
테이블 행 안에 들어맞음. 동일한 노랑 + 검정 조합.

**`text-link`** — `{colors.primary}`의 인라인 본문 링크(다크에서도 라이트에서도 노란색).
기본적으로 밑줄 없음. 타입은 `{typography.body-md}`를 상속.

### 카드 & 컨테이너

**`hero-band-dark`** — 홈페이지 h1 + 서브 헤드라인 + 듀얼 CTA 페어를 담는 전체 너비 다크
밴드. 배경 `{colors.canvas-dark}`, 패딩 `{spacing.section}`(80px). h1("316,258,026 USERS
TRUST US")은 시스템에서 가장 큰 타입 역할인 `{typography.hero-display}` 64px / 700을
사용합니다.

**`stat-callout-card`** — 인라인 노란색 통계 숫자(15,000 BTC, 7,488,223, $429,423,449).
투명 배경, 텍스트 `{colors.primary}`, 타입은 BinancePlex의 `{typography.number-display}`.
표면이 있는 카드가 아니라 평면 레이아웃 블록으로 사용됩니다 — 노란색 텍스트 자체가 시각적
무게를 담당합니다.

**`trust-badge`** — "No.1 Customer Service" / "No.1 Trading Volume" 주장을 담는 작은
다크 카드. 배경 `{colors.surface-card-dark}`, 반경 `{rounded.lg}`(8px), 패딩 16px ×
20px. 노란색 숫자 또는 단어 배지("No.1")가 짧은 라벨 옆에 배치됩니다.

**`markets-table-card`** — 홈페이지 우측의 마켓 테이블. 배경
`{colors.surface-card-dark}`, 반경 `{rounded.xl}`(12px), 패딩 `{spacing.lg}`(24px).
탭 행(Popular / New listing / Top gainers)을 담고, 그 아래 코인 페어, 최근 가격, 24시간
변동률, 액션 버튼으로 이루어진 5컬럼 행이 이어집니다. 각 행은 `{component.markets-row}`를
사용합니다.

**`markets-row`** — 마켓 테이블 안의 단일 행. 투명 배경, 수직 패딩 12px, 행 사이 헤어라인
구분선. 왼쪽에 코인 아이콘(32×32) + 심볼; BinancePlex의 `{typography.number-md}`로 최근
가격; 방향에 따라 색이 입혀지는 24시간 변동 셀(`{component.price-up-cell}` 또는
`{component.price-down-cell}`); "상세 보기"를 위한 오른쪽 정렬 화살표 아이콘.

**`price-up-cell`** / **`price-down-cell`** — 가격 변동을 위한 색 텍스트 셀. 투명 배경,
텍스트는 `{colors.trading-up}` 또는 `{colors.trading-down}`, 타입은 BinancePlex의
`{typography.number-md}`. 항상 방향을 나타내는 작은 삼각형 화살표와 함께 사용됩니다.

**`feature-photo-card`** — "Trade on the go" 섹션의 사진 스트립 — Binance 앱을 사용하는
사람들을 보여주는 3장의 라이프스타일 사진. 배경 `{colors.surface-card-dark}`, 반경
`{rounded.xl}`. 사진은 가장자리까지 크롭되며, 이미지 주변에 내부 패딩이 없습니다.

**`qr-promo-card`** — QR 코드가 있는 "Trade on the go. Anywhere, anytime." 카드. 배경
`{colors.surface-card-dark}`, 반경 `{rounded.xl}`, 패딩 `{spacing.xl}`(32px).
`{typography.title-md}`의 h2, 본문 문단, 앱스토어 배지(iOS / Android), 중앙 정렬된 QR
코드를 포함합니다.

**`funds-safu-band`** — 노란색 헤드라인의 "FUNDS ARE SAFU" 밴드. 배경은
`{colors.canvas-dark}`를 유지하지만, 헤드라인은 `{typography.display-lg}`에서
`{colors.primary}`를 사용합니다. 헤드라인 아래로 세 개의 큰
`{component.stat-callout-card}` 숫자가 밴드를 지지합니다: 총 BTC 준비금, 지원한 사용자
수, 복구된 자금.

**`faq-row`** — 단일 FAQ 아코디언 행. 투명 배경, 수직 패딩 20px, 행 사이 헤어라인
구분선. 닫힘 상태: `{typography.title-sm}`의 질문 + 오른쪽 화살표 아이콘. 열림 상태:
질문 + `{typography.body-md}`의 본문 답변.

**`cta-band-dark`** — "Secure, Low-Fee Trading on Binance" 푸터 전 CTA 밴드. 배경
`{colors.surface-card-dark}`(캔버스보다 한 단계 떠 있음), 반경 `{rounded.xl}`, 패딩
`{spacing.xxl}`(48px). `{typography.display-sm}`의 h2와 오른쪽 정렬된
`{component.button-primary}`를 포함합니다.

### 라이트 모드 거래성 컴포넌트

**`buy-crypto-amount-card`** — Buy BTC 페이지 우측 레일 카드. 배경
`{colors.canvas-light}`, 반경 `{rounded.lg}`(8px), 패딩 `{spacing.lg}`(24px).
BinancePlex의 `{typography.number-display}`로 표시되는 편집 가능한 금액 입력, 통화
선택기, "Continue" / "Confirm Order"를 위한 노란색 `{component.button-primary}`를
포함합니다.

**`steps-card`** — "How to Buy Crypto" 3열 카드(Enter Amount → Confirm Order →
Receive Crypto). 배경 `{colors.canvas-light}`, 반경 `{rounded.lg}`, 패딩
`{spacing.lg}`. 각 카드는 작은 번호 아이콘, `{typography.title-sm}`의 단계 이름, 본문
설명을 가집니다.

**`price-chart-card`** — BTC 가격 차트를 담는 "Bitcoin Markets" 카드. 배경
`{colors.canvas-light}`, 반경 `{rounded.lg}`. 상단 행은 페어 선택기($79,065.04,
+0.45%); 메인 영역은 `{colors.trading-up}`와 `{colors.trading-down}`으로 된
캔들스틱/라인 차트; 하단 행은 타임프레임 선택기(24H / 1W / 1M / 3M / 1Y / ALL)를
포함합니다.

**`conversion-cell`** — BTC ↔ USD 환산 테이블의 단일 행. 투명 배경, 텍스트
`{colors.body-on-light}`, 타입 `{typography.body-md}`. 왼쪽에 페어 라벨(BTC, USDT
등); 오른쪽에 USD 환산값.

### 입력 & 폼

**`search-input-on-dark`** — 홈페이지 히어로의 "Search currencies" 입력창. 배경
`{colors.surface-card-dark}`, 텍스트 `{colors.on-dark}`, 반경 `{rounded.lg}`(8px),
패딩 10px × 16px, 높이 40px. 오른쪽에 노란색 `{component.button-primary-pill}`("Sign
Up")을 포함합니다.

**`text-input-on-light`** — 거래성 페이지의 표준 입력창. 배경 `{colors.canvas-light}`,
1px `{colors.hairline-on-light}` 테두리, 반경 `{rounded.md}`(6px), 패딩 10px ×
16px, 높이 40px. 포커스 상태는 포커스 링 그림자를 상속합니다.

**`cookie-consent-card`** — 홈페이지에 표시되는 쿠키 배너 카드. 배경
`{colors.canvas-light}`, 반경 `{rounded.lg}`, 패딩 `{spacing.md}`(16px). 본문 텍스트는
`{typography.body-sm}`(13px / 400)이며 세 개의 버튼 옵션이 세로로 쌓입니다(Accept
Cookies & Continue / Reject Additional Cookies / Manage Cookies).

### Smart Money 하위 시스템

**`trader-row`** — /smart-money의 상위 트레이더 테이블 안의 단일 행. 투명 배경, 수직
패딩 12px, 행 사이 헤어라인 구분선. 왼쪽에 아바타 + 트레이더 이름 + 프라이빗/퍼블릭
배지; ROI %, AUM, 개설일 컬럼; 오른쪽에 노란색 `{component.button-subscribe}`.

### 시그니처 컴포넌트

**`arena-hero-gradient`** — Futures Arena 제품 출시 히어로. `{colors.primary}`에서
`{colors.canvas-dark}`로 이어지는 수직 그라디언트에, 중앙 정렬된
`{typography.display-lg}`의 상금 풀 헤드라인(4,000,000 USDT). 헤드라인 아래에
`{component.button-primary-pill}`("Join Now")가 배치됩니다. 제품 출시 이벤트 표면에만
사용 — 다른 히어로로 일반화하지 말 것.

### 푸터

**`footer-light`** — 모든 페이지(다크 캔버스 페이지 포함)를 마무리하는 밝은 회색
푸터. 배경 `{colors.surface-soft-light}`(#fafafa), 텍스트
`{colors.body-on-light}`. 데스크톱에서 Community / About Us / Products / Business /
Service / Learn 컬럼을 다루는 6컬럼 링크 목록. 수직 패딩 64px. 다크 페이지 위에
의도적으로 배치된 라이트 푸터는 Binance의 가장 특징적인 레이아웃 선택 중 하나입니다 —
"마케팅 리셋" 표면으로 페이지를 시각적으로 마무리합니다.

## Do's and Don'ts (해야 할 것과 하지 말아야 할 것)

### Do (해야 할 것)
- `{colors.primary}`(Binance Yellow)는 주요 액션, 브랜드 주장 헤드라인, 워드마크로만
  아껴 사용할 것. 2차적이거나 장식적인 용도로는 절대 사용하지 말 것 — 노란색의 희소성이
  힘의 원천입니다.
- `{component.button-primary}`(노랑 배경 + 검정 텍스트)를 다크/라이트 모드 모두를
  아우르는 보편적인 주요 CTA로 유지할 것. 동일한 버튼이 `{colors.canvas-dark}`와
  `{colors.canvas-light}` 위에서 동일하게 나타납니다.
- `{component.button-trading-up}`(초록)과 `{component.button-trading-down}`(빨강)은
  명시적인 매수/매도 또는 롱/숏 액션에만 사용할 것. 가격 방향의 의미를 담고 있으므로
  일반적인 "확인"이나 "취소"에는 절대 사용하지 말 것.
- 모든 숫자에 BinancePlex를 사용할 것. 가격, 거래량, 퍼센트, 통계 카운터 — 전부
  BinancePlex. 숫자 티커에 BinanceNova를 섞으면 트레이딩 플랫폼 특유의 성격이
  깨집니다.
- 표면 의도에 따라 캔버스 모드를 선택할 것: 마케팅/제품 소개/트레이딩 대시보드는 다크;
  거래성 다이얼로그(구매/입금/출금/폼 제출)는 라이트.
- 모든 에디토리얼 밴드를 `{spacing.section}`(80px)로 고정할 것. Binance는 여유로운
  마케팅 전용 사이트보다 밀도가 높습니다 — 80px가 적절한 리듬입니다.

### Don't (하지 말아야 할 것)
- 두 번째 브랜드 컬러를 도입하지 말 것. 이 시스템은 정확히 하나의 액센트
  (`{colors.primary}`)만 가지며, 이를 확장하면 브랜드 정체성이 희석됩니다. Smart
  Money의 터콰이즈는 시스템 토큰이 아니라 단일 제품 실험입니다.
- 노란색을 본문 텍스트나 큰 표면 채우기에 사용하지 말 것. 초점이 되는 CTA와
  헤드라인 전용입니다.
- `{colors.trading-up}` / `{colors.trading-down}`을 카드의 배경 채우기로 사용하지
  말 것. 이들은 가격 방향 신호이며, 텍스트 컬러나 작은 배지 채우기로만 표현되어야 하고
  카드 표면으로는 절대 사용되지 않습니다.
- 디스플레이 굵기를 낮추지 말 것. `{typography.hero-display}`와
  `{typography.display-lg}`는 의도적으로 굵기 700입니다 — 400으로 낮추면 트레이딩
  플랫폼이 아니라 디자인 포트폴리오처럼 읽힙니다.
- 캔버스에 대기감 있는 그라디언트(메시, 오로라, 글로우 효과)를 추가하지 말 것.
  Binance는 색 블록 대비를 신뢰합니다 — 대기감 있는 깊이를 더하면 트레이딩 플랫폼
  특유의 느낌이 흐려집니다.
- `{component.button-primary}`의 텍스트 컬러를 반전시키지 말 것. 노랑 위 검정은
  이 시스템의 시그니처입니다 — 노랑 위 흰색 텍스트는 대비와 브랜드 인지도를
  떨어뜨립니다.

## Responsive Behavior (반응형 동작)

### 브레이크포인트

| 이름 | 너비 | 주요 변화 |
|---|---|---|
| 모바일 | < 768px | 상단 내비게이션이 햄버거로 접힘; 히어로 h1이 64px에서 약 36px로 축소; 마켓 테이블이 수평 스크롤 가능한 카드 목록으로 전환; 데모 그리드가 1단으로 축소; 푸터 6컬럼이 2컬럼으로 줄바꿈 |
| 태블릿 | 768–1024px | 상단 내비게이션은 가로형을 유지하되 타이트해지고, 보조 메뉴 항목은 "More" 드롭다운 뒤로 숨음; 마켓 테이블 2단; 가격/기능 그리드 2단 |
| 데스크톱 | 1024–1440px | 모든 주요 메뉴 항목을 포함한 전체 상단 내비게이션; 5컬럼 마켓 테이블; 트레이딩 대시보드는 8/4 분할(차트 + 사이드 레일) |
| 와이드 | > 1440px | 데스크톱과 동일하되 외부 여백이 더 넓음; 표면에 따라 최대 콘텐츠 너비는 1280~1440px로 상한 |

### 터치 타겟
- 주요 CTA는 최소 40 × 40px(`{component.button-primary}` 높이 + 패딩)로 렌더링됩니다 —
  주변 여백을 포함하면 WCAG AAA의 44 × 44를 충족합니다.
- 구독/인라인 액션 버튼은 28 × 28px — 이상적이지는 않지만 업계 트레이딩 플랫폼 관행에
  부합합니다.
- 마켓 테이블의 코인 아이콘은 32 × 32px이며, 행 전체가 탭 가능해 44px 이상의 실질적인
  터치 타겟을 제공합니다.

### 축소 전략
- 상단 내비게이션은 768px 미만에서 햄버거로 접히고, 메뉴는 동일한 노란색 액센트
  CTA가 시트 하단에 고정된 전체 화면 시트로 열립니다.
- 마켓 테이블은 모바일에서 코인 페어당 하나의 수평 스크롤 가능한 카드로 재배치됩니다.
- 히어로 통계 숫자("316M USERS")는 줄바꿈되지 않고 비례적으로 축소됩니다 — Binance의
  가장 큰 주장은 항상 하나의 블록으로 읽혀야 합니다.
- 트레이딩 대시보드는 모바일에서 차트 + 사이드 레일 구조에서 차트 전용 + 별도의
  "Trade" 탭으로 전환됩니다.
- 라이트 푸터는 모든 브레이크포인트에서 풀블리드를 유지합니다 — 별도의 다크 변형으로
  축소되지 않습니다.

### 이미지 동작
- 코인 아이콘은 브레이크포인트와 무관하게 고정된 24/32px 크기를 유지합니다.
- "Trade on the go" 섹션의 라이프스타일 사진은 반응형으로 크롭됩니다 — 데스크톱에서는
  더 넓게, 모바일에서는 더 세로로(수직) 잘립니다.
- 3D 코인 스택 일러스트레이션은 크롭 없이 균일하게 스케일되는 고정 종횡비 에셋입니다.

## Iteration Guide (반복 작업 가이드)

1. 한 번에 하나의 컴포넌트에만 집중할 것. YAML 키를 직접 참조할 것
   (`{component.button-primary}`, `{component.markets-row}`).
2. 새 컴포넌트를 추가할 때는 먼저 다크 모드(마케팅/제품)에 속하는지 라이트 모드
   (거래성)에 속하는지 결정할 것. 동일한 컴포넌트가 표면 톤만 바뀐 채 양쪽 모두에
   등장합니다.
3. 기존 컴포넌트의 변형(`-active`, `-disabled`)은 `components:` 아래 별도 항목으로
   존재해야 함 — 중첩된 상태 객체로 만들지 말 것.
4. 프로즈에서 색상, 반경, 타이포그래피 역할, 간격 값을 언급할 때는 어디서나
   `{token.refs}`를 사용할 것.
5. 호버 상태는 절대 문서화하지 말 것. 이 시스템은 Default와 Active/Pressed 상태만
   문서화합니다.
6. 숫자는 항상 BinancePlex, 카피는 항상 BinanceNova를 사용할 것. 섞어 쓰는 것은
   시스템 위반입니다.
7. 트레이딩 초록/빨강은 가격에 대한 의미론적 토큰입니다 — 일반적인 "성공"이나
   "오류" 상태로 재활용하지 말 것.

## Known Gaps (알려진 공백)

- dembrandt 빈도 분석기는 `#eaecef`(라이트 헤어라인, 1,022회)를 가장 빈도 높은
  토큰으로 포착했습니다. 브랜드를 정의하는 `{colors.primary}`(#FCD535)는 액센트로
  절제되어 사용되기 때문에 훨씬 적게 등장합니다 — 시스템 내 역할은 스크린샷을 통해
  별도로 확인해야 했습니다.
- BinanceNova와 BinancePlex의 굵기 축 값은 가변 폰트 토큰으로 공식화되어 있지 않음
  — 스크린샷에서 관찰된 정적 굵기만 문서화되어 있습니다.
- 애니메이션과 전환 타이밍(차트 다시 그리기, 가격 변동 플래시)은 범위에 포함되지
  않습니다.
- `{component.text-input-on-light}` 기본값을 넘어서는 폼 검증 상태는 추출되지
  않았습니다 — 오류/성공 입력 변형은 가입 또는 주문 확인 플로우를 통해 확인이
  필요합니다.
- 트레이딩 대시보드 표면(Spot / Futures / Margin)은 분석된 URL 세트에 포함되지
  않았습니다; 이들의 호가창, 캔들스틱 차트 구성, 포지션 관리 카드는 여기에
  문서화되어 있지 않습니다.
- 라이트/다크 테마 토글 동작(거래성 페이지를 사용자 선호에 따라 강제로 다크로
  전환할 수 있는지 여부)은 마케팅 표면에서 추출된 것이 아니라 제품 동작 영역입니다.
