import { describe, expect, it } from 'vitest';
import type { Card, CardSuit, GameState, PendingAction, PlayerState } from '../core/types';
import { cardKey, isRed, RANKS } from '../core/types';
import { analyzeHand, clearAnalysisCache, estimateDistance } from '../core/ting';
import { chooseDiscard, decideAction } from '../core/ai';

let cardId = 0;

/** 生成测试用牌（id 自增唯一） */
function C(suit: CardSuit, rank: (typeof RANKS)[number]): Card {
  return { id: `t-${cardId++}`, suit, rank, isRed: isRed(rank) };
}

/** 生成 n 张同牌 */
function CN(suit: CardSuit, rank: (typeof RANKS)[number], n: number): Card[] {
  return Array.from({ length: n }, () => C(suit, rank));
}

function makePlayer(id: string, hand: Card[], over: Partial<PlayerState> = {}): PlayerState {
  return {
    id,
    name: id,
    seat: 0,
    hand,
    melds: [],
    score: 0,
    huxi: 0,
    redCount: 0,
    paoTiCount: 0,
    passedPengRanks: [],
    passedHuRanks: [],
    isAI: true,
    isDealer: false,
    isOpenHand: false,
    ...over,
  };
}

function makeState(players: PlayerState[], over: Partial<GameState> = {}): GameState {
  return {
    phase: 'WAIT_DISCARD',
    dealerId: players[0].id,
    currentPlayerId: players[0].id,
    deck: [],
    players,
    pendingActions: [],
    roundIndex: 1,
    baseScore: 1,
    turnCount: 1,
    logs: [],
    ...over,
  };
}

function makeAction(id: string, playerId: string, actionType: PendingAction['actionType'], card: Card): PendingAction {
  return { id, playerId, actionType, card, sourcePlayerId: 'player', sourceType: 'discard', priority: 3 };
}

function keyOf(cards: Card[], id: string | null): string {
  const card = cards.find((c) => c.id === id);
  if (!card) throw new Error(`discard id ${id} not found in hand`);
  return cardKey(card);
}

describe('听牌分析（analyzeHand）', () => {
  it('应识别听牌并给出胡牌张', () => {
    clearAnalysisCache();
    // 5 个大字坎（30 胡息）+ 小字特殊顺（3 胡息）+ 小五对子：听小五
    const hand = [
      ...CN('big', 1, 3),
      ...CN('big', 2, 3),
      ...CN('big', 3, 3),
      ...CN('big', 4, 3),
      ...CN('big', 5, 3),
      C('small', 1),
      C('small', 2),
      C('small', 3),
      ...CN('small', 5, 2),
    ];
    const analysis = analyzeHand(hand, false, 0);
    expect(analysis.isTing).toBe(true);
    // 小五（凑坎）与大伍（凑大小三搭）都可胡
    expect(analysis.winningKeys).toEqual(['small-5', 'big-5']);
  });

  it('零散手牌不应误判为听牌', () => {
    clearAnalysisCache();
    const hand = [
      ...RANKS.map((r) => C('small', r)),
      ...RANKS.map((r) => C('big', r)),
    ];
    const analysis = analyzeHand(hand, false, 0);
    expect(analysis.isTing).toBe(false);
    expect(analysis.winningCount).toBe(0);
  });
});

describe('向听估计（estimateDistance）', () => {
  it('接近成型的手牌距离应接近 0.5', () => {
    // 6 组完整牌 + 1 对：再进一张即可成型
    const hand = [
      ...CN('big', 1, 3),
      ...CN('big', 2, 3),
      ...CN('big', 3, 3),
      ...CN('big', 4, 3),
      ...CN('big', 5, 3),
      C('small', 1),
      C('small', 2),
      C('small', 3),
      ...CN('small', 5, 2),
    ];
    const estimate = estimateDistance(hand, false);
    expect(estimate.groups).toBe(6);
    expect(estimate.distance).toBe(0.5);
  });

  it('零散手牌距离应明显大于成型手牌', () => {
    const nearComplete = [
      ...CN('big', 1, 3),
      ...CN('big', 2, 3),
      ...CN('big', 3, 3),
      ...CN('big', 4, 3),
      ...CN('big', 5, 3),
      C('small', 1),
      C('small', 2),
      C('small', 3),
      ...CN('small', 5, 2),
    ];
    // 3 个坎 + 6 张互不相干的散牌（间距 ≥3，无对子无连张）
    const scattered = [
      ...CN('big', 1, 3),
      ...CN('big', 2, 3),
      ...CN('big', 3, 3),
      C('small', 1),
      C('small', 4),
      C('small', 7),
      C('small', 10),
      C('big', 5),
      C('big', 9),
    ];
    expect(estimateDistance(scattered, false).distance).toBeGreaterThan(
      estimateDistance(nearComplete, false).distance + 1
    );
  });
});

