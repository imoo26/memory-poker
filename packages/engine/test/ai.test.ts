import { describe, expect, test } from 'vitest';
import {
  type AiConfig,
  DEFAULT_AI_CONFIG,
  type Difficulty,
  chooseAiSelection,
  computeBandSizes,
  enumerateSelections,
  getSelectionBands,
  rankSelections,
} from '../src/ai';
import { type Deal, type Selection, dealRound, isValidSelection } from '../src/board';
import { createRng, parseCards } from '../src/card';
import { HandCategory, compareHands } from '../src/evaluator';

/** 사람이 읽기 쉬운 문자열로 Deal을 만든다 */
function makeDeal(boardText: string, communityText: string): Deal {
  const board = parseCards(boardText);
  const [first, second, third] = parseCards(communityText);
  if (first === undefined || second === undefined || third === undefined) {
    throw new Error('community must have 3 cards');
  }
  return { board, community: [first, second, third] };
}

// 칸:          A  B  C  D  E  F  G  H  I  J  K  L  M  N  O  P
// 인덱스:      0  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15
const TIE_BOARD = 'Js 2h 2d 3c 4d 5h 6c 7d 8h 9c Ts Kd Kh Qc Qd Ac';
// A(Js) + K(Ts) + As Ks Qs → 로열 스트레이트 플러시. B(2h)와 C(2d)처럼 문양만 다른 카드가 있어 동점 조합이 많다.
const TIE_DEAL = makeDeal(TIE_BOARD, 'As Ks Qs');

const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);
const DIFFICULTIES: readonly Difficulty[] = ['hard', 'normal', 'easy'];

function selectionsOf(band: readonly { selection: Selection }[]): Selection[] {
  return band.map((r) => r.selection);
}

describe('enumerateSelections', () => {
  const selections = enumerateSelections();

  test('정확히 120개', () => {
    expect(selections).toHaveLength(120);
  });

  test('첫 번째 [0,1], 두 번째 [0,2], 마지막 [14,15]', () => {
    expect(selections[0]).toEqual([0, 1]);
    expect(selections[1]).toEqual([0, 2]);
    expect(selections[15]).toEqual([1, 2]); // (0,1)~(0,15) 15개 다음
    expect(selections.at(-1)).toEqual([14, 15]);
  });

  test('모두 i < j인 유효한 선택이고 중복 없음', () => {
    for (const selection of selections) {
      expect(isValidSelection(selection)).toBe(true);
      expect(selection[0]).toBeLessThan(selection[1]);
    }
    expect(new Set(selections.map((s) => s.join(','))).size).toBe(120);
  });

  test('i < j 오름차순(사전순)으로 나열', () => {
    for (let k = 1; k < selections.length; k++) {
      const [pi, pj] = selections[k - 1] ?? [0, 0];
      const [ci, cj] = selections[k] ?? [0, 0];
      expect(pi < ci || (pi === ci && pj < cj)).toBe(true);
    }
  });
});

describe('rankSelections', () => {
  test('120개를 반환', () => {
    expect(rankSelections(TIE_DEAL)).toHaveLength(120);
  });

  test('가장 강한 조합이 맨 앞: A(Js) + K(Ts) → 로열 스트레이트 플러시', () => {
    const [top] = rankSelections(TIE_DEAL);
    expect(top?.selection).toEqual([0, 10]);
    expect(top?.hand).toEqual({ category: HandCategory.StraightFlush, ranks: [14] });
  });

  test.each(SEEDS.slice(0, 10))('시드 %i: 강도 내림차순', (seed) => {
    const ranked = rankSelections(dealRound(createRng(seed)));
    for (let k = 1; k < ranked.length; k++) {
      const prev = ranked[k - 1];
      const curr = ranked[k];
      if (prev === undefined || curr === undefined) {
        throw new Error('unreachable');
      }
      expect(compareHands(prev.hand, curr.hand)).toBeGreaterThanOrEqual(0);
    }
  });

  test('안정 정렬: 강도가 같은 조합은 나열 순서(i < j 오름차순)를 유지', () => {
    const order = new Map(enumerateSelections().map((s, index) => [s.join(','), index]));
    const ranked = rankSelections(TIE_DEAL);
    let tiePairs = 0;
    for (let k = 1; k < ranked.length; k++) {
      const prev = ranked[k - 1];
      const curr = ranked[k];
      if (prev === undefined || curr === undefined) {
        throw new Error('unreachable');
      }
      if (compareHands(prev.hand, curr.hand) === 0) {
        tiePairs++;
        expect(order.get(prev.selection.join(','))).toBeLessThan(
          order.get(curr.selection.join(',')) ?? -1,
        );
      }
    }
    expect(tiePairs).toBeGreaterThan(0); // 동점이 실제로 있어야 의미 있는 테스트
  });

  test('구체적인 동점 예: B·D(2h 3c)가 C·D(2d 3c)보다 앞', () => {
    const ranked = rankSelections(TIE_DEAL).map((r) => r.selection.join(','));
    expect(ranked.indexOf('1,3')).toBeLessThan(ranked.indexOf('2,3'));
  });
});

