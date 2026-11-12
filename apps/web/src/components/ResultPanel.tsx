import type { Card, Difficulty, GameResult, HandValue, ResultState } from '@memory-poker/engine';
import { cx } from '../cx';
import { DIFFICULTIES, DIFFICULTY_LABELS, handName } from '../labels';
import { PlayingCard } from './PlayingCard';
import styles from './ResultPanel.module.css';

interface ResultPanelProps {
  state: ResultState;
  onToggleRevealAll: () => void;
  onRematch: () => void;
  onNewGame: (difficulty: Difficulty) => void;
}

function headline(result: GameResult): { text: string; tone: 'win' | 'lose' | 'draw' } {
  if (result.reason === 'timeout') {
    return { text: '시간 초과 패배', tone: 'lose' };
  }
  switch (result.winner) {
    case 'player':
      return { text: '승리!', tone: 'win' };
    case 'ai':
      return { text: '패배', tone: 'lose' };
    case 'draw':
      return { text: '무승부', tone: 'draw' };
  }
}

/** 결과: 양쪽 선택 카드와 족보, 승패, 전체 카드 보기, 재대결/새 게임 */
export function ResultPanel({ state, onToggleRevealAll, onRematch, onNewGame }: ResultPanelProps) {
  const { result } = state;
  const { text, tone } = headline(result);
  const isDraw = result.winner === 'draw';

  return (
    <section className={styles.panel} aria-live="polite">
      <h2 className={cx(styles.headline, styles[tone])}>{text}</h2>

      <div className={styles.rows}>
        <OutcomeRow
          who="나"
          whoClass={styles.player}
          cards={result.player.cards}
          hand={result.reason === 'hand' ? result.player.hand : null}
          note={result.reason === 'timeout' ? '시간 안에 2장을 고르지 못함' : undefined}
        />
        <OutcomeRow
          who={`컴퓨터 (${DIFFICULTY_LABELS[state.difficulty]})`}
          whoClass={styles.ai}
          cards={result.ai.cards}
          hand={result.ai.hand}
        />
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={onToggleRevealAll}>
          {state.revealAll ? '고른 카드만 보기' : '전체 카드 보기'}
        </button>

        {isDraw ? (
          <button type="button" className={styles.primary} onClick={onRematch}>
            재대결
          </button>
        ) : (
          <div className={styles.newGame}>
            <span>새 게임</span>
            {DIFFICULTIES.map((difficulty) => (
              <button
                key={difficulty}
                type="button"
                className={styles.primary}
                onClick={() => onNewGame(difficulty)}
              >
                {DIFFICULTY_LABELS[difficulty]}
              </button>
            ))}
          </div>
        )}
      </div>
      {isDraw && <p className={styles.hint}>무승부입니다. 새 카드로 처음부터 다시 겨룹니다.</p>}
    </section>
  );
}

interface OutcomeRowProps {
  who: string;
  whoClass: string | undefined;
  cards: readonly Card[];
  hand: HandValue | null;
  note?: string;
}

function OutcomeRow({ who, whoClass, cards, hand, note }: OutcomeRowProps) {
  return (
    <div className={styles.row}>
      <span className={cx(styles.who, whoClass)}>{who}</span>
      <div className={styles.cards}>
        {cards.map((card, i) => (
          <PlayingCard key={i} card={card} size="sm" />
        ))}
        {cards.length === 0 && <span className={styles.empty}>고른 카드 없음</span>}
      </div>
      <span className={styles.hand}>{hand !== null ? handName(hand) : note}</span>
    </div>
  );
}
