import { describe, expect, test } from 'vitest';
import { type Difficulty, getSelectionBands, rankSelections } from '../src/ai';
import { type CellIndex, evaluateSelection } from '../src/board';
import {
  type GameAction,
  type GameState,
  INITIAL_GAME_STATE,
  MEMORIZE_MS,
  type MemorizeState,
  type ReadyState,
  type ResultState,
  SELECT_MS,
  type SelectState,
  gameReducer,
  visibleBoard,
  visibleCommunity,
} from '../src/game';

// ---- 헬퍼 ----

function play(state: GameState, ...actions: GameAction[]): GameState {
  return actions.reduce(gameReducer, state);
}

/** START까지 (준비 단계) */
function start(seed = 1, difficulty: Difficulty = 'normal'): GameState {
  return gameReducer(INITIAL_GAME_STATE, { type: 'START', difficulty, seed });
}

/** START → "시작" 버튼까지 (암기 단계) */
function begin(seed = 1, difficulty: Difficulty = 'normal'): GameState {
  return play(start(seed, difficulty), { type: 'BEGIN_MEMORIZE' });
}

function toggle(...indices: CellIndex[]): GameAction[] {
  return indices.map((index) => ({ type: 'TOGGLE_CELL', index }));
}

// 단계를 확인하면서 타입을 좁히는 헬퍼. 단계가 다르면 테스트 실패
function asReady(state: GameState): ReadyState {
  if (state.phase !== 'ready') {
    throw new Error(`expected ready, got ${state.phase}`);
  }
  return state;
}
function asMemorize(state: GameState): MemorizeState {
  if (state.phase !== 'memorize') {
    throw new Error(`expected memorize, got ${state.phase}`);
  }
  return state;
}
function asSelect(state: GameState): SelectState {
  if (state.phase !== 'select') {
    throw new Error(`expected select, got ${state.phase}`);
  }
  return state;
}
function asResult(state: GameState): ResultState {
  if (state.phase !== 'result') {
    throw new Error(`expected result, got ${state.phase}`);
  }
  return state;
}

/** 선택 단계까지 진행 */
function toSelect(seed = 1, difficulty: Difficulty = 'normal'): SelectState {
  return asSelect(play(begin(seed, difficulty), { type: 'MEMORIZE_TIME_UP' }));
}

/** 플레이어가 컴퓨터와 같은 2칸을 골라 무승부가 된 결과 상태 */
function toDraw(seed = 1): ResultState {
  const select = toSelect(seed);
  return asResult(play(select, ...toggle(...select.aiSelection), { type: 'SUBMIT' }));
}

/** 무승부가 아닌 결과 상태 (컴퓨터 하 vs 플레이어 최강 조합) */
function toPlayerWin(seed = 1): ResultState {
  const select = toSelect(seed, 'easy');
  const [best] = rankSelections(select.deal);
  if (best === undefined) {
    throw new Error('unreachable');
  }
  return asResult(play(select, ...toggle(...best.selection), { type: 'SUBMIT' }));
}

const ALL_HIDDEN = Array.from({ length: 16 }, () => null);

// ---- 테스트 ----

describe('상수와 초기 상태', () => {
  test('암기 60초, 선택 30초', () => {
    expect(MEMORIZE_MS).toBe(60_000);
    expect(SELECT_MS).toBe(30_000);
  });

  test('초기 상태는 idle, 카드는 아무것도 보이지 않음', () => {
    expect(INITIAL_GAME_STATE).toEqual({ phase: 'idle' });
    expect(visibleBoard(INITIAL_GAME_STATE)).toEqual(ALL_HIDDEN);
    expect(visibleCommunity(INITIAL_GAME_STATE)).toBeNull();
  });
});

