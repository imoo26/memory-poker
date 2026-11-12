// 게임 상태 머신 (리듀서). 한 판의 진행(암기 → 선택 → 결과)과 무승부 재대결을 다룬다.
// 엔진은 시계를 보지 않는다. 시간이 다 됐다는 사실은 *_TIME_UP 액션으로 전달받는다.
// React의 useReducer(gameReducer, INITIAL_GAME_STATE)에 그대로 연결할 수 있다.

import {
  type AiConfig,
  DEFAULT_AI_CONFIG,
  type Difficulty,
  chooseAiSelection,
  computeBandSizes,
  enumerateSelections,
} from './ai';
import {
  BOARD_SIZE,
  type CellIndex,
  type Deal,
  type Selection,
  SELECTION_SIZE,
  dealRound,
  evaluateSelection,
  isValidCellIndex,
  isValidSelection,
} from './board';
import { type Card, createRng } from './card';
import { type HandValue, compareHands } from './evaluator';

/** 암기 단계 시간 (UI 타이머가 사용) */
export const MEMORIZE_MS = 60_000;
/** 선택 단계 시간 (UI 타이머가 사용) */
export const SELECT_MS = 30_000;

/**
 * - idle: START 전 (시작 화면)
 * - ready: 게임 화면에서 "시작" 버튼 대기. 카드는 뒷면이고 타이머는 돌지 않는다
 */
export type Phase = 'idle' | 'ready' | 'memorize' | 'select' | 'result';
export type Winner = 'player' | 'ai' | 'draw';

/** 2칸을 골라 족보까지 판정된 쪽의 결과 */
export interface HandOutcome {
  readonly selection: Selection;
  readonly cards: readonly [Card, Card];
  readonly hand: HandValue;
}

/** 시간 초과한 플레이어의 결과. 시간 안에 고른 칸(0~1개)과 그 카드만 */
export interface TimeoutOutcome {
  readonly selection: readonly CellIndex[];
  readonly cards: readonly Card[];
}

/**
 * 판별 유니온: `reason` 값에 따라 나머지 필드의 타입이 정해진다.
 * `if (result.reason === 'timeout')` 안에서는 `result.player`가 TimeoutOutcome으로 좁혀진다.
 */
export type GameResult =
  | {
      readonly reason: 'hand';
      readonly winner: Winner;
      readonly player: HandOutcome;
      readonly ai: HandOutcome;
    }
  | {
      readonly reason: 'timeout';
      readonly winner: 'ai';
      readonly player: TimeoutOutcome;
      readonly ai: HandOutcome;
    };

/** 한 판 동안 유지되는 정보 */
interface RoundInfo {
  readonly difficulty: Difficulty;
  readonly aiConfig: AiConfig;
  /** START로 받은 기본 시드. 판마다 이 시드와 판 번호로 새 시드를 파생한다 */
  readonly seed: number;
  /** 판 번호 (1부터). 무승부 재대결마다 1씩 증가 */
  readonly round: number;
  readonly deal: Deal;
}

export interface IdleState {
  readonly phase: 'idle';
}

/** 배치는 이미 정해져 있지만 아무 카드도 보여주지 않는다 */
export interface ReadyState extends RoundInfo {
  readonly phase: 'ready';
}

export interface MemorizeState extends RoundInfo {
  readonly phase: 'memorize';
}

export interface SelectState extends RoundInfo {
  readonly phase: 'select';
  /** 플레이어가 고른 칸 (고른 순서, 0~2개). 앞면은 공개하지 않는다 */
  readonly playerSelection: readonly CellIndex[];
  /** 선택 단계 시작 때 결정. 결과 단계에서 공개 */
  readonly aiSelection: Selection;
}

export interface ResultState extends RoundInfo {
  readonly phase: 'result';
  readonly playerSelection: readonly CellIndex[];
  readonly aiSelection: Selection;
  readonly result: GameResult;
  /** "전체 카드 보기". 결과 단계에만 존재하므로 새 판이 시작되면 자연히 초기화된다 */
  readonly revealAll: boolean;
}

