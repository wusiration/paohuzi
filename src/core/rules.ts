import type { Card, Meld, MeldType, PlayerState, SourceType } from './types';
import { cardKey, cardRankKey } from './types';
import { createMeldId, huxiForMeld } from '../utils/helpers';

// ==================== 基础牌组判断 ====================

export function isSameCard(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

export function isSameRank(a: Card, b: Card): boolean {
  return a.rank === b.rank;
}

export function isSequence(a: Card, b: Card, c: Card): boolean {
  if (a.suit !== b.suit || b.suit !== c.suit) return false;
  const ranks = [a.rank, b.rank, c.rank].sort((x, y) => x - y);
  return ranks[0] + 1 === ranks[1] && ranks[1] + 1 === ranks[2];
}

export function isSpecialSequence(a: Card, b: Card, c: Card): boolean {
  if (a.suit !== b.suit || b.suit !== c.suit) return false;
  const ranks = new Set([a.rank, b.rank, c.rank]);
  // 一二三
  if (ranks.has(1) && ranks.has(2) && ranks.has(3)) return true;
  // 二七十
  if (ranks.has(2) && ranks.has(7) && ranks.has(10)) return true;
  return false;
}

export function isMixedTriplet(a: Card, b: Card, c: Card): boolean {
  if (a.rank !== b.rank || b.rank !== c.rank) return false;
  const suits = new Set([a.suit, b.suit, c.suit]);
  return suits.size === 2;
}

export function isPair(a: Card, b: Card): boolean {
  return isSameCard(a, b);
}

export function findTripletType(cards: Card[]): MeldType | null {
  if (cards.length !== 3) return null;
  if (isSpecialSequence(cards[0], cards[1], cards[2])) return 'specialSequence';
  if (isSequence(cards[0], cards[1], cards[2])) return 'sequence';
  if (isMixedTriplet(cards[0], cards[1], cards[2])) return 'mixedTriplet';
  return null;
}

export function isValidTriplet(cards: Card[]): boolean {
  return findTripletType(cards) !== null;
}

// ==================== 手牌统计 ====================

export function countByKey(hand: Card[], key: string): Map<string, Card[]> {
  const map = new Map<string, Card[]>();
  for (const card of hand) {
    const k = key === 'rank' ? cardRankKey(card) : cardKey(card);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(card);
  }
  return map;
}

export function getCardGroups(hand: Card[]): { byKey: Map<string, Card[]>; byRank: Map<string, Card[]> } {
  return {
    byKey: countByKey(hand, 'key'),
    byRank: countByKey(hand, 'rank'),
  };
}

// ==================== 落地牌组查询 ====================

export function findMeldByType(player: PlayerState, type: MeldType): Meld | undefined {
  return player.melds.find((m) => m.type === type);
}

export function findExistingPeng(player: PlayerState, rankKey: string): Meld | undefined {
  return player.melds.find(
    (m) =>
      (m.type === 'peng' || m.type === 'pao') &&
      m.cards.length >= 3 &&
      `${m.cards[0].suit}-${m.cards[0].rank}` === rankKey
  );
}

export function findExistingWei(player: PlayerState, rankKey: string): Meld | undefined {
  return player.melds.find(
    (m) =>
      (m.type === 'wei' || m.type === 'chouWei' || m.type === 'pao') &&
      m.cards.length >= 3 &&
      `${m.cards[0].suit}-${m.cards[0].rank}` === rankKey
  );
}

// ==================== 动作检测 ====================

export interface ActionCheckContext {
  player: PlayerState;
  card: Card;
  sourcePlayerId: string;
  sourceType: SourceType;
  isSelfDraw: boolean;
  isSourceFromDeck: boolean;
}

export function canChi(context: ActionCheckContext, players: PlayerState[]): { can: boolean; options: ChiOption[] } {
  const { player, card, sourcePlayerId, sourceType } = context;
  const isDownstream = isDownstreamPlayer(player, sourcePlayerId, players);
  if (!isDownstream && sourceType !== 'drawReveal') return { can: false, options: [] };

  const options = findAllChiOptions(player.hand, card);
  const validOptions = options.filter((opt) => canCompleteBi(player.hand, card, opt));
  return { can: validOptions.length > 0, options: validOptions };
}

export interface ChiOption {
  id: string;
  mainCards: Card[];
  biCards?: Card[];
  type: MeldType;
  huxi: number;
}

export function isDownstreamPlayer(player: PlayerState, sourcePlayerId: string, players: PlayerState[]): boolean {
  if (!sourcePlayerId) return false;
  const source = players.find((p) => p.id === sourcePlayerId);
  if (!source) return false;
  const nextSeat = (source.seat + 1) % players.length;
  return player.seat === nextSeat;
}

export function findAllChiOptions(hand: Card[], target: Card): ChiOption[] {
  const options: ChiOption[] = [];
  const key = cardKey(target);
  const rank = target.rank;
  const suit = target.suit;

  // 普通顺子：target与手牌中两张组成连续三张
  for (let start = Math.max(1, rank - 2); start <= Math.min(8, rank); start++) {
    const ranks = [start, start + 1, start + 2];
    if (!ranks.includes(rank)) continue;
    const needed = ranks.filter((r) => r !== rank);
    const cards: Card[] = [];
    let ok = true;
    for (const r of needed) {
      const found = hand.find((c) => c.suit === suit && c.rank === r && !isSameCard(c, target));
      if (!found) {
        ok = false;
        break;
      }
      cards.push(found);
    }
    if (ok) {
      const type: MeldType = isSpecialSequence(target, cards[0], cards[1]) ? 'specialSequence' : 'sequence';
      options.push({
        id: `chi-${key}-${start}`,
        mainCards: [target, ...cards].sort((a, b) => a.rank - b.rank),
        type,
        huxi: huxiForMeld(type, suit === 'big'),
      });
    }
  }

  // 二七十特殊顺（如果target是2、7、10之一）
  if ([2, 7, 10].includes(rank)) {
    const neededRanks = [2, 7, 10].filter((r) => r !== rank);
    const cards: Card[] = [];
    let ok = true;
    for (const r of neededRanks) {
      const found = hand.find((c) => c.suit === suit && c.rank === r && !isSameCard(c, target));
      if (!found) {
        ok = false;
        break;
      }
      cards.push(found);
    }
    if (ok) {
      options.push({
        id: `chi-${key}-special`,
        mainCards: [target, ...cards].sort((a, b) => a.rank - b.rank),
        type: 'specialSequence',
        huxi: huxiForMeld('specialSequence', suit === 'big'),
      });
    }
  }

  // 大小三搭：target与手牌中两张同rank不同suit
  const crossSuit = suit === 'small' ? 'big' : 'small';
  const sameRankCards = hand.filter((c) => c.rank === rank && c.suit === crossSuit);
  if (sameRankCards.length >= 2) {
    const cards = sameRankCards.slice(0, 2);
    options.push({
      id: `chi-${key}-mixed`,
      mainCards: [target, ...cards].sort((a) => (a.suit === 'big' ? 1 : -1)),
      type: 'mixedTriplet',
      huxi: 0,
    });
  }

  return options;
}

// 比牌检测：吃牌后，若手中仍有与target相同的牌，必须也组成合法组合
export function canCompleteBi(hand: Card[], target: Card, option: ChiOption): boolean {
  const usedIds = new Set(option.mainCards.map((c) => c.id));
  const remaining = hand.filter((c) => !usedIds.has(c.id));
  const sameCards = remaining.filter((c) => isSameCard(c, target));
  if (sameCards.length === 0) return true;

  // 每张相同的牌都必须能组成合法组合
  for (const sameCard of sameCards) {
    const rest = remaining.filter((c) => c.id !== sameCard.id);
    if (!canFormGroupWith(sameCard, rest)) {
      return false;
    }
  }
  return true;
}

export function canFormGroupWith(target: Card, hand: Card[]): boolean {
  // 尝试组成普通顺子、特殊顺、三搭、碰/对子
  const rank = target.rank;
  const suit = target.suit;

  // 碰/对子：需要手中还有一张相同
  if (hand.some((c) => isSameCard(c, target))) return true;

  // 普通顺子
  for (let start = Math.max(1, rank - 2); start <= Math.min(8, rank); start++) {
    const ranks = [start, start + 1, start + 2];
    if (!ranks.includes(rank)) continue;
    const needed = ranks.filter((r) => r !== rank);
    if (needed.every((r) => hand.some((c) => c.suit === suit && c.rank === r))) return true;
  }

  // 特殊顺
  if ([2, 7, 10].includes(rank)) {
    const needed = [2, 7, 10].filter((r) => r !== rank);
    if (needed.every((r) => hand.some((c) => c.suit === suit && c.rank === r))) return true;
  }

  // 大小三搭
  const crossSuit = suit === 'small' ? 'big' : 'small';
  if (hand.filter((c) => c.rank === rank && c.suit === crossSuit).length >= 2) return true;

  return false;
}

export function canPeng(hand: Card[], target: Card): boolean {
  return hand.filter((c) => isSameCard(c, target)).length >= 2;
}

export function canWei(hand: Card[], target: Card): boolean {
  return hand.filter((c) => isSameCard(c, target)).length >= 2;
}

export function canPaoFromHand(hand: Card[], target: Card): boolean {
  return hand.filter((c) => isSameCard(c, target)).length >= 3;
}

export function canTiFromHand(hand: Card[], target: Card): boolean {
  return hand.filter((c) => isSameCard(c, target)).length >= 3;
}

export function findInitialTi(player: PlayerState): Meld | null {
  const groups = countByKey(player.hand, 'key');
  for (const [, cards] of groups) {
    if (cards.length === 4) {
      return {
        id: createMeldId(),
        type: 'ti',
        cards: cards.slice(),
        ownerId: player.id,
        sourceType: 'initial',
        isHidden: true,
        huxi: huxiForMeld('ti', cards[0].suit === 'big'),
      };
    }
  }
  return null;
}

// ==================== 动作构建 ====================

export function buildPengMeld(player: PlayerState, target: Card, sourcePlayerId: string, sourceType: SourceType): Meld {
  const matched = player.hand.filter((c) => isSameCard(c, target)).slice(0, 2);
  return {
    id: createMeldId(),
    type: 'peng',
    cards: [...matched, target],
    ownerId: player.id,
    sourcePlayerId,
    sourceType,
    isHidden: false,
    huxi: huxiForMeld('peng', target.suit === 'big'),
  };
}

export function buildWeiMeld(player: PlayerState, target: Card): Meld {
  const matched = player.hand.filter((c) => isSameCard(c, target));
  return {
    id: createMeldId(),
    type: 'wei',
    cards: [...matched, target],
    ownerId: player.id,
    sourceType: 'drawReveal',
    isHidden: true,
    huxi: huxiForMeld('wei', target.suit === 'big'),
  };
}

export function buildChouWeiMeld(player: PlayerState, target: Card): Meld {
  const matched = player.hand.filter((c) => isSameCard(c, target));
  return {
    id: createMeldId(),
    type: 'chouWei',
    cards: [...matched, target],
    ownerId: player.id,
    sourceType: 'drawReveal',
    isHidden: true,
    huxi: huxiForMeld('chouWei', target.suit === 'big'),
  };
}

export function buildPaoMeldFromHand(player: PlayerState, target: Card, sourcePlayerId: string, sourceType: SourceType): Meld {
  const matched = player.hand.filter((c) => isSameCard(c, target));
  return {
    id: createMeldId(),
    type: 'pao',
    cards: [...matched, target],
    ownerId: player.id,
    sourcePlayerId,
    sourceType,
    isHidden: false,
    huxi: huxiForMeld('pao', target.suit === 'big'),
  };
}

export function buildPaoMeldFromUpgrade(existing: Meld, target: Card, sourcePlayerId: string, sourceType: SourceType): Meld {
  return {
    id: createMeldId(),
    type: 'pao',
    cards: [...existing.cards, target],
    ownerId: existing.ownerId,
    sourcePlayerId,
    sourceType,
    isHidden: false,
    huxi: huxiForMeld('pao', target.suit === 'big'),
    upgradedFrom: existing.type,
  };
}

export function buildTiMeldFromHand(player: PlayerState, target: Card): Meld {
  const matched = player.hand.filter((c) => isSameCard(c, target));
  return {
    id: createMeldId(),
    type: 'ti',
    cards: [...matched, target],
    ownerId: player.id,
    sourceType: 'drawReveal',
    isHidden: true,
    huxi: huxiForMeld('ti', target.suit === 'big'),
  };
}

export function buildTiMeldFromUpgrade(existing: Meld, target: Card): Meld {
  return {
    id: createMeldId(),
    type: 'ti',
    cards: [...existing.cards, target],
    ownerId: existing.ownerId,
    sourceType: 'drawReveal',
    isHidden: true,
    huxi: huxiForMeld('ti', target.suit === 'big'),
    upgradedFrom: existing.type,
  };
}

export function buildChiMeld(player: PlayerState, option: ChiOption, sourcePlayerId: string): Meld {
  return {
    id: createMeldId(),
    type: 'chi',
    cards: option.mainCards.slice(),
    ownerId: player.id,
    sourcePlayerId,
    sourceType: sourcePlayerId === player.id ? 'drawReveal' : 'discard',
    isHidden: false,
    huxi: option.huxi,
  };
}

export function buildBiMeld(target: Card, hand: Card[], sourcePlayerId: string): Meld | null {
  // 为比牌构建一个合法组合
  const options = findAllChiOptions(hand, target);
  if (options.length === 0) return null;
  const option = options[0];
  return {
    id: createMeldId(),
    type: 'chi',
    cards: option.mainCards.slice(),
    ownerId: '',
    sourcePlayerId,
    sourceType: 'discard',
    isHidden: false,
    huxi: option.huxi,
  };
}
