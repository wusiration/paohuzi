import { describe, expect, it } from 'vitest';
import type { Card, PlayerState } from '../core/types';
import { splitHand, calculateHu, canHu } from '../core/solver';

function makeCard(suit: 'small' | 'big', rank: number, id: string): Card {
  return { id, suit, rank: rank as Card['rank'], isRed: [2, 7, 10].includes(rank) };
}

function makePlayer(hand: Card[]): PlayerState {
  return {
    id: 'player',
    name: '我',
    seat: 0,
    hand,
    melds: [],
    score: 0,
    huxi: 0,
    redCount: 0,
    paoTiCount: 0,
    passedPengRanks: [],
    passedHuRanks: [],
    isAI: false,
    isDealer: true,
  };
}

describe('胡牌求解', () => {
  it('普通顺子加对子可胡', () => {
    const hand = [
      makeCard('small', 1, 'a'),
      makeCard('small', 2, 'b'),
      makeCard('small', 3, 'c'),
      makeCard('small', 4, 'd'),
      makeCard('small', 5, 'e'),
      makeCard('small', 6, 'f'),
      makeCard('small', 7, 'g'),
      makeCard('small', 7, 'h'),
    ];
    const result = splitHand(hand, 'player', false);
    expect(result.valid).toBe(true);
  });

  it('特殊顺子一二三计胡息', () => {
    const hand = [
      makeCard('small', 1, 'a'),
      makeCard('small', 2, 'b'),
      makeCard('small', 3, 'c'),
      makeCard('small', 7, 'd'),
      makeCard('small', 7, 'e'),
    ];
    const result = splitHand(hand, 'player', false);
    expect(result.valid).toBe(true);
    expect(result.huxi).toBe(3);
  });

  it('有跑提时必须有且仅有一对将', () => {
    const player = makePlayer([
      makeCard('small', 1, 'a'),
      makeCard('small', 2, 'b'),
      makeCard('small', 3, 'c'),
    ]);
    player.melds = [{
      id: 'm1',
      type: 'pao',
      cards: [makeCard('small', 5, 'x'), makeCard('small', 5, 'y'), makeCard('small', 5, 'z'), makeCard('small', 5, 'w')],
      ownerId: 'player',
      sourceType: 'initial',
      isHidden: false,
      huxi: 6,
    }];
    const result = splitHand(player.hand, 'player', true);
    expect(result.valid).toBe(false);
  });

  it('自摸15胡可胡', () => {
    // 构造15胡：大壹贰叁(6) + 大二七十(6) + 小一二三(3) + 小四五六(0)
    const player = makePlayer([
      makeCard('big', 1, 'a'),
      makeCard('big', 2, 'b'),
      makeCard('big', 3, 'c'),
      makeCard('big', 2, 'd'),
      makeCard('big', 7, 'e'),
      makeCard('big', 10, 'f'),
      makeCard('small', 1, 'g'),
      makeCard('small', 2, 'h'),
      makeCard('small', 3, 'i'),
      makeCard('small', 4, 'j'),
      makeCard('small', 5, 'k'),
    ]);
    const extra = makeCard('small', 6, 't');
    const result = calculateHu(player, extra, 'player', 'drawReveal', true);
    expect(result.canHu).toBe(true);
    expect(result.huxi).toBe(15);
    expect(canHu(player, extra, 'player', 'drawReveal', true)).toBe(true);
  });

  it('低于15胡不能胡', () => {
    const player = makePlayer([
      makeCard('small', 1, 'a'),
      makeCard('small', 2, 'b'),
      makeCard('small', 3, 'c'),
      makeCard('small', 4, 'd'),
      makeCard('small', 5, 'e'),
      makeCard('small', 6, 'f'),
      makeCard('small', 7, 'g'),
      makeCard('small', 7, 'h'),
    ]);
    const extra = makeCard('small', 7, 't');
    expect(canHu(player, extra, 'player', 'drawReveal', true)).toBe(false);
  });
});
