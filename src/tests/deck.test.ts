import { describe, expect, it } from 'vitest';
import { createDeck, createInitialGameDeck, dealCards, groupHandForDisplay } from '../core/deck';

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

  it('groupHandForDisplay 应把三张相同牌放在一起', () => {
    const deck = createDeck();
    const small7s = deck.filter((c) => c.suit === 'small' && c.rank === 7).slice(0, 3);
    const small5 = deck.find((c) => c.suit === 'small' && c.rank === 5)!;
    const hand = [small5, ...small7s];
    const grouped = groupHandForDisplay(hand);
    const ranks = grouped.map((c) => c.rank);
    // 三张 7 应连续出现
    expect(ranks).toEqual([7, 7, 7, 5]);
  });

  it('groupHandForDisplay 应优先组对子，其次组顺子', () => {
    const deck = createDeck();
    // 组成：small-5 两张、small-6 一张、small-7 一张，可组成对子 5 或顺子 5-6-7
    const cards = [
      ...deck.filter((c) => c.suit === 'small' && c.rank === 5).slice(0, 2),
      deck.find((c) => c.suit === 'small' && c.rank === 6)!,
      deck.find((c) => c.suit === 'small' && c.rank === 7)!,
    ];
    const grouped = groupHandForDisplay(cards);
    const ranks = grouped.map((c) => c.rank);
    // 期望对子 5 先被提出，剩下 6、7 为单张
    expect(ranks.slice(0, 2)).toEqual([5, 5]);
  });
});

function cardKey(card: { suit: string; rank: number }): string {
  return `${card.suit}-${card.rank}`;
}
