import { cx } from '../cx';
import styles from './Timer.module.css';

interface TimerProps {
  remainingMs: number;
  totalMs: number;
}

const WARNING_MS = 10_000;

/** 남은 초와 진행 막대. 마지막 10초는 빨간색으로 강조 */
export function Timer({ remainingMs, totalMs }: TimerProps) {
  const seconds = Math.ceil(remainingMs / 1000);
  const ratio = totalMs > 0 ? remainingMs / totalMs : 0;
  const warning = remainingMs <= WARNING_MS;
  return (
    <div className={cx(styles.timer, warning && styles.warning)} role="timer">
      <span className={styles.seconds}>{seconds}초</span>
      <div className={styles.track}>
        <div className={styles.bar} style={{ transform: `scaleX(${ratio})` }} />
      </div>
    </div>
  );
}
