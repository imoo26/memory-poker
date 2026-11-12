# 싱글 플레이 개발 로드맵

플레이어 vs 컴퓨터 버전을 완성하기까지의 작업 계획. 규칙은 `docs/GAME_RULES.md`를 따른다.

## 전체 흐름

| 단계 | 내용                      | 위치                               | 결과물                                       |
| ---- | ------------------------- | ---------------------------------- | -------------------------------------------- |
| 0    | 모노레포 세팅 + CI        | 루트                               | ✅ 세팅 완료, CI 추가 예정                   |
| 1    | 카드 모델, 시드 RNG, 셔플 | `packages/engine/src/card.ts`      | 카드를 만들고 섞을 수 있음                   |
| 2    | 족보 판정과 비교          | `packages/engine/src/evaluator.ts` | 5장의 족보와 승패를 판정                     |
| 3    | 보드 배치와 선택 평가     | `packages/engine/src/board.ts`     | 16+3장 배치, A~P 라벨, 2칸 선택 평가         |
| 4    | 컴퓨터 AI                 | `packages/engine/src/ai.ts`        | 난이도별 선택                                |
| 5    | 게임 상태 머신            | `packages/engine/src/game.ts`      | 한 판의 진행, 판정, 재대결이 엔진만으로 완결 |
| 6    | 웹 UI                     | `apps/web`                         | 브라우저에서 플레이 가능                     |
| 7    | 다듬기와 배포             | `apps/web`, `.github`              | 공개 URL, README                             |

**순서의 원칙:** 1~5단계는 화면 없이 테스트만으로 완성한다. 엔진이 끝나면 6단계 UI는 엔진을 "연결"하는 작업만 남는다.

**작업 단위 공통 규칙**

- 단계마다 브랜치 하나 (`feat/engine-card`, `feat/engine-evaluator` …) → PR → squash merge
- Claude Code는 단계마다 새 대화로 시작
- 완료 조건: `pnpm test`, `pnpm typecheck`, `pnpm lint` 통과 + 아래 체크리스트 완료

---

## 0단계: CI 추가 (남은 작업)

PR마다 테스트, 타입 검사, 린트가 자동으로 돌게 한다. 1단계 전에 해두면 이후 모든 PR이 자동 검증된다.

- [x] `.github/workflows/ci.yml` 작성: pull_request와 main push 시 실행
  - pnpm 설치 → Node LTS 설정 (pnpm 캐시) → `pnpm install --frozen-lockfile` → `pnpm typecheck` → `pnpm lint` → `pnpm test`
- [ ] GitHub 레포 Settings → Rules에서 main 브랜치에 "CI 통과 필수" 규칙 추가 (선택)

**배울 것:** GitHub Actions 워크플로 문법, `--frozen-lockfile`의 의미 (lock 파일과 다르면 실패)

---

## 1단계: 카드 모델 (`card.ts`)

### 설계

```ts
export const SUITS = ['s', 'h', 'd', 'c'] as const;
export type Suit = (typeof SUITS)[number]; // 's' | 'h' | 'd' | 'c'
export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;
export type Rank = (typeof RANKS)[number]; // 2 | … | 14 (11=J, 12=Q, 13=K, 14=A)
export interface Card {
  readonly rank: Rank;
  readonly suit: Suit;
}
export type Rng = () => number; // [0, 1) 난수
```

### 작업

- [x] `Suit`, `Rank`, `Card` 타입과 `SUITS`, `RANKS` 상수
- [x] `cardToString(card)`: `{ rank: 14, suit: 's' }` → `'As'` (T=10, J, Q, K, A)
- [x] `parseCard('As')`, `parseCards('As Kd Th')`: 잘못된 입력이면 에러
- [x] `createDeck()`: 52장, 모두 서로 다름
- [x] `cardEquals(a, b)`, `cardId(card)`: 0~51 정수 ID (중복 검사, React key에 사용)
- [x] `createRng(seed)`: 시드 기반 난수 생성기 (mulberry32 같은 짧은 알고리즘)
- [x] `shuffle(cards, rng)`: Fisher–Yates. **원본을 바꾸지 않고 새 배열 반환**

### 테스트

- [x] 덱 52장, `cardId` 기준 중복 없음
- [x] `parseCard` ↔ `cardToString` 왕복 일치 (52장 전부)
- [x] 잘못된 입력 에러: `'1s'`, `'Ax'`, `'10s'`, 빈 문자열
- [x] 같은 시드 → 같은 셔플 결과, 다른 시드 → 다른 결과
- [x] 셔플 후 원소 집합 동일, 원본 배열 불변