export type GameState = IdleState | ReadyState | MemorizeState | SelectState | ResultState;

export const INITIAL_GAME_STATE: GameState = { phase: 'idle' };

export type GameAction =
  | {
      readonly type: 'START';
      readonly difficulty: Difficulty;
      readonly seed: number;
      /** 생략하면 DEFAULT_AI_CONFIG */
      readonly aiConfig?: AiConfig;
    }
  | { readonly type: 'BEGIN_MEMORIZE' } // 준비 단계의 "시작" 버튼. UI는 이때부터 60초를 잰다
  | { readonly type: 'MEMORIZE_TIME_UP' }
  | { readonly type: 'TOGGLE_CELL'; readonly index: CellIndex }
  | { readonly type: 'SUBMIT' }
  | { readonly type: 'SELECT_TIME_UP' }
  | { readonly type: 'TOGGLE_REVEAL_ALL' } // 결과 단계의 "전체 카드 보기" 버튼
  | { readonly type: 'REMATCH' };

/**
 * 상태 전이. 현재 단계에서 허용되지 않는 액션은 같은 state 객체를 그대로 반환한다.
 *
 * | 액션               | 허용 단계         | 결과                                   |
 * | ------------------ | ----------------- | -------------------------------------- |
 * | START              | idle, result      | 1판 준비 단계                          |
 * | BEGIN_MEMORIZE     | ready             | 암기 단계 (항상 60초, 조기 종료 없음)  |
 * | MEMORIZE_TIME_UP   | memorize          | 선택 단계 (컴퓨터 선택 결정)           |
 * | TOGGLE_CELL        | select            | 칸 선택/해제 (최대 2칸)                |
 * | SUBMIT             | select (2칸일 때) | 결과 단계                              |
 * | SELECT_TIME_UP     | select            | 결과 단계 (2칸 미만이면 시간 초과 패배) |
 * | TOGGLE_REVEAL_ALL  | result            | 전체 카드 보기 켜기/끄기               |
 * | REMATCH            | result (무승부)   | 다음 판 준비 단계                      |
 */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START': {
      if (state.phase !== 'idle' && state.phase !== 'result') {
        return state;
      }
      const aiConfig = action.aiConfig ?? DEFAULT_AI_CONFIG;
      // 잘못된 AI 설정은 게임 도중이 아니라 시작할 때 바로 에러로 알린다
      computeBandSizes(enumerateSelections().length, aiConfig);
      return startRound(action.difficulty, aiConfig, action.seed, 1);
    }

    case 'BEGIN_MEMORIZE': {
      if (state.phase !== 'ready') {
        return state;
      }
      return { ...state, phase: 'memorize' };
    }

    case 'MEMORIZE_TIME_UP': {
      if (state.phase !== 'memorize') {
        return state;
      }
      const aiRng = createRng(deriveSeed(state.seed, state.round, 'ai'));
      return {
        ...state,
        phase: 'select',
        playerSelection: [],
        aiSelection: chooseAiSelection(state.deal, state.difficulty, aiRng, state.aiConfig),
      };
    }

    case 'TOGGLE_CELL': {
      if (state.phase !== 'select' || !isValidCellIndex(action.index)) {
        return state;
      }
      const selected = state.playerSelection;
      if (selected.includes(action.index)) {
        return { ...state, playerSelection: selected.filter((i) => i !== action.index) };
      }
      if (selected.length >= SELECTION_SIZE) {
        return state; // 이미 2칸이면 먼저 하나를 해제해야 한다
      }
      return { ...state, playerSelection: [...selected, action.index] };
    }

    case 'SUBMIT': {
      if (state.phase !== 'select' || !isValidSelection(state.playerSelection)) {
        return state;
      }
      return finishRound(state);
    }

    case 'SELECT_TIME_UP': {
      if (state.phase !== 'select') {
        return state;
      }
      return finishRound(state);
    }

    case 'TOGGLE_REVEAL_ALL': {
      if (state.phase !== 'result') {
        return state;
      }
      return { ...state, revealAll: !state.revealAll };
    }

    case 'REMATCH': {
      if (state.phase !== 'result' || state.result.winner !== 'draw') {
        return state;
      }
      return startRound(state.difficulty, state.aiConfig, state.seed, state.round + 1);
    }

    default:
      // 모든 액션 타입을 처리했다면 여기서 action의 타입은 never.
      // 새 액션을 추가하고 case를 빠뜨리면 컴파일 에러가 난다 (Kotlin when의 철저성 검사와 같다)
      return assertNever(action);
  }
}

