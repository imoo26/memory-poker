// 난이도별 전적(승/패)을 localStorage에 저장한다.
// 무승부는 재대결로 이어지므로 기록하지 않고, 승부가 난 게임만 1번 기록한다. 시간 초과 패배도 패배로 센다.
//
// React에서는 useSyncExternalStore로 구독한다. localStorage는 React 바깥의 "외부 저장소"이므로
// 값이 바뀌면 구독자에게 알리고, 컴포넌트는 getSnapshot()으로 최신 값을 읽는다.

import type { Difficulty } from '@memory-poker/engine';
import { DIFFICULTIES } from './labels';

export interface WinLoss {
  readonly wins: number;
  readonly losses: number;
}

export type Stats = Readonly<Record<Difficulty, WinLoss>>;

const STORAGE_KEY = 'memory-poker:stats:v1';

export function emptyStats(): Stats {
  return {
    easy: { wins: 0, losses: 0 },
    normal: { wins: 0, losses: 0 },
    hard: { wins: 0, losses: 0 },
  };
}

/** 승부 하나를 반영한 새 전적 (원본은 바꾸지 않음) */
export function addResult(stats: Stats, difficulty: Difficulty, won: boolean): Stats {
  const current = stats[difficulty];
  const next: WinLoss = won
    ? { ...current, wins: current.wins + 1 }
    : { ...current, losses: current.losses + 1 };
  return { ...stats, [difficulty]: next };
}

/** 저장된 JSON을 검증해서 읽는다. 형식이 이상하면 해당 값은 0으로 본다 */
export function parseStats(raw: string | null): Stats {
  if (raw === null) {
    return emptyStats();
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptyStats();
  }
  const stats = emptyStats();
  return {
    easy: readRecord(field(data, 'easy')) ?? stats.easy,
    normal: readRecord(field(data, 'normal')) ?? stats.normal,
    hard: readRecord(field(data, 'hard')) ?? stats.hard,
  };
}

/**
 * unknown 값에서 필드 하나를 꺼낸다. 객체가 아니면 undefined.
 * key가 문자열 변수라 `data[key]`는 타입 에러가 나므로 Reflect.get으로 읽고, 결과는 unknown으로 다룬다.
 */
function field(data: unknown, key: string): unknown {
  if (typeof data === 'object' && data !== null) {
    const value: unknown = Reflect.get(data, key);
    return value;
  }
  return undefined;
}

function readRecord(value: unknown): WinLoss | null {
  const wins = field(value, 'wins');
  const losses = field(value, 'losses');
  if (isCount(wins) && isCount(losses)) {
    return { wins, losses };
  }
  return null;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

// ---- 외부 저장소 (useSyncExternalStore용) ----

function load(): Stats {
  try {
    return parseStats(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return emptyStats(); // 사생활 보호 모드 등에서 localStorage 접근이 막힌 경우
  }
}

function save(stats: Stats): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // 저장 실패해도 게임은 계속 (이번 세션 동안은 메모리 값으로 표시)
  }
}

let snapshot: Stats = load();
const listeners = new Set<() => void>();

function update(next: Stats): void {
  snapshot = next;
  save(next);
  listeners.forEach((listener) => listener());
}

export function subscribeStats(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getStatsSnapshot(): Stats {
  return snapshot;
}

export function recordGame(difficulty: Difficulty, won: boolean): void {
  update(addResult(snapshot, difficulty, won));
}

export function resetStats(): void {
  update(emptyStats());
}

export function totalGames(stats: Stats): number {
  return DIFFICULTIES.reduce((sum, d) => sum + stats[d].wins + stats[d].losses, 0);
}
