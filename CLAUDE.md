# memory-poker

데블스플랜 3: 데드 어게인의 "기억 포커"를 웹 게임으로 구현하는 pnpm 모노레포. 현재 단계: **싱글 플레이(플레이어 vs 컴퓨터)**. 멀티 플레이는 나중에.

- 게임 규칙 전체: @docs/GAME_RULES.md (규칙 관련 코드를 쓰기 전에 반드시 확인)
- 작업 계획: @docs/ROADMAP.md
- 규칙이 문서에 없거나 모호하면 추측하지 말고 사용자에게 질문할 것

## 사용자에 대해

- Java, C++ 경험이 있고 Kotlin 백엔드 세미나를 들었음. **TypeScript는 이 프로젝트로 처음 배우는 중.**
- 답변과 설명은 **한국어**로. 코드 식별자는 영어, 주석과 테스트 설명은 한국어 가능.
- TypeScript 고유 개념(구조적 타이핑, 유니온 타입, `undefined`/`null`, `===`, `number` 단일 타입, async/이벤트 루프 등)이 처음 나오면 Java/Kotlin과 비교해 짧게 설명.
- 학습이 목표이므로 엔진의 핵심 로직(족보 판정, 게임 상태 머신, AI)은 기본적으로 **타입·테스트·설계를 먼저 제안**하고, 구현까지 할지는 사용자에게 확인. 설정 파일·UI 뼈대 같은 반복 작업은 바로 진행해도 됨.

## 기술 스택과 고정 버전

- 패키지 매니저: **pnpm 12** (workspaces). npm/yarn 명령 사용 금지. Turborepo는 아직 도입 안 함.
- **TypeScript ~6.0으로 고정. 7.x로 올리지 말 것** (typescript-eslint가 아직 TS 7 미지원).
- 프론트: React + Vite (`apps/web`, react-ts 템플릿)
- 테스트: Vitest / 린트: ESLint flat config + typescript-eslint + eslint-config-prettier / 포맷: Prettier
- `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess` 켜져 있음. 이를 끄거나 `any`, `as` 단언, `!` non-null 단언으로 우회하지 말 것.

## 구조

```
apps/web/            # React + Vite 프론트엔드 (자체 eslint.config.js 보유)
packages/engine/     # 게임 로직. 순수 TypeScript
  src/card.ts        # (예정) 카드, 덱, 시드 기반 셔플
  src/evaluator.ts   # (예정) 족보 판정과 비교
  src/game.ts        # (예정) 게임 상태 머신
  src/ai.ts          # (예정) 컴퓨터 난이도
  src/index.ts       # 공개 API만 export
  test/              # Vitest 테스트
```

- `packages/engine`은 React, DOM, 브라우저 API, `Date.now()`, `Math.random()`에 직접 의존하지 않는다. 시간과 난수는 인자로 주입(시드 RNG)해서 테스트와 리플레이가 재현 가능하게 한다.
- 웹은 `@memory-poker/engine`(workspace 의존성)으로 엔진을 import한다. 게임 규칙을 `apps/web`에 중복 구현하지 말 것.
- 예정(지금은 만들지 않음): `apps/server`(Node + Socket.IO), `packages/shared`(통신 타입).

## 명령어 (레포 루트에서)

```bash
pnpm dev          # 웹 개발 서버
pnpm test         # 전체 테스트
pnpm typecheck    # 전체 타입 검사
pnpm lint         # 전체 린트
pnpm format       # Prettier
pnpm --filter @memory-poker/engine test:watch
```

작업을 끝냈다고 보고하기 전에 `pnpm test`, `pnpm typecheck`, `pnpm lint`를 실행해 통과를 확인한다.

## 환경

- Windows + VS Code, 터미널은 **Git Bash**. 셸 명령은 bash 문법으로 작성 (PowerShell 전용 문법 사용 금지).
- 대화형 프롬프트가 있는 명령은 다른 명령과 한 번에 이어서 실행하지 않는다.

## Git 규칙

- `main`에 직접 커밋하지 않는다. 기능별 브랜치(`feat/...`, `fix/...`, `chore/...`) → PR → squash merge.
- 커밋 메시지는 Conventional Commits: `feat(engine): add hand evaluator`
- `pnpm-lock.yaml`은 항상 커밋. 커밋·push·PR 생성은 사용자가 요청할 때만.
