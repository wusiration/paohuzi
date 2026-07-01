import { describe, expect, it } from 'vitest';
import type { HuResult } from '../core/types';
import { computeRedMingtang, computeMingtang, computeBaseTun, computeSettlement } from '../core/scoring';

function makeHuResult(partial: Partial<HuResult>): HuResult {
  return {
    canHu: true,
    huxi: partial.huxi || 18,
    melds: partial.melds || [],
    pair: partial.pair,
    redCount: partial.redCount ?? 0,
    bigCount: partial.bigCount ?? 0,
    smallCount: partial.smallCount ?? 0,
    isZiMo: partial.isZiMo ?? false,
    sourceType: partial.sourceType || 'drawReveal',
    sourcePlayerId: partial.sourcePlayerId || 'player',
  };
}

describe('名堂计算', () => {
  it('乌胡0红5番', () => {
    const mt = computeRedMingtang(0);
    expect(mt).toEqual([{ name: '乌胡', fan: 5 }]);
  });

  it('点胡1红3番', () => {
    const mt = computeRedMingtang(1);
    expect(mt).toEqual([{ name: '点胡', fan: 3 }]);
  });

  it('红胡10-12红2番', () => {
    const mt = computeRedMingtang(10);
    expect(mt).toEqual([{ name: '红胡', fan: 2 }]);
  });

  it('红拐弯13红4番', () => {
    const mt = computeRedMingtang(13);
    expect(mt).toEqual([{ name: '红拐弯', fan: 4 }]);
  });

  it('加红13红以后每多1红加1番', () => {
    const mt = computeRedMingtang(14);
    expect(mt).toContainEqual({ name: '红拐弯', fan: 4 });
    expect(mt).toContainEqual({ name: '加红(1)', fan: 1 });
  });

  it('碰碰胡识别', () => {
    const hu = makeHuResult({
      melds: [
        { id: 'm1', type: 'peng', cards: [], ownerId: 'p', sourceType: 'initial', isHidden: false, huxi: 1 },
        { id: 'm2', type: 'peng', cards: [], ownerId: 'p', sourceType: 'initial', isHidden: false, huxi: 1 },
        { id: 'm3', type: 'pair', cards: [], ownerId: 'p', sourceType: 'initial', isHidden: false, huxi: 0 },
      ],
    });
    const mt = computeMingtang(hu);
    expect(mt).toContainEqual({ name: '碰碰胡', fan: 5 });
  });

  it('十八大递增正确', () => {
    const hu = makeHuResult({ bigCount: 20 });
    const mt = computeMingtang(hu);
    expect(mt).toContainEqual({ name: '十八大(20)', fan: 6 });
  });

  it('不同类别名堂相加', () => {
    const hu = makeHuResult({ redCount: 0 });
    hu.melds = [
      { id: 'm1', type: 'peng', cards: [], ownerId: 'p', sourceType: 'initial', isHidden: false, huxi: 1 },
      { id: 'm2', type: 'peng', cards: [], ownerId: 'p', sourceType: 'initial', isHidden: false, huxi: 1 },
      { id: 'm3', type: 'pair', cards: [], ownerId: 'p', sourceType: 'initial', isHidden: false, huxi: 0 },
    ];
    const mt = computeMingtang(hu, 2, 10, false);
    const totalFan = mt.reduce((s, m) => s + m.fan, 0);
    expect(totalFan).toBe(10);
  });
});

describe('囤数与结算', () => {
  it('基础囤公式正确', () => {
    expect(computeBaseTun(15)).toBe(1);
    expect(computeBaseTun(18)).toBe(2);
    expect(computeBaseTun(20)).toBe(2);
    expect(computeBaseTun(21)).toBe(3);
  });

  it('15胡自摸按2囤', () => {
    const hu = makeHuResult({ huxi: 15, isZiMo: true });
    const players = [
      { id: 'player', name: '我', seat: 0, hand: [], melds: [], score: 0, huxi: 0, redCount: 0, paoTiCount: 0, passedPengRanks: [], passedHuRanks: [], isAI: false, isDealer: true, isOpenHand: false },
      { id: 'ai-1', name: 'AI左', seat: 1, hand: [], melds: [], score: 0, huxi: 0, redCount: 0, paoTiCount: 0, passedPengRanks: [], passedHuRanks: [], isAI: true, isDealer: false, isOpenHand: false },
      { id: 'ai-2', name: 'AI右', seat: 2, hand: [], melds: [], score: 0, huxi: 0, redCount: 0, paoTiCount: 0, passedPengRanks: [], passedHuRanks: [], isAI: true, isDealer: false, isOpenHand: false },
    ];
    const winner = players[0];
    const result = computeSettlement(winner, hu, players, 1, 1, 0);
    expect(result.totalTun).toBe(2);
  });

  it('18胡胡别人明牌不加自摸囤', () => {
    const hu = makeHuResult({ huxi: 18, isZiMo: false });
    const players = [
      { id: 'player', name: '我', seat: 0, hand: [], melds: [], score: 0, huxi: 0, redCount: 0, paoTiCount: 0, passedPengRanks: [], passedHuRanks: [], isAI: false, isDealer: true, isOpenHand: false },
      { id: 'ai-1', name: 'AI左', seat: 1, hand: [], melds: [], score: 0, huxi: 0, redCount: 0, paoTiCount: 0, passedPengRanks: [], passedHuRanks: [], isAI: true, isDealer: false, isOpenHand: false },
      { id: 'ai-2', name: 'AI右', seat: 2, hand: [], melds: [], score: 0, huxi: 0, redCount: 0, paoTiCount: 0, passedPengRanks: [], passedHuRanks: [], isAI: true, isDealer: false, isOpenHand: false },
    ];
    const winner = players[0];
    const result = computeSettlement(winner, hu, players, 1, 1, 0);
    expect(result.ziMoTun).toBe(0);
    expect(result.totalTun).toBe(2);
  });

  it('明牌结算翻倍', () => {
    const hu = makeHuResult({
      huxi: 18,
      isZiMo: false,
      redCount: 3,
      melds: [
        { id: 'm1', type: 'sequence', cards: [], ownerId: 'p', sourceType: 'initial', isHidden: false, huxi: 0 },
      ],
    });
    const players = [
      { id: 'player', name: '我', seat: 0, hand: [], melds: [], score: 0, huxi: 0, redCount: 0, paoTiCount: 0, passedPengRanks: [], passedHuRanks: [], isAI: false, isDealer: false, isOpenHand: true },
      { id: 'ai-1', name: 'AI左', seat: 1, hand: [], melds: [], score: 0, huxi: 0, redCount: 0, paoTiCount: 0, passedPengRanks: [], passedHuRanks: [], isAI: true, isDealer: false, isOpenHand: false },
      { id: 'ai-2', name: 'AI右', seat: 2, hand: [], melds: [], score: 0, huxi: 0, redCount: 0, paoTiCount: 0, passedPengRanks: [], passedHuRanks: [], isAI: true, isDealer: false, isOpenHand: false },
    ];
    const winner = players[0];
    const result = computeSettlement(winner, hu, players, 1, 2, 10);
    expect(result.scorePerLoser).toBe(4); // 2囤 * 1番 * 1底分 * 2明牌翻倍
    expect(result.totalScore).toBe(8);
  });
});
