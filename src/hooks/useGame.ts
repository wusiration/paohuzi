import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState } from '../core/types';
import { createInitialState, discardCard, executeAction, startNewGame, startNextRound } from '../core/stateMachine';
import { chooseDiscard, decideAction, isAIPlayer } from '../core/ai';

const AI_DELAY = 800;

export function useGame() {
  const [state, setState] = useState<GameState>(createInitialState());
  const [started, setStarted] = useState(false);
  const [aiDelayEnabled, setAiDelayEnabled] = useState(true);
  const [fastMode, setFastMode] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(() => {
    setStarted(true);
    setState((prev) => startNewGame(prev));
  }, []);

  const restart = useCallback(() => {
    setState((prev) => startNextRound(prev));
  }, []);

  const reset = useCallback(() => {
    setStarted(false);
    setState(createInitialState());
  }, []);

  const doDiscard = useCallback((cardId: string) => {
    setState((prev) => {
      if (prev.phase !== 'WAIT_DISCARD' || prev.currentPlayerId !== 'player') return prev;
      return discardCard(prev, 'player', cardId);
    });
  }, []);

  const doAction = useCallback((actionId: string, optionId?: string) => {
    setState((prev) => {
      if (prev.phase !== 'WAIT_RESPONSE') return prev;
      const action = prev.pendingActions.find((a) => a.id === actionId);
      if (!action || action.playerId !== 'player') return prev;
      return executeAction(prev, actionId, optionId);
    });
  }, []);

  // AI 自动执行
  useEffect(() => {
    if (!started) return;
    if (state.phase === 'SETTLEMENT' || state.phase === 'DRAW_GAME') return;

    const currentId = state.currentPlayerId;

    const runAI = () => {
      if (state.phase === 'WAIT_DISCARD') {
        if (isAIPlayer(state, currentId)) {
          const cardId = chooseDiscard(state, currentId);
          if (cardId) {
            setState((prev) => discardCard(prev, currentId, cardId));
          }
        }
      } else if (state.phase === 'WAIT_RESPONSE') {
        // 处理优先级最高的 pending action
        const firstAction = state.pendingActions[0];
        if (firstAction && isAIPlayer(state, firstAction.playerId)) {
          const decision = decideAction(state, firstAction.playerId);
          if (decision && decision.actionId) {
            setState((prev) => executeAction(prev, decision.actionId!, decision.optionId));
          }
        }
      } else if (state.phase === 'INIT' || state.phase === 'DEALING' || state.phase === 'CHECK_INITIAL_TI') {
        // 自动推进
      }
    };

    const isAIAction =
      (state.phase === 'WAIT_DISCARD' && isAIPlayer(state, currentId)) ||
      (state.phase === 'WAIT_RESPONSE' && state.pendingActions[0] && isAIPlayer(state, state.pendingActions[0].playerId));

    if (isAIAction) {
      const delay = aiDelayEnabled ? (fastMode ? 200 : AI_DELAY) : 0;
      timerRef.current = setTimeout(runAI, delay);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state, started, aiDelayEnabled, fastMode]);

  return {
    state,
    started,
    aiDelayEnabled,
    fastMode,
    start,
    restart,
    reset,
    doDiscard,
    doAction,
    setAiDelayEnabled,
    setFastMode,
  };
}
