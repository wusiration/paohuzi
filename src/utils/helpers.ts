import type { Card, Meld, MeldType, PlayerState } from '../core/types';

let meldIdCounter = 0;
let pendingActionIdCounter = 0;
let logIdCounter = 0;

export function createMeldId(): string {
  return `meld-${meldIdCounter++}`;
}

export function createPendingActionId(): string {
  return `action-${pendingActionIdCounter++}`;
}

export function createLogId(): string {
  return `log-${logIdCounter++}`;
}

export function resetIds(): void {
  meldIdCounter = 0;
  pendingActionIdCounter = 0;
  logIdCounter = 0;
}

export function nextPlayerId(currentId: string, players: PlayerState[]): string {
  const current = players.find((p) => p.id === currentId);
  if (!current) return players[0].id;
  const nextSeat = (current.seat + 1) % players.length;
  return players.find((p) => p.seat === nextSeat)!.id;
}

export function previousPlayerId(currentId: string, players: PlayerState[]): string {
  const current = players.find((p) => p.id === currentId);
  if (!current) return players[0].id;
  const prevSeat = (current.seat + players.length - 1) % players.length;
  return players.find((p) => p.seat === prevSeat)!.id;
}

export function distanceFromSource(sourceSeat: number, actorSeat: number, playerCount: number): number {
  return (actorSeat - sourceSeat + playerCount) % playerCount;
}

export function huxiForMeld(type: MeldType, isBig: boolean): number {
  switch (type) {
    case 'peng':
      return isBig ? 3 : 1;
    case 'wei':
    case 'chouWei':
      return isBig ? 6 : 3;
    case 'pao':
      return isBig ? 9 : 6;
    case 'ti':
      return isBig ? 12 : 9;
    case 'specialSequence':
      return isBig ? 6 : 3;
    case 'sequence':
    case 'mixedTriplet':
    case 'pair':
    default:
      return 0;
  }
}

export function meldTypeLabel(type: MeldType): string {
  switch (type) {
    case 'chi':
      return '吃';
    case 'peng':
      return '碰';
    case 'wei':
      return '偎';
    case 'chouWei':
      return '臭偎';
    case 'pao':
      return '跑';
    case 'ti':
      return '提';
    case 'sequence':
      return '顺子';
    case 'specialSequence':
      return '特殊顺';
    case 'mixedTriplet':
      return '三搭';
    case 'pair':
      return '将';
    default:
      return '';
  }
}

export function countCards(hand: Card[], keyFn: (c: Card) => string): Map<string, number> {
  const map = new Map<string, number>();
  for (const card of hand) {
    const key = keyFn(card);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

export function cardEqual(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

export function clonePlayer(player: PlayerState): PlayerState {
  return {
    ...player,
    hand: player.hand.map((c) => ({ ...c })),
    melds: player.melds.map((m) => ({ ...m, cards: m.cards.map((c) => ({ ...c })) })),
    passedPengRanks: [...player.passedPengRanks],
    passedHuRanks: [...player.passedHuRanks],
  };
}

export function clonePlayers(players: PlayerState[]): PlayerState[] {
  return players.map(clonePlayer);
}

export function cloneMeld(meld: Meld): Meld {
  return {
    ...meld,
    cards: meld.cards.map((c) => ({ ...c })),
  };
}
