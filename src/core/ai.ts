import type { Card, ChiOption, GameState, Meld, PendingAction, PlayerState } from './types';
import { cardKey } from './types';
import { hasPaoOrTi } from './solver';
import { analyzeHand, estimateDistance, HU_HUXI_THRESHOLD, type HandAnalysis } from './ting';
import { huxiForMeld } from '../utils/helpers';

export interface AIDecision {
  actionId?: string;
  optionId?: string;
  cardId?: string;
  openHand?: boolean;
}

/** 非自摸稳胡线：18 胡息可平胡 */
const SOLID_HU_THRESHOLD = 18;

interface RichAnalysis extends HandAnalysis {
  /** 按剩余可摸张数加权的有效胡牌张数 */
  effectiveCount: number;
  /** 稳听胡牌张数（≥18 胡息，可胡他人弃牌） */
  solidCount: number;
  /** 距完整拆分的估计距离（越小越接近听牌） */
  distance: number;
}

export function shouldOpenHand(player: PlayerState): boolean {
  // AI 明牌策略：已听牌或名堂潜力大时明牌（明牌结算翻倍，风险自负）
  const analysis = analyze(player);

  const redCount = player.hand.filter((c) => c.isRed).length + player.melds.flatMap((m) => m.cards).filter((c) => c.isRed).length;
  const bigCount = player.hand.filter((c) => c.suit === 'big').length + player.melds.flatMap((m) => m.cards).filter((c) => c.suit === 'big').length;

  // 已听牌：随时可能胡，明牌博取翻倍
  if (analysis.isTing) return true;
  // 名堂潜力：红牌/大字多，哪怕慢一点也值得搏
  if (redCount >= 5 && bigCount >= 8) return true;
  if (player.paoTiCount >= 1 && redCount >= 3) return true;

  // 其余情况偶尔激进一次
  return Math.random() > 0.95;
}

export function decideAction(state: GameState, playerId: string): AIDecision | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;

  const myActions = state.pendingActions.filter((a) => a.playerId === playerId);
  if (myActions.length === 0) return null;

  // 强制动作：胡、跑、提、偎、臭偎
  const forced = myActions.find((a) => ['hu', 'pao', 'ti', 'wei', 'chouWei'].includes(a.actionType));
  if (forced) {
    return { actionId: forced.id };
  }

  // 碰
  const peng = myActions.find((a) => a.actionType === 'peng');
  if (peng) {
    if (shouldPeng(state, player, peng)) {
      return { actionId: peng.id };
    }
  }

  // 吃
  const chi = myActions.find((a) => a.actionType === 'chi');
  if (chi && chi.options && chi.options.length > 0) {
    const option = chooseChiOption(state, player, chi.options);
    if (option) {
      return { actionId: chi.id, optionId: option.id };
    }
  }

  // 默认过
  const pass = myActions.find((a) => a.actionType === 'pass');
  if (pass) {
    return { actionId: pass.id };
  }

  return null;
}

function shouldPeng(state: GameState, player: PlayerState, action: PendingAction): boolean {
  const card = action.card;
  const key = cardKey(card);

  // 必碰：自己已落地该牌的碰/偎（可升级成跑）
  const hasExistingMeld = player.melds.some(
    (m) => m.cards.length > 0 && cardKey(m.cards[0]) === key
  );
  if (hasExistingMeld) return true;

  const requirePair = hasPaoOrTi(player.melds);
  const visible = buildVisibility(state, player.id);
  const current = richAnalyze(player.hand, requirePair, player.huxi, visible);

  // 模拟碰：手牌移除两张同牌、落地加碰胡息，随后必须打出一张
  const rest = removeCardsByKey(player.hand, key, 2);
  if (rest.length !== player.hand.length - 2) return false;
  // 碰后无牌可打（极端残局），放弃碰
  if (rest.length === 0) return false;
  const pengHuxi = huxiForMeld('peng', card.suit === 'big');
  const after = bestDiscardAnalysis(state, player, rest, player.huxi + pengHuxi, visible);

  if (current.isTing) {
    // 已听牌：碰后仍听牌且不亏胡牌张才碰；除非碰胡息能跨过起胡门槛
    if (!after.isTing) return false;
    if (after.effectiveCount >= current.effectiveCount) return true;
    return crossesThreshold(player.huxi, player.huxi + pengHuxi);
  }

  // 未听牌：碰后结构不劣化才碰
  if (after.winningCount < current.winningCount) return false;
  // 向听明显变差（超过半个牌块）不碰
  if (after.distance > current.distance + 0.5) return false;
  // 碰能跨过 15/18 胡息门槛，或当前胡息还不够起胡，积极碰
  if (crossesThreshold(player.huxi, player.huxi + pengHuxi)) return true;
  return player.huxi + pengHuxi < HU_HUXI_THRESHOLD;
}

/** 胡息是否跨过 15 / 18 两道门槛 */
function crossesThreshold(before: number, after: number): boolean {
  return (
    (before < HU_HUXI_THRESHOLD && after >= HU_HUXI_THRESHOLD) ||
    (before < SOLID_HU_THRESHOLD && after >= SOLID_HU_THRESHOLD)
  );
}

