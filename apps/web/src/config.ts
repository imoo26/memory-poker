// 타이머 시간과 시드. 엔진은 시계와 난수를 직접 쓰지 않으므로 여기(엔진 밖)에서 만든다.
//
// 개발용 URL 옵션 (함께 쓸 수 있음: /?fast&seed=42)
// - ?fast    : 암기 5초, 선택 10초
// - ?seed=42 : 새 게임마다 같은 시드 → 같은 배치와 같은 컴퓨터 선택.
//              한 판 해서 컴퓨터가 고른 칸을 본 뒤, 새 게임에서 같은 칸을 고르면 무승부 → 재대결을 확인할 수 있다

import { MEMORIZE_MS, SELECT_MS } from '@memory-poker/engine';

const params = new URLSearchParams(window.location.search);

export const IS_FAST_MODE = params.has('fast');

export const TIMING = IS_FAST_MODE
  ? { memorizeMs: 5_000, selectMs: 10_000 }
  : { memorizeMs: MEMORIZE_MS, selectMs: SELECT_MS };

function parseSeed(value: string | null): number | null {
  if (value === null || value.trim() === '') {
    return null;
  }
  const seed = Number(value);
  return Number.isSafeInteger(seed) ? seed : null;
}

/** ?seed=로 고정한 시드. 없거나 정수가 아니면 null */
export const FIXED_SEED = parseSeed(params.get('seed'));

/** 새 게임마다 다른 시드. 같은 시드를 넣으면 엔진은 같은 게임을 재현한다 */
export function createSeed(): number {
  return FIXED_SEED ?? Date.now();
}
