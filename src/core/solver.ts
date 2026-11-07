import type { Card, HuResult, Meld, MeldType, PlayerState, SourceType } from './types';
import { isSameCard, isSequence, isSpecialSequence } from './rules';
import { createMeldId, huxiForMeld } from '../utils/helpers';

export interface SplitResult {
  valid: boolean;
  melds: Meld[];
  pair?: Meld;
  huxi: number;
}

function cardSort(a: Card, b: Card): number {
  if (a.suit !== b.suit) return a.suit === 'big' ? 1 : -1;
  return a.rank - b.rank;
}

function removeCards(hand: Card[], toRemove: Card[]): Card[] {
  const removedIds = new Set(toRemove.map((c) => c.id));
  return hand.filter((c) => !removedIds.has(c.id));
}

function makeMeld(type: MeldType, cards: Card[], ownerId: string): Meld {
  return {
    id: createMeldId(),
    type,
    cards: cards.slice().sort(cardSort),
    ownerId,
    sourceType: 'initial',
    isHidden: false,
    huxi: huxiForMeld(type, cards[0].suit === 'big'),
  };
}

// 查找所有包含第一张牌的合法组合
function findGroupsWithFirst(hand: Card[], isZiMo: boolean, winningCardId?: string): { type: MeldType; cards: Card[] }[] {
  if (hand.length === 0) return [];
  const first = hand[0];
  const results: { type: MeldType; cards: Card[] }[] = [];
  const suit = first.suit;
  const rank = first.rank;

  // 对子
  for (let i = 1; i < hand.length; i++) {
    if (isSameCard(first, hand[i])) {
      results.push({ type: 'pair', cards: [first, hand[i]] });
      break; // 每种对子只取一次
    }
  }

  // 三张相同
  const sameCards = hand.filter((c) => isSameCard(c, first));
  if (sameCards.length >= 3) {
    // 在手三张称"坎"，与偎同息（小3大6）；
    // 仅当该组包含胡牌张时按来源计：自摸算偎、胡他人牌算碰
    const containsWinningCard = winningCardId !== undefined && sameCards.some((c) => c.id === winningCardId);
    const type: MeldType = containsWinningCard && !isZiMo ? 'peng' : 'wei';
    results.push({ type, cards: sameCards.slice(0, 3) });
  }

  // 同花色顺子
  const sameSuit = hand.filter((c) => c.suit === suit && c.id !== first.id);
  for (let i = 0; i < sameSuit.length; i++) {
    for (let j = i + 1; j < sameSuit.length; j++) {
      const triplet = [first, sameSuit[i], sameSuit[j]];
      if (isSequence(triplet[0], triplet[1], triplet[2]) || isSpecialSequence(triplet[0], triplet[1], triplet[2])) {
        const type = isSpecialSequence(triplet[0], triplet[1], triplet[2]) ? 'specialSequence' : 'sequence';
        results.push({ type, cards: triplet });
      }
    }
  }

  // 大小三搭
  const crossSuit = suit === 'small' ? 'big' : 'small';
  const crossCards = hand.filter((c) => c.rank === rank && c.suit === crossSuit);
  if (crossCards.length >= 2) {
    results.push({ type: 'mixedTriplet', cards: [first, crossCards[0], crossCards[1]] });
  }

  return results;
}

function searchSplit(
  hand: Card[],
  ownerId: string,
  isZiMo: boolean,
  usedPair: boolean,
  cache: Map<string, SplitResult>,
  winningCardId?: string
): SplitResult {
  const key = hand.map((c) => c.id).join(',') + `|${usedPair}|${isZiMo}`;
  if (cache.has(key)) return cache.get(key)!;

  if (hand.length === 0) {
    const result: SplitResult = { valid: true, melds: [], huxi: 0 };
    cache.set(key, result);
    return result;
  }

  let best: SplitResult | null = null;
  const groups = findGroupsWithFirst(hand, isZiMo, winningCardId);

  for (const group of groups) {
    if (group.type === 'pair') {
      if (usedPair) continue;
      const remaining = removeCards(hand, group.cards);
      const sub = searchSplit(remaining, ownerId, isZiMo, true, cache, winningCardId);
      if (sub.valid) {
        const pairMeld = makeMeld('pair', group.cards, ownerId);
        const candidate: SplitResult = {
          valid: true,
          melds: sub.melds,
          pair: pairMeld,
          huxi: sub.huxi,
        };
        if (!best || candidate.huxi > best.huxi) best = candidate;
      }
    } else {
      const remaining = removeCards(hand, group.cards);
      const sub = searchSplit(remaining, ownerId, isZiMo, usedPair, cache, winningCardId);
      if (sub.valid) {
        const meld = makeMeld(group.type, group.cards, ownerId);
        const candidate: SplitResult = {
          valid: true,
          melds: [meld, ...sub.melds],
          pair: sub.pair,
          huxi: meld.huxi + sub.huxi,
        };
        if (!best || candidate.huxi > best.huxi) best = candidate;
      }
    }
  }

  const result: SplitResult = best || { valid: false, melds: [], huxi: 0 };
  cache.set(key, result);
  return result;
}

