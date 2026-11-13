import { type AiConfig, computeBandSizes, enumerateSelections } from '@memory-poker/engine';

export interface RatioText {
  readonly hard: string;
  readonly easy: string;
}

/** 조합 수 (120) */
export const SELECTION_TOTAL = enumerateSelections().length;

/**
 * 입력 문자열을 AiConfig로 바꾸고 엔진의 computeBandSizes로 검증한다.
 * 규칙(비율 0 초과 1 미만, 구간마다 1개 이상)은 엔진에만 있고, 여기서는 에러 메시지만 받아 보여준다.
 */
export function parseAiConfig(text: RatioText): { config: AiConfig } | { error: string } {
  const config: AiConfig = { hardRatio: Number(text.hard), easyRatio: Number(text.easy) };
  try {
    computeBandSizes(SELECTION_TOTAL, config);
    return { config };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