### 배울 것

`as const`와 `(typeof X)[number]`로 유니온 타입 만들기, `readonly`, `interface` vs `type`, 클로저로 상태를 가진 함수(RNG) 만들기, Java의 enum 대신 유니온 타입을 쓰는 이유

---

## 2단계: 족보 판정 (`evaluator.ts`)

### 설계

```ts
export const HandCategory = {
  HighCard: 0,
  OnePair: 1,
  TwoPair: 2,
  ThreeOfAKind: 3,
  Straight: 4,
  Flush: 5,
  FullHouse: 6,
  FourOfAKind: 7,
  StraightFlush: 8,
} as const;

export interface HandValue {
  readonly category: HandCategory; // 등급
  readonly ranks: readonly Rank[]; // 동급 비교용 랭크 (중요한 순서)
}

export function evaluateHand(cards: readonly Card[]): HandValue; // 정확히 5장
export function compareHands(a: HandValue, b: HandValue): number; // 양수: a 승, 0: 무승부
```

`ranks` 예시

- 원페어 K, 키커 A-9-4 → `[13, 14, 9, 4]`
- 투페어 J와 5, 키커 2 → `[11, 5, 2]`
- 풀하우스 Q 트리플 + 7 페어 → `[12, 7]`
- 휠 스트레이트 A-2-3-4-5 → `[5]`

### 작업

- [x] `HandCategory`와 타입
- [x] `evaluateHand`: 5장이 아니거나 중복 카드가 있으면 에러
  1. 랭크별 개수 세기 → (개수 내림차순, 랭크 내림차순)으로 그룹 정렬
  2. 플러시 여부, 스트레이트 여부 (휠 포함, 랩어라운드 금지)
  3. 등급 결정과 `ranks` 구성
- [x] `compareHands`: 등급 비교 → `ranks` 사전순 비교
- [x] 7장 중 베스트 5장 선택 로직은 **만들지 않는다**

### 테스트 (`engine-tdd` 스킬의 함정 케이스 전부 포함)

- [x] 9개 등급 각각 판정
- [x] 휠 스트레이트 = 가장 약한 스트레이트, 스틸 휠 = 가장 약한 스트레이트 플러시
- [x] Q-K-A-2-3은 스트레이트 아님
- [x] 동급 비교: 페어 → 키커 순서, 투페어 높은 페어 → 낮은 페어 → 키커, 풀하우스 트리플 우선, 플러시 높은 카드부터
- [x] 문양만 다른 같은 구성 → 무승부, 같은 하이카드 스트레이트끼리 → 무승부
- [x] 입력 에러: 4장, 6장, 중복 카드
- [x] (선택, 강력 추천) **전수 검증 테스트**: 52장에서 5장을 고르는 2,598,960개 조합을 모두 평가해 등급별 개수가 수학적 정답과 일치하는지 확인. 몇 초 걸릴 수 있어서 별도 파일로 분리

| 등급                          | 개수      |
| ----------------------------- | --------- |
| 스트레이트 플러시 (로열 포함) | 40        |
| 포카드                        | 624       |
| 풀하우스                      | 3,744     |
| 플러시                        | 5,108     |
| 스트레이트                    | 10,200    |
| 트리플                        | 54,912    |
| 투페어                        | 123,552   |
| 원페어                        | 1,098,240 |
| 하이카드                      | 1,302,540 |

이 테스트가 통과하면 판정 로직의 정확성을 강하게 보장할 수 있다.

### 배울 것

`Map`, 배열 메서드(`map`, `filter`, `sort`, `every`), 정렬 비교 함수, 객체 상수로 enum 흉내 내기, `noUncheckedIndexedAccess` 환경에서 배열 다루기

---

## 3단계: 보드 배치와 선택 평가 (`board.ts`)

### 설계

```ts
export const CELL_LABELS = ['A', 'B', /* … */ 'P'] as const;
export type CellIndex = number; // 0~15 (A=0, P=15). 화면 번호는 index + 1

export interface Deal {
  readonly board: readonly Card[]; // 16장
  readonly community: readonly [Card, Card, Card];
}
export type Selection = readonly [CellIndex, CellIndex];
```

### 작업

