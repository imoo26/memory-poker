import { type Card, type CellIndex, indexToLabel } from '@memory-poker/engine';
import { cx } from '../cx';
import { PlayingCard } from './PlayingCard';
import styles from './Board.module.css';

interface BoardProps {
  /** visibleBoard(state)의 결과. null인 칸은 뒷면 */
  cards: readonly (Card | null)[];
  /** A~P 라벨 표시 여부 (선택·결과 단계) */
  showLabels: boolean;
  /** 칸 클릭 가능 여부 (선택 단계) */
  selectable: boolean;
  /** 플레이어가 고른 칸 */
  playerCells: readonly CellIndex[];
  /** 컴퓨터가 고른 칸 (결과 단계에서만 넘긴다) */
  aiCells: readonly CellIndex[];
  onToggle: (index: CellIndex) => void;
}

/** 4x4 보드. 선택 강조는 뒷면 위 테두리로만 표시하고 앞면은 보여주지 않는다. */
export function Board({
  cards,
  showLabels,
  selectable,
  playerCells,
  aiCells,
  onToggle,
}: BoardProps) {
  return (
    <div className={styles.board}>
      {cards.map((card, index) => {
        const label = indexToLabel(index);
        const byPlayer = playerCells.includes(index);
        const byAi = aiCells.includes(index);
        return (
          <button
            key={index}
            type="button"
            className={cx(
              styles.cell,
              selectable && styles.selectable,
              byPlayer && styles.player,
              byAi && styles.ai,
            )}
            disabled={!selectable}
            aria-pressed={selectable ? byPlayer : undefined}
            aria-label={showLabels ? `${label}칸` : undefined}
            onClick={() => onToggle(index)}
          >
            <PlayingCard card={card} />
            {showLabels && <span className={styles.label}>{label}</span>}
            {(byPlayer || byAi) && (
              <span className={styles.tags}>
                {byPlayer && <span className={cx(styles.tag, styles.tagPlayer)}>나</span>}
                {byAi && <span className={cx(styles.tag, styles.tagAi)}>AI</span>}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
