import type { Card, ChiOption, GameState, PendingAction, PlayerState } from './types';
import { cardKey } from './types';

export interface AIDecision {
  actionId?: string;
  optionId?: string;
  cardId?: string;
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
  // 红牌、大字优先碰
  if (card.isRed || card.suit === 'big') return true;
  // 接近胡牌时碰
  if (player.huxi >= 12) return true;
  return Math.random() > 0.3;
}

function chooseChiOption(_state: GameState, player: PlayerState, options: ChiOption[]): ChiOption | null {
  // 优先选择胡息高、能接近胡牌、保留红牌的选项
  let best: ChiOption | null = null;
  let bestScore = -Infinity;

  for (const option of options) {
    let score = option.huxi * 10;
    // 特殊顺子加分
    if (option.type === 'specialSequence') score += 20;
    // 保留红牌倾向
    const hasRed = option.mainCards.some((c) => c.isRed);
    if (hasRed) score += 15;
    // 接近胡牌
    if (player.huxi >= 12) score += 25;
    // 避免破坏对子
    const pairBroken = countPairs(player.hand) > countPairsAfterChi(player.hand, option);
    if (pairBroken) score -= 20;

    if (score > bestScore) {
      bestScore = score;
      best = option;
    }
  }

  // 若分数太低，放弃吃
  if (bestScore < 10) return null;
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

  let worstCard = player.hand[0];
  let worstScore = Infinity;

  for (const card of player.hand) {
    const score = evaluateCardValue(card, player.hand, player.melds);
    if (score < worstScore) {
      worstScore = score;
      worstCard = card;
    }
  }

  return worstCard.id;
}

function evaluateCardValue(card: Card, hand: Card[], melds: import('./types').Meld[]): number {
  let score = 0;

  // 红牌加分（保留）
  if (card.isRed) score += 30;
  // 大字加分
  if (card.suit === 'big') score += 10;

  // 成对/成坎潜力
  const sameCards = hand.filter((c) => c.suit === card.suit && c.rank === card.rank);
  if (sameCards.length >= 2) score += 40;
  else if (sameCards.length === 1) score += 20;

  // 顺子潜力
  const sameSuit = hand.filter((c) => c.suit === card.suit && c.id !== card.id);
  let sequencePotential = 0;
  for (const other of sameSuit) {
    if (Math.abs(other.rank - card.rank) <= 2 && other.rank !== card.rank) {
      sequencePotential++;
    }
  }
  score += sequencePotential * 8;

  // 大小三搭潜力
  const crossSuitSameRank = hand.filter((c) => c.rank === card.rank && c.suit !== card.suit);
  if (crossSuitSameRank.length >= 1) score += 15;

  // 孤张惩罚
  if (sameCards.length === 0 && sequencePotential === 0 && crossSuitSameRank.length === 0) {
    score -= 25;
  }

  // 已落地同牌型：若已有碰/偎/跑，手牌中同牌价值降低
  const hasSameMeld = melds.some((m) =>
    m.cards.some((c) => c.suit === card.suit && c.rank === card.rank)
  );
  if (hasSameMeld) score -= 15;

  return score;
}

export function isAIPlayer(state: GameState, playerId: string): boolean {
  const player = state.players.find((p) => p.id === playerId);
  return player?.isAI ?? false;
}