describe('정상 흐름: START → 시작 버튼 → 시간 종료 → 2칸 선택 → 제출 → 결과', () => {
  test('각 단계로 순서대로 넘어가고 결과가 판정됨', () => {
    const ready = asReady(start(7, 'hard'));
    expect(ready).toMatchObject({ difficulty: 'hard', seed: 7, round: 1 });
    expect(ready.deal.board).toHaveLength(16);

    const memorize = asMemorize(play(ready, { type: 'BEGIN_MEMORIZE' }));
    expect(memorize.deal).toBe(ready.deal); // 준비 단계에서 정한 배치 그대로

    const select = asSelect(play(memorize, { type: 'MEMORIZE_TIME_UP' }));
    expect(select.playerSelection).toEqual([]);
    expect(select.deal).toBe(memorize.deal); // 배치는 그대로

    const picked = asSelect(play(select, ...toggle(3, 12)));
    expect(picked.playerSelection).toEqual([3, 12]);

    const result = asResult(play(picked, { type: 'SUBMIT' }));
    expect(result.revealAll).toBe(false);
    expect(result.result.reason).toBe('hand');
    if (result.result.reason !== 'hand') {
      throw new Error('unreachable');
    }
    const { player, ai } = result.result;
    expect(player.selection).toEqual([3, 12]);
    expect(player.cards).toEqual([result.deal.board[3], result.deal.board[12]]);
    expect(player.hand).toEqual(evaluateSelection(result.deal, [3, 12]));
    expect(ai.selection).toEqual(select.aiSelection);
    expect(ai.hand).toEqual(evaluateSelection(result.deal, select.aiSelection));
  });

  test('플레이어 족보가 더 강하면 player 승', () => {
    expect(toPlayerWin().result.winner).toBe('player');
  });

  test('플레이어 족보가 더 약하면 ai 승', () => {
    const select = toSelect(1, 'hard');
    const worst = rankSelections(select.deal).at(-1);
    if (worst === undefined) {
      throw new Error('unreachable');
    }
    const result = asResult(play(select, ...toggle(...worst.selection), { type: 'SUBMIT' }));
    expect(result.result).toMatchObject({ reason: 'hand', winner: 'ai' });
  });

  test('컴퓨터 선택은 선택 단계 시작 때 정해지고, 난이도 구간 안에 있음', () => {
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      const select = toSelect(3, difficulty);
      const band = getSelectionBands(select.deal)[difficulty].map((r) => r.selection);
      expect(band).toContainEqual(select.aiSelection);
    }
  });

  test('START에 aiConfig를 넘기면 그 비율을 따름 (상 1/120 → 1등 조합)', () => {
    const state = gameReducer(INITIAL_GAME_STATE, {
      type: 'START',
      difficulty: 'hard',
      seed: 5,
      aiConfig: { hardRatio: 1 / 120, easyRatio: 0.3 },
    });
    const select = asSelect(play(state, { type: 'BEGIN_MEMORIZE' }, { type: 'MEMORIZE_TIME_UP' }));
    expect(select.aiSelection).toEqual(rankSelections(select.deal)[0]?.selection);
  });

  test('잘못된 aiConfig로 START하면 에러', () => {
    expect(() =>
      gameReducer(INITIAL_GAME_STATE, {
        type: 'START',
        difficulty: 'hard',
        seed: 5,
        aiConfig: { hardRatio: 0.5, easyRatio: 0.499 },
      }),
    ).toThrow();
  });

  test('같은 시드 → 같은 배치와 같은 컴퓨터 선택', () => {
    expect(toSelect(42)).toEqual(toSelect(42));
    expect(toSelect(42).deal).not.toEqual(toSelect(43).deal);
  });

  test('결과 단계에서 START하면 새 게임 1판 준비 단계로', () => {
    const next = asReady(play(toPlayerWin(), { type: 'START', difficulty: 'easy', seed: 9 }));
    expect(next).toMatchObject({ difficulty: 'easy', seed: 9, round: 1 });
  });
});

