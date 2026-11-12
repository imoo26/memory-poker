// 52장에서 5장을 고르는 2,598,960개 조합을 모두 평가해 등급별 개수가 수학적 정답과 같은지 확인한다.
// 몇 초 걸리므로 별도 파일로 분리했다.

import { describe, expect, test } from 'vitest';
import { type Card, createDeck } from '../src/card';
import { HandCategory, evaluateHand } from '../src/evaluator';

const EXPECTED_COUNTS: Record<HandCategory, number> = {
  [HandCategory.StraightFlush]: 40,
  [HandCategory.FourOfAKind]: 624,
  [HandCategory.FullHouse]: 3_744,
  [HandCategory.Flush]: 5_108,
  [HandCategory.Straight]: 10_200,
  [HandCategory.ThreeOfAKind]: 54_912,
  [HandCategory.TwoPair]: 123_552,
  [HandCategory.OnePair]: 1_098_240,
  [HandCategory.HighCard]: 1_302_540,
};

/** 배열에서 k개를 고르는 모든 조합을 차례로 콜백에 넘긴다 */
function forEachCombination<T>(
  items: readonly T[],
  k: number,
  visit: (combo: readonly T[]) => void,
) {
  const combo: T[] = [];
  function pick(start: number) {
    if (combo.length === k) {
      visit(combo);
      return;
    }
    for (let i = start; i <= items.length - (k - combo.length); i++) {
      const item = items[i];
      if (item === undefined) {
        continue;
      }
      combo.push(item);
      pick(i + 1);
      combo.pop();
    }
  }
  pick(0);
}

describe('evaluateHand 전수 검증', () => {
  test('2,598,960개 조합의 등급별 개수', { timeout: 120_000 }, () => {
    const counts = new Map<HandCategory, number>();
    let total = 0;
    forEachCombination<Card>(createDeck(), 5, (cards) => {
      const { category } = evaluateHand(cards);
      counts.set(category, (counts.get(category) ?? 0) + 1);
      total++;
    });

    expect(total).toBe(2_598_960);
    expect(Object.fromEntries(counts)).toEqual(EXPECTED_COUNTS);
  });
});
