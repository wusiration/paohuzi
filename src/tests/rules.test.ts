import { describe, expect, it } from 'vitest';
import type { Card, PlayerState, SourceType } from '../core/types';
import { isSequence, isSpecialSequence, isMixedTriplet, canPeng, canWei, canPaoFromHand, canTiFromHand, findAllChiOptions, canCompleteBi, canChi, isDownstreamPlayer } from '../core/rules';

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

const players: PlayerState[] = [
  makePlayer([]),
  { ...makePlayer([]), id: 'ai-1', seat: 1, isAI: true, isDealer: false },
  { ...makePlayer([]), id: 'ai-2', seat: 2, isAI: true, isDealer: false },
];

describe('基础牌组判断', () => {
  it('普通顺子：同花色连续三张', () => {
    expect(isSequence(makeCard('small', 1, 'a'), makeCard('small', 2, 'b'), makeCard('small', 3, 'c'))).toBe(true);
    expect(isSequence(makeCard('small', 1, 'a'), makeCard('big', 2, 'b'), makeCard('small', 3, 'c'))).toBe(false);
    expect(isSequence(makeCard('small', 1, 'a'), makeCard('small', 2, 'b'), makeCard('small', 4, 'c'))).toBe(false);
  });

  it('特殊顺子：一二三、二七十', () => {
    expect(isSpecialSequence(makeCard('small', 1, 'a'), makeCard('small', 2, 'b'), makeCard('small', 3, 'c'))).toBe(true);
    expect(isSpecialSequence(makeCard('small', 2, 'a'), makeCard('small', 7, 'b'), makeCard('small', 10, 'c'))).toBe(true);
    expect(isSpecialSequence(makeCard('big', 2, 'a'), makeCard('big', 7, 'b'), makeCard('big', 10, 'c'))).toBe(true);
    expect(isSpecialSequence(makeCard('small', 1, 'a'), makeCard('small', 2, 'b'), makeCard('small', 4, 'c'))).toBe(false);
  });

  it('大小三搭：同数字大小字混合三张', () => {
    expect(isMixedTriplet(makeCard('small', 2, 'a'), makeCard('small', 2, 'b'), makeCard('big', 2, 'c'))).toBe(true);
    expect(isMixedTriplet(makeCard('small', 2, 'a'), makeCard('big', 2, 'b'), makeCard('big', 2, 'c'))).toBe(true);
    expect(isMixedTriplet(makeCard('small', 2, 'a'), makeCard('small', 2, 'b'), makeCard('small', 2, 'c'))).toBe(false);
  });
});

describe('动作检测', () => {
  it('碰：手中有两张相同', () => {
    const hand = [makeCard('small', 2, 'a'), makeCard('small', 2, 'b'), makeCard('small', 3, 'c')];
    expect(canPeng(hand, makeCard('small', 2, 't'))).toBe(true);
    expect(canPeng(hand, makeCard('small', 5, 't'))).toBe(false);
  });

  it('偎：手中有两张相同', () => {
    const hand = [makeCard('big', 7, 'a'), makeCard('big', 7, 'b')];
    expect(canWei(hand, makeCard('big', 7, 't'))).toBe(true);
  });

  it('跑：手中有三张相同', () => {
    const hand = [makeCard('small', 2, 'a'), makeCard('small', 2, 'b'), makeCard('small', 2, 'c')];
    expect(canPaoFromHand(hand, makeCard('small', 2, 't'))).toBe(true);
  });

  it('提：手中有三张相同', () => {
    const hand = [makeCard('big', 10, 'a'), makeCard('big', 10, 'b'), makeCard('big', 10, 'c')];
    expect(canTiFromHand(hand, makeCard('big', 10, 't'))).toBe(true);
  });

  it('吃：可组成普通顺子', () => {
    const hand = [makeCard('small', 1, 'a'), makeCard('small', 3, 'b')];
    const options = findAllChiOptions(hand, makeCard('small', 2, 't'));
    expect(options.length).toBeGreaterThan(0);
  });

  it('吃：二七十特殊顺', () => {
    const hand = [makeCard('small', 7, 'a'), makeCard('small', 10, 'b')];
    const options = findAllChiOptions(hand, makeCard('small', 2, 't'));
    expect(options.some((o) => o.type === 'specialSequence')).toBe(true);
  });

  it('吃：下家可吃，非下家不能吃', () => {
    const source = players.find((p) => p.id === 'ai-1')!;
    const downstream = players.find((p) => p.seat === (source.seat + 1) % 3)!;
    const nonDownstream = players.find((p) => p.seat !== (source.seat + 1) % 3 && p.id !== source.id)!;

    const hand = [makeCard('small', 1, 'a'), makeCard('small', 3, 'b')];
    const card = makeCard('small', 2, 't');

    expect(isDownstreamPlayer(downstream, source.id, players)).toBe(true);
    expect(isDownstreamPlayer(nonDownstream, source.id, players)).toBe(false);

    const downstreamCtx = { player: { ...downstream, hand }, card, sourcePlayerId: source.id, sourceType: 'discard' as SourceType, isSelfDraw: false, isSourceFromDeck: false };
    expect(canChi(downstreamCtx, players).can).toBe(true);

    const nonDownstreamCtx = { player: { ...nonDownstream, hand }, card, sourcePlayerId: source.id, sourceType: 'discard' as SourceType, isSelfDraw: false, isSourceFromDeck: false };
    expect(canChi(nonDownstreamCtx, players).can).toBe(false);
  });

  it('比牌：吃后剩余同牌必须能组成组合', () => {
    // 手牌 small-1, small-2, small-2, small-3，吃 small-2 需要比出另一张 small-2
    const hand = [
      makeCard('small', 1, 'a'),
      makeCard('small', 2, 'b'),
      makeCard('small', 2, 'c'),
      makeCard('small', 3, 'd'),
    ];
    const options = findAllChiOptions(hand, makeCard('small', 2, 't'));
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((opt) => canCompleteBi(hand, makeCard('small', 2, 't'), opt))).toBe(true);
  });
});
