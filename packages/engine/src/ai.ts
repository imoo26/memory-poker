// 컴퓨터 AI. 카드를 모두 아는 상태에서 120개 조합을 강도순으로 정렬하고,
// 난이도에 해당하는 구간에서 무작위로 하나를 고른다. (GAME_RULES 5절)

import { BOARD_SIZE, type Deal, type Selection, evaluateSelection } from './board';
import { type Rng, randomIndex } from './card';
import { type HandValue, compareHands } from './evaluator';

export type Difficulty = 'easy' | 'normal' | 'hard'; // 하 / 중 / 상

export interface AiConfig {
  /** 상 구간 비율 (0 초과 1 미만) */
  readonly hardRatio: number;
  /** 하 구간 비율 (0 초과 1 미만) */
  readonly easyRatio: number;
}

export const DEFAULT_AI_CONFIG: AiConfig = { hardRatio: 0.3, easyRatio: 0.3 };

/** 난이도별 구간 크기. 세 값의 합은 전체 조합 수와 같다. */
export type BandSizes = Readonly<Record<Difficulty, number>>;

/** 조합 하나와 그 족보 */
export interface RankedSelection {
  readonly selection: Selection;
  readonly hand: HandValue;
}

/** 16칸에서 2칸을 고르는 120개 조합. (0,1), (0,2), …, (0,15), (1,2), …, (14,15) 순서 */
export function enumerateSelections(): Selection[] {
  const selections: Selection[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    for (let j = i + 1; j < BOARD_SIZE; j++) {
      selections.push([i, j]);
    }
  }
  return selections;
}

/**
 * 120개 조합을 강도 내림차순으로 정렬한다.
 * Array.prototype.sort는 안정 정렬이므로(ES2019부터 표준) 강도가 같으면 enumerateSelections 순서가 유지된다.
 */
export function rankSelections(deal: Deal): RankedSelection[] {
  return enumerateSelections()
    .map((selection) => ({ selection, hand: evaluateSelection(deal, selection) }))
    .sort((a, b) => compareHands(b.hand, a.hand));
}

/**
 * 구간 크기 계산. 상 = round(total × hardRatio), 하 = round(total × easyRatio), 중 = 나머지.
 * 비율이 0 초과 1 미만이 아니거나, 반올림 후 1개 미만인 구간이 있으면 설정 에러.
 */
export function computeBandSizes(total: number, config: AiConfig): BandSizes {
  if (!Number.isInteger(total) || total <= 0) {
    throw new Error(`Total must be a positive integer: ${total}`);
  }
  assertRatio('hardRatio', config.hardRatio);
  assertRatio('easyRatio', config.easyRatio);

  const hard = Math.round(total * config.hardRatio);
  const easy = Math.round(total * config.easyRatio);
  const normal = total - hard - easy;
  if (hard < 1 || normal < 1 || easy < 1) {
    throw new Error(
      `Every band must have at least 1 selection: hard ${hard}, normal ${normal}, easy ${easy}`,
    );
  }
  return { hard, normal, easy };
}

function assertRatio(name: string, ratio: number): void {
  // NaN도 걸러지도록 부정형으로 검사한다 (NaN과의 비교는 항상 false)
  if (!(ratio > 0 && ratio < 1)) {
    throw new Error(`${name} must be greater than 0 and less than 1: ${ratio}`);
  }
}

/** 강도순으로 정렬한 120개를 앞에서부터 상 → 중 → 하 구간으로 자른다. */
export function getSelectionBands(
  deal: Deal,
  config: AiConfig = DEFAULT_AI_CONFIG,
): Readonly<Record<Difficulty, readonly RankedSelection[]>> {
  const ranked = rankSelections(deal);
  const sizes = computeBandSizes(ranked.length, config);
  return {
    hard: ranked.slice(0, sizes.hard),
    normal: ranked.slice(sizes.hard, sizes.hard + sizes.normal),
    easy: ranked.slice(sizes.hard + sizes.normal),
  };
}

/** 난이도에 해당하는 구간에서 무작위로 1개를 고른다. config를 생략하면 기본 비율(30/40/30). */
export function chooseAiSelection(
  deal: Deal,
  difficulty: Difficulty,
  rng: Rng,
  config: AiConfig = DEFAULT_AI_CONFIG,
): Selection {
  const band = getSelectionBands(deal, config)[difficulty];
  return pickRandom(band, rng).selection;
}

/** 배열에서 무작위로 하나. 제네릭 함수라 어떤 원소 타입이든 그대로 돌려준다. */
function pickRandom<T>(items: readonly T[], rng: Rng): T {
  const item = items[randomIndex(rng, items.length)];
  if (item === undefined) {
    throw new Error('Cannot pick from an empty array');
  }
  return item;
}