describe('computeBandSizes', () => {
  test('기본 설정: 상 36 / 중 48 / 하 36', () => {
    expect(computeBandSizes(120, DEFAULT_AI_CONFIG)).toEqual({ hard: 36, normal: 48, easy: 36 });
  });

  test('비율 0.33: round(39.6) = 40 → 40 / 40 / 40', () => {
    expect(computeBandSizes(120, { hardRatio: 0.33, easyRatio: 0.33 })).toEqual({
      hard: 40,
      normal: 40,
      easy: 40,
    });
  });

  test('상과 하 비율이 달라도 각각 반올림: 0.1 / 0.5 → 12 / 48 / 60', () => {
    expect(computeBandSizes(120, { hardRatio: 0.1, easyRatio: 0.5 })).toEqual({
      hard: 12,
      normal: 48,
      easy: 60,
    });
  });

  test('비율 합 조건은 없음: 0.45 + 0.45 = 0.9도 허용 → 54 / 12 / 54', () => {
    expect(computeBandSizes(120, { hardRatio: 0.45, easyRatio: 0.45 })).toEqual({
      hard: 54,
      normal: 12,
      easy: 54,
    });
  });

  test('어떤 유효한 설정이든 합계 120', () => {
    for (let hard = 0.01; hard < 0.5; hard += 0.01) {
      for (let easy = 0.01; easy < 0.5; easy += 0.03) {
        const sizes = computeBandSizes(120, { hardRatio: hard, easyRatio: easy });
        expect(sizes.hard + sizes.normal + sizes.easy).toBe(120);
        expect(Math.min(sizes.hard, sizes.normal, sizes.easy)).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test.each<[string, AiConfig]>([
    ['상 비율 0', { hardRatio: 0, easyRatio: 0.3 }],
    ['하 비율 0', { hardRatio: 0.3, easyRatio: 0 }],
    ['상 비율 1', { hardRatio: 1, easyRatio: 0.3 }],
    ['하 비율 1', { hardRatio: 0.3, easyRatio: 1 }],
    ['상 비율 음수', { hardRatio: -0.1, easyRatio: 0.3 }],
    ['하 비율 음수', { hardRatio: 0.3, easyRatio: -0.3 }],
    ['비율 1 초과', { hardRatio: 1.5, easyRatio: 0.3 }],
    ['비율 NaN', { hardRatio: Number.NaN, easyRatio: 0.3 }],
  ])('잘못된 비율 에러: %s', (_name, config) => {
    expect(() => computeBandSizes(120, config)).toThrow();
  });

  test('상 0.5 + 하 0.499 → 상 60, 하 60, 중 0개라 에러', () => {
    expect(() => computeBandSizes(120, { hardRatio: 0.5, easyRatio: 0.499 })).toThrow();
  });

  test('상 0.6 + 하 0.6 → 중이 음수라 에러', () => {
    expect(() => computeBandSizes(120, { hardRatio: 0.6, easyRatio: 0.6 })).toThrow();
  });

  test('비율 0.004 → round(0.48) = 0개라 에러', () => {
    expect(() => computeBandSizes(120, { hardRatio: 0.004, easyRatio: 0.3 })).toThrow();
  });
});

describe('getSelectionBands', () => {
  test('기본 설정: 36 / 48 / 36개로 나뉘고 이어 붙이면 rankSelections와 같음', () => {
    const bands = getSelectionBands(TIE_DEAL);
    expect(bands.hard).toHaveLength(36);
    expect(bands.normal).toHaveLength(48);
    expect(bands.easy).toHaveLength(36);
    expect([...bands.hard, ...bands.normal, ...bands.easy]).toEqual(rankSelections(TIE_DEAL));
  });
});

describe('chooseAiSelection', () => {
  test.each(DIFFICULTIES)('%s: 여러 시드로 반복해도 항상 해당 구간에서만 선택', (difficulty) => {
    for (const seed of SEEDS) {
      const deal = dealRound(createRng(seed));
      const band = selectionsOf(getSelectionBands(deal)[difficulty]);
      const choice = chooseAiSelection(deal, difficulty, createRng(seed * 1000));
      expect(band).toContainEqual(choice);
    }
  });

  test('상은 항상 상위 구간, 하는 항상 하위 구간: 같은 보드에서 상의 선택이 하의 선택보다 강하거나 같음', () => {
    for (const seed of SEEDS) {
      const deal = dealRound(createRng(seed));
      const ranked = rankSelections(deal).map((r) => r.selection.join(','));
      const hard = chooseAiSelection(deal, 'hard', createRng(seed)).join(',');
      const easy = chooseAiSelection(deal, 'easy', createRng(seed)).join(',');
      expect(ranked.indexOf(hard)).toBeLessThan(36);
      expect(ranked.indexOf(easy)).toBeGreaterThanOrEqual(120 - 36);
    }
  });

  test('구간 안에서 무작위: 시드를 바꾸면 여러 조합이 나옴', () => {
    const choices = new Set(
      SEEDS.map((seed) => chooseAiSelection(TIE_DEAL, 'normal', createRng(seed)).join(',')),
    );
    expect(choices.size).toBeGreaterThan(1);
  });

  test('같은 시드 → 같은 선택', () => {
    for (const difficulty of DIFFICULTIES) {
      expect(chooseAiSelection(TIE_DEAL, difficulty, createRng(42))).toEqual(
        chooseAiSelection(TIE_DEAL, difficulty, createRng(42)),
      );
    }
  });

  test('설정을 넘기면 그 구간 크기를 따름: 상 비율 1/120 → 항상 1등 조합', () => {
    const config: AiConfig = { hardRatio: 1 / 120, easyRatio: 0.3 };
    for (const seed of SEEDS) {
      expect(chooseAiSelection(TIE_DEAL, 'hard', createRng(seed), config)).toEqual([0, 10]);
    }
  });

  test('잘못된 설정이면 에러', () => {
    expect(() =>
      chooseAiSelection(TIE_DEAL, 'hard', createRng(1), { hardRatio: 0.5, easyRatio: 0.499 }),
    ).toThrow();
  });
});
