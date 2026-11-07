/**
 * 新旧 AI A/B 对战：new = 当前 ai.ts，old = 上一版启发式 ai.ts。
 * 运行：npx vite-node scripts/ab-test.ts [局数]
 */
import { createInitialState, startNewGame, discardCard, executeAction, startNextRound } from '../src/core/stateMachine';
import * as newAI from '../src/core/ai';
import * as oldAI from './old-ai';

type Strategy = 'new' | 'old';

const strategies: Record<Strategy, { decideAction: typeof newAI.decideAction; chooseDiscard: typeof newAI.chooseDiscard }> = {
  new: { decideAction: newAI.decideAction, chooseDiscard: newAI.chooseDiscard },
  old: { decideAction: oldAI.decideAction, chooseDiscard: oldAI.chooseDiscard },
};

interface Result {
  wins: Record<Strategy, number>;
  draws: number;
  rounds: number;
}

function run(totalRounds: number, seatOfNew: string): Result {
  let state = createInitialState();
  state = startNewGame(state);
  const wins: Record<Strategy, number> = { new: 0, old: 0 };
  let draws = 0;
  let rounds = 0;

  const strategyOf = (playerId: string): Strategy => (playerId === seatOfNew ? 'new' : 'old');

  while (rounds < totalRounds) {
    for (let step = 0; step < 200; step++) {
      if (state.phase === 'SETTLEMENT' || state.phase === 'DRAW_GAME') break;

      if (state.phase === 'WAIT_DISCARD') {
        const s = strategies[strategyOf(state.currentPlayerId)];
        const cardId = s.chooseDiscard(state, state.currentPlayerId);
        if (!cardId) break;
        state = discardCard(state, state.currentPlayerId, cardId);
      } else if (state.phase === 'WAIT_RESPONSE') {
        const firstAction = state.pendingActions[0];
        if (!firstAction) throw new Error('WAIT_RESPONSE with no pending actions');
        const s = strategies[strategyOf(firstAction.playerId)];
        const decision = s.decideAction(state, firstAction.playerId);
        if (decision?.actionId) {
          state = executeAction(state, decision.actionId, decision.optionId);
        } else {
          const pass = state.pendingActions.find((a) => a.playerId === firstAction.playerId && a.actionType === 'pass');
          if (!pass) throw new Error('no decision and no pass');
          state = executeAction(state, pass.id);
        }
      } else if (state.phase === 'DRAW_REVEAL' || state.phase === 'RESOLVE_FORCED_ACTION') {
        throw new Error(`Unexpected phase ${state.phase}`);
      }
    }

    rounds++;
    if (state.phase === 'DRAW_GAME') {
      draws++;
    } else if (state.settlement) {
      wins[strategyOf(state.settlement.winnerId)]++;
    }
    state = startNextRound(state);
  }

  return { wins, draws, rounds };
}

const rounds = Number(process.argv[2]) || 300;

// 两个对称配置消除座位偏差：新 AI 分别占 1 个和 2 个座位
const t = Date.now();
const a = run(rounds, 'player');
const b = run(rounds, 'ai-1');

const totalNew = a.wins.new + b.wins.new;
const totalOld = a.wins.old + b.wins.old;
const totalRounds = a.rounds + b.rounds;
const totalDraws = a.draws + b.draws;

// 每个配置中 new 占 1 座、old 占 2 座：按座位数归一化比较
const newSeatRounds = totalRounds;
const oldSeatRounds = totalRounds * 2;
const newRate = (totalNew / newSeatRounds) * 100;
const oldRate = (totalOld / oldSeatRounds) * 100;

console.log(`\n=== A/B 对战（各 ${rounds} 局 ×2 配置，共 ${totalRounds} 局）===`);
console.log(`配置A（new 占 player 位）: new ${a.wins.new} 胜 / old ${a.wins.old} 胜 / 流局 ${a.draws}`);
console.log(`配置B（new 占 ai-1 位） : new ${b.wins.new} 胜 / old ${b.wins.old} 胜 / 流局 ${b.draws}`);
console.log(`合计: new ${totalNew} 胜  old ${totalOld} 胜  流局 ${totalDraws} (${((totalDraws / totalRounds) * 100).toFixed(1)}%)`);
console.log(`每座位胜率: new ${newRate.toFixed(1)}%  old ${oldRate.toFixed(1)}%  强度比 ${(newRate / oldRate).toFixed(2)}x`);
console.log(`耗时 ${((Date.now() - t) / 1000).toFixed(1)}s`);
