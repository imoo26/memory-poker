import {
  type Difficulty,
  type GameAction,
  type GameState,
  type IdleState,
  visibleBoard,
  visibleCommunity,
} from '@memory-poker/engine';
import { TIMING } from '../config';
import { useCountdown } from '../hooks/useCountdown';
import { useKeyboardControls } from '../hooks/useKeyboardControls';
import { DIFFICULTY_LABELS, resultHeadline } from '../labels';
import type { WinLoss } from '../stats';
import { Board } from './Board';
import { CommunityCards } from './CommunityCards';
import { ResultPanel } from './ResultPanel';
import { Timer } from './Timer';
import styles from './GameScreen.module.css';

interface GameScreenProps {
  /** 시작 화면(idle)을 제외한 상태. Exclude는 유니온에서 해당 타입을 뺀다 */
  state: Exclude<GameState, IdleState>;
  dispatch: (action: GameAction) => void;
  onNewGame: (difficulty: Difficulty) => void;
  /** 현재 난이도의 전적 (결과 패널에 표시) */
  record: WinLoss;
}

/** 게임 화면: 준비 → 암기 → 선택 → 결과. 카드는 엔진의 visibleBoard/visibleCommunity 결과만 그린다. */
export function GameScreen({ state, dispatch, onNewGame, record }: GameScreenProps) {
  const { phase } = state;
  useKeyboardControls(state, dispatch);
  const timed = phase === 'memorize' || phase === 'select';
  const totalMs = phase === 'memorize' ? TIMING.memorizeMs : TIMING.selectMs;

  // 단계가 바뀔 때마다 runKey가 바뀌어 타이머가 새로 시작된다
  const runKey = timed ? `${state.seed}:${state.round}:${phase}` : null;
  const remainingMs = useCountdown(totalMs, runKey, () => {
    if (phase === 'memorize') {
      dispatch({ type: 'MEMORIZE_TIME_UP' });
    } else if (phase === 'select') {
      dispatch({ type: 'SELECT_TIME_UP' });
    }
  });

  const playerCells = phase === 'select' || phase === 'result' ? state.playerSelection : [];
  const aiCells = phase === 'result' ? state.aiSelection : [];

  return (
    <section className={styles.game}>
      <div className={styles.meta}>
        <span>난이도 {DIFFICULTY_LABELS[state.difficulty]}</span>
        <span>{state.round}판</span>
      </div>

      <div className={styles.status}>
        <p className={styles.message} aria-live="polite">
          {phaseMessage(state)}
        </p>
        {phase === 'select' && (
          <p className={styles.hint}>키보드: A~P 키로 칸 선택, Enter로 제출</p>
        )}
        {timed && <Timer remainingMs={remainingMs} totalMs={totalMs} />}
      </div>

      <div className={styles.table}>
        <Board
          cards={visibleBoard(state)}
          showLabels={phase === 'select' || phase === 'result'}
          selectable={phase === 'select'}
          playerCells={playerCells}
          aiCells={aiCells}
          onToggle={(index) => dispatch({ type: 'TOGGLE_CELL', index })}
        />

        <div className={styles.side}>
          <CommunityCards cards={visibleCommunity(state)} />

          {phase === 'ready' && (
            <button
              type="button"
              className={styles.primary}
              onClick={() => dispatch({ type: 'BEGIN_MEMORIZE' })}
            >
              시작
            </button>
          )}

          {phase === 'select' && (
            <button
              type="button"
              className={styles.primary}
              disabled={state.playerSelection.length !== 2}
              onClick={() => dispatch({ type: 'SUBMIT' })}
            >
              제출 ({state.playerSelection.length}/2)
            </button>
          )}

          {phase === 'result' && (
            <ResultPanel
              state={state}
              onToggleRevealAll={() => dispatch({ type: 'TOGGLE_REVEAL_ALL' })}
              onRematch={() => dispatch({ type: 'REMATCH' })}
              onNewGame={onNewGame}
              record={record}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function phaseMessage(state: Exclude<GameState, IdleState>): string {
  const memorizeSeconds = TIMING.memorizeMs / 1000;
  switch (state.phase) {
    case 'ready':
      return state.round === 1
        ? `준비되면 "시작"을 누르세요. 16장이 공개되고 ${memorizeSeconds}초 동안 외울 수 있습니다.`
        : `재대결 ${state.round}판입니다. 새 카드로 진행합니다. 준비되면 "시작"을 누르세요.`;
    case 'memorize':
      return '카드 위치를 외우세요.';
    case 'select':
      return '기억을 떠올려 2칸을 고르고 제출하세요. 다시 누르면 선택이 해제됩니다.';
    case 'result':
      return `결과: ${resultHeadline(state.result).text}`;
  }
}