/**
 * 拆分手牌。
 * @param winningCardId 胡牌张 id：包含它的三张组按来源计息（自摸算偎、胡他人牌算碰），
 *                      其余在手三张一律按坎计息（3/6）。不传则全部按坎计。
 */
export function splitHand(
  hand: Card[],
  ownerId: string,
  requirePair: boolean,
  isZiMo: boolean = false,
  winningCardId?: string
): SplitResult {
  const sorted = hand.slice().sort(cardSort);
  const cache = new Map<string, SplitResult>();
  const result = searchSplit(sorted, ownerId, isZiMo, false, cache, winningCardId);
  if (!result.valid) return result;
  if (requirePair && !result.pair) return { valid: false, melds: [], huxi: 0 };
  return result;
}

export function hasPaoOrTi(melds: Meld[]): boolean {
  return melds.some((m) => m.type === 'pao' || m.type === 'ti');
}

export function calculateHu(
  player: PlayerState,
  extraCard: Card,
  sourcePlayerId: string,
  sourceType: SourceType,
  isZiMo: boolean
): HuResult {
  const fullHand = [...player.hand, extraCard];
  const requirePair = hasPaoOrTi(player.melds);
  const split = splitHand(fullHand, player.id, requirePair, isZiMo, extraCard.id);

  if (!split.valid) {
    return {
      canHu: false,
      huxi: 0,
      melds: [],
      redCount: 0,
      bigCount: 0,
      smallCount: 0,
      isZiMo,
      sourceType,
      sourcePlayerId,
    };
  }

  const allMelds = [...player.melds, ...split.melds];
  if (split.pair) allMelds.push(split.pair);

  let huxi = 0;
  for (const meld of allMelds) {
    huxi += meld.huxi;
  }

  let redCount = 0;
  let bigCount = 0;
  let smallCount = 0;
  for (const meld of allMelds) {
    for (const card of meld.cards) {
      if (card.isRed) redCount++;
      if (card.suit === 'big') bigCount++;
      else smallCount++;
    }
  }

  return {
    canHu: true,
    huxi,
    melds: allMelds,
    pair: split.pair,
    redCount,
    bigCount,
    smallCount,
    isZiMo,
    sourceType,
    sourcePlayerId,
  };
}

function hasEffectiveMingtang(huResult: HuResult): boolean {
  // 排除仅命中“普通牌型（2-9 红，1 番）”的情况
  const hasNormalOnly =
    huResult.redCount >= 2 && huResult.redCount <= 9 &&
    huResult.bigCount < 18 &&
    huResult.smallCount < 16 &&
    huResult.melds.some((m) => ['sequence', 'specialSequence', 'mixedTriplet'].includes(m.type));
  return !hasNormalOnly;
}

export function canHu(
  player: PlayerState,
  extraCard: Card,
  sourcePlayerId: string,
  sourceType: SourceType,
  isZiMo: boolean
): boolean {
  const result = calculateHu(player, extraCard, sourcePlayerId, sourceType, isZiMo);
  if (!result.canHu) return false;

  // 起胡门槛
  if (result.huxi < 15) return false;
  if (isZiMo) return true;
  if (result.huxi >= 18) return true;
  // 15-17 胡息胡别人明牌需具备有效名堂（非普通牌型）
  return hasEffectiveMingtang(result);
}
