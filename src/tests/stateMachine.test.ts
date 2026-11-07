import { describe, expect, it } from 'vitest';
import { checkInitialTi, createInitialState, discardCard, drawCard, executeAction, startNewGame } from '../core/stateMachine';
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
    passedChiRanks: overrides.passedChiRanks || [],
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

  it('庄家手牌21张，闲家20张（起手四张相同会提成落地牌）', () => {
    const state = startNewGame(createInitialState());
    const dealer = state.players.find((p) => p.isDealer);
    const nonDealers = state.players.filter((p) => !p.isDealer);
    const dealerTotal = (dealer?.hand.length || 0) + (dealer?.melds.reduce((s, m) => s + m.cards.length, 0) || 0);
    const nonDealerTotals = nonDealers.map(
      (p) => p.hand.length + p.melds.reduce((s, m) => s + m.cards.length, 0)
    );
    expect(dealerTotal).toBe(21);
    expect(nonDealerTotals.every((n) => n === 20)).toBe(true);
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

  it('发牌后挡底为牌墩最后一张', () => {
    const state = startNewGame(createInitialState());
    expect(state.bottomCard).toBeDefined();
    expect(state.bottomCard!.id).toBe(state.deck[state.deck.length - 1].id);
    expect(state.deck.length).toBe(19);
  });

  it('漏碰记录：放弃碰后同牌记入 passedPengRanks', () => {
    const target = makeCard('d5', 'small', 5);
    const p1 = makePlayer({ id: 'p1', seat: 0, hand: [target, makeCard('x1', 'big', 3)], isDealer: true });
    const p2 = makePlayer({ id: 'p2', seat: 1, hand: [makeCard('p5a', 'small', 5), makeCard('p5b', 'small', 5)] });
    const p3 = makePlayer({ id: 'p3', seat: 2, hand: [] });
    let state: GameState = {
      ...createInitialState(),
      phase: 'WAIT_DISCARD',
      dealerId: 'p1',
      currentPlayerId: 'p1',
      players: [p1, p2, p3],
      deck: [makeCard('deck-1', 'big', 9)],
    };

    state = discardCard(state, 'p1', 'd5');
    expect(state.phase).toBe('WAIT_RESPONSE');
    const pengAction = state.pendingActions.find((a) => a.playerId === 'p2' && a.actionType === 'peng');
    const passAction = state.pendingActions.find((a) => a.playerId === 'p2' && a.actionType === 'pass');
    expect(pengAction).toBeDefined();
    expect(passAction).toBeDefined();

    state = executeAction(state, passAction!.id);
    const p2After = state.players.find((p) => p.id === 'p2')!;
    expect(p2After.passedPengRanks).toContain('small-5');
  });

  it('臭牌：可吃而未吃记入 passedChiRanks，之后同牌不再给吃', () => {
    const target = makeCard('c5', 'small', 5);
    // p2 为 p1 下家，手牌 小肆小陆 可吃小五
    const p1 = makePlayer({ id: 'p1', seat: 0, hand: [target], isDealer: true });
    const p2 = makePlayer({ id: 'p2', seat: 1, hand: [makeCard('s4', 'small', 4), makeCard('s6', 'small', 6)] });
    const p3 = makePlayer({ id: 'p3', seat: 2, hand: [] });
    let state: GameState = {
      ...createInitialState(),
      phase: 'WAIT_DISCARD',
      dealerId: 'p1',
      currentPlayerId: 'p1',
      players: [p1, p2, p3],
      deck: [makeCard('deck-1', 'big', 9)],
    };

    state = discardCard(state, 'p1', 'c5');
    const chiAction = state.pendingActions.find((a) => a.playerId === 'p2' && a.actionType === 'chi');
    const passAction = state.pendingActions.find((a) => a.playerId === 'p2' && a.actionType === 'pass');
    expect(chiAction).toBeDefined();

    state = executeAction(state, passAction!.id);
    const p2After = state.players.find((p) => p.id === 'p2')!;
    expect(p2After.passedChiRanks).toContain('small-5');

    // 再次打出小五：p2 不再收到吃（臭牌）
    const target2 = makeCard('c5b', 'small', 5);
    const p1b = makePlayer({ id: 'p1', seat: 0, hand: [target2], isDealer: true });
    const state2: GameState = {
      ...state,
      phase: 'WAIT_DISCARD',
      currentPlayerId: 'p1',
      players: [p1b, p2After, p3],
      pendingActions: [],
      revealedCard: undefined,
      lastDiscard: undefined,
    };
    const afterSecond = discardCard(state2, 'p1', 'c5b');
    const chi2 = afterSecond.pendingActions.find((a) => a.playerId === 'p2' && a.actionType === 'chi');
    expect(chi2).toBeUndefined();
  });
});
