import type { Card, HuResult, Mingtang, SettlementResult, PlayerState } from './types';

export function computeRedMingtang(redCount: number): Mingtang[] {
  const result: Mingtang[] = [];
  if (redCount === 0) {
    result.push({ name: '乌胡', fan: 5 });
  } else if (redCount === 1) {
    result.push({ name: '点胡', fan: 3 });
  } else if (redCount >= 2 && redCount <= 9) {
    result.push({ name: '普通牌型', fan: 1 });
  } else if (redCount >= 10 && redCount <= 12) {
    result.push({ name: '红胡', fan: 2 });
  } else if (redCount === 13) {
    result.push({ name: '红拐弯', fan: 4 });
  } else if (redCount > 13) {
    result.push({ name: '红拐弯', fan: 4 });
    result.push({ name: `加红(${redCount - 13})`, fan: redCount - 13 });
  }
  return result;
}

export function computeMingtang(huResult: HuResult, turnCount: number = 1, deckLength: number = 0, isDealer: boolean = false): Mingtang[] {
  const result: Mingtang[] = [];

  // 红牌类名堂（互斥，但内部红拐弯可叠加加红）
  result.push(...computeRedMingtang(huResult.redCount));

  // 碰碰胡：所有落地牌组均为碰/跑/提/偎/臭偎，且无非对子顺子/三搭
  if (isPengPengHu(huResult)) {
    result.push({ name: '碰碰胡', fan: 5 });
  }

  // 十八大
  if (huResult.bigCount >= 18) {
    const extra = huResult.bigCount - 18;
    result.push({ name: `十八大(${huResult.bigCount})`, fan: 4 + extra });
  }

  // 十六小
  if (huResult.smallCount >= 16) {
    const extra = huResult.smallCount - 16;
    result.push({ name: `十六小(${huResult.smallCount})`, fan: 4 + extra });
  }

  // 天胡/地胡/海底胡
  if (turnCount <= 1 && isDealer) {
    result.push({ name: '天胡', fan: 1 });
  } else if (turnCount <= 1 && !isDealer) {
    result.push({ name: '地胡', fan: 1 });
  }
  if (deckLength === 0) {
    result.push({ name: '海底胡', fan: 1 });
  }

  return result;
}

export function isPengPengHu(huResult: HuResult): boolean {
  for (const meld of huResult.melds) {
    if (meld.type === 'sequence' || meld.type === 'specialSequence' || meld.type === 'mixedTriplet') {
      return false;
    }
  }
  return true;
}

export function computeBaseTun(totalHuxi: number): number {
  if (totalHuxi < 15) return 0;
  return Math.floor((totalHuxi - 15) / 3) + 1;
}

export function computeSettlement(
  winner: PlayerState,
  huResult: HuResult,
  players: PlayerState[],
  baseScore: number,
  turnCount: number,
  deckLength: number
): SettlementResult {
  const isDealer = winner.id === players.find((p) => p.isDealer)?.id;
  const mingtang = computeMingtang(huResult, turnCount, deckLength, isDealer);
  const totalFan = mingtang.reduce((sum, m) => sum + m.fan, 0) || 1;
  const baseTun = computeBaseTun(huResult.huxi);
  const ziMoTun = huResult.isZiMo ? 1 : 0;
  const totalTun = baseTun + ziMoTun;

  // 明牌翻倍：胡牌者或被胡者任一方明牌，结算翻倍
  const hasOpenHand = winner.isOpenHand || players.some((p) => p.id !== winner.id && p.isOpenHand);
  const openHandMultiplier = hasOpenHand ? 2 : 1;

  const scorePerLoser = totalTun * totalFan * baseScore * openHandMultiplier;
  const loserIds = players.filter((p) => p.id !== winner.id).map((p) => p.id);
  const totalScore = scorePerLoser * loserIds.length;

  const huxiDetails: { type: string; huxi: number }[] = [];
  const typeMap = new Map<string, number>();
  for (const meld of huResult.melds) {
    const label = meldTypeLabel(meld.type);
    typeMap.set(label, (typeMap.get(label) || 0) + meld.huxi);
  }
  for (const [type, huxi] of typeMap) {
    huxiDetails.push({ type, huxi });
  }

  return {
    winnerId: winner.id,
    isZiMo: huResult.isZiMo,
    sourcePlayerId: huResult.sourcePlayerId,
    totalHuxi: huResult.huxi,
    huxiDetails,
    baseTun,
    ziMoTun,
    totalTun,
    mingtang,
    totalFan,
    baseScore,
    scorePerLoser,
    totalScore,
    loserIds,
    huResult,
  };
}

function meldTypeLabel(type: string): string {
  switch (type) {
    case 'chi':
      return '吃';
    case 'peng':
      return '碰';
    case 'wei':
      return '偎';
    case 'chouWei':
      return '臭偎';
    case 'pao':
      return '跑';
    case 'ti':
      return '提';
    case 'sequence':
      return '普通顺';
    case 'specialSequence':
      return '特殊顺';
    case 'mixedTriplet':
      return '大小三搭';
    case 'pair':
      return '将牌';
    default:
      return type;
  }
}

export function getCardDisplay(card: Card): string {
  if (card.suit === 'small') {
    const map = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    return map[card.rank];
  }
  const map = ['', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾'];
  return map[card.rank];
}
