/** AI 决策性能剖析 */
import { createInitialState, startNewGame, discardCard, executeAction, startNextRound } from '../src/core/stateMachine';
import { decideAction, chooseDiscard, isAIPlayer } from '../src/core/ai';
import { analyzeHand, estimateDistance, clearAnalysisCache } from '../src/core/ting';
import { hasPaoOrTi } from '../src/core/solver';

// 统计：每个函数的总耗时与调用次数
const stats = new Map<string, { total: number; count: number; max: number }>();
function timeit<T>(name: string, fn: () => T): T {
  const t0 = performance.now();
  const r = fn();
  const ms = performance.now() - t0;
  const s = stats.get(name) ?? { total: 0, count: 0, max: 0 };
  s.total += ms;
  s.count++;
  if (ms > s.max) s.max = ms;
  stats.set(name, s);
  return r;
}

function runOneGame(): void {
  let state = createInitialState();
  state = startNewGame(state);

  for (let step = 0; step < 200; step++) {
    if (state.phase === 'SETTLEMENT' || state.phase === 'DRAW_GAME') return;

    if (state.phase === 'WAIT_DISCARD') {
      const id = state.currentPlayerId;
      if (isAIPlayer(state, id)) {
        const cardId = timeit('chooseDiscard', () => chooseDiscard(state, id));
        if (!cardId) return;
        state = discardCard(state, id, cardId);
      } else {
        const p = state.players.find((x) => x.id === id)!;
        if (p.hand.length === 0) return;
        state = discardCard(state, id, p.hand[0].id);
      }
    } else if (state.phase === 'WAIT_RESPONSE') {
      const a = state.pendingActions[0];
      if (!a) return;
      if (isAIPlayer(state, a.playerId)) {
        const d = timeit('decideAction', () => decideAction(state, a.playerId));
        if (d?.actionId) {
          state = executeAction(state, d.actionId, d.optionId);
        } else {
          const pass = state.pendingActions.find((x) => x.playerId === a.playerId && x.actionType === 'pass');
          if (!pass) return;
          state = executeAction(state, pass.id);
        }
      } else {
        const mine = state.pendingActions.filter((x) => x.playerId === a.playerId);
        const chosen = mine.find((x) => x.actionType !== 'pass') ?? mine[0];
        state = executeAction(state, chosen.id);
      }
    } else if (state.phase === 'DRAW_REVEAL' || state.phase === 'RESOLVE_FORCED_ACTION') {
      return;
    }
  }
}

// 单函数基准：随机起手牌的分析成本
function benchAnalysis(): void {
  let state = createInitialState();
  state = startNewGame(state);
  const ai = state.players.find((p) => p.isAI)!;
  clearAnalysisCache();
  timeit('analyzeHand(冷)', () => analyzeHand(ai.hand, hasPaoOrTi(ai.melds), ai.huxi));
  timeit('analyzeHand(热)', () => analyzeHand(ai.hand, hasPaoOrTi(ai.melds), ai.huxi));
  timeit('estimateDistance', () => estimateDistance(ai.hand, false));
}

const t0 = Date.now();
benchAnalysis();
const ROUNDS = 100;
let state2 = createInitialState();
state2 = startNewGame(state2);
for (let i = 0; i < ROUNDS; i++) {
  runOneGame();
  state2 = startNextRound(state2);
}
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

console.log(`\n=== ${ROUNDS} 局耗时 ${elapsed}s（含基准）===`);
for (const [name, s] of [...stats.entries()].sort((a, b) => b[1].total - a[1].total)) {
  console.log(
    `${name.padEnd(20)} 总 ${s.total.toFixed(0).padStart(6)}ms  均 ${(s.total / s.count).toFixed(2)}ms  最大 ${s.max.toFixed(1)}ms  次数 ${s.count}`
  );
}