- [ ] `CELL_LABELS`, `indexToLabel`, `labelToIndex`, `indexToNumber`
- [ ] `dealRound(rng)`: 셔플한 덱에서 앞 16장은 보드, 다음 3장은 공유 카드
- [ ] `isValidSelection(sel)`: 0~15 범위, 서로 다른 2칸
- [ ] `evaluateSelection(deal, sel)`: 선택 2장 + 공유 3장 → `HandValue`

### 테스트

- [ ] 보드 16장 + 공유 3장 = 19장 모두 서로 다름
- [ ] 같은 시드 → 같은 배치
- [ ] 라벨 변환: A↔0↔1번, P↔15↔16번
- [ ] 잘못된 선택 에러: 같은 칸 두 번, 범위 밖, 1칸만
- [ ] 알려진 배치로 `evaluateSelection` 결과 확인

### 배울 것

튜플 타입(`[Card, Card, Card]`), 타입 가드 함수

---

## 4단계: 컴퓨터 AI (`ai.ts`)

### 설계

```ts
export type Difficulty = 'easy' | 'normal' | 'hard'; // 하 / 중 / 상
export interface AiConfig {
  readonly hardRatio: number;
  readonly easyRatio: number;
}
export const DEFAULT_AI_CONFIG: AiConfig = { hardRatio: 0.3, easyRatio: 0.3 };
```

### 작업

- [ ] `enumerateSelections()`: 120개, `i < j` 오름차순
- [ ] `rankSelections(deal)`: 120개를 강도 내림차순 **안정 정렬**
- [ ] `computeBandSizes(total, config)`: 상 = `Math.round(120 × hardRatio)`, 하 = `Math.round(120 × easyRatio)`, 중 = 나머지. 각 비율이 0 초과 1 미만이 아니거나, 반올림 후 상·중·하 중 0개인 구간이 있으면 에러 (비율 합 조건은 없음)
- [ ] `chooseAiSelection(deal, difficulty, rng, config?)`: 해당 구간에서 무작위 1개

### 테스트

- [ ] 조합 정확히 120개, 첫 번째 `[0,1]`, 마지막 `[14,15]`
- [ ] 기본 설정 구간 크기 36 / 48 / 36, 어떤 설정이든 합계 120
- [ ] 비율 0.33 같은 경계 사례, 잘못된 설정 에러 (비율 0, 1, 음수)
- [ ] 상 0.5 + 하 0.499 → 중간 구간 0개라 에러
- [ ] 여러 시드로 반복해도 상은 항상 상위 구간, 하는 항상 하위 구간에서만 선택
- [ ] 같은 시드 → 같은 선택

### 배울 것

제네릭 함수, 기본값 매개변수, 정렬 안정성

---

## 5단계: 게임 상태 머신 (`game.ts`)

엔진만으로 한 게임 전체(암기 → 선택 → 결과 → 재대결)가 돌아가게 만든다. 엔진은 시계를 직접 보지 않고, 시간이 다 됐다는 사실을 **액션으로 전달받는다.**

### 설계 (리듀서 방식: React `useReducer`에 그대로 연결됨)

```ts
export type Phase = 'memorize' | 'select' | 'result';

export type GameAction =
  | { type: 'START'; difficulty: Difficulty; seed: number }
  | { type: 'MEMORIZE_TIME_UP' }
  | { type: 'TOGGLE_CELL'; index: CellIndex }
  | { type: 'SUBMIT' }
  | { type: 'SELECT_TIME_UP' }
  | { type: 'REMATCH' };

export function gameReducer(state: GameState, action: GameAction): GameState;
```

- 판마다 시드를 다르게 파생해서(예: 기본 시드 + 판 번호) 재대결해도 재현 가능하게 한다.
- 컴퓨터 선택은 선택 단계가 시작될 때 결정해 두고, 결과 단계에서 공개한다.
- `MEMORIZE_MS = 60_000`, `SELECT_MS = 30_000` 상수로 export (UI 타이머가 사용)

### 작업

- [ ] `GameState`, `GameResult` 타입 (승자: player / ai / draw, 사유: hand / timeout)
- [ ] 각 단계에서 허용되지 않는 액션은 상태를 바꾸지 않음
- [ ] 선택 단계: 칸 토글, 최대 2칸
- [ ] 판정: 시간 초과 패배 처리, 족보 비교
- [ ] 무승부 → `REMATCH`로 새 배치, 판 번호 증가

### 테스트

- [ ] 정상 흐름: START → 시간 종료 → 2칸 선택 → 제출 → 결과
- [ ] 2칸 미만에서 시간 종료 → 플레이어 패배 (0칸, 1칸 각각)
- [ ] 무승부 상황을 시드나 배치를 고정해 만들고, REMATCH 후 카드가 바뀌는지 확인
- [ ] 잘못된 단계의 액션 무시

