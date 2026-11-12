// 카드 모델, 덱, 시드 기반 난수와 셔플.
// 엔진은 Math.random()을 직접 쓰지 않는다. 난수는 createRng(seed)로 만든 Rng를 주입받는다.

export const SUITS = ['s', 'h', 'd', 'c'] as const;
export type Suit = (typeof SUITS)[number]; // 's' | 'h' | 'd' | 'c'

export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;
export type Rank = (typeof RANKS)[number]; // 2 | 3 | … | 14  (11=J, 12=Q, 13=K, 14=A)

export interface Card {
  readonly rank: Rank;
  readonly suit: Suit;
}

/** 호출할 때마다 [0, 1) 범위의 난수를 반환하는 함수 */
export type Rng = () => number;

// Record<Rank, string>: Rank의 모든 값(2~14)을 키로 가져야 한다. 하나라도 빠지면 컴파일 에러.
const RANK_TO_CHAR: Record<Rank, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: 'T',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

/** { rank: 14, suit: 's' } → 'As' */
export function cardToString(card: Card): string {
  return RANK_TO_CHAR[card.rank] + card.suit;
}

/** 'As' → { rank: 14, suit: 's' }. 랭크는 대문자(T=10), 문양은 소문자. 그 외 입력은 에러. */
export function parseCard(text: string): Card {
  if (text.length !== 2) {
    throw new Error(`Invalid card: "${text}"`);
  }
  const rank = RANKS.find((r) => RANK_TO_CHAR[r] === text[0]);
  const suit = SUITS.find((s) => s === text[1]);
  if (rank === undefined || suit === undefined) {
    throw new Error(`Invalid card: "${text}"`);
  }
  return { rank, suit };
}

/** 'As Kd Th' → 카드 3장. 공백으로 구분한다. 중복 카드는 검사하지 않는다. */
export function parseCards(text: string): Card[] {
  const trimmed = text.trim();
  if (trimmed === '') {
    throw new Error('No cards to parse');
  }
  return trimmed.split(/\s+/).map((token) => parseCard(token));
}

/** 52장 덱. 순서: ♠2…♠A, ♥2…♥A, ♦2…♦A, ♣2…♣A (i번째 카드의 cardId가 i) */
export function createDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit })));
}

export function cardEquals(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

/** 0~51 정수 ID. 문양 순서 × 13 + (랭크 − 2) */
export function cardId(card: Card): number {
  return SUITS.indexOf(card.suit) * RANKS.length + (card.rank - 2);
}

/** 시드 기반 난수 생성기 (mulberry32). 같은 시드면 항상 같은 수열을 만든다. */
export function createRng(seed: number): Rng {
  if (!Number.isInteger(seed)) {
    throw new Error(`Seed must be an integer: ${seed}`);
  }
  let state = seed >>> 0; // 32비트 부호 없는 정수로 자른다

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // 2^32로 나눠 [0, 1)로
  };
}

/** [0, length) 범위의 정수 하나를 뽑는다. rng가 [0, 1)을 벗어나면 에러. */
function randomIndex(rng: Rng, length: number): number {
  const r = rng();
  if (!(r >= 0 && r < 1)) {
    throw new Error(`Rng must return a number in [0, 1): ${r}`);
  }
  return Math.floor(r * length);
}

/**
 * Fisher–Yates 셔플. 원본은 바꾸지 않고 새 배열을 반환한다.
 * 남은 원소(pool) 중 하나를 무작위로 뽑아 결과 뒤에 붙이는 것을 반복한다.
 */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const pool = [...items];
  const result: T[] = [];
  while (pool.length > 0) {
    const index = randomIndex(rng, pool.length);
    result.push(...pool.splice(index, 1));
  }
  return result;
}