function chooseChiOption(_state: GameState, player: PlayerState, options: ChiOption[]): ChiOption | null {
  const requirePair = hasPaoOrTi(player.melds);
  const analysis = analyze(player);
  let best: ChiOption | null = null;
  let bestScore = -Infinity;

  for (const option of options) {
    let score = option.huxi * 12;
    if (option.type === 'specialSequence') score += 30;
    if (option.type === 'mixedTriplet') score += 5;

    // 保留红牌倾向
    const keptRedCount = countRedInHandAfterChi(player.hand, option);
    score += keptRedCount * 8;

    // 吃后听牌张数变化（真实向听，带缓存）
    const usedIds = new Set([...option.mainCards, ...(option.biCards ?? [])].map((c) => c.id));
    const afterHand = player.hand.filter((c) => !usedIds.has(c.id));
    const after = analyzeHand(afterHand, requirePair, player.huxi + option.huxi);
    score += (after.winningCount - analysis.winningCount) * 50;
    if (after.isTing) score += 30;

    // 向听距离变化：吃牌把手牌向完整推进得越多越值得吃
    const distBefore = estimateDistance(player.hand, requirePair);
    const distAfter = estimateDistance(afterHand, requirePair);
    score += (distBefore.distance - distAfter.distance) * 60;

    // 避免破坏对子/坎
    const pairBroken = countPairs(player.hand) > countPairsAfterChi(player.hand, option);
    if (pairBroken) score -= 25;

    // 已听牌时，优先吃能增加胡息的
    if (analysis.isTing) score += option.huxi * 8;

    if (score > bestScore) {
      bestScore = score;
      best = option;
    }
  }

  // 若分数太低且未听牌，放弃吃
  if (bestScore < 15 && !analysis.isTing) return null;
  return best;
}

function countPairs(hand: Card[]): number {
  const groups = groupByKey(hand);
  let pairs = 0;
  for (const cards of groups.values()) {
    pairs += Math.floor(cards.length / 2);
  }
  return pairs;
}

function countPairsAfterChi(hand: Card[], option: ChiOption): number {
  const usedIds = new Set(option.mainCards.map((c) => c.id));
  const remaining = hand.filter((c) => !usedIds.has(c.id));
  return countPairs(remaining);
}

function countRedInHandAfterChi(hand: Card[], option: ChiOption): number {
  const usedIds = new Set(option.mainCards.map((c) => c.id));
  return hand.filter((c) => !usedIds.has(c.id) && c.isRed).length;
}

function groupByKey(hand: Card[]): Map<string, Card[]> {
  const map = new Map<string, Card[]>();
  for (const card of hand) {
    const key = cardKey(card);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(card);
  }
  return map;
}

export function chooseDiscard(state: GameState, playerId: string): string | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.hand.length === 0) return null;

  const visible = buildVisibility(state, playerId);
  const best = bestDiscardAnalysis(state, player, player.hand, player.huxi, visible);
  const card = player.hand.find((c) => cardKey(c) === best.discardKey);
  return card ? card.id : player.hand[0].id;
}

interface DiscardCandidate extends RichAnalysis {
  discardKey: string;
  score: number;
}

/**
 * 出牌核心评估：枚举每种可打的牌，模拟打出后的手牌质量。
 * 主分 = 打出后听牌/胡牌张数；辅分 = 打出安全性 - 保留价值。
 */
function bestDiscardAnalysis(
  state: GameState,
  player: PlayerState,
  hand: Card[],
  baseHuxi: number,
  visible: Map<string, number>
): DiscardCandidate {
  const requirePair = hasPaoOrTi(player.melds);
  const uniqueKeys = [...groupByKey(hand).keys()];

  let best: DiscardCandidate | null = null;
  for (const key of uniqueKeys) {
    const rest = removeCardsByKey(hand, key, 1);
    const analysis = richAnalyze(rest, requirePair, baseHuxi, visible);
    const safety = assessSafety(state, player.id, key, visible);
    const card = hand.find((c) => cardKey(c) === key)!;
    const keep = keepValue(card, hand, player.melds);

    const score =
      analysis.winningCount * 1000 +
      analysis.solidCount * 200 +
      analysis.effectiveCount * 60 -
      analysis.distance * 100 +
      safety -
      keep;

    if (!best || score > best.score) {
      best = { ...analysis, discardKey: key, score };
    }
  }

  return best!;
}

/** 分析手牌并叠加"剩余可摸张数"权重、稳听（18 胡息线）统计与向听距离 */
function richAnalyze(
  hand: Card[],
  requirePair: boolean,
  baseHuxi: number,
  visible: Map<string, number>
): RichAnalysis {
  const analysis = analyzeHand(hand, requirePair, baseHuxi);
  const effectiveCount = analysis.winningKeys.reduce(
    (sum, key) => sum + Math.max(0, 4 - (visible.get(key) ?? 0)),
    0
  );
  // 稳听：18 胡息线，胡牌机会不再局限于自摸
  const solid = analyzeHand(hand, requirePair, baseHuxi, SOLID_HU_THRESHOLD);
  const { distance } = estimateDistance(hand, requirePair);
  return { ...analysis, effectiveCount, solidCount: solid.winningCount, distance };
}

