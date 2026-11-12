import { type Card, cardId } from '@memory-poker/engine';
import { type TransitionEvent, useState } from 'react';
import { cx } from '../cx';
import { cardName, isRed, rankLabel, suitSymbol } from '../labels';
import styles from './PlayingCard.module.css';

interface PlayingCardProps {
  /** null이면 뒷면 */
  card: Card | null;
  size?: 'md' | 'sm';
}

/**
 * 트럼프 카드 한 장. card가 null ↔ Card로 바뀌면 3D로 뒤집힌다.
 *
 * 앞면 → 뒷면으로 뒤집히는 동안에도 앞면 그림이 필요하므로 마지막으로 받은 카드를 기억해 둔다.
 * 뒤집기 애니메이션이 끝나면 기억한 카드를 지워서, 뒷면 상태의 DOM에는 카드 정보가 남지 않게 한다.
 */
export function PlayingCard({ card, size = 'md' }: PlayingCardProps) {
  const [lastCard, setLastCard] = useState<Card | null>(card);

  // props가 바뀐 것을 렌더 중에 반영하는 React 권장 패턴 (effect 없이 state 조정)
  if (card !== null && (lastCard === null || cardId(card) !== cardId(lastCard))) {
    setLastCard(card);
  }

  const faceUp = card !== null;
  const front = card ?? lastCard;

  function handleTransitionEnd(event: TransitionEvent<HTMLDivElement>) {
    if (event.propertyName === 'transform' && card === null) {
      setLastCard(null);
    }
  }

  return (
    <div
      className={cx(styles.card, size === 'sm' && styles.small, faceUp && styles.faceUp)}
      role="img"
      aria-label={card === null ? '뒷면 카드' : cardName(card)}
    >
      <div className={styles.inner} onTransitionEnd={handleTransitionEnd}>
        <div className={cx(styles.face, styles.back)} />
        <div
          className={cx(styles.face, styles.front, front !== null && isRed(front) && styles.red)}
        >
          {front !== null && (
            <>
              <span className={styles.corner}>
                {rankLabel(front)}
                <br />
                {suitSymbol(front)}
              </span>
              <span className={styles.center}>{suitSymbol(front)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
