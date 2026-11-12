import type { Difficulty } from '@memory-poker/engine';
import { useState } from 'react';
import { cx } from '../cx';
import { DIFFICULTIES, DIFFICULTY_LABELS } from '../labels';
import styles from './StartScreen.module.css';

interface StartScreenProps {
  onStart: (difficulty: Difficulty) => void;
}

const DIFFICULTY_DESCRIPTIONS: Record<Difficulty, string> = {
  easy: '컴퓨터가 약한 조합을 고릅니다',
  normal: '컴퓨터가 중간 조합을 고릅니다',
  hard: '컴퓨터가 강한 조합을 고릅니다',
};

/** 시작 화면: 규칙 요약과 난이도 선택 */
export function StartScreen({ onStart }: StartScreenProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');

  return (
    <section className={styles.start}>
      <ol className={styles.rules}>
        <li>"시작"을 누르면 16장이 공개됩니다. 60초 동안 외우세요.</li>
        <li>카드가 뒤집히고 공유 카드 3장이 공개됩니다.</li>
        <li>30초 안에 기억을 떠올려 2칸을 고르세요.</li>
        <li>고른 2장 + 공유 카드 3장으로 컴퓨터와 족보를 겨룹니다.</li>
      </ol>

      <fieldset className={styles.difficulty}>
        <legend>난이도</legend>
        {DIFFICULTIES.map((d) => (
          <label key={d} className={cx(styles.option, d === difficulty && styles.checked)}>
            <input
              type="radio"
              name="difficulty"
              value={d}
              checked={d === difficulty}
              onChange={() => setDifficulty(d)}
            />
            <strong>{DIFFICULTY_LABELS[d]}</strong>
            <span>{DIFFICULTY_DESCRIPTIONS[d]}</span>
          </label>
        ))}
      </fieldset>

      <button type="button" className={styles.startButton} onClick={() => onStart(difficulty)}>
        새 게임
      </button>
    </section>
  );
}