describe('선택 단계: 칸 토글', () => {
  test('누르면 선택, 다시 누르면 해제', () => {
    const select = toSelect();
    expect(asSelect(play(select, ...toggle(5))).playerSelection).toEqual([5]);
    expect(asSelect(play(select, ...toggle(5, 5))).playerSelection).toEqual([]);
    expect(asSelect(play(select, ...toggle(5, 9, 5))).playerSelection).toEqual([9]);
  });

  test('최대 2칸: 3번째 칸은 무시', () => {
    const two = play(toSelect(), ...toggle(1, 2));
    expect(play(two, ...toggle(3))).toBe(two);
  });

  test('2칸에서 하나를 해제하면 다른 칸을 고를 수 있음', () => {
    const state = asSelect(play(toSelect(), ...toggle(1, 2, 1, 3)));
    expect(state.playerSelection).toEqual([2, 3]);
  });

  test.each([-1, 16, 1.5])('범위 밖 칸 %s는 무시', (index) => {
    const select = toSelect();
    expect(play(select, ...toggle(index))).toBe(select);
  });

  test.each([[[]], [[4]]])('2칸 미만(%j)에서 SUBMIT은 무시', (indices) => {
    const state = play(toSelect(), ...toggle(...indices));
    expect(play(state, { type: 'SUBMIT' })).toBe(state);
  });

  test('컴퓨터가 고른 칸을 플레이어도 고를 수 있음', () => {
    const select = toSelect();
    const state = asSelect(play(select, ...toggle(...select.aiSelection)));
    expect(state.playerSelection).toEqual([...select.aiSelection]);
  });
});

describe('시간 초과', () => {
  test.each([[[]], [[6]]])('%j칸만 고르고 시간 종료 → 플레이어 시간 초과 패배', (indices) => {
    const select = toSelect();
    const result = asResult(play(select, ...toggle(...indices), { type: 'SELECT_TIME_UP' }));
    expect(result.result.reason).toBe('timeout');
    expect(result.result.winner).toBe('ai');
    if (result.result.reason !== 'timeout') {
      throw new Error('unreachable');
    }
    // 플레이어는 시간 안에 고른 카드까지만, 컴퓨터는 2장과 족보 공개
    expect(result.result.player.selection).toEqual(indices);
    expect(result.result.player.cards).toEqual(indices.map((i) => select.deal.board[i]));
    expect(result.result.ai.selection).toEqual(select.aiSelection);
    expect(result.result.ai.hand).toEqual(evaluateSelection(select.deal, select.aiSelection));
  });

  test('2칸을 고른 뒤 제출하지 않고 시간 종료 → 패배가 아니라 정상 판정', () => {
    const result = asResult(play(toSelect(), ...toggle(0, 1), { type: 'SELECT_TIME_UP' }));
    expect(result.result.reason).toBe('hand');
  });
});

describe('무승부와 재대결', () => {
  test('양쪽이 같은 칸을 고르면 같은 족보라 무승부', () => {
    expect(toDraw().result).toMatchObject({ reason: 'hand', winner: 'draw' });
  });

  test('REMATCH → 판 번호 증가, 새 배치로 준비 단계부터', () => {
    const draw = toDraw();
    const next = asReady(play(draw, { type: 'REMATCH' }));
    expect(next.round).toBe(2);
    expect(next).toMatchObject({ difficulty: draw.difficulty, seed: draw.seed });
    expect(next.deal.board).not.toEqual(draw.deal.board);
    expect(next.deal.community).not.toEqual(draw.deal.community);
  });

  test('재대결도 같은 시드면 재현됨', () => {
    expect(play(toDraw(11), { type: 'REMATCH' })).toEqual(play(toDraw(11), { type: 'REMATCH' }));
  });

  test('재대결에서 다시 무승부면 또 REMATCH 가능 (판 번호 계속 증가)', () => {
    const round2 = asSelect(
      play(toDraw(), { type: 'REMATCH' }, { type: 'BEGIN_MEMORIZE' }, { type: 'MEMORIZE_TIME_UP' }),
    );
    const draw2 = play(round2, ...toggle(...round2.aiSelection), { type: 'SUBMIT' });
    expect(asReady(play(draw2, { type: 'REMATCH' })).round).toBe(3);
  });

  test('무승부가 아니면 REMATCH 무시', () => {
    const win = toPlayerWin();
    expect(play(win, { type: 'REMATCH' })).toBe(win);
  });
});

