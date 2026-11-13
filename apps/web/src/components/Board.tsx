import { type Card, type CellIndex, indexToLabel } from '@memory-poker/engine';
import { cx } from '../cx';
import { cardName } from '../labels';
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
            aria-label={cellAriaLabel(index, card, showLabels, byPlayer, byAi)}
            onClick={() => onToggle(index)}
          >
            <PlayingCard card={card} />
            {showLabels && (
              <span className={styles.label} aria-hidden="true">
                {label}
              </span>
            )}
            {(byPlayer || byAi) && (
              <span className={styles.tags} aria-hidden="true">
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

/**
 * 스크린 리더용 칸 이름. 화면에 보이는 정보만 읽어 준다.
 * 예: 선택 단계 'A칸, 뒷면' / 결과 단계 'A칸, 하트 A, 내 선택' / 암기 단계 '1행 1열, 하트 A'
 */
function cellAriaLabel(
  index: CellIndex,
  card: Card | null,
  showLabels: boolean,
  byPlayer: boolean,
  byAi: boolean,
): string {
  const position = showLabels
    ? `${indexToLabel(index)}칸`
    : `${Math.floor(index / 4) + 1}행 ${(index % 4) + 1}열`;
  const parts = [position, card === null ? '뒷면' : cardName(card)];
  if (byPlayer) {
    parts.push('내 선택');
  }
  if (byAi) {
    parts.push('컴퓨터 선택');
  }
  return parts.join(', ');
}
