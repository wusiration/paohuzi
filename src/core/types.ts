export type CardSuit = 'small' | 'big';

export interface Card {
  id: string;
  suit: CardSuit;
  rank: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  isRed: boolean;
}

export type MeldType =
  | 'chi'
  | 'peng'
  | 'wei'
  | 'chouWei'
  | 'pao'
  | 'ti'
  | 'sequence'
  | 'specialSequence'
  | 'mixedTriplet'
  | 'pair';

export type SourceType = 'initial' | 'drawReveal' | 'discard' | 'upgrade';

export interface Meld {
  id: string;
  type: MeldType;
  cards: Card[];
  ownerId: string;
  sourcePlayerId?: string;
  sourceType: SourceType;
  isHidden: boolean;
  huxi: number;
  upgradedFrom?: MeldType;
}

export interface PlayerState {
  id: string;
  name: string;
  seat: number;
  hand: Card[];
  handOrder?: string[];
  melds: Meld[];
  score: number;
  huxi: number;
  redCount: number;
  paoTiCount: number;
  passedPengRanks: string[];
  passedHuRanks: string[];
  /** 臭牌：可吃而未吃的牌，之后同牌不能再吃（仍可胡） */
  passedChiRanks: string[];
  isAI: boolean;
  isDealer: boolean;
  isOpenHand: boolean;
}

export type GamePhase =
  | 'INIT'
  | 'DEALING'
  | 'CHECK_INITIAL_TI'
  | 'WAIT_DISCARD'
  | 'DRAW_REVEAL'
  | 'RESOLVE_FORCED_ACTION'
  | 'WAIT_RESPONSE'
  | 'SELECT_CHI'
  | 'RESOLVE_ACTION'
  | 'CHECK_HU'
  | 'SETTLEMENT'
  | 'DRAW_GAME';

export type ActionType = 'hu' | 'pao' | 'ti' | 'wei' | 'chouWei' | 'peng' | 'chi' | 'pass' | 'discard';

export interface PendingAction {
  id: string;
  playerId: string;
  actionType: ActionType;
  card: Card;
  sourcePlayerId: string;
  sourceType: SourceType;
  options?: ChiOption[];
  priority: number;
}

export interface ChiOption {
  id: string;
  mainCards: Card[];
  biCards?: Card[];
  type: MeldType;
  huxi: number;
}

export interface GameState {
  phase: GamePhase;
  dealerId: string;
  currentPlayerId: string;
  deck: Card[];
  /** 挡底：发牌后亮出的墩底牌（仍在牌墩中，最后一个被摸走） */
  bottomCard?: Card;
  revealedCard?: Card;
  lastDiscard?: Card;
  lastDiscardPlayerId?: string;
  players: PlayerState[];
  pendingActions: PendingAction[];
  roundIndex: number;
  baseScore: number;
  turnCount: number;
  logs: GameLog[];
  settlement?: SettlementResult;
}

export interface GameLog {
  id: string;
  turn: number;
  playerId: string;
  action: ActionType;
  card?: Card;
  targetPlayerId?: string;
  timestamp: number;
  message: string;
}

export interface HuResult {
  canHu: boolean;
  huxi: number;
  melds: Meld[];
  pair?: Meld;
  redCount: number;
  bigCount: number;
  smallCount: number;
  isZiMo: boolean;
  sourceType: SourceType;
  sourcePlayerId: string;
}

export interface Mingtang {
  name: string;
  fan: number;
}

export interface SettlementResult {
  winnerId: string;
  isZiMo: boolean;
  sourcePlayerId?: string;
  totalHuxi: number;
  huxiDetails: { type: string; huxi: number }[];
  baseTun: number;
  ziMoTun: number;
  totalTun: number;
  mingtang: Mingtang[];
  totalFan: number;
  baseScore: number;
  scorePerLoser: number;
  totalScore: number;
  loserIds: string[];
  huResult: HuResult;
}

export const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export const RED_RANKS = new Set<number>([2, 7, 10]);

export function isRed(rank: number): boolean {
  return RED_RANKS.has(rank);
}

export function cardKey(card: Card): string {
  return `${card.suit}-${card.rank}`;
}

export function cardRankKey(card: Card): string {
  return String(card.rank);
}
