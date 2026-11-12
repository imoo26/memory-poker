import { describe, expect, test } from 'vitest';
import {
  RANKS,
  SUITS,
  cardEquals,
  cardId,
  cardToString,
  createDeck,
  createRng,
  parseCard,
  parseCards,
  shuffle,
} from '../src/card';

describe('상수', () => {
  test('문양 4개, 랭크 13개', () => {
    expect(SUITS).toEqual(['s', 'h', 'd', 'c']);
    expect(RANKS).toHaveLength(13);
    expect(RANKS[0]).toBe(2);
    expect(RANKS[12]).toBe(14);
  });
});

describe('createDeck', () => {
  test('52장', () => {
    expect(createDeck()).toHaveLength(52);
  });

  test('cardId 기준으로 중복 없음', () => {
    const ids = new Set(createDeck().map(cardId));
    expect(ids.size).toBe(52);
  });

  test('i번째 카드의 cardId는 i (0~51)', () => {
    const ids = createDeck().map(cardId);
    expect(ids).toEqual(Array.from({ length: 52 }, (_, i) => i));
  });

  test('첫 카드는 2s, 마지막 카드는 Ac', () => {
    const deck = createDeck();
    expect(deck[0]).toEqual({ rank: 2, suit: 's' });
    expect(deck[51]).toEqual({ rank: 14, suit: 'c' });
  });

  test('호출할 때마다 새 배열', () => {
    expect(createDeck()).not.toBe(createDeck());
  });
});

describe('cardId', () => {
  test('대표 카드의 ID', () => {
    expect(cardId({ rank: 2, suit: 's' })).toBe(0);
    expect(cardId({ rank: 14, suit: 's' })).toBe(12);
    expect(cardId({ rank: 2, suit: 'h' })).toBe(13);
    expect(cardId({ rank: 14, suit: 'c' })).toBe(51);
  });
});

describe('cardToString', () => {
  test('A, K, Q, J, T와 숫자 랭크', () => {
    expect(cardToString({ rank: 14, suit: 's' })).toBe('As');
    expect(cardToString({ rank: 13, suit: 'h' })).toBe('Kh');
    expect(cardToString({ rank: 12, suit: 'd' })).toBe('Qd');
    expect(cardToString({ rank: 11, suit: 'c' })).toBe('Jc');
    expect(cardToString({ rank: 10, suit: 's' })).toBe('Ts');
    expect(cardToString({ rank: 9, suit: 'h' })).toBe('9h');
    expect(cardToString({ rank: 2, suit: 'c' })).toBe('2c');
  });
});

describe('parseCard', () => {
  test('표준 표기를 카드로', () => {
    expect(parseCard('As')).toEqual({ rank: 14, suit: 's' });
    expect(parseCard('Td')).toEqual({ rank: 10, suit: 'd' });
    expect(parseCard('2c')).toEqual({ rank: 2, suit: 'c' });
  });

  test('52장 모두 cardToString과 왕복 일치', () => {
    for (const card of createDeck()) {
      const text = cardToString(card);
      expect(parseCard(text)).toEqual(card);
      expect(cardToString(parseCard(text))).toBe(text);
    }
  });

  test.each([
    ['1s', '없는 랭크'],
    ['Ax', '없는 문양'],
    ['10s', '10은 T로 써야 함'],
    ['', '빈 문자열'],
    ['as', '랭크 소문자'],
    ['AS', '문양 대문자'],
    ['ts', 'T 소문자'],
    ['A', '한 글자'],
    [' As', '앞 공백'],
    ['As ', '뒤 공백'],
  ])('잘못된 입력 %j → 에러 (%s)', (input) => {
    expect(() => parseCard(input)).toThrow();
  });
});

describe('parseCards', () => {
  test('공백으로 구분된 여러 장', () => {
    expect(parseCards('As Kd Th')).toEqual([
      { rank: 14, suit: 's' },
      { rank: 13, suit: 'd' },
      { rank: 10, suit: 'h' },
    ]);
  });

  test('공백 여러 칸과 앞뒤 공백 허용', () => {
    expect(parseCards('  As   Kd\tTh  ')).toEqual(parseCards('As Kd Th'));
  });

  test('한 장도 가능', () => {
    expect(parseCards('Qc')).toEqual([{ rank: 12, suit: 'c' }]);
  });

  test('중복 카드는 검사하지 않음', () => {
    expect(parseCards('As As')).toHaveLength(2);
  });

  test.each(['', '   '])('빈 입력 %j → 에러', (input) => {
    expect(() => parseCards(input)).toThrow();
  });

  test('잘못된 카드가 하나라도 있으면 에러', () => {
    expect(() => parseCards('As Kd 1h')).toThrow();
  });
});

