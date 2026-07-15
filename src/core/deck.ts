import type { Card, CardSuit, PlayerState, SourceType } from './types';
import { RANKS, isRed } from './types';

let cardIdCounter = 0;

export function createDeck(): Card[] {
  const deck: Card[] = [];
  const suits: CardSuit[] = ['small', 'big'];
  for (const suit of suits) {
    for (const rank of RANKS) {
      for (let i = 0; i < 4; i++) {
        deck.push({
          id: `${suit}-${rank}-${cardIdCounter++}`,
          suit,
          rank,
          isRed: isRed(rank),
        });
      }
    }
  }
  return deck;
}

export function shuffle<T>(array: T[]): T[] {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createInitialGameDeck(): Card[] {
  return shuffle(createDeck());
}

export function dealCards(deck: Card[], dealerSeat: number): {
  players: PlayerState[];
  remainingDeck: Card[];
} {
  const playerIds = ['player', 'ai-1', 'ai-2'];
  const playerNames = ['我', 'AI左', 'AI右'];
  const hands: Card[][] = [[], [], []];

  const dealOrder: number[] = [];
  for (let i = 0; i < 3; i++) {
    dealOrder.push((dealerSeat + i) % 3);
  }

  let deckIndex = 0;

  // 庄家21张，闲家20张，按逆时针顺序发牌
  const counts = [21, 20, 20];
  for (let round = 0; round < 21; round++) {
    for (const seat of dealOrder) {
      if (hands[seat].length < counts[dealOrder.indexOf(seat)]) {
        hands[seat].push(deck[deckIndex++]);
      }
    }
  }

  const players: PlayerState[] = playerIds.map((id, index) => {
    const groupedHand = groupHandForDisplay(hands[index]);
    return {
      id,
      name: playerNames[index],
      seat: index,
      hand: groupedHand,
      handOrder: groupedHand.map((c) => c.id),
      melds: [],
      score: 0,
      huxi: 0,
      redCount: 0,
      paoTiCount: 0,
      passedPengRanks: [],
      passedHuRanks: [],
      isAI: id !== 'player',
      isDealer: index === dealerSeat,
      isOpenHand: false,
    };
  });

  return {
    players,
    remainingDeck: deck.slice(deckIndex),
  };
}

export function compareCards(a: Card, b: Card): number {
  if (a.suit !== b.suit) {
    return a.suit === 'big' ? 1 : -1;
  }
  return a.rank - b.rank;
}

export function sortHand(hand: Card[]): Card[] {
  return hand.slice().sort(compareCards);
}

/**
 * 按对子/坎/顺子的优先级对手牌进行 UI 分组排序。
 * 分组优先级：三张相同（坎）> 两张相同（对子）> 同花色顺子 > 单张。
 * 同一组内按点数升序，组间按原比较顺序保持稳定。
 */
export function groupHandForDisplay(hand: Card[]): Card[] {
  const remaining = hand.slice().sort(compareCards);
  const groups: Card[][] = [];

  // 辅助：从 remaining 中移除指定 id 的牌并返回
  const takeById = (id: string): Card | undefined => {
    const idx = remaining.findIndex((c) => c.id === id);
    if (idx >= 0) return remaining.splice(idx, 1)[0];
    return undefined;
  };

  // 1. 优先找三张相同（坎）
  const tripletKeys = new Map<string, number>();
  for (const card of remaining) {
    const key = `${card.suit}-${card.rank}`;
    tripletKeys.set(key, (tripletKeys.get(key) || 0) + 1);
  }
  for (const [key, count] of tripletKeys) {
    const [suit, rankStr] = key.split('-');
    const rank = Number(rankStr);
    const tripletCount = Math.floor(count / 3);
    for (let i = 0; i < tripletCount; i++) {
      const group: Card[] = [];
      for (let j = 0; j < 3; j++) {
        const card = remaining.find((c) => c.suit === suit && c.rank === rank);
        if (card) {
          const taken = takeById(card.id);
          if (taken) group.push(taken);
        }
      }
      if (group.length === 3) groups.push(group);
    }
  }

  // 2. 再找两张相同（对子）
  const pairKeys = new Map<string, number>();
  for (const card of remaining) {
    const key = `${card.suit}-${card.rank}`;
    pairKeys.set(key, (pairKeys.get(key) || 0) + 1);
  }
  for (const [key, count] of pairKeys) {
    const [suit, rankStr] = key.split('-');
    const rank = Number(rankStr);
    const pairCount = Math.floor(count / 2);
    for (let i = 0; i < pairCount; i++) {
      const group: Card[] = [];
      for (let j = 0; j < 2; j++) {
        const card = remaining.find((c) => c.suit === suit && c.rank === rank);
        if (card) {
          const taken = takeById(card.id);
          if (taken) group.push(taken);
        }
      }
      if (group.length === 2) groups.push(group);
    }
  }

  // 3. 找同花色顺子（普通顺子，连续三张）
  for (const suit of ['small', 'big'] as CardSuit[]) {
    const suitCards = remaining.filter((c) => c.suit === suit);
    const rankCount = new Map<number, Card[]>();
    for (const card of suitCards) {
      if (!rankCount.has(card.rank)) rankCount.set(card.rank, []);
      rankCount.get(card.rank)!.push(card);
    }
    for (let rank = 1; rank <= 8; rank++) {
      while (
        rankCount.get(rank)?.length &&
        rankCount.get(rank + 1)?.length &&
        rankCount.get(rank + 2)?.length
      ) {
        const group: Card[] = [];
        for (let r = rank; r <= rank + 2; r++) {
          const cards = rankCount.get(r)!;
          const card = cards[0];
          const taken = takeById(card.id);
          if (taken) {
            group.push(taken);
            cards.shift();
          }
        }
        if (group.length === 3) groups.push(group);
      }
    }
  }

  // 4. 剩余单张按原 compareCards 顺序追加
  remaining.sort(compareCards);
  if (remaining.length > 0) {
    groups.push(remaining);
  }

  return groups.flat();
}

export function sourceTypeLabel(sourceType: SourceType): string {
  switch (sourceType) {
    case 'initial':
      return '起手';
    case 'drawReveal':
      return '摸牌';
    case 'discard':
      return '出牌';
    case 'upgrade':
      return '升级';
    default:
      return '';
  }
}
