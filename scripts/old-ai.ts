import type { Card, ChiOption, GameState, PendingAction, PlayerState } from '../src/core/types';
import { cardKey } from '../src/core/types';
import { splitHand } from '../src/core/solver';

export interface AIDecision {
  actionId?: string;
  optionId?: string;
  cardId?: string;
  openHand?: boolean;
}

export function shouldOpenHand(player: PlayerState): boolean {
  // AI 明牌策略：手牌较好时才明牌（听牌概率高、红牌多、大字多）
  const split = splitHand(player.hand, player.id, false, false);
  if (!split.valid) return false;

  const handHuxi = split.melds.reduce((sum, m) => sum + m.huxi, 0);
  const totalHuxi = player.huxi + handHuxi;
  const tingLikelihood = Math.min(totalHuxi / 18, 1) * 0.6 + (split.pair ? 0.2 : 0);

  const redCount = player.hand.filter((c) => c.isRed).length + player.melds.flatMap((m) => m.cards).filter((c) => c.isRed).length;
  const bigCount = player.hand.filter((c) => c.suit === 'big').length + player.melds.flatMap((m) => m.cards).filter((c) => c.suit === 'big').length;

  // 起手提或起手很好时考虑明牌
  if (player.paoTiCount >= 1 && tingLikelihood >= 0.5) return true;
  if (tingLikelihood >= 0.7 && redCount >= 3) return true;
  if (redCount >= 5 && bigCount >= 8) return true;

  return Math.random() > 0.92 && tingLikelihood >= 0.4;
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

function shouldPeng(_state: GameState, player: PlayerState, action: PendingAction): boolean {
  const card = action.card;
  const rankKey = `${card.suit}-${card.rank}`;

  // 必碰：自己已落地该牌的碰/偎（可升级成跑）
  const hasExistingMeld = player.melds.some(
    (m) => m.cards.length > 0 && `${m.cards[0].suit}-${m.cards[0].rank}` === rankKey
  );
  if (hasExistingMeld) return true;

  // 接近听牌或已听牌时，优先碰以加速胡牌
  const tingLikelihood = estimateTingLikelihood(player);
  if (tingLikelihood >= 0.5) return true;

  // 红牌、大字价值高，优先碰
  if (card.isRed || card.suit === 'big') {
    // 但如果会严重破坏顺子结构则放弃
    return !isCriticalForSequences(card, player.hand);
  }

  // 小字非红：仅在牌型较好或需要提速时碰
  if (player.huxi >= 12 || tingLikelihood >= 0.3) return Math.random() > 0.4;
  return Math.random() > 0.65;
}

function chooseChiOption(_state: GameState, player: PlayerState, options: ChiOption[]): ChiOption | null {
  const tingLikelihood = estimateTingLikelihood(player);
  let best: ChiOption | null = null;
  let bestScore = -Infinity;

  for (const option of options) {
    let score = option.huxi * 12;
    if (option.type === 'specialSequence') score += 30;
    if (option.type === 'mixedTriplet') score += 5;

    // 保留红牌倾向
    const keptRedCount = countRedInHandAfterChi(player.hand, option);
    score += keptRedCount * 8;

    // 接近听牌时更看重向听数减少
    const tingDelta = estimateTingDelta(player.hand, option);
    score += tingDelta * 40;

    // 避免破坏对子/坎
    const pairBroken = countPairs(player.hand) > countPairsAfterChi(player.hand, option);
    if (pairBroken) score -= 25;

    // 已接近胡牌时，优先吃能增加胡息的
    if (tingLikelihood >= 0.6) score += option.huxi * 8;

    if (score > bestScore) {
      bestScore = score;
      best = option;
    }
  }

  // 若分数太低且当前牌型尚可，放弃吃
  if (bestScore < 15 && tingLikelihood < 0.4) return null;
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

function isCriticalForSequences(card: Card, hand: Card[]): boolean {
  // 判断这张牌是否是多个潜在顺子的关键牌
  const sameSuit = hand.filter((c) => c.suit === card.suit && c.id !== card.id);
  let nearCount = 0;
  for (const other of sameSuit) {
    if (Math.abs(other.rank - card.rank) <= 2 && other.rank !== card.rank) {
      nearCount++;
    }
  }
  return nearCount >= 2;
}

function estimateTingLikelihood(player: PlayerState): number {
  // 基于落地胡息和手牌结构简单估计接近胡牌的概率
  const split = splitHand(player.hand, player.id, false, false);
  if (!split.valid) return 0;
  const handHuxi = split.melds.reduce((sum, m) => sum + m.huxi, 0);
  const totalHuxi = player.huxi + handHuxi;
  const ratio = Math.min(totalHuxi / 18, 1);
  return ratio * 0.6 + (split.pair ? 0.2 : 0);
}

function estimateTingDelta(hand: Card[], option: ChiOption): number {
  // 估算吃牌后向听数的变化（简化版）
  const before = splitHand(hand, 'ai', false, false);
  const usedIds = new Set(option.mainCards.map((c) => c.id));
  const afterHand = hand.filter((c) => !usedIds.has(c.id));
  const after = splitHand(afterHand, 'ai', false, false);

  if (!before.valid || !after.valid) return 0;

  const beforeGroups = before.melds.length + (before.pair ? 1 : 0);
  const afterGroups = after.melds.length + (after.pair ? 1 : 0);
  return afterGroups - beforeGroups;
}

export function chooseDiscard(state: GameState, playerId: string): string | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.hand.length === 0) return null;

  // 简单安全评估：避免打出可能让别家碰/跑/胡的牌
  const dangerousKeys = collectDangerousKeys(state, playerId);

  let worstCard = player.hand[0];
  let worstScore = Infinity;

  for (const card of player.hand) {
    const score = evaluateCardValue(card, player.hand, player.melds, dangerousKeys);
    if (score < worstScore) {
      worstScore = score;
      worstCard = card;
    }
  }

  return worstCard.id;
}

