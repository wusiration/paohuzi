import { describe, expect, it } from 'vitest';
import { checkInitialTi, createInitialState, drawCard, startNewGame } from '../core/stateMachine';
import type { Card, GameState, PlayerState } from '../core/types';

function makeCard(id: string, suit: 'small' | 'big', rank: number): Card {
  return {
    id,
    suit,
    rank: rank as Card['rank'],
    isRed: [2, 7, 10].includes(rank),
  };
}

function makePlayer(overrides: Partial<PlayerState> & { id: string; seat: number }): PlayerState {
  return {
    id: overrides.id,
    name: overrides.id,
    seat: overrides.seat,
    hand: overrides.hand || [],
    melds: overrides.melds || [],
    score: overrides.score ?? 0,
    huxi: overrides.huxi ?? 0,
    redCount: overrides.redCount ?? 0,
    paoTiCount: overrides.paoTiCount ?? 0,
    passedPengRanks: overrides.passedPengRanks || [],
    passedHuRanks: overrides.passedHuRanks || [],
    isAI: overrides.isAI ?? false,
    isDealer: overrides.isDealer ?? (overrides.seat === 0),
    isOpenHand: overrides.isOpenHand ?? false,
  };
}

describe('状态机', () => {
  it('初始状态为空', () => {
    const state = createInitialState();
    expect(state.phase).toBe('INIT');
    expect(state.players.length).toBe(0);
  });

  it('开始新游戏后进入WAIT_DISCARD', () => {
    const state = startNewGame(createInitialState());
    expect(state.phase).toBe('WAIT_DISCARD');
    expect(state.players.length).toBe(3);
    expect(state.deck.length).toBe(19);
  });

  it('庄家手牌21张，闲家20张', () => {
    const state = startNewGame(createInitialState());
    const dealer = state.players.find((p) => p.isDealer);
    const nonDealers = state.players.filter((p) => !p.isDealer);
    expect(dealer?.hand.length).toBe(21);
    expect(nonDealers.every((p) => p.hand.length === 20)).toBe(true);
  });

  it('庄家为首个currentPlayer', () => {
    const state = startNewGame(createInitialState());
    expect(state.currentPlayerId).toBe(state.dealerId);
  });

  it('起手提牌后应从手牌中移除对应的4张牌', () => {
    const tiCards = [
      makeCard('s5-1', 'small', 5),
      makeCard('s5-2', 'small', 5),
      makeCard('s5-3', 'small', 5),
      makeCard('s5-4', 'small', 5),
    ];
    const otherCards = Array.from({ length: 16 }, (_, i) => makeCard(`other-${i}`, 'big', (i % 10) + 1));
    const player = makePlayer({ id: 'p1', seat: 0, hand: [...tiCards, ...otherCards], isDealer: true });
    const state: GameState = {
      ...createInitialState(),
      phase: 'DEALING',
      dealerId: 'p1',
      currentPlayerId: 'p1',
      players: [player, makePlayer({ id: 'p2', seat: 1, hand: [] }), makePlayer({ id: 'p3', seat: 2, hand: [] })],
      deck: [],
    };

    const newState = checkInitialTi(state);
    const updated = newState.players.find((p) => p.id === 'p1')!;

    expect(updated.melds).toHaveLength(1);
    expect(updated.melds[0].type).toBe('ti');
    expect(updated.melds[0].cards).toHaveLength(4);
    expect(updated.hand).toHaveLength(16);
    expect(updated.hand.some((c) => c.suit === 'small' && c.rank === 5)).toBe(false);
  });

  it('自己摸第四张执行提后，手牌中不应再含该牌', () => {
    const handCards = [
      makeCard('s5-1', 'small', 5),
      makeCard('s5-2', 'small', 5),
      makeCard('s5-3', 'small', 5),
      ...Array.from({ length: 17 }, (_, i) => makeCard(`other-${i}`, 'big', (i % 10) + 1)),
    ];
    const drawnCard = makeCard('s5-drawn', 'small', 5);
    const player = makePlayer({ id: 'p1', seat: 0, hand: handCards, isDealer: true });
    const state: GameState = {
      ...createInitialState(),
      phase: 'DRAW_REVEAL',
      dealerId: 'p1',
      currentPlayerId: 'p1',
      players: [player, makePlayer({ id: 'p2', seat: 1, hand: [] }), makePlayer({ id: 'p3', seat: 2, hand: [] })],
      deck: [drawnCard],
    };

    const newState = drawCard(state, 'p1');
    const updated = newState.players.find((p) => p.id === 'p1')!;

    expect(updated.melds).toHaveLength(1);
    expect(updated.melds[0].type).toBe('ti');
    expect(updated.melds[0].cards).toHaveLength(4);
    expect(updated.hand.some((c) => c.suit === 'small' && c.rank === 5)).toBe(false);
  });
});