describe('잘못된 단계의 액션은 무시 (같은 state 반환)', () => {
  const START: GameAction = { type: 'START', difficulty: 'normal', seed: 99 };
  const BEGIN: GameAction = { type: 'BEGIN_MEMORIZE' };
  const MEMORIZE_TIME_UP: GameAction = { type: 'MEMORIZE_TIME_UP' };
  const TOGGLE: GameAction = { type: 'TOGGLE_CELL', index: 0 };
  const SUBMIT: GameAction = { type: 'SUBMIT' };
  const SELECT_TIME_UP: GameAction = { type: 'SELECT_TIME_UP' };
  const REVEAL: GameAction = { type: 'TOGGLE_REVEAL_ALL' };
  const REMATCH: GameAction = { type: 'REMATCH' };

  test.each([BEGIN, MEMORIZE_TIME_UP, TOGGLE, SUBMIT, SELECT_TIME_UP, REVEAL, REMATCH])(
    'idle: %j',
    (action) => {
      expect(gameReducer(INITIAL_GAME_STATE, action)).toBe(INITIAL_GAME_STATE);
    },
  );

  test.each([START, MEMORIZE_TIME_UP, TOGGLE, SUBMIT, SELECT_TIME_UP, REVEAL, REMATCH])(
    'ready: %j',
    (action) => {
      const state = start();
      expect(gameReducer(state, action)).toBe(state);
    },
  );

  // 암기 단계를 일찍 끝내는 액션은 없다: MEMORIZE_TIME_UP 외에는 모두 무시
  test.each([START, BEGIN, TOGGLE, SUBMIT, SELECT_TIME_UP, REVEAL, REMATCH])(
    'memorize: %j',
    (action) => {
      const state = begin();
      expect(gameReducer(state, action)).toBe(state);
    },
  );

  test.each([START, BEGIN, MEMORIZE_TIME_UP, REVEAL, REMATCH])('select: %j', (action) => {
    const state = play(toSelect(), ...toggle(2));
    expect(gameReducer(state, action)).toBe(state);
  });

  test.each([BEGIN, MEMORIZE_TIME_UP, TOGGLE, SUBMIT, SELECT_TIME_UP, REMATCH])(
    'result(무승부 아님): %j',
    (action) => {
      const state = toPlayerWin();
      expect(gameReducer(state, action)).toBe(state);
    },
  );
});

describe('공유 카드 공개 시점 (visibleCommunity)', () => {
  test('준비·암기 단계 null → 선택 단계 3장 → 결과 단계 3장 → 재대결 준비·암기 단계 null', () => {
    expect(visibleCommunity(start())).toBeNull();
    expect(visibleCommunity(begin())).toBeNull();

    const select = toSelect();
    expect(visibleCommunity(select)).toEqual(select.deal.community);

    const draw = toDraw();
    expect(visibleCommunity(draw)).toEqual(draw.deal.community);

    const rematch = play(draw, { type: 'REMATCH' });
    expect(visibleCommunity(rematch)).toBeNull();
    expect(visibleCommunity(play(rematch, { type: 'BEGIN_MEMORIZE' }))).toBeNull();
  });
});

