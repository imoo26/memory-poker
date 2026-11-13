import {
  type AiConfig,
  DEFAULT_AI_CONFIG,
  type Difficulty,
  INITIAL_GAME_STATE,
  gameReducer,
} from '@memory-poker/engine';
import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import { GameScreen } from './components/GameScreen';
import { StartScreen } from './components/StartScreen';
import { FIXED_SEED, IS_DEV_PANEL, IS_FAST_MODE, createSeed } from './config';
import { getStatsSnapshot, recordGame, subscribeStats } from './stats';
import styles from './App.module.css';

export default function App() {
  // 게임 규칙과 상태 전이는 전부 엔진의 gameReducer가 맡는다. 화면은 state를 그리고 action을 보낼 뿐이다
  const [state, dispatch] = useReducer(gameReducer, INITIAL_GAME_STATE);
  // 마지막으로 쓴 AI 비율 (결과 화면에서 바로 새 게임을 시작할 때도 같은 설정 사용)
  const [aiConfig, setAiConfig] = useState<AiConfig>(DEFAULT_AI_CONFIG);
  // 새 게임마다 1씩 증가. 전적을 게임당 한 번만 기록하는 데 쓴다 (무승부 재대결은 같은 게임)
  const [gameId, setGameId] = useState(0);
  const stats = useSyncExternalStore(subscribeStats, getStatsSnapshot);

  // 승부가 나면 전적에 기록 (localStorage라는 외부 저장소와 동기화하는 effect)
  const recordedGameRef = useRef<number | null>(null);
  useEffect(() => {
    if (state.phase !== 'result' || state.result.winner === 'draw') {
      return;
    }
    if (recordedGameRef.current === gameId) {
      return; // 같은 게임을 두 번 기록하지 않는다 (리렌더, 전체 카드 보기 토글 등)
    }
    recordedGameRef.current = gameId;
    recordGame(state.difficulty, state.result.winner === 'player');
  }, [state, gameId]);

  function startGame(difficulty: Difficulty, config: AiConfig = aiConfig) {
    setAiConfig(config);
    setGameId((id) => id + 1);
    dispatch({ type: 'START', difficulty, seed: createSeed(), aiConfig: config });
  }

  return (
    <main className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>기억 포커</h1>
        {IS_FAST_MODE && <span className={styles.dev}>개발용 빠른 모드</span>}
        {FIXED_SEED !== null && <span className={styles.dev}>시드 고정 {FIXED_SEED}</span>}
      </header>

      {state.phase === 'idle' ? (
        <StartScreen
          onStart={startGame}
          stats={stats}
          initialAiConfig={aiConfig}
          showDevPanel={IS_DEV_PANEL}
        />
      ) : (
        <GameScreen
          state={state}
          dispatch={dispatch}
          onNewGame={(difficulty) => startGame(difficulty)}
          record={stats[state.difficulty]}
        />
      )}
    </main>
  );
}
