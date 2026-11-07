/**
 * 批量模拟对局脚本：统计 AI 表现。
 * 运行：npx vite-node scripts/simulate.ts [局数]
 */
import { createInitialState, startNewGame, discardCard, executeAction, startNextRound } from '../src/core/stateMachine';
import { decideAction, chooseDiscard, isAIPlayer } from '../src/core/ai';
import { analyzeHand } from '../src/core/ting';
import { hasPaoOrTi } from '../src/core/solver';

interface SeatStats {
  wins: number;
  ziMoWins: number;
  totalHuxi: number;
  totalScore: number;
  openHandCount: number;
}

interface SimResult {
  rounds: number;
  drawGames: number;
  totalTurns: number;
  maxTurns: number;
  seats: Record<string, SeatStats>;
  /** 流局时各状态计数：听牌（≥15 胡息潜力）/ 稳听（≥18）/ 未听 */
  endTing: number;
  endSolidTing: number;
  endNotTing: number;
  totalMelds: number;
  actionCounts: Record<string, number>;
}

function newSeatStats(): SeatStats {
  return { wins: 0, ziMoWins: 0, totalHuxi: 0, totalScore: 0, openHandCount: 0 };
}

/** 是否使用随机玩家占据 player 座位（true=评估 AI 对随机玩家压制力，false=全 AI 对称校验） */
function runSimulation(totalRounds: number, randomHuman: boolean): SimResult {
  let state = createInitialState();
  state = startNewGame(state);

  const seats: Record<string, SeatStats> = {
    player: newSeatStats(),
    'ai-1': newSeatStats(),
    'ai-2': newSeatStats(),
  };

  let rounds = 0;
  let drawGames = 0;
  let totalTurns = 0;
  let maxTurns = 0;
  let endTing = 0;
  let endSolidTing = 0;
  let endNotTing = 0;
  let totalMelds = 0;
  const actionCounts: Record<string, number> = {};

  while (rounds < totalRounds) {
    // 单局推进
    for (let step = 0; step < 200; step++) {
      if (state.phase === 'SETTLEMENT' || state.phase === 'DRAW_GAME') break;

      if (state.phase === 'WAIT_DISCARD') {
        const currentId = state.currentPlayerId;
        const useAI = isAIPlayer(state, currentId) || !randomHuman;
        if (useAI) {
          const cardId = chooseDiscard(state, currentId);
          if (!cardId) break;
          state = discardCard(state, currentId, cardId);
        } else {
          const p = state.players.find((x) => x.id === currentId)!;
          if (p.hand.length === 0) break;
          state = discardCard(state, currentId, p.hand[0].id);
        }
      } else if (state.phase === 'WAIT_RESPONSE') {
        const firstAction = state.pendingActions[0];
        if (!firstAction) throw new Error('WAIT_RESPONSE with no pending actions');
        const useAI = isAIPlayer(state, firstAction.playerId) || !randomHuman;
        if (useAI) {
          const decision = decideAction(state, firstAction.playerId);
          if (decision?.actionId) {
            state = executeAction(state, decision.actionId, decision.optionId);
          } else {
            const pass = state.pendingActions.find((a) => a.playerId === firstAction.playerId && a.actionType === 'pass');
            if (!pass) throw new Error('AI has no decision and no pass action');
            state = executeAction(state, pass.id);
          }
        } else {
          const actions = state.pendingActions.filter((a) => a.playerId === firstAction.playerId);
          const nonPass = actions.find((a) => a.actionType !== 'pass');
          const chosen = nonPass ?? actions.find((a) => a.actionType === 'pass');
          if (chosen) state = executeAction(state, chosen.id);
        }
      } else if (state.phase === 'DRAW_REVEAL' || state.phase === 'RESOLVE_FORCED_ACTION') {
        throw new Error(`Unexpected phase ${state.phase}`);
      }
    }

    rounds++;
    totalTurns += state.turnCount;
    if (state.turnCount > maxTurns) maxTurns = state.turnCount;

    if (state.phase === 'DRAW_GAME') {
      drawGames++;
    } else if (state.settlement) {
      const s = state.settlement;
      const winner = seats[s.winnerId];
      winner.wins++;
      if (s.isZiMo) winner.ziMoWins++;
      winner.totalHuxi += s.totalHuxi;
      for (const p of state.players) {
        seats[p.id].totalScore += p.score;
        if (p.isOpenHand) seats[p.id].openHandCount++;
      }
    }

    // 终局手牌质量统计：是否听牌（15 胡息线）与稳听（18 胡息线）
    for (const p of state.players) {
      totalMelds += p.melds.length;
      const requirePair = hasPaoOrTi(p.melds);
      const ting = analyzeHand(p.hand, requirePair, p.huxi);
      const solid = analyzeHand(p.hand, requirePair, p.huxi, 18);
      if (solid.isTing) endSolidTing++;
      else if (ting.isTing) endTing++;
      else endNotTing++;
    }

    // 动作频率统计
    for (const log of state.logs) {
      if (['chi', 'peng', 'wei', 'chouWei', 'pao', 'ti'].includes(log.action)) {
        actionCounts[log.action] = (actionCounts[log.action] ?? 0) + 1;
      }
    }

    state = startNextRound(state);
  }

  return { rounds, drawGames, totalTurns, maxTurns, seats, endTing, endSolidTing, endNotTing, totalMelds, actionCounts };
}

function report(title: string, r: SimResult): void {
  console.log(`\n=== ${title}（${r.rounds} 局）===`);
  console.log(`流局率: ${((r.drawGames / r.rounds) * 100).toFixed(1)}%  平均回合: ${(r.totalTurns / r.rounds).toFixed(1)}  最长回合: ${r.maxTurns}`);
  const endTotal = r.endTing + r.endSolidTing + r.endNotTing;
  console.log(
    `终局状态: 稳听(≥18可胡弃牌) ${((r.endSolidTing / endTotal) * 100).toFixed(1)}%  仅自摸听(15-17) ${((r.endTing / endTotal) * 100).toFixed(1)}%  未听 ${((r.endNotTing / endTotal) * 100).toFixed(1)}%  人均落地牌 ${(r.totalMelds / endTotal).toFixed(1)} 组`
  );
  const per = (k: string) => ((r.actionCounts[k] ?? 0) / r.rounds).toFixed(1);
  console.log(`局均动作: 吃 ${per('chi')}  碰 ${per('peng')}  偎 ${per('wei')}  臭偎 ${per('chouWei')}  跑 ${per('pao')}  提 ${per('ti')}`);
  for (const [id, s] of Object.entries(r.seats)) {
    const winRate = ((s.wins / r.rounds) * 100).toFixed(1);
    const ziMoRate = s.wins > 0 ? ((s.ziMoWins / s.wins) * 100).toFixed(0) : '-';
    const avgHuxi = s.wins > 0 ? (s.totalHuxi / s.wins).toFixed(1) : '-';
    console.log(
      `  ${id.padEnd(8)} 胜 ${String(s.wins).padStart(3)} 次 (${winRate}%)  自摸率 ${ziMoRate}%  平均胡息 ${avgHuxi}  明牌 ${s.openHandCount} 次`
    );
  }
}

const rounds = Number(process.argv[2]) || 300;

const t1 = Date.now();
report('全 AI 对称局', runSimulation(rounds, false));
console.log(`耗时 ${((Date.now() - t1) / 1000).toFixed(1)}s`);

const t2 = Date.now();
report('2 AI vs 随机玩家', runSimulation(rounds, true));
console.log(`耗时 ${((Date.now() - t2) / 1000).toFixed(1)}s`);
