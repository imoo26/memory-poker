import { describe, expect, test } from 'vitest';
import { BOARD_SIZE, COMMUNITY_CARD_COUNT } from '../src/index';

describe('engine setup', () => {
  test('보드는 4x4 = 16칸', () => {
    expect(BOARD_SIZE).toBe(16);
  });

  test('공유 카드는 3장', () => {
    expect(COMMUNITY_CARD_COUNT).toBe(3);
  });
});
