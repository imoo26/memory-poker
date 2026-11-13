// 키보드 입력 → 엔진 액션 변환 (순수 함수라 테스트하기 쉽다)

import { type GameAction, type GameState, labelToIndex } from '@memory-poker/engine';

/** KeyboardEvent에서 필요한 부분만. 테스트에서는 이 모양의 객체를 직접 만들어 넘긴다 */
export interface KeyInput {
  readonly code: string;
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly repeat: boolean;
}

/**
 * 선택 단계에서만 동작한다.
 * - A~P: 해당 칸 선택/해제
 * - Enter: 제출 (2칸 미만이면 엔진이 무시)
 *
 * 문자는 `key`가 아니라 `code`(물리 키 위치)로 판단한다. 한글 입력 상태에서 A 키를 누르면
 * key는 'ㅁ'이 되지만 code는 항상 'KeyA'이기 때문이다.
 */
export function keyToAction(input: KeyInput, state: GameState): GameAction | null {
  if (state.phase !== 'select' || input.ctrlKey || input.metaKey || input.altKey || input.repeat) {
    return null;
  }
  if (input.key === 'Enter') {
    return { type: 'SUBMIT' };
  }
  const match = /^Key([A-P])$/.exec(input.code);
  const letter = match?.[1];
  if (letter === undefined) {
    return null;
  }
  return { type: 'TOGGLE_CELL', index: labelToIndex(letter) };
}
