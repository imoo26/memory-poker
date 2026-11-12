import type { Card } from '@memory-poker/engine';
import { PlayingCard } from './PlayingCard';
import styles from './CommunityCards.module.css';

interface CommunityCardsProps {
  /** visibleCommunity(state)의 결과. null이면 3장 모두 뒷면 */
  cards: readonly [Card, Card, Card] | null;
}

/** 공유 카드 3장. 암기 카드가 뒤집힌 다음(선택 단계부터) 앞면으로 뒤집힌다. */
export function CommunityCards({ cards }: CommunityCardsProps) {
  const slots = [0, 1, 2] as const;
  return (
    <section className={styles.community} aria-label="공유 카드">
      <h2 className={styles.title}>공유 카드</h2>
      <div className={styles.cards}>
        {slots.map((slot) => (
          <PlayingCard key={slot} card={cards === null ? null : cards[slot]} />
        ))}
      </div>
    </section>
  );
}
