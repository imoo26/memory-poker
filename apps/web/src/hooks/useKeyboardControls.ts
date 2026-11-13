import type { GameAction, GameState } from '@memory-poker/engine';
import { useEffect } from 'react';
import { keyToAction } from '../keyboard';

/** 입력창에 타이핑 중일 때는 단축키를 쓰지 않는다 */
function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/** 선택 단계에서 A~P 키로 칸 선택, Enter로 제출 */
export function useKeyboardControls(state: GameState, dispatch: (action: GameAction) => void) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) {
        return;
      }
      const action = keyToAction(event, state);
      if (action === null) {
        return;
      }
      // 포커스된 칸 버튼에서 Enter를 누르면 브라우저 기본 동작(버튼 클릭)으로 칸이 토글되므로 막는다
      event.preventDefault();
      dispatch(action);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, dispatch]);
}