describe('보드 공개 시점 (visibleBoard)', () => {
  test('준비 단계에서는 16칸 모두 null', () => {
    expect(visibleBoard(start())).toEqual(ALL_HIDDEN);
  });

  test('암기 단계에서는 16장 앞면 (deal.board와 같음)', () => {
    const memorize = asMemorize(begin());
    expect(visibleBoard(memorize)).toEqual(memorize.deal.board);
  });

  test('MEMORIZE_TIME_UP 후 16칸 모두 null', () => {
    expect(visibleBoard(toSelect())).toEqual(ALL_HIDDEN);
  });

  test('선택한 칸 비공개: 1칸, 2칸을 골라도 16칸 모두 null', () => {
    expect(visibleBoard(play(toSelect(), ...toggle(4)))).toEqual(ALL_HIDDEN);
    expect(visibleBoard(play(toSelect(), ...toggle(4, 11)))).toEqual(ALL_HIDDEN);
  });

  test('결과 단계: 플레이어와 컴퓨터가 고른 칸만 앞면, 나머지 null', () => {
    const select = toSelect(1, 'easy');
    // 컴퓨터와 겹치지 않는 2칸 고르기
    const mine = [0, 1, 2, 3].filter((i) => !select.aiSelection.includes(i)).slice(0, 2);
    const result = asResult(play(select, ...toggle(...mine), { type: 'SUBMIT' }));
    const shown = new Set([...mine, ...select.aiSelection]);
    expect(shown.size).toBe(4);
    expect(visibleBoard(result)).toEqual(
      result.deal.board.map((card, i) => (shown.has(i) ? card : null)),
    );
  });

  test('결과 단계: 양쪽이 같은 칸을 고르면 그 2칸만 앞면', () => {
    const draw = toDraw();
    const visible = visibleBoard(draw);
    expect(visible.filter((card) => card !== null)).toHaveLength(2);
    for (const index of draw.aiSelection) {
      expect(visible[index]).toEqual(draw.deal.board[index]);
    }
  });

  test.each([[[]], [[6]]])(
    '결과 단계: 시간 초과(%j칸)면 플레이어가 고른 칸 + 컴퓨터 2칸만 앞면',
    (indices) => {
      const select = toSelect();
      const result = asResult(play(select, ...toggle(...indices), { type: 'SELECT_TIME_UP' }));
      const shown = new Set([...indices, ...select.aiSelection]);
      expect(visibleBoard(result)).toEqual(
        result.deal.board.map((card, i) => (shown.has(i) ? card : null)),
      );
    },
  );
});

describe('전체 카드 보기 (TOGGLE_REVEAL_ALL)', () => {
  test('결과 단계에서 켜면 16장 모두 앞면, 한 번 더 누르면 고른 칸만으로 복귀', () => {
    const result = toPlayerWin();
    const defaultView = visibleBoard(result);

    const revealed = asResult(play(result, { type: 'TOGGLE_REVEAL_ALL' }));
    expect(revealed.revealAll).toBe(true);
    expect(visibleBoard(revealed)).toEqual(result.deal.board);

    const back = asResult(play(revealed, { type: 'TOGGLE_REVEAL_ALL' }));
    expect(back.revealAll).toBe(false);
    expect(visibleBoard(back)).toEqual(defaultView);
  });

  test('암기·선택 단계에서는 상태가 바뀌지 않음 (선택 단계에서 보내도 16칸 모두 null)', () => {
    const ready = start();
    expect(play(ready, { type: 'TOGGLE_REVEAL_ALL' })).toBe(ready);

    const memorize = begin();
    expect(play(memorize, { type: 'TOGGLE_REVEAL_ALL' })).toBe(memorize);

    const select = play(toSelect(), ...toggle(1, 2));
    const after = play(select, { type: 'TOGGLE_REVEAL_ALL' });
    expect(after).toBe(select);
    expect(visibleBoard(after)).toEqual(ALL_HIDDEN);
  });

  test('켠 채로 REMATCH → 새 판의 결과 단계에서 revealAll은 false', () => {
    const revealed = play(toDraw(), { type: 'TOGGLE_REVEAL_ALL' });
    const nextSelect = asSelect(
      play(revealed, { type: 'REMATCH' }, { type: 'BEGIN_MEMORIZE' }, { type: 'MEMORIZE_TIME_UP' }),
    );
    expect(visibleBoard(nextSelect)).toEqual(ALL_HIDDEN);
    const nextResult = asResult(play(nextSelect, ...toggle(0, 1), { type: 'SUBMIT' }));
    expect(nextResult.revealAll).toBe(false);
  });
});
