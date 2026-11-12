import { describe, expect, test } from 'vitest';
import { parseCards } from '../src/card';
import { HandCategory, compareHands, evaluateHand } from '../src/evaluator';

/** 'As Kd Qh Jc Ts' → 족보 */
function hand(text: string) {
  return evaluateHand(parseCards(text));
}

/** 1: a 승, -1: b 승, 0: 무승부 */
function compare(a: string, b: string): number {
  return Math.sign(compareHands(hand(a), hand(b)));
}

describe('evaluateHand: 9개 등급 판정', () => {
  test.each([
    ['As Ks Qs Js Ts', HandCategory.StraightFlush, [14]], // 로열
    ['9h 8h 7h 6h 5h', HandCategory.StraightFlush, [9]],
    ['9c 9d 9h 9s 2c', HandCategory.FourOfAKind, [9, 2]],
    ['Qs Qh Qd 7c 7s', HandCategory.FullHouse, [12, 7]],
    ['Kd Td 7d 4d 2d', HandCategory.Flush, [13, 10, 7, 4, 2]],
    ['Ts 9h 8d 7c 6s', HandCategory.Straight, [10]],
    ['5s 5h 5d Kc 2s', HandCategory.ThreeOfAKind, [5, 13, 2]],
    ['Js Jh 5d 5c 2s', HandCategory.TwoPair, [11, 5, 2]],
    ['Ks Kh As 9d 4c', HandCategory.OnePair, [13, 14, 9, 4]],
    ['As Jh 9d 6c 3s', HandCategory.HighCard, [14, 11, 9, 6, 3]],
  ])('%s', (text, category, ranks) => {
    expect(hand(text)).toEqual({ category, ranks });
  });

  test('입력 순서와 무관하게 같은 결과', () => {
    expect(hand('7c Qs 7s Qh Qd')).toEqual(hand('Qs Qh Qd 7c 7s'));
    expect(hand('2c 9h 9d 2s 9s')).toEqual({ category: HandCategory.FullHouse, ranks: [9, 2] });
  });
});

describe('evaluateHand: 스트레이트 함정 케이스', () => {
  test('A-2-3-4-5 휠은 5 하이 스트레이트', () => {
    expect(hand('As 2h 3d 4c 5s')).toEqual({ category: HandCategory.Straight, ranks: [5] });
  });

  test('휠은 가장 약한 스트레이트 (6 하이 스트레이트보다 약함)', () => {
    expect(compare('As 2h 3d 4c 5s', '2s 3h 4d 5c 6s')).toBe(-1);
  });

  test('A-K-Q-J-T는 가장 강한 스트레이트', () => {
    expect(hand('As Kh Qd Jc Ts')).toEqual({ category: HandCategory.Straight, ranks: [14] });
    expect(compare('As Kh Qd Jc Ts', 'Ks Qh Jd Tc 9s')).toBe(1);
  });

  test('스틸 휠(A-2-3-4-5 스트레이트 플러시)은 5 하이 스트레이트 플러시', () => {
    expect(hand('Ah 2h 3h 4h 5h')).toEqual({ category: HandCategory.StraightFlush, ranks: [5] });
  });

  test('스틸 휠은 가장 약한 스트레이트 플러시', () => {
    expect(compare('Ah 2h 3h 4h 5h', '2s 3s 4s 5s 6s')).toBe(-1);
    // 그래도 포카드보다는 강하다
    expect(compare('Ah 2h 3h 4h 5h', 'As Ac Ad Ah Ks')).toBe(1);
  });

  test.each(['Qs Kh As 2d 3c', 'Js Qh Kd Ac 2s', 'Ks Ah 2d 3c 4s'])(
    '랩어라운드 %s는 스트레이트가 아니라 하이카드',
    (text) => {
      expect(hand(text).category).toBe(HandCategory.HighCard);
    },
  );

  test('랩어라운드 플러시는 스트레이트 플러시가 아니라 플러시', () => {
    expect(hand('Qs Ks As 2s 3s')).toEqual({
      category: HandCategory.Flush,
      ranks: [14, 13, 12, 3, 2],
    });
  });

  test('한 칸 빠진 연속은 스트레이트가 아님', () => {
    expect(hand('9s 8h 7d 6c 4s').category).toBe(HandCategory.HighCard);
  });
});

describe('compareHands: 다른 등급끼리', () => {
  test.each([
    ['스트레이트 플러시 > 포카드', '9h 8h 7h 6h 5h', 'As Ac Ad Ah Ks'],
    ['포카드 > 풀하우스', '2s 2h 2d 2c 3s', 'As Ah Ad Kc Ks'],
    ['풀하우스 > 플러시', '2s 2h 2d 3c 3s', 'As Ks Qs Js 9s'],
    ['플러시 > 스트레이트', '7s 5s 4s 3s 2s', 'As Kh Qd Jc Ts'],
    ['스트레이트 > 트리플', 'As 2h 3d 4c 5s', 'As Ah Ad Kc Qs'],
    ['트리플 > 투페어', '2s 2h 2d 3c 4s', 'As Ah Kd Kc Qs'],
    ['투페어 > 원페어', '3s 3h 2d 2c 4s', 'As Ah Kd Qc Js'],
    ['원페어 > 하이카드', '2s 2h 3d 4c 5s', 'As Kh Qd Jc 9s'],
  ])('%s', (_name, stronger, weaker) => {
    expect(compare(stronger, weaker)).toBe(1);
    expect(compare(weaker, stronger)).toBe(-1);
  });
});

