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

export interface DistanceEstimate {
  /** 距完整拆分的估计距离（0.5 步进，越小越接近听牌） */
  distance: number;
  /** 完整牌组数 */
  groups: number;
  /** 半搭子数（对子/连张/间张/跨花色对，每个算 0.5 进度） */
  partials: number;
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

function handSignature(hand: Card[], requirePair: boolean, baseHuxi: number, threshold: number): string {
  // 拆分逻辑只依赖 suit+rank，不依赖具体 id，因此用牌型签名换取跨对局缓存命中
  const keys = hand.map(cardKey).sort().join(',');
  return `${keys}|${requirePair ? 'P' : 'N'}|${baseHuxi}|${threshold}`;
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
 * @param threshold 起胡胡息线：自摸潜力用 15，可胡他人弃牌的稳听线用 18
 */
export function analyzeHand(
  hand: Card[],
  requirePair: boolean,
  baseHuxi: number,
  threshold: number = HU_HUXI_THRESHOLD
): HandAnalysis {
  const signature = handSignature(hand, requirePair, baseHuxi, threshold);
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
    if (totalHuxi >= threshold) {
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
  distanceCache.clear();
}

// ---------------------------------------------------------------------------
// 向听估计（贪心牌块分解）
// ---------------------------------------------------------------------------

const distanceCache = new Map<string, DistanceEstimate>();
const DISTANCE_CACHE_LIMIT = 20000;

/**
 * 估计手牌距完整拆分的距离（向听代理，非精确 shanten）。
 *
 * 贪心提取完整牌组（坎 > 特殊顺 > 普通顺 > 大小三搭），
 * 再提取半搭子（对子 > 连张/间张 > 跨花色对）。
 * distance = 所需牌组数 - 完整组数 - 有效半搭 × 0.5，越小越接近听牌。
 *
 * 用于未听牌时比较"哪手牌离听更近"，精度足够做候选排序。
 */
export function estimateDistance(hand: Card[], requirePair: boolean): DistanceEstimate {
  const keys = hand.map(cardKey).sort().join(',');
  const signature = `${keys}|${requirePair ? 'P' : 'N'}`;
  const cached = distanceCache.get(signature);
  if (cached) return cached;

  // 计数数组：下标 1..10
  const small = new Array<number>(11).fill(0);
  const big = new Array<number>(11).fill(0);
  for (const card of hand) {
    (card.suit === 'small' ? small : big)[card.rank]++;
  }

  let groups = 0;
  let partials = 0;
  let hasPair = false;
  const suits = [small, big];

  // 1) 坎（三张同牌）
  for (const arr of suits) {
    for (let r = 1; r <= 10; r++) {
      while (arr[r] >= 3) {
        arr[r] -= 3;
        groups++;
      }
    }
  }

  // 2) 特殊顺子（一二三 / 二七十）
  for (const arr of suits) {
    while (arr[1] >= 1 && arr[2] >= 1 && arr[3] >= 1) {
      arr[1]--; arr[2]--; arr[3]--;
      groups++;
    }
    while (arr[2] >= 1 && arr[7] >= 1 && arr[10] >= 1) {
      arr[2]--; arr[7]--; arr[10]--;
      groups++;
    }
  }

  // 3) 普通顺子
  for (const arr of suits) {
    for (let r = 1; r <= 8; r++) {
      while (arr[r] >= 1 && arr[r + 1] >= 1 && arr[r + 2] >= 1) {
        arr[r]--; arr[r + 1]--; arr[r + 2]--;
        groups++;
      }
    }
  }

  // 4) 大小三搭（同 rank 跨花色 2+1）
  for (let r = 1; r <= 10; r++) {
    while (small[r] >= 1 && big[r] >= 1 && small[r] + big[r] >= 3) {
      if (small[r] >= big[r]) {
        small[r] -= 2; big[r] -= 1;
      } else {
        big[r] -= 2; small[r] -= 1;
      }
      groups++;
    }
  }

  // 5) 对子（半搭）
  for (const arr of suits) {
    for (let r = 1; r <= 10; r++) {
      while (arr[r] >= 2) {
        arr[r] -= 2;
        partials++;
        hasPair = true;
      }
    }
  }

  // 6) 连张 / 间张（半搭）
  for (const arr of suits) {
    for (let r = 1; r <= 9; r++) {
      while (arr[r] >= 1 && arr[r + 1] >= 1) {
        arr[r]--; arr[r + 1]--;
        partials++;
      }
      if (r <= 8) {
        while (arr[r] >= 1 && arr[r + 2] >= 1) {
          arr[r]--; arr[r + 2]--;
          partials++;
        }
      }
    }
  }

  // 7) 跨花色同 rank（半搭，大小三搭缺一张）
  for (let r = 1; r <= 10; r++) {
    while (small[r] >= 1 && big[r] >= 1) {
      small[r]--; big[r]--;
      partials++;
    }
  }

  // 目标牌组数：手牌 20 张瞄准 21 张（7 组），17 张瞄准 18 张（6 组），
  // 18 张（吃/碰后待打出的瞬态）打出 1 张后瞄准 18 张（6 组）
  const needed = Math.round((hand.length + 1) / 3);
  const usablePartials = Math.min(partials, Math.max(0, needed - groups));
  let distance = needed - groups - usablePartials * 0.5;
  // 有跑/提时胡牌必须有将：没有对子也没有对子半搭，加罚
  if (requirePair && !hasPair) distance += 0.5;

  const result: DistanceEstimate = { distance, groups, partials };
  if (distanceCache.size >= DISTANCE_CACHE_LIMIT) distanceCache.clear();
  distanceCache.set(signature, result);
  return result;
}
