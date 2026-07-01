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

  const players: PlayerState[] = playerIds.map((id, index) => ({
    id,
    name: playerNames[index],
    seat: index,
    hand: hands[index].sort(compareCards),
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
  }));

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
