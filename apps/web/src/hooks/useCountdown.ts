import { useEffect, useRef, useState } from 'react';

const TICK_MS = 100;

/**
 * 카운트다운 훅. `runKey`가 바뀔 때마다 그 시각부터 `durationMs`를 새로 잰다.
 * `runKey`가 null이면 멈춘다. 0이 되면 `onExpire`를 한 번 호출한다.
 *
 * - 남은 시간은 setInterval 횟수가 아니라 시작 시각(performance.now) 기준으로 계산한다.
 *   탭이 백그라운드로 가서 interval이 늦게 와도 시간이 밀리지 않는다.
 * - React StrictMode는 개발 중 effect를 "실행 → 정리 → 다시 실행"한다.
 *   정리(cleanup)에서 interval을 지우므로 타이머가 두 개 돌지 않는다.
 *
 * @returns 남은 시간(ms)
 */
export function useCountdown(
  durationMs: number,
  runKey: string | null,
  onExpire: () => void,
): number {
  const [tick, setTick] = useState<{ key: string; remainingMs: number } | null>(null);

  // 최신 onExpire를 ref에 보관해, onExpire가 바뀌어도 타이머를 다시 시작하지 않게 한다
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    if (runKey === null) {
      return;
    }
    const startedAt = performance.now();
    const id = window.setInterval(() => {
      const remainingMs = Math.max(0, durationMs - (performance.now() - startedAt));
      setTick({ key: runKey, remainingMs });
      if (remainingMs === 0) {
        window.clearInterval(id);
        onExpireRef.current();
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [runKey, durationMs]);

  if (runKey === null) {
    return 0;
  }
  // 새 runKey의 첫 tick이 오기 전에는 전체 시간을 보여준다
  return tick?.key === runKey ? tick.remainingMs : durationMs;
}
