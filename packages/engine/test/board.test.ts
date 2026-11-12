import { describe, expect, test } from 'vitest';
import { type Card, cardId, createRng, parseCards } from '../src/card';
import {
  BOARD_SIZE,
  CELL_LABELS,
  type Deal,
  dealRound,
  evaluateSelection,
  indexToLabel,
  indexToNumber,
  isValidCellIndex,
  isValidSelection,
  labelToIndex,
} from '../src/board';
import { HandCategory } from '../src/evaluator';

/** 사람이 읽기 쉬운 문자열로 Deal을 만든다 */
function makeDeal(boardText: string, communityText: string): Deal {
  const board = parseCards(boardText);
  const [first, second, third, ...rest] = parseCards(communityText);
  if (board.length !== BOARD_SIZE) {
    throw new Error('board must have 16 cards');
  }
  if (first === undefined || second === undefined || third === undefined || rest.length > 0) {
    throw new Error('community must have exactly 3 cards');
  }
  return { board, community: [first, second, third] };
}

function allCards(deal: Deal): Card[] {
  return [...deal.board, ...deal.community];
}

// 칸:        A  B  C  D  E  F  G  H  I  J  K  L  M  N  O  P
const KNOWN_BOARD = 'As Ah 7c 2d Ks Qs 9h 3c 5d 8s Kd 4h Jc 6c Th 2s';
const KNOWN_DEAL = makeDeal(KNOWN_BOARD, 'Js Ts Ad');

describe('칸 라벨 변환', () => {
  test('라벨은 A~P 16개', () => {
    expect(CELL_LABELS).toHaveLength(16);
    expect(CELL_LABELS.join('')).toBe('ABCDEFGHIJKLMNOP');
  });

  test('A ↔ 0 ↔ 1번', () => {
    expect(indexToLabel(0)).toBe('A');
    expect(labelToIndex('A')).toBe(0);
    expect(indexToNumber(0)).toBe(1);
  });

  test('P ↔ 15 ↔ 16번', () => {
    expect(indexToLabel(15)).toBe('P');
    expect(labelToIndex('P')).toBe(15);
    expect(indexToNumber(15)).toBe(16);
  });

  test('16칸 모두 왕복 변환 일치', () => {
    for (let i = 0; i < BOARD_SIZE; i++) {
      expect(labelToIndex(indexToLabel(i))).toBe(i);
    }
  });

  test.each([-1, 16, 1.5, NaN])('범위 밖 인덱스 %s는 에러', (index) => {
    expect(isValidCellIndex(index)).toBe(false);
    expect(() => indexToLabel(index)).toThrow();
    expect(() => indexToNumber(index)).toThrow();
  });

  test.each(['', 'Q', 'a', 'AB', '1'])('잘못된 라벨 "%s"는 에러', (label) => {
    expect(() => labelToIndex(label)).toThrow();
  });
});

describe('dealRound', () => {
  test('보드 16장 + 공유 3장', () => {
    const deal = dealRound(createRng(1));
    expect(deal.board).toHaveLength(16);
    expect(deal.community).toHaveLength(3);
  });

  test.each([1, 2, 42, 12345])('시드 %i: 19장 모두 서로 다름', (seed) => {
    const ids = new Set(allCards(dealRound(createRng(seed))).map(cardId));
    expect(ids.size).toBe(19);
  });

  test('같은 시드 → 같은 배치', () => {
    expect(dealRound(createRng(7))).toEqual(dealRound(createRng(7)));
  });

  test('다른 시드 → 다른 배치', () => {
    expect(dealRound(createRng(7))).not.toEqual(dealRound(createRng(8)));
  });

  test('같은 rng로 연속으로 나누면 다른 배치 (재대결용)', () => {
    const rng = createRng(7);
    expect(dealRound(rng)).not.toEqual(dealRound(rng));
  });
});

describe('isValidSelection', () => {
  test.each([[[0, 1]], [[15, 0]], [[3, 12]]])('%j는 유효', (selection) => {
    expect(isValidSelection(selection)).toBe(true);
  });

  test.each([
    ['같은 칸 두 번', [3, 3]],
    ['범위 밖 (음수)', [-1, 2]],
    ['범위 밖 (16)', [0, 16]],
    ['정수 아님', [0, 1.5]],
    ['1칸만', [3]],
    ['0칸', []],
    ['3칸', [0, 1, 2]],
  ])('%s → 무효', (_name, selection) => {
    expect(isValidSelection(selection)).toBe(false);
  });
});

describe('evaluateSelection', () => {
  test('A, B (As Ah) + Js Ts Ad → A 트리플', () => {
    expect(evaluateSelection(KNOWN_DEAL, [0, 1])).toEqual({
      category: HandCategory.ThreeOfAKind,
      ranks: [14, 11, 10],
    });
  });

  test('E, F (Ks Qs) + Js Ts Ad → A 하이 스트레이트', () => {
    expect(evaluateSelection(KNOWN_DEAL, [4, 5])).toEqual({
      category: HandCategory.Straight,
      ranks: [14],
    });
  });

  test('C, D (7c 2d) + Js Ts Ad → 하이카드', () => {
    expect(evaluateSelection(KNOWN_DEAL, [2, 3])).toEqual({
      category: HandCategory.HighCard,
      ranks: [14, 11, 10, 7, 2],
    });
  });

  test('선택 순서와 무관하게 같은 결과', () => {
    expect(evaluateSelection(KNOWN_DEAL, [5, 4])).toEqual(evaluateSelection(KNOWN_DEAL, [4, 5]));
  });

  test('양쪽 플레이어가 같은 칸을 골라도 각자 평가할 수 있음', () => {
    const player = evaluateSelection(KNOWN_DEAL, [0, 4]);
    const ai = evaluateSelection(KNOWN_DEAL, [0, 5]);
    expect(player.category).toBe(HandCategory.OnePair);
    expect(ai.category).toBe(HandCategory.OnePair);
  });

  test.each([
    ['같은 칸 두 번', [3, 3]],
    ['범위 밖', [0, 16]],
    ['1칸만', [3]],
  ])('잘못된 선택(%s)은 에러', (_name, selection) => {
    expect(() => evaluateSelection(KNOWN_DEAL, selection)).toThrow();
  });
});
