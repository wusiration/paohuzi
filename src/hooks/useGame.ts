import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState } from '../core/types';
import { createInitialState, discardCard, executeAction, startNewGame, startNextRound, toggleOpenHand } from '../core/stateMachine';
import { chooseDiscard, decideAction, isAIPlayer, shouldOpenHand } from '../core/ai';
import { soundManager } from '../audio/soundManager';

const AI_DELAY = 800;

export function useGame() {
  const [state, setState] = useState<GameState>(createInitialState());
  const [started, setStarted] = useState(false);
  const [aiDelayEnabled, setAiDelayEnabled] = useState(true);
  const [fastMode, setFastMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cheatMode, setCheatMode] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPhaseRef = useRef<string>('INIT');
  const prevTurnRef = useRef<number>(0);

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
    soundManager.play('discard');
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
      soundManager.play(action.actionType === 'pass' ? 'pass' : action.actionType === 'chouWei' ? 'wei' : action.actionType);
      return executeAction(prev, actionId, optionId);
    });
  }, []);

  const doOpenHand = useCallback(() => {
    setState((prev) => toggleOpenHand(prev, 'player'));
  }, []);

  // AI 自动执行
  useEffect(() => {
    if (!started) return;
    if (state.phase === 'SETTLEMENT' || state.phase === 'DRAW_GAME') return;

    const currentId = state.currentPlayerId;

    const runAI = () => {
      if (state.phase === 'WAIT_DISCARD') {
        if (isAIPlayer(state, currentId)) {
          // AI 在首次出牌前可能选择明牌
          const aiPlayer = state.players.find((p) => p.id === currentId);
          if (aiPlayer && state.turnCount === 0 && !aiPlayer.isOpenHand && shouldOpenHand(aiPlayer)) {
            setState((prev) => toggleOpenHand(prev, currentId));
            return;
          }
          const cardId = chooseDiscard(state, currentId);
          if (cardId) {
            soundManager.play('discard');
            setState((prev) => discardCard(prev, currentId, cardId));
          }
        }
      } else if (state.phase === 'WAIT_RESPONSE') {
        // 处理优先级最高的 pending action
        const firstAction = state.pendingActions[0];
        if (firstAction && isAIPlayer(state, firstAction.playerId)) {
          const decision = decideAction(state, firstAction.playerId);
          if (decision && decision.actionId) {
            const action = state.pendingActions.find((a) => a.id === decision.actionId);
            if (action) {
              soundManager.play(action.actionType === 'pass' ? 'pass' : action.actionType === 'chouWei' ? 'wei' : action.actionType);
            }
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

  // 根据状态变化触发通用音效
  useEffect(() => {
    if (!started) return;

    // 摸牌音效：回合数增加且不是刚开局
    if (state.turnCount > prevTurnRef.current && state.turnCount > 0) {
      soundManager.play('draw');
    }

    // 胡牌音效
    if (state.phase === 'SETTLEMENT' && prevPhaseRef.current !== 'SETTLEMENT') {
      soundManager.play('hu');
    }

    // 流局音效
    if (state.phase === 'DRAW_GAME' && prevPhaseRef.current !== 'DRAW_GAME') {
      soundManager.play('pass');
    }

    prevPhaseRef.current = state.phase;
    prevTurnRef.current = state.turnCount;
  }, [state, started]);

  return {
    state,
    started,
    aiDelayEnabled,
    fastMode,
    soundEnabled,
    cheatMode,
    start,
    restart,
    reset,
    doDiscard,
    doAction,
    doOpenHand,
    setAiDelayEnabled,
    setFastMode,
    setSoundEnabled,
    setCheatMode,
  };
}
