import { computeBandSizes } from '@memory-poker/engine';
import { type RatioText, SELECTION_TOTAL as TOTAL, parseAiConfig } from '../aiConfig';
import styles from './AiConfigPanel.module.css';

interface AiConfigPanelProps {
  value: RatioText;
  onChange: (value: RatioText) => void;
  error: string | null;
}

/** 개발용(?dev): 상/하 구간 비율 조정. 중 구간은 나머지 */
export function AiConfigPanel({ value, onChange, error }: AiConfigPanelProps) {
  const parsed = parseAiConfig(value);
  const sizes = 'config' in parsed ? computeBandSizes(TOTAL, parsed.config) : null;

  return (
    <fieldset className={styles.panel}>
      <legend>개발용: AI 비율</legend>
      <label>
        상 비율
        <input
          type="number"
          step="0.01"
          min="0"
          max="1"
          value={value.hard}
          onChange={(e) => onChange({ ...value, hard: e.target.value })}
        />
      </label>
      <label>
        하 비율
        <input
          type="number"
          step="0.01"
          min="0"
          max="1"
          value={value.easy}
          onChange={(e) => onChange({ ...value, easy: e.target.value })}
        />
      </label>
      <p className={error === null ? styles.sizes : styles.error} role="status">
        {sizes !== null
          ? `구간 크기 (${TOTAL}개 중): 상 ${sizes.hard} / 중 ${sizes.normal} / 하 ${sizes.easy}`
          : `설정 에러: ${error ?? ''}`}
      </p>
    </fieldset>
  );
}