function analyze(player: PlayerState): HandAnalysis {
  return analyzeHand(player.hand, hasPaoOrTi(player.melds), player.huxi);
}

/**
 * 统计每种牌在公开信息中的可见张数。
 * 只看公开信息：自己手牌/落地、别家公开落地、日志中的弃牌与摸出明牌。
 * 别家暗置的偎/臭偎不可见，诚实起见不统计其牌面。
 */
function buildVisibility(state: GameState, selfId: string): Map<string, number> {
  const map = new Map<string, number>();
  const add = (card: Card) => {
    const key = cardKey(card);
    map.set(key, (map.get(key) ?? 0) + 1);
  };

  for (const player of state.players) {
    if (player.id === selfId) {
      player.hand.forEach(add);
      for (const meld of player.melds) meld.cards.forEach(add);
    } else {
      for (const meld of player.melds) {
        if (!meld.isHidden) meld.cards.forEach(add);
      }
    }
  }

  for (const log of state.logs) {
    if (log.action === 'discard' && log.card) add(log.card);
  }
  // 响应窗口内的明牌尚未落入日志
  if (state.revealedCard) add(state.revealedCard);

  return map;
}

/**
 * 打出某张牌的安全分（越高越安全）。
 * - 绝张（4 张全部可见）：别家不可能有用，最安全
 * - 别家漏胡/漏碰过的牌：规则上无法再胡/碰
 * - 别家公开碰/偎三张组：打出送跑，重罚
 * - 中张剩余多：易被下家吃，小罚
 */
function assessSafety(
  state: GameState,
  selfId: string,
  key: string,
  visible: Map<string, number>
): number {
  let score = 0;
  const visibleCount = visible.get(key) ?? 0;

  if (visibleCount >= 4) {
    score += 200;
  }

  for (const opp of state.players) {
    if (opp.id === selfId) continue;
    if (opp.passedHuRanks.includes(key)) score += 80;
    if (opp.passedPengRanks.includes(key)) score += 40;

    // 公开碰/偎三张组，打出即送跑
    const feedsPao = opp.melds.some(
      (m) =>
        !m.isHidden &&
        m.cards.length === 3 &&
        ['peng', 'wei', 'chouWei'].includes(m.type) &&
        cardKey(m.cards[0]) === key
    );
    if (feedsPao) score -= 150;
  }

  // 中张（3-8）容易被吃，剩余越多越危险
  const rank = Number(key.split('-')[1]);
  if (rank >= 3 && rank <= 8) {
    score -= Math.max(0, 4 - visibleCount) * 3;
  }

  return score;
}

/** 牌的保留价值（越高越不该打），仅作模拟评估后的辅分 */
function keepValue(card: Card, hand: Card[], melds: Meld[]): number {
  let score = 0;

  // 红牌、大字加分（保留倾向）
  if (card.isRed) score += 35;
  if (card.suit === 'big') score += 12;

  // 成对/成坎潜力
  const sameCards = hand.filter((c) => c.suit === card.suit && c.rank === card.rank);
  if (sameCards.length >= 3) score += 70;
  else if (sameCards.length === 2) score += 45;
  else if (sameCards.length === 1) score += 22;

  // 顺子潜力
  const sameSuit = hand.filter((c) => c.suit === card.suit && c.id !== card.id);
  let sequencePotential = 0;
  for (const other of sameSuit) {
    if (Math.abs(other.rank - card.rank) <= 2 && other.rank !== card.rank) {
      sequencePotential++;
    }
  }
  score += sequencePotential * 10;

  // 特殊顺子潜力额外加分
  if ([1, 2, 3].includes(card.rank) || [2, 7, 10].includes(card.rank)) {
    score += 8;
  }

  // 大小三搭潜力
  const crossSuitSameRank = hand.filter((c) => c.rank === card.rank && c.suit !== card.suit);
  if (crossSuitSameRank.length >= 2) score += 35;
  else if (crossSuitSameRank.length === 1) score += 18;

  // 孤张惩罚
  if (sameCards.length === 1 && sequencePotential === 0 && crossSuitSameRank.length === 0) {
    score -= 30;
  }

  // 已落地同牌型：手牌中同牌价值降低
  const hasSameMeld = melds.some((m) =>
    m.cards.some((c) => c.suit === card.suit && c.rank === card.rank)
  );
  if (hasSameMeld) score -= 20;

  return score;
}

function removeCardsByKey(hand: Card[], key: string, count: number): Card[] {
  const result: Card[] = [];
  let removed = 0;
  for (const card of hand) {
    if (removed < count && cardKey(card) === key) {
      removed++;
      continue;
    }
    result.push(card);
  }
  return result;
}

export function isAIPlayer(state: GameState, playerId: string): boolean {
  const player = state.players.find((p) => p.id === playerId);
  return player?.isAI ?? false;
}
