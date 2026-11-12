// 족보 판정과 비교. 이 게임은 항상 정확히 5장(선택 2장 + 공유 3장)으로 판정하므로
// 7장 중 베스트 5장을 고르는 로직은 없다.

import { type Card, type Rank, cardId, cardToString } from './card';

/**
 * 족보 등급. 숫자가 클수록 강하다.
 * Java enum 대신 `as const` 객체를 쓰고, 같은 이름의 타입(아래)을 함께 선언한다.
 * TypeScript는 값과 타입의 이름 공간이 분리되어 있어 같은 이름을 둘 다 쓸 수 있다.
 */
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
export type HandCategory = (typeof HandCategory)[keyof typeof HandCategory]; // 0 | 1 | … | 8

export interface HandValue {
  /** 등급 */
  readonly category: HandCategory;
  /** 같은 등급끼리 비교할 랭크. 중요한 것부터 순서대로 (사전순 비교) */
  readonly ranks: readonly Rank[];
}

export const HAND_SIZE = 5;

/**
 * 5장의 족보를 판정한다. 5장이 아니거나 중복 카드가 있으면 에러.
 *
 * `ranks` 예시
 * - 원페어 K, 키커 A-9-4 → [13, 14, 9, 4]
 * - 투페어 J와 5, 키커 2 → [11, 5, 2]
 * - 풀하우스 Q 트리플 + 7 페어 → [12, 7]
 * - 휠 스트레이트 A-2-3-4-5 → [5]
 */
export function evaluateHand(cards: readonly Card[]): HandValue {
  if (cards.length !== HAND_SIZE) {
    throw new Error(`A hand must have exactly ${HAND_SIZE} cards: got ${cards.length}`);
  }
  if (new Set(cards.map(cardId)).size !== cards.length) {
    throw new Error(`Duplicate cards in hand: ${cards.map(cardToString).join(' ')}`);
  }

  // 1. 랭크별 개수를 세고 (개수 내림차순, 랭크 내림차순)으로 정렬
  const counts = new Map<Rank, number>();
  for (const card of cards) {
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  }
  const groups = [...counts]
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  // 그룹 정렬 순서가 곧 비교용 랭크 순서가 된다 (스트레이트 계열만 예외)
  const groupRanks = groups.map((g) => g.rank);
  // 개수 패턴: '41' 포카드, '32' 풀하우스, '311' 트리플, '221' 투페어, '2111' 원페어, '11111' 모두 다름
  const shape = groups.map((g) => g.count).join('');

  // 2. 플러시, 스트레이트 여부
  const firstSuit = cards[0]?.suit;
  const isFlush = cards.every((card) => card.suit === firstSuit);
  const straightHigh = findStraightHigh(groupRanks);

  // 3. 등급 결정 (강한 등급부터 확인)
  if (straightHigh !== undefined && isFlush) {
    return { category: HandCategory.StraightFlush, ranks: [straightHigh] };
  }
  if (shape === '41') {
    return { category: HandCategory.FourOfAKind, ranks: groupRanks };
  }
  if (shape === '32') {
    return { category: HandCategory.FullHouse, ranks: groupRanks };
  }
  if (isFlush) {
    return { category: HandCategory.Flush, ranks: groupRanks };
  }
  if (straightHigh !== undefined) {
    return { category: HandCategory.Straight, ranks: [straightHigh] };
  }
  if (shape === '311') {
    return { category: HandCategory.ThreeOfAKind, ranks: groupRanks };
  }
  if (shape === '221') {
    return { category: HandCategory.TwoPair, ranks: groupRanks };
  }
  if (shape === '2111') {
    return { category: HandCategory.OnePair, ranks: groupRanks };
  }
  return { category: HandCategory.HighCard, ranks: groupRanks };
}

/**
 * 내림차순으로 정렬된 서로 다른 랭크 5개가 스트레이트면 가장 높은 카드를 반환한다.
 * A-2-3-4-5(휠)는 5 하이. Q-K-A-2-3 같은 랩어라운드는 스트레이트가 아니다.
 */
function findStraightHigh(ranksDesc: readonly Rank[]): Rank | undefined {
  if (ranksDesc.length !== HAND_SIZE) {
    return undefined; // 같은 랭크가 있으면 스트레이트일 수 없다
  }
  const [high, second, , , low] = ranksDesc;
  if (high === undefined || low === undefined) {
    return undefined;
  }
  if (high - low === 4) {
    return high;
  }
  // 서로 다른 5개 중 가장 높은 것이 A, 그다음이 5라면 나머지는 반드시 4-3-2
  if (high === 14 && second === 5) {
    return 5;
  }
  return undefined;
}

/**
 * 두 족보를 비교한다. 양수: a 승, 음수: b 승, 0: 무승부.
 * 등급을 먼저 비교하고, 같으면 `ranks`를 앞에서부터 차례로 비교한다. 문양 간 우열은 없다.
 */
export function compareHands(a: HandValue, b: HandValue): number {
  if (a.category !== b.category) {
    return a.category - b.category;
  }
  const length = Math.max(a.ranks.length, b.ranks.length);
  for (let i = 0; i < length; i++) {
    const diff = (a.ranks[i] ?? 0) - (b.ranks[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}
