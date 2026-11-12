// 4x4 보드 배치, 칸 라벨, 2칸 선택 평가.
// 칸 인덱스는 0부터 (A=0, …, P=15). 화면 표시 번호는 1부터 (A=1, …, P=16).

import { type Card, type Rng, createDeck, shuffle } from './card';
import { type HandValue, evaluateHand } from './evaluator';

export const BOARD_SIZE = 16;
export const COMMUNITY_CARD_COUNT = 3;
export const SELECTION_SIZE = 2;

/** 배치 순서: 왼쪽 위부터 행 우선 (1행 A B C D, 2행 E F G H, 3행 I J K L, 4행 M N O P) */
export const CELL_LABELS = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
] as const;
export type CellLabel = (typeof CELL_LABELS)[number]; // 'A' | 'B' | … | 'P'

/** 0~15 (A=0, P=15). 화면 번호는 index + 1 */
export type CellIndex = number;

export interface Deal {
  /** 기억 카드 16장. board[i]가 i번 칸 */
  readonly board: readonly Card[];
  /** 공유 카드 정확히 3장 (튜플 타입이라 길이가 타입에 고정된다) */
  readonly community: readonly [Card, Card, Card];
}

/** 한 플레이어가 고른 서로 다른 2칸 */
export type Selection = readonly [CellIndex, CellIndex];

/** 0~15 범위의 정수인지 */
export function isValidCellIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < BOARD_SIZE;
}

function assertCellIndex(index: number): void {
  if (!isValidCellIndex(index)) {
    throw new Error(`Invalid cell index: ${index}`);
  }
}

/** 0 → 'A', 15 → 'P'. 범위 밖이면 에러 */
export function indexToLabel(index: CellIndex): CellLabel {
  assertCellIndex(index);
  const label = CELL_LABELS[index];
  if (label === undefined) {
    throw new Error(`Invalid cell index: ${index}`);
  }
  return label;
}

/** 'A' → 0, 'P' → 15. 대문자 A~P 외에는 에러 */
export function labelToIndex(label: string): CellIndex {
  const index = CELL_LABELS.findIndex((l) => l === label);
  if (index === -1) {
    throw new Error(`Invalid cell label: "${label}"`);
  }
  return index;
}

/** 0 → 1, 15 → 16 (화면 표시용 번호). 범위 밖이면 에러 */
export function indexToNumber(index: CellIndex): number {
  assertCellIndex(index);
  return index + 1;
}

/** 셔플한 덱에서 앞 16장은 보드, 다음 3장은 공유 카드. 19장 모두 서로 다르다. */
export function dealRound(rng: Rng): Deal {
  const deck = shuffle(createDeck(), rng);
  const board = deck.slice(0, BOARD_SIZE);
  const [first, second, third] = deck.slice(BOARD_SIZE, BOARD_SIZE + COMMUNITY_CARD_COUNT);
  if (first === undefined || second === undefined || third === undefined) {
    throw new Error('Not enough cards to deal');
  }
  return { board, community: [first, second, third] };
}

/**
 * 0~15 범위의 서로 다른 2칸인지 확인하는 타입 가드.
 * true를 반환하면 이후 코드에서 `selection`은 `Selection` 타입으로 좁혀진다.
 */
export function isValidSelection(selection: readonly CellIndex[]): selection is Selection {
  if (selection.length !== SELECTION_SIZE) {
    return false;
  }
  const [a, b] = selection;
  return (
    a !== undefined && b !== undefined && isValidCellIndex(a) && isValidCellIndex(b) && a !== b
  );
}

/** 선택한 2칸의 카드 + 공유 카드 3장으로 족보를 판정한다. 잘못된 선택이면 에러. */
export function evaluateSelection(deal: Deal, selection: readonly CellIndex[]): HandValue {
  if (!isValidSelection(selection)) {
    throw new Error(`Invalid selection: [${selection.join(', ')}]`);
  }
  const picked = selection.map((index) => {
    const card = deal.board[index];
    if (card === undefined) {
      throw new Error(`No card at cell ${index}`);
    }
    return card;
  });
  return evaluateHand([...picked, ...deal.community]);
}
