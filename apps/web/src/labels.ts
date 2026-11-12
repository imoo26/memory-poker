// 화면 표시용 한글 이름. 규칙 판정은 엔진이 하고, 여기서는 이름만 붙인다.

import { type Card, type Difficulty, HandCategory, type HandValue } from '@memory-poker/engine';

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '하',
  normal: '중',
  hard: '상',
};

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

const CATEGORY_NAMES: Record<HandCategory, string> = {
  [HandCategory.HighCard]: '하이카드',
  [HandCategory.OnePair]: '원페어',
  [HandCategory.TwoPair]: '투페어',
  [HandCategory.ThreeOfAKind]: '트리플',
  [HandCategory.Straight]: '스트레이트',
  [HandCategory.Flush]: '플러시',
  [HandCategory.FullHouse]: '풀하우스',
  [HandCategory.FourOfAKind]: '포카드',
  [HandCategory.StraightFlush]: '스트레이트 플러시',
};

/** 족보 한글 이름. A 하이 스트레이트 플러시는 로열 스트레이트 플러시 */
export function handName(hand: HandValue): string {
  if (hand.category === HandCategory.StraightFlush && hand.ranks[0] === 14) {
    return '로열 스트레이트 플러시';
  }
  return CATEGORY_NAMES[hand.category];
}

const RANK_LABELS: Record<Card['rank'], string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

const SUIT_SYMBOLS: Record<Card['suit'], string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_NAMES: Record<Card['suit'], string> = {
  s: '스페이드',
  h: '하트',
  d: '다이아몬드',
  c: '클로버',
};

export function rankLabel(card: Card): string {
  return RANK_LABELS[card.rank];
}

export function suitSymbol(card: Card): string {
  return SUIT_SYMBOLS[card.suit];
}

export function isRed(card: Card): boolean {
  return card.suit === 'h' || card.suit === 'd';
}

/** 스크린 리더용: '하트 A' */
export function cardName(card: Card): string {
  return `${SUIT_NAMES[card.suit]} ${RANK_LABELS[card.rank]}`;
}