describe('AI 出牌（chooseDiscard）', () => {
  it('听牌时应打出孤张保听，而不是拆结构', () => {
    // 听小五的手牌 + 孤张大玖，AI 必须打出大玖
    const hand = [
      ...CN('big', 1, 3),
      ...CN('big', 2, 3),
      ...CN('big', 3, 3),
      ...CN('big', 4, 3),
      ...CN('big', 5, 3),
      C('small', 1),
      C('small', 2),
      C('small', 3),
      ...CN('small', 5, 2),
      C('big', 9),
    ];
    const ai = makePlayer('ai-1', hand);
    const state = makeState([ai, makePlayer('player', []), makePlayer('ai-2', [])]);

    const discardId = chooseDiscard(state, 'ai-1');
    expect(keyOf(hand, discardId)).toBe('big-9');
  });

  it('未听牌时应保留向听结构，不拆牌组和搭子', () => {
    // 5 个大字坎 + 小五对子 + 小八小九连张 + 大玖孤张：未听牌
    const hand = [
      ...CN('big', 1, 3),
      ...CN('big', 2, 3),
      ...CN('big', 3, 3),
      ...CN('big', 4, 3),
      ...CN('big', 5, 3),
      ...CN('small', 5, 2),
      C('small', 8),
      C('small', 9),
      C('big', 9),
    ];
    const ai = makePlayer('ai-1', hand);
    const state = makeState([ai, makePlayer('player', []), makePlayer('ai-2', [])]);

    const discardId = chooseDiscard(state, 'ai-1');
    const key = keyOf(hand, discardId);
    // 只能打散牌区域（小八/大玖），绝不允许拆坎或对子
    expect(['small-8', 'big-9']).toContain(key);
  });

  it('结构等效时应优先打出绝张（4 张全部可见）', () => {
    // 5 个小字坎（胡息低，任何打法都未听牌）+ 三张互不相干的孤张：大壹、大伍、大玖
    const hand = [
      ...CN('small', 1, 3),
      ...CN('small', 3, 3),
      ...CN('small', 5, 3),
      ...CN('small', 7, 3),
      ...CN('small', 9, 3),
      C('big', 1),
      C('big', 5),
      C('big', 9),
    ];
    const ai = makePlayer('ai-1', hand);
    const others = [makePlayer('player', []), makePlayer('ai-2', [])];

    // 对照组：无可见信息时按静态价值打出大玖（保留大壹的特殊顺潜力）
    const control = makeState([ai, ...others]);
    expect(keyOf(hand, chooseDiscard(control, 'ai-1'))).toBe('big-9');

    // 3 张大壹已被打出（日志可见）+ 手牌 1 张 = 绝张，应改打大壹
    const logs = CN('big', 1, 3).map((card, i) => ({
      id: `log-${i}`,
      turn: 1,
      playerId: 'player',
      action: 'discard' as const,
      card,
      timestamp: i,
      message: '',
    }));
    const withDead = makeState([ai, ...others], { logs });
    expect(keyOf(hand, chooseDiscard(withDead, 'ai-1'))).toBe('big-1');
  });
});

describe('AI 碰牌决策（decideAction）', () => {
  it('胡息已够且碰后无结构收益时应过', () => {
    // 5 个小字坎，落地已有 18 胡息；碰大玖对结构无改善
    const hand = [
      ...CN('small', 1, 3),
      ...CN('small', 2, 3),
      ...CN('small', 3, 3),
      ...CN('small', 4, 3),
      ...CN('small', 5, 3),
      C('small', 6),
      ...CN('big', 9, 2),
      C('big', 10),
      C('big', 1),
    ];
    const ai = makePlayer('ai-1', hand, { huxi: 18 });
    const target = C('big', 9);
    const state = makeState([ai, makePlayer('player', []), makePlayer('ai-2', [])], {
      phase: 'WAIT_RESPONSE',
      pendingActions: [
        makeAction('a-peng', 'ai-1', 'peng', target),
        makeAction('a-pass', 'ai-1', 'pass', target),
      ],
    });

    const decision = decideAction(state, 'ai-1');
    expect(decision?.actionId).toBe('a-pass');
  });

  it('胡息不够起胡时应积极碰牌攒胡息', () => {
    // 5 个大小三搭（0 胡息）+ 小六对子 + 大玖对子 + 大拾孤张：
    // 当前未听且胡息为 0，碰大玖拿 3 胡息
    const hand = [
      ...CN('small', 1, 2),
      C('big', 1),
      ...CN('small', 2, 2),
      C('big', 2),
      ...CN('small', 3, 2),
      C('big', 3),
      ...CN('small', 4, 2),
      C('big', 4),
      ...CN('small', 5, 2),
      C('big', 5),
      ...CN('small', 6, 2),
      ...CN('big', 9, 2),
      C('big', 10),
    ];
    const ai = makePlayer('ai-1', hand, { huxi: 0 });
    const target = C('big', 9);
    const state = makeState([ai, makePlayer('player', []), makePlayer('ai-2', [])], {
      phase: 'WAIT_RESPONSE',
      pendingActions: [
        makeAction('a-peng', 'ai-1', 'peng', target),
        makeAction('a-pass', 'ai-1', 'pass', target),
      ],
    });

    const decision = decideAction(state, 'ai-1');
    expect(decision?.actionId).toBe('a-peng');
  });

  it('强制动作优先：胡牌永远先执行', () => {
    const hand = [...CN('small', 6, 2)];
    const ai = makePlayer('ai-1', hand);
    const target = C('small', 6);
    const state = makeState([ai, makePlayer('player', []), makePlayer('ai-2', [])], {
      phase: 'WAIT_RESPONSE',
      pendingActions: [
        makeAction('a-peng', 'ai-1', 'peng', target),
        makeAction('a-hu', 'ai-1', 'hu', target),
        makeAction('a-pass', 'ai-1', 'pass', target),
      ],
    });

    const decision = decideAction(state, 'ai-1');
    expect(decision?.actionId).toBe('a-hu');
  });
});
