import { describe, expect, it } from 'vitest';
import { createDeck, createInitialGameDeck, dealCards } from '../core/deck';

describe('牌张生成与发牌', () => {
  it('应生成80张牌', () => {
    const deck = createDeck();
    expect(deck.length).toBe(80);
  });

  it('每种牌应有4张', () => {
    const deck = createDeck();
    const groups = new Map<string, number>();
    for (const card of deck) {
      const key = `${card.suit}-${card.rank}`;
      groups.set(key, (groups.get(key) || 0) + 1);
    }
    expect(groups.size).toBe(20);
    for (const count of groups.values()) {
      expect(count).toBe(4);
    }
  });

  it('红牌应为二、七、十、贰、柒、拾', () => {
    const deck = createDeck();
    const redKeys = new Set(deck.filter((c) => c.isRed).map((c) => `${cardKey(c)}`));
    expect(redKeys.size).toBe(6);
    expect(redKeys.has('small-2')).toBe(true);
    expect(redKeys.has('small-7')).toBe(true);
    expect(redKeys.has('small-10')).toBe(true);
    expect(redKeys.has('big-2')).toBe(true);
    expect(redKeys.has('big-7')).toBe(true);
    expect(redKeys.has('big-10')).toBe(true);
  });

  it('发牌后庄家21张、闲家20张、牌墩19张', () => {
    const deck = createInitialGameDeck();
    const { players, remainingDeck } = dealCards(deck, 0);
    expect(players[0].hand.length).toBe(21);
    expect(players[1].hand.length).toBe(20);
    expect(players[2].hand.length).toBe(20);
    expect(remainingDeck.length).toBe(19);
  });

  it('发牌后牌张无重复无缺失', () => {
    const deck = createInitialGameDeck();
    const { players, remainingDeck } = dealCards(deck, 1);
    const allCards = [...players[0].hand, ...players[1].hand, ...players[2].hand, ...remainingDeck];
    expect(allCards.length).toBe(80);
    const ids = new Set(allCards.map((c) => c.id));
    expect(ids.size).toBe(80);
  });
});

function cardKey(card: { suit: string; rank: number }): string {
  return `${card.suit}-${card.rank}`;
}
