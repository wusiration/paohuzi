import { describe, expect, it } from 'vitest';
import { createInitialState, startNewGame } from '../core/stateMachine';

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
});