### 배울 것

판별 유니온(discriminated union)과 `switch`의 철저성 검사(`never`), 불변 상태 업데이트(스프레드 문법) — Kotlin의 `sealed class` + `when`과 거의 같은 패턴

---

## 6단계: 웹 UI (`apps/web`)

### 6-1. 정리와 뼈대

- [ ] Vite 템플릿의 예제 코드와 이미지 제거
- [ ] 스타일 방식 결정: **CSS Modules** 추천 (Vite 기본 지원, 추가 학습 최소)
- [ ] 화면 구성: 시작 화면 → 게임 화면 → 결과 화면

### 6-2. 컴포넌트

- [ ] `Card`: 앞면(랭크 + ♠♥♦♣, 빨강/검정), 뒷면, **뒤집기 애니메이션** (CSS 3D transform)
- [ ] `Board`: 4x4 그리드, 각 칸에 A~P 라벨 표시, 선택 단계에서만 클릭 가능, 선택 강조
- [ ] `CommunityCards`: 공유 카드 3장 (뒤집은 뒤 등장)
- [ ] `Timer`: 남은 초 표시 (마지막 10초 강조 등)
- [ ] `ResultPanel`: 양쪽 선택 2장, 족보 이름(한글), 승패, 시간 초과 표시, 무승부면 재대결 버튼
- [ ] 족보 한글 이름 매핑: 원페어, 투페어, 트리플, 스트레이트 … 로열 스트레이트 플러시

### 6-3. 엔진 연결

- [ ] `useReducer(gameReducer, …)`로 게임 상태 관리
- [ ] `useCountdown` 커스텀 훅: 단계 시작 시각 기준으로 남은 시간 계산, 0이 되면 `*_TIME_UP` 액션 dispatch
- [ ] 시드는 시작 시 `Date.now()` 등으로 만들어 엔진에 주입 (엔진 밖에서만 시간과 난수 생성)

### 6-4. 확인

- [ ] 수동 테스트 체크리스트: 난이도 3종, 시간 초과(0칸/1칸), 무승부 → 재대결, 결과 화면 정보
- [ ] (선택) 개발용으로 암기·선택 시간을 짧게 바꾸는 설정 (예: URL `?fast`)
- [ ] (선택) React Testing Library로 핵심 컴포넌트 테스트

### 배울 것

JSX, 컴포넌트와 props, `useState`/`useReducer`/`useEffect`, effect 정리(cleanup)와 타이머, React StrictMode에서 개발 중 effect가 두 번 실행되는 이유

---

## 7단계: 다듬기와 배포

- [ ] 반응형 레이아웃 (모바일에서도 4x4 그리드가 보이게)
- [ ] 키보드 입력: A~P 키로 칸 선택, Enter로 제출
- [ ] 접근성: 카드와 칸에 `aria-label`
- [ ] 전적 저장: 난이도별 승/패를 `localStorage`에 기록
- [ ] (선택) 효과음, 개발용 AI 비율 조정 패널
- [ ] 배포: GitHub Pages(Actions로 자동 배포, `vite.config.ts`의 `base: '/memory-poker/'`) 또는 Vercel
- [ ] README: 게임 소개, 규칙 요약, 스크린샷 또는 GIF, 기술 스택, 실행 방법, 배포 URL

---

## 6단계 전에 정해야 할 것

| 질문                                            | 선택지                                                |
| ----------------------------------------------- | ----------------------------------------------------- |
| 선택 단계에서 고른 칸을 30초 안에 바꿀 수 있나? | 자유롭게 토글 / 한번 고르면 확정                      |
| 제출 버튼이 있나?                               | 2칸 고르고 제출하면 즉시 결과 / 30초가 다 지나야 결과 |
| 무승부 후 재대결 시작 방식                      | 버튼을 눌러 시작 / 몇 초 뒤 자동 시작                 |
| 암기 단계 조기 종료                             | 불가 (항상 60초) / "준비 완료" 버튼으로 바로 넘어감   |
| 칸 라벨 표시                                    | 문자만(A~P) / 번호만(1~16) / 둘 다                    |

5단계 설계는 "토글 가능 + 제출 버튼 + 버튼으로 재대결"을 가정했다. 결정이 다르면 5단계 시작 전에 이 문서와 `GAME_RULES.md`를 수정한다.