describe('compareHands: 같은 등급끼리', () => {
  test('원페어: 페어 랭크가 먼저', () => {
    expect(compare('Ks Kh 4d 3c 2s', 'Qs Qh Ad Kc Js')).toBe(1);
  });

  test('원페어: 페어가 같으면 키커를 높은 순으로 차례로', () => {
    expect(compare('Ks Kh Ad 9c 4s', 'Kd Kc Qh Jd Ts')).toBe(1); // 첫 키커 A > Q
    expect(compare('Ks Kh Ad 9c 4s', 'Kd Kc Ah 8d 7s')).toBe(1); // 둘째 키커 9 > 8
    expect(compare('Ks Kh Ad 9c 4s', 'Kd Kc Ah 9d 3s')).toBe(1); // 셋째 키커 4 > 3
  });

  test('투페어: 높은 페어 → 낮은 페어 → 키커', () => {
    expect(compare('Ks Kh 2d 2c 3s', 'Qs Qh Jd Jc As')).toBe(1); // 높은 페어 K > Q
    expect(compare('Ks Kh 5d 5c 2s', 'Kd Kc 4h 4d As')).toBe(1); // 낮은 페어 5 > 4
    expect(compare('Ks Kh 5d 5c 3s', 'Kd Kc 5h 5s 2s')).toBe(1); // 키커 3 > 2
  });

  test('트리플: 트리플 랭크 → 키커', () => {
    expect(compare('8s 8h 8d 3c 2s', '7s 7h 7d Ac Ks')).toBe(1);
    expect(compare('8s 8h 8d Ac 2s', '8c 8h 8d Kc Qs')).toBe(1);
  });

  test('스트레이트: 가장 높은 카드로 비교', () => {
    expect(compare('Ts 9h 8d 7c 6s', '9s 8h 7d 6c 5s')).toBe(1);
  });

  test('플러시: 가장 높은 카드부터 차례로', () => {
    expect(compare('As 9s 7s 5s 3s', 'Kh Qh Jh 9h 7h')).toBe(1); // A > K
    expect(compare('As Ks 7s 5s 3s', 'Ah Kh 6h 5h 4h')).toBe(1); // 셋째 7 > 6
    expect(compare('As Ks 7s 5s 3s', 'Ah Kh 7h 5h 2h')).toBe(1); // 마지막 3 > 2
  });

  test('풀하우스: 트리플 랭크가 페어 랭크보다 우선', () => {
    expect(compare('3s 3h 3d 2c 2s', '2s 2h 2d Ac As')).toBe(1);
    expect(compare('3s 3h 3d Ac As', '3c 3h 3d Kc Ks')).toBe(1);
  });

  test('포카드: 포카드 랭크 → 키커', () => {
    expect(compare('3s 3h 3d 3c 2s', '2s 2h 2d 2c As')).toBe(1);
    expect(compare('3s 3h 3d 3c As', '3s 3h 3d 3c Ks')).toBe(1);
  });

  test('스트레이트 플러시: 가장 높은 카드로 비교', () => {
    expect(compare('As Ks Qs Js Ts', 'Kh Qh Jh Th 9h')).toBe(1);
  });
});

describe('compareHands: 무승부', () => {
  test.each([
    ['하이카드', 'As Jh 9d 6c 3s', 'Ah Jd 9c 6s 3h'],
    ['원페어', 'Ks Kh As 9d 4c', 'Kd Kc Ah 9s 4d'],
    ['투페어', 'Js Jh 5d 5c 2s', 'Jd Jc 5h 5s 2d'],
    ['플러시', 'Kd Td 7d 4d 2d', 'Ks Ts 7s 4s 2s'],
    ['풀하우스', 'Qs Qh Qd 7c 7s', 'Qs Qh Qc 7d 7h'],
  ])('문양만 다른 같은 구성은 무승부: %s', (_name, a, b) => {
    expect(compare(a, b)).toBe(0);
  });

  test('같은 하이카드의 스트레이트끼리는 무승부', () => {
    expect(compare('Ts 9h 8d 7c 6s', 'Th 9d 8c 7s 6h')).toBe(0);
    expect(compare('As 2h 3d 4c 5s', 'Ad 2c 3s 4h 5d')).toBe(0); // 휠끼리
  });

  test('같은 하이카드의 스트레이트 플러시끼리는 무승부', () => {
    expect(compare('9h 8h 7h 6h 5h', '9c 8c 7c 6c 5c')).toBe(0);
  });

  test('자기 자신과는 무승부', () => {
    expect(compareHands(hand('As Kh Qd Jc 9s'), hand('As Kh Qd Jc 9s'))).toBe(0);
  });
});

describe('evaluateHand: 입력 에러', () => {
  test('4장이면 에러', () => {
    expect(() => hand('As Kh Qd Jc')).toThrow();
  });

  test('6장이면 에러', () => {
    expect(() => hand('As Kh Qd Jc Ts 9s')).toThrow();
  });

  test('0장이면 에러', () => {
    expect(() => evaluateHand([])).toThrow();
  });

  test('중복 카드가 있으면 에러', () => {
    expect(() => hand('As As Qd Jc Ts')).toThrow();
  });
});
