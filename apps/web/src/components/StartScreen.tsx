import type { AiConfig, Difficulty } from '@memory-poker/engine';
import { useState } from 'react';
import { cx } from '../cx';
import { DIFFICULTIES, DIFFICULTY_LABELS } from '../labels';
import { type Stats, resetStats, totalGames } from '../stats';
import { parseAiConfig } from '../aiConfig';
import { AiConfigPanel } from './AiConfigPanel';
import styles from './StartScreen.module.css';

interface StartScreenProps {
  onStart: (difficulty: Difficulty, aiConfig: AiConfig) => void;
  stats: Stats;
  initialAiConfig: AiConfig;
  /** ?dev일 때만 AI 비율 조정 패널 표시 */
  showDevPanel: boolean;
}

const DIFFICULTY_DESCRIPTIONS: Record<Difficulty, string> = {
  easy: '컴퓨터가 약한 조합을 고릅니다',
  normal: '컴퓨터가 중간 조합을 고릅니다',
  hard: '컴퓨터가 강한 조합을 고릅니다',
};

/** 시작 화면: 규칙 요약, 난이도 선택, 전적 */
export function StartScreen({ onStart, stats, initialAiConfig, showDevPanel }: StartScreenProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [ratioText, setRatioText] = useState({
    hard: String(initialAiConfig.hardRatio),
    easy: String(initialAiConfig.easyRatio),
  });
  // 패널이 없으면 받은 설정 그대로, 있으면 입력값을 검증한 결과 (잘못되면 에러 메시지)
  const parsed = showDevPanel ? parseAiConfig(ratioText) : { config: initialAiConfig };

  function handleResetStats() {
    if (window.confirm('전적을 모두 지울까요?')) {
      resetStats();
    }
  }

  return (
    <section className={styles.start}>
      <ol className={styles.rules}>
        <li>"시작"을 누르면 16장이 공개됩니다. 60초 동안 외우세요.</li>
        <li>카드가 뒤집히고 공유 카드 3장이 공개됩니다.</li>
        <li>30초 안에 기억을 떠올려 2칸을 고르세요. (마우스 또는 A~P 키, Enter로 제출)</li>
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
            <span className={styles.description}>{DIFFICULTY_DESCRIPTIONS[d]}</span>
            <span className={styles.record}>
              {stats[d].wins}승 {stats[d].losses}패
            </span>
          </label>
        ))}
      </fieldset>

      {showDevPanel && (
        <AiConfigPanel
          value={ratioText}
          onChange={setRatioText}
          error={'error' in parsed ? parsed.error : null}
        />
      )}

      <button
        type="button"
        className={styles.startButton}
        disabled={!('config' in parsed)}
        onClick={() => {
          if ('config' in parsed) {
            onStart(difficulty, parsed.config);
          }
        }}
      >
        새 게임
      </button>

      {totalGames(stats) > 0 && (
        <button type="button" className={styles.reset} onClick={handleResetStats}>
          전적 초기화
        </button>
      )}
    </section>
  );
}
