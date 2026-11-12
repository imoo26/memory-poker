import { type Difficulty, INITIAL_GAME_STATE, gameReducer } from '@memory-poker/engine';
import { useReducer } from 'react';
import { GameScreen } from './components/GameScreen';
import { StartScreen } from './components/StartScreen';
import { FIXED_SEED, IS_FAST_MODE, createSeed } from './config';
import styles from './App.module.css';

export default function App() {
  // 게임 규칙과 상태 전이는 전부 엔진의 gameReducer가 맡는다. 화면은 state를 그리고 action을 보낼 뿐이다
  const [state, dispatch] = useReducer(gameReducer, INITIAL_GAME_STATE);

  function startGame(difficulty: Difficulty) {
    dispatch({ type: 'START', difficulty, seed: createSeed() });
  }

  return (
    <main className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>기억 포커</h1>
        {IS_FAST_MODE && <span className={styles.dev}>개발용 빠른 모드</span>}
        {FIXED_SEED !== null && <span className={styles.dev}>시드 고정 {FIXED_SEED}</span>}
      </header>

      {state.phase === 'idle' ? (
        <StartScreen onStart={startGame} />
      ) : (
        <GameScreen state={state} dispatch={dispatch} onNewGame={startGame} />
      )}
    </main>
  );
}
