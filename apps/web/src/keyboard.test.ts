import { type GameState, INITIAL_GAME_STATE, gameReducer } from '@memory-poker/engine';
import { describe, expect, test } from 'vitest';
import { type KeyInput, keyToAction } from './keyboard';

function key(code: string, key: string, mods: Partial<KeyInput> = {}): KeyInput {
  return { code, key, ctrlKey: false, metaKey: false, altKey: false, repeat: false, ...mods };
}

const ready = gameReducer(INITIAL_GAME_STATE, { type: 'START', difficulty: 'normal', seed: 1 });
const memorize = gameReducer(ready, { type: 'BEGIN_MEMORIZE' });
const select: GameState = gameReducer(memorize, { type: 'MEMORIZE_TIME_UP' });

describe('keyToAction', () => {
  test.each([
    ['KeyA', 'a', 0],
    ['KeyA', 'A', 0],
    ['KeyF', 'f', 5],
    ['KeyP', 'p', 15],
  ])('선택 단계: %s → 칸 %i 토글', (code, k, index) => {
    expect(keyToAction(key(code, k), select)).toEqual({ type: 'TOGGLE_CELL', index });
  });

  test('한글 입력 상태(key가 ㅁ)여도 물리 키 A면 A칸', () => {
    expect(keyToAction(key('KeyA', 'ㅁ'), select)).toEqual({ type: 'TOGGLE_CELL', index: 0 });
  });

  test('Enter → 제출', () => {
    expect(keyToAction(key('Enter', 'Enter'), select)).toEqual({ type: 'SUBMIT' });
    expect(keyToAction(key('NumpadEnter', 'Enter'), select)).toEqual({ type: 'SUBMIT' });
  });

  test.each([
    ['Q 이후 문자', key('KeyQ', 'q')],
    ['숫자', key('Digit1', '1')],
    ['Ctrl+A', key('KeyA', 'a', { ctrlKey: true })],
    ['Cmd+A', key('KeyA', 'a', { metaKey: true })],
    ['Alt+A', key('KeyA', 'a', { altKey: true })],
    ['키 반복', key('KeyA', 'a', { repeat: true })],
  ])('무시: %s', (_name, input) => {
    expect(keyToAction(input, select)).toBeNull();
  });

  test.each([
    ['시작 전', INITIAL_GAME_STATE],
    ['준비', ready],
    ['암기', memorize],
  ])('선택 단계가 아니면(%s) 아무 키도 동작하지 않음', (_name, state) => {
    expect(keyToAction(key('KeyA', 'a'), state)).toBeNull();
    expect(keyToAction(key('Enter', 'Enter'), state)).toBeNull();
  });
});