describe('cardEquals', () => {
  test('같은 랭크와 문양이면 같음 (서로 다른 객체여도)', () => {
    expect(cardEquals(parseCard('As'), parseCard('As'))).toBe(true);
  });

  test('랭크만 다르면 다름', () => {
    expect(cardEquals(parseCard('As'), parseCard('Ks'))).toBe(false);
  });

  test('문양만 다르면 다름', () => {
    expect(cardEquals(parseCard('As'), parseCard('Ah'))).toBe(false);
  });
});

/** rng를 count번 호출한 결과 */
function take(rng: () => number, count: number): number[] {
  return Array.from({ length: count }, () => rng());
}

describe('createRng', () => {
  test('같은 시드 → 같은 수열', () => {
    expect(take(createRng(42), 10)).toEqual(take(createRng(42), 10));
  });

  test('다른 시드 → 다른 수열', () => {
    expect(take(createRng(1), 10)).not.toEqual(take(createRng(2), 10));
  });

  test('모든 값이 [0, 1) 범위', () => {
    for (const value of take(createRng(7), 1000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  test('Date.now() 같은 큰 정수와 음수 시드도 사용 가능', () => {
    expect(take(createRng(1_731_380_000_000), 5)).toEqual(take(createRng(1_731_380_000_000), 5));
    expect(take(createRng(-1), 5)).toEqual(take(createRng(-1), 5));
  });

  test.each([1.5, Number.NaN, Number.POSITIVE_INFINITY])('정수가 아닌 시드 %s → 에러', (seed) => {
    expect(() => createRng(seed)).toThrow();
  });
});

describe('shuffle', () => {
  test('같은 시드 → 같은 결과', () => {
    const deck = createDeck();
    expect(shuffle(deck, createRng(123))).toEqual(shuffle(deck, createRng(123)));
  });

  test('다른 시드 → 다른 결과', () => {
    const deck = createDeck();
    expect(shuffle(deck, createRng(1))).not.toEqual(shuffle(deck, createRng(2)));
  });

  test('원소 집합은 그대로', () => {
    const deck = createDeck();
    const shuffled = shuffle(deck, createRng(99));
    expect(shuffled).toHaveLength(52);
    expect(shuffled.map(cardId).sort((a, b) => a - b)).toEqual(deck.map(cardId));
  });

  test('원본 배열은 바뀌지 않고 새 배열을 반환', () => {
    const deck = createDeck();
    const before = deck.map(cardToString);
    const shuffled = shuffle(deck, createRng(5));
    expect(deck.map(cardToString)).toEqual(before);
    expect(shuffled).not.toBe(deck);
  });

  test('실제로 순서가 바뀜', () => {
    const deck = createDeck();
    expect(shuffle(deck, createRng(5))).not.toEqual(deck);
  });

  test('빈 배열과 1개짜리 배열', () => {
    expect(shuffle([], createRng(1))).toEqual([]);
    expect(shuffle(['x'], createRng(1))).toEqual(['x']);
  });

  test('카드가 아닌 배열도 섞을 수 있음 (제네릭)', () => {
    const shuffled = shuffle([1, 2, 3, 4, 5], createRng(3));
    expect([...shuffled].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  test('첫 자리에 오는 원소가 고르게 분포 (4000번, 각 1000번 ± 15%)', () => {
    const rng = createRng(2024);
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) {
      const first = shuffle([0, 1, 2, 3], rng)[0];
      if (first !== undefined) {
        counts[first] = (counts[first] ?? 0) + 1;
      }
    }
    for (const count of counts) {
      expect(count).toBeGreaterThan(850);
      expect(count).toBeLessThan(1150);
    }
  });

  test('rng가 [0, 1)을 벗어난 값을 주면 에러', () => {
    expect(() => shuffle([1, 2, 3], () => 1)).toThrow();
    expect(() => shuffle([1, 2, 3], () => -0.1)).toThrow();
  });
});