function collectDangerousKeys(state: GameState, selfId: string): Set<string> {
  const dangerous = new Set<string>();
  const self = state.players.find((p) => p.id === selfId);
  if (!self) return dangerous;

  for (const player of state.players) {
    if (player.id === selfId) continue;
    // 别家落地牌型中缺少一张即可成跑的牌
    for (const meld of player.melds) {
      if (meld.cards.length === 3 && ['peng', 'wei', 'chouWei'].includes(meld.type)) {
        dangerous.add(`${meld.cards[0].suit}-${meld.cards[0].rank}`);
      }
    }
    // 别家已碰/偎过的牌再次出现时很可能成跑
    for (const meld of player.melds) {
      if (['peng', 'wei', 'chouWei'].includes(meld.type)) {
        dangerous.add(`${meld.cards[0].suit}-${meld.cards[0].rank}`);
      }
    }
  }

  return dangerous;
}

function evaluateCardValue(
  card: Card,
  hand: Card[],
  melds: import('./types').Meld[],
  dangerousKeys: Set<string>
): number {
  let score = 0;
  const key = `${card.suit}-${card.rank}`;

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

  // 已落地同牌型：若已有碰/偎/跑，手牌中同牌价值降低
  const hasSameMeld = melds.some((m) =>
    m.cards.some((c) => c.suit === card.suit && c.rank === card.rank)
  );
  if (hasSameMeld) score -= 20;

  // 安全度：打出危险牌要扣大分
  if (dangerousKeys.has(key)) {
    score -= 50;
  }

  // 单张红大牌额外谨慎
  if (card.isRed && card.suit === 'big' && sameCards.length === 1) {
    score += 15;
  }

  return score;
}

export function isAIPlayer(state: GameState, playerId: string): boolean {
  const player = state.players.find((p) => p.id === playerId);
  return player?.isAI ?? false;
}
