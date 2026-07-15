import { describe, it, expect } from 'vitest';
import { createInitialState, startNewGame, discardCard, executeAction, startNextRound } from '../core/stateMachine';
import { decideAction, chooseDiscard, isAIPlayer } from '../core/ai';
import type { GameState } from '../core/types';

function runGame(_seed: number): {
  state: GameState;
  rounds: number;
  drawsPerPlayer: Record<string, number>;
  totalTurns: number;
} {
  let state = createInitialState();
  state = startNewGame(state);

  const drawsPerPlayer: Record<string, number> = { player: 0, 'ai-1': 0, 'ai-2': 0 };
  let totalTurns = 0;
  let rounds = 1;

  // 单局最多 200 步，防止死循环
  for (let step = 0; step < 200; step++) {
    if (state.phase === 'SETTLEMENT' || state.phase === 'DRAW_GAME') {
      if (rounds >= 5) break;
      state = startNextRound(state);
      rounds++;
      continue;
    }

    if (state.phase === 'WAIT_DISCARD') {
      const currentId = state.currentPlayerId;
      if (isAIPlayer(state, currentId)) {
        const cardId = chooseDiscard(state, currentId);
        if (!cardId) break;
        state = discardCard(state, currentId, cardId);
      } else {
        // 人类玩家：随机打一张
        const player = state.players.find((p) => p.id === currentId)!;
        if (player.hand.length === 0) break;
        state = discardCard(state, currentId, player.hand[0].id);
      }
    } else if (state.phase === 'WAIT_RESPONSE') {
      const firstAction = state.pendingActions[0];
      if (!firstAction) {
        // 不应该发生：没有 pending action 但仍在 WAIT_RESPONSE
        throw new Error(`WAIT_RESPONSE with no pending actions at step ${step}`);
      }
      if (isAIPlayer(state, firstAction.playerId)) {
        const decision = decideAction(state, firstAction.playerId);
        if (decision?.actionId) {
          state = executeAction(state, decision.actionId, decision.optionId);
        } else {
          // AI 无法决策，强制过
          const passAction = state.pendingActions.find((a) => a.playerId === firstAction.playerId && a.actionType === 'pass');
          if (passAction) {
            state = executeAction(state, passAction.id);
          } else {
            throw new Error(`AI has no decision and no pass action at step ${step}`);
          }
        }
      } else {
        // 人类玩家：随机选择第一个非过动作，或点过
        const actions = state.pendingActions.filter((a) => a.playerId === firstAction.playerId);
        const nonPass = actions.find((a) => a.actionType !== 'pass');
        if (nonPass) {
          state = executeAction(state, nonPass.id);
        } else {
          const pass = actions.find((a) => a.actionType === 'pass');
          if (pass) state = executeAction(state, pass.id);
        }
      }
    } else if (state.phase === 'DRAW_REVEAL' || state.phase === 'RESOLVE_FORCED_ACTION') {
      // 这些阶段不应该长时间停留，直接报错
      throw new Error(`Unexpected phase ${state.phase} at step ${step}`);
    }

    // 统计摸牌
    if (state.turnCount > totalTurns) {
      totalTurns = state.turnCount;
      drawsPerPlayer[state.currentPlayerId] = (drawsPerPlayer[state.currentPlayerId] || 0) + 1;
    }
  }

  return { state, rounds, drawsPerPlayer, totalTurns };
}

function validateState(state: GameState) {
  // 基本不变量检查
  for (const player of state.players) {
    expect(player.hand.length).toBeGreaterThanOrEqual(0);
    expect(player.score).toBeDefined();
    expect(player.huxi).toBeGreaterThanOrEqual(0);
  }
  expect(state.deck.length).toBeGreaterThanOrEqual(0);
  expect(state.deck.length).toBeLessThanOrEqual(19);
}

describe('模拟对局检测', () => {
  it('应能完成 50 局随机对局且无异常', () => {
    let noDrawGames = 0;
    let singleNoDrawCount = 0;
    const noDrawByPlayer: Record<string, number> = { player: 0, 'ai-1': 0, 'ai-2': 0 };

    for (let i = 0; i < 50; i++) {
      const result = runGame(i);
      validateState(result.state);
      expect(result.rounds).toBeGreaterThanOrEqual(1);
      expect(result.totalTurns).toBeGreaterThanOrEqual(0);

      const totalDraws = Object.values(result.drawsPerPlayer).reduce((a, b) => a + b, 0);
      if (totalDraws === 0) {
        noDrawGames++;
      }

      for (const [pid, count] of Object.entries(result.drawsPerPlayer)) {
        if (count === 0) {
          singleNoDrawCount++;
          noDrawByPlayer[pid]++;
        }
      }
    }

    // 统计输出到控制台
    console.log('=== 模拟 50 局统计 ===');
    console.log(`整局无人摸牌次数: ${noDrawGames}`);
    console.log(`单个玩家没摸到牌的局次合计: ${singleNoDrawCount}`);
    console.log('各玩家没摸到牌的局次:', noDrawByPlayer);

    // 整局无人摸牌应为 0，否则有严重 bug
    expect(noDrawGames).toBe(0);
  });

  it('庄家应持有 21 张牌，闲家 20 张（起手四张相同会提成落地牌）', () => {
    let state = createInitialState();
    state = startNewGame(state);
    for (const player of state.players) {
      const total = player.hand.length + player.melds.reduce((s, m) => s + m.cards.length, 0);
      if (player.isDealer) {
        expect(total).toBe(21);
      } else {
        expect(total).toBe(20);
      }
    }
    expect(state.deck.length).toBe(19);
  });
});
