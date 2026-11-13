import { describe, expect, test } from 'vitest';
import { addResult, emptyStats, parseStats, totalGames } from './stats';

describe('addResult', () => {
  test('승리는 wins, 패배는 losses를 1 증가', () => {
    const afterWin = addResult(emptyStats(), 'hard', true);
    expect(afterWin.hard).toEqual({ wins: 1, losses: 0 });
    const afterLoss = addResult(afterWin, 'hard', false);
    expect(afterLoss.hard).toEqual({ wins: 1, losses: 1 });
    expect(afterLoss.easy).toEqual({ wins: 0, losses: 0 });
    expect(totalGames(afterLoss)).toBe(2);
  });

  test('원본은 바뀌지 않음', () => {
    const stats = emptyStats();
    addResult(stats, 'easy', true);
    expect(stats).toEqual(emptyStats());
  });
});

describe('parseStats', () => {
  test('저장된 값이 없으면 0', () => {
    expect(parseStats(null)).toEqual(emptyStats());
  });

  test('저장 → 읽기 왕복', () => {
    const stats = addResult(addResult(emptyStats(), 'normal', true), 'easy', false);
    expect(parseStats(JSON.stringify(stats))).toEqual(stats);
  });

  test.each(['not json', '[]', '42', 'null', '{"easy": "x"}'])('잘못된 형식 %s → 0', (raw) => {
    expect(parseStats(raw)).toEqual(emptyStats());
  });

  test('일부 난이도만 잘못되면 그 난이도만 0', () => {
    const raw = JSON.stringify({
      easy: { wins: 3, losses: 1 },
      normal: { wins: -1, losses: 2 },
      hard: { wins: 1.5, losses: 0 },
    });
    expect(parseStats(raw)).toEqual({
      easy: { wins: 3, losses: 1 },
      normal: { wins: 0, losses: 0 },
      hard: { wins: 0, losses: 0 },
    });
  });
});
