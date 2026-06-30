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

  it('splitHand 支持三张相同：非自摸算碰', () => {
    const hand = [
      makeCard('big', 1, 'a'),
      makeCard('big', 1, 'b'),
      makeCard('big', 1, 'c'),
      makeCard('small', 5, 'd'),
      makeCard('small', 5, 'e'),
    ];
    const result = splitHand(hand, 'player', false, false);
    expect(result.valid).toBe(true);
    expect(result.melds.some((m) => m.type === 'peng')).toBe(true);
    expect(result.huxi).toBe(3);
  });

  it('splitHand 支持三张相同：自摸算偎', () => {
    const hand = [
      makeCard('big', 1, 'a'),
      makeCard('big', 1, 'b'),
      makeCard('big', 1, 'c'),
      makeCard('small', 5, 'd'),
      makeCard('small', 5, 'e'),
    ];
    const result = splitHand(hand, 'player', false, true);
    expect(result.valid).toBe(true);
    expect(result.melds.some((m) => m.type === 'wei')).toBe(true);
    expect(result.huxi).toBe(6);
  });

  it('15-17胡息胡别人明牌：有名堂可胡', () => {
    // 5 个大字非红碰（已在 melds 中） + 小字非红碰，extra 组成该小字碰
    // 乌胡（0 红）属于有效名堂
    const player = makePlayer([
      makeCard('small', 8, 'f1'),
      makeCard('small', 8, 'f2'),
    ]);
    player.melds = [
      { id: 'm1', type: 'peng', cards: [makeCard('big', 1, 'a1'), makeCard('big', 1, 'a2'), makeCard('big', 1, 'a3')], ownerId: 'player', sourceType: 'discard', isHidden: false, huxi: 3 },
      { id: 'm2', type: 'peng', cards: [makeCard('big', 3, 'b1'), makeCard('big', 3, 'b2'), makeCard('big', 3, 'b3')], ownerId: 'player', sourceType: 'discard', isHidden: false, huxi: 3 },
      { id: 'm3', type: 'peng', cards: [makeCard('big', 4, 'c1'), makeCard('big', 4, 'c2'), makeCard('big', 4, 'c3')], ownerId: 'player', sourceType: 'discard', isHidden: false, huxi: 3 },
      { id: 'm4', type: 'peng', cards: [makeCard('big', 5, 'd1'), makeCard('big', 5, 'd2'), makeCard('big', 5, 'd3')], ownerId: 'player', sourceType: 'discard', isHidden: false, huxi: 3 },
      { id: 'm5', type: 'peng', cards: [makeCard('big', 6, 'e1'), makeCard('big', 6, 'e2'), makeCard('big', 6, 'e3')], ownerId: 'player', sourceType: 'discard', isHidden: false, huxi: 3 },
    ];
    const extra = makeCard('small', 8, 't');
    const result = calculateHu(player, extra, 'ai-1', 'drawReveal', false);
    expect(result.canHu).toBe(true);
    expect(result.huxi).toBe(16);
    expect(result.redCount).toBe(0);
    expect(canHu(player, extra, 'ai-1', 'drawReveal', false)).toBe(true);
  });

  it('15-17胡息胡别人明牌：只有普通牌型不可胡', () => {
    // 4 个大字非红碰 + 小一二三特殊顺 + 小字红碰（small-2），extra 组成该小字碰
    // redCount=3，有普通牌型但无有效名堂（非碰碰胡）
    const player = makePlayer([
      makeCard('small', 1, 'g1'),
      makeCard('small', 2, 'g2'),
      makeCard('small', 3, 'g3'),
      makeCard('small', 2, 'f1'),
      makeCard('small', 2, 'f2'),
    ]);
    player.melds = [
      { id: 'm1', type: 'peng', cards: [makeCard('big', 1, 'a1'), makeCard('big', 1, 'a2'), makeCard('big', 1, 'a3')], ownerId: 'player', sourceType: 'discard', isHidden: false, huxi: 3 },
      { id: 'm2', type: 'peng', cards: [makeCard('big', 3, 'b1'), makeCard('big', 3, 'b2'), makeCard('big', 3, 'b3')], ownerId: 'player', sourceType: 'discard', isHidden: false, huxi: 3 },
      { id: 'm3', type: 'peng', cards: [makeCard('big', 4, 'c1'), makeCard('big', 4, 'c2'), makeCard('big', 4, 'c3')], ownerId: 'player', sourceType: 'discard', isHidden: false, huxi: 3 },
      { id: 'm4', type: 'peng', cards: [makeCard('big', 5, 'd1'), makeCard('big', 5, 'd2'), makeCard('big', 5, 'd3')], ownerId: 'player', sourceType: 'discard', isHidden: false, huxi: 3 },
    ];
    const extra = makeCard('small', 2, 't');
    const result = calculateHu(player, extra, 'ai-1', 'drawReveal', false);
    expect(result.canHu).toBe(true);
    expect(result.huxi).toBe(16);
    expect(result.redCount).toBe(4);
    expect(canHu(player, extra, 'ai-1', 'drawReveal', false)).toBe(false);
  });
});
