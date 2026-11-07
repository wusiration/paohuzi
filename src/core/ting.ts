import type { Card, CardSuit } from './types';
import { cardKey, isRed, RANKS } from './types';
import { splitHand } from './solver';

/**
 * 听牌/向听分析模块。
 *
 * 基于 solver 的真实拆分能力，枚举"摸进每种牌"后的手牌合法性，
 * 为 AI 提供比"胡息占比"准确得多的听牌判断。
 */

/** 起胡胡息门槛。AI 用自摸线（15）作为"可胡潜力"的保守估计。 */
export const HU_HUXI_THRESHOLD = 15;

export interface HandAnalysis {
  /** 是否听牌：摸进一张即可达到起胡门槛 */
  isTing: boolean;
  /** 能胡的牌 key 列表（cardKey 格式，如 'small-3'） */
  winningKeys: string[];
  /** 能胡的牌型种数 */
  winningCount: number;
}

interface CardType {
  suit: CardSuit;
  rank: (typeof RANKS)[number];
}

const ALL_TYPES: CardType[] = (['small', 'big'] as CardSuit[]).flatMap((suit) =>
  RANKS.map((rank) => ({ suit, rank }))
);

const analysisCache = new Map<string, HandAnalysis>();
const CACHE_LIMIT = 8000;

interface QuickSplit {
  valid: boolean;
  huxi: number;
}

// splitHand 轻量结果缓存：AI 场景 isZiMo 固定为 false，结果只依赖牌型构成
const splitCache = new Map<string, QuickSplit>();
const SPLIT_CACHE_LIMIT = 20000;

function quickSplit(hand: Card[], requirePair: boolean): QuickSplit {
  const keys = hand.map(cardKey).sort().join(',');
  const signature = `${keys}|${requirePair ? 'P' : 'N'}`;
  const cached = splitCache.get(signature);
  if (cached) return cached;

  const split = splitHand(hand, 'ai-probe', requirePair, false);
  const result: QuickSplit = { valid: split.valid, huxi: split.huxi };
  if (splitCache.size >= SPLIT_CACHE_LIMIT) splitCache.clear();
  splitCache.set(signature, result);
  return result;
}

/**
 * 剪枝：只保留可能与手牌组成牌组的摸牌类型。
 * 一张与手牌毫无关联的孤张摸牌不可能参与任何牌组（对子/坎/顺子/特殊顺/三搭）。
 */
function relevantTypes(hand: Card[]): CardType[] {
  const relevant = new Set<string>();
  const specialRanks = [1, 2, 3, 7, 10];
  for (const card of hand) {
    // 同牌（对子/坎）
    relevant.add(`${card.suit}-${card.rank}`);
    // 同花色 ±2（普通顺子）
    for (let dr = -2; dr <= 2; dr++) {
      const rank = card.rank + dr;
      if (rank >= 1 && rank <= 10) relevant.add(`${card.suit}-${rank}`);
    }
    // 特殊顺子（一二三 / 贰柒拾）的非相邻搭档
    if (specialRanks.includes(card.rank)) {
      for (const rank of specialRanks) relevant.add(`${card.suit}-${rank}`);
    }
    // 跨花色同 rank（大小三搭）
    const cross = card.suit === 'small' ? 'big' : 'small';
    relevant.add(`${cross}-${card.rank}`);
  }
  return ALL_TYPES.filter((t) => relevant.has(`${t.suit}-${t.rank}`));
}

function handSignature(hand: Card[], requirePair: boolean, baseHuxi: number): string {
  // 拆分逻辑只依赖 suit+rank，不依赖具体 id，因此用牌型签名换取跨对局缓存命中
  const keys = hand.map(cardKey).sort().join(',');
  return `${keys}|${requirePair ? 'P' : 'N'}|${baseHuxi}`;
}

function makeProbeCard(type: CardType): Card {
  return {
    id: `probe-${type.suit}-${type.rank}`,
    suit: type.suit,
    rank: type.rank,
    isRed: isRed(type.rank),
  };
}

/**
 * 分析手牌：枚举所有可能摸进的牌，统计能达到起胡门槛的牌型。
 *
 * @param hand 手牌（不含落地牌）
 * @param requirePair 有跑/提落地时胡牌必须含将
 * @param baseHuxi 已落地牌组的胡息（player.huxi）
 */
export function analyzeHand(hand: Card[], requirePair: boolean, baseHuxi: number): HandAnalysis {
  const signature = handSignature(hand, requirePair, baseHuxi);
  const cached = analysisCache.get(signature);
  if (cached) return cached;

  const countByType = new Map<string, number>();
  for (const card of hand) {
    const key = cardKey(card);
    countByType.set(key, (countByType.get(key) ?? 0) + 1);
  }

  const winningKeys: string[] = [];
  for (const type of relevantTypes(hand)) {
    const key = `${type.suit}-${type.rank}`;
    // 手牌中已有 4 张同牌，不可能再摸进
    if ((countByType.get(key) ?? 0) >= 4) continue;

    const probe = [...hand, makeProbeCard(type)];
    const split = quickSplit(probe, requirePair);
    if (!split.valid) continue;

    const totalHuxi = baseHuxi + split.huxi;
    if (totalHuxi >= HU_HUXI_THRESHOLD) {
      winningKeys.push(key);
    }
  }

  const result: HandAnalysis = {
    isTing: winningKeys.length > 0,
    winningKeys,
    winningCount: winningKeys.length,
  };

  if (analysisCache.size >= CACHE_LIMIT) {
    analysisCache.clear();
  }
  analysisCache.set(signature, result);
  return result;
}

/** 清空分析缓存（测试用） */
export function clearAnalysisCache(): void {
  analysisCache.clear();
  splitCache.clear();
}