/** 지금 화면에 보여줄 보드 16칸. null은 뒷면 */
export function visibleBoard(state: GameState): readonly (Card | null)[] {
  switch (state.phase) {
    case 'idle':
    case 'ready':
    case 'select':
      // 선택 단계에서는 플레이어가 고른 칸도 앞면을 보여주지 않는다 (기억에 의존해 고른다)
      return hiddenBoard();
    case 'memorize':
      return state.deal.board;
    case 'result': {
      if (state.revealAll) {
        return state.deal.board;
      }
      const shown = new Set<CellIndex>([...state.playerSelection, ...state.aiSelection]);
      return state.deal.board.map((card, index) => (shown.has(index) ? card : null));
    }
    default:
      return assertNever(state);
  }
}

/** 지금 화면에 보여줄 공유 카드. 시작 전, 준비, 암기 단계에서는 null */
export function visibleCommunity(state: GameState): readonly [Card, Card, Card] | null {
  if (state.phase === 'select' || state.phase === 'result') {
    return state.deal.community;
  }
  return null;
}

function hiddenBoard(): null[] {
  return Array.from({ length: BOARD_SIZE }, () => null);
}

function startRound(
  difficulty: Difficulty,
  aiConfig: AiConfig,
  seed: number,
  round: number,
): ReadyState {
  const deal = dealRound(createRng(deriveSeed(seed, round, 'deal')));
  return { phase: 'ready', difficulty, aiConfig, seed, round, deal };
}

/**
 * 기본 시드와 판 번호, 용도로 시드를 파생한다. 판마다, 용도마다 서로 다른 시드가 나온다.
 * 1판: 배치 seed+2, AI seed+3 / 2판: 배치 seed+4, AI seed+5 / …
 */
function deriveSeed(seed: number, round: number, purpose: 'deal' | 'ai'): number {
  return seed + round * 2 + (purpose === 'ai' ? 1 : 0);
}

function finishRound(state: SelectState): ResultState {
  const ai = handOutcome(state.deal, state.aiSelection);
  const selection = state.playerSelection;

  let result: GameResult;
  if (isValidSelection(selection)) {
    // 시간이 끝났더라도 2칸을 다 골랐으면 패배가 아니라 정상 판정한다
    const player = handOutcome(state.deal, selection);
    result = { reason: 'hand', winner: decideWinner(player.hand, ai.hand), player, ai };
  } else {
    const cards = selection.map((index) => cardAt(state.deal, index));
    result = { reason: 'timeout', winner: 'ai', player: { selection, cards }, ai };
  }
  return { ...state, phase: 'result', result, revealAll: false };
}

function handOutcome(deal: Deal, selection: Selection): HandOutcome {
  const [a, b] = selection;
  return {
    selection,
    cards: [cardAt(deal, a), cardAt(deal, b)],
    hand: evaluateSelection(deal, selection),
  };
}

function decideWinner(player: HandValue, ai: HandValue): Winner {
  const diff = compareHands(player, ai);
  if (diff > 0) {
    return 'player';
  }
  if (diff < 0) {
    return 'ai';
  }
  return 'draw';
}

function cardAt(deal: Deal, index: CellIndex): Card {
  const card = deal.board[index];
  if (card === undefined) {
    throw new Error(`No card at cell ${index}`);
  }
  return card;
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
