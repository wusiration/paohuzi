import type { Card as CardType } from '../core/types';
import { Card } from './Card';
import { useState, useEffect, useMemo } from 'react';

interface HandProps {
  cards: CardType[];
  hidden?: boolean;
  selectable?: boolean;
  selectedId?: string;
  disabled?: boolean;
  onSelect?: (card: CardType) => void;
  small?: boolean;
  dealing?: boolean;
  onReorder?: (cards: CardType[]) => void;
}

function cardKey(card: CardType): string {
  return `${card.suit}-${card.rank}`;
}

function isSequence(a: CardType, b: CardType, c: CardType): boolean {
  if (a.suit !== b.suit || b.suit !== c.suit) return false;
  const ranks = [a.rank, b.rank, c.rank].sort((x, y) => x - y);
  return ranks[0] + 1 === ranks[1] && ranks[1] + 1 === ranks[2];
}

function isSpecialSequence(a: CardType, b: CardType, c: CardType): boolean {
  if (a.suit !== b.suit || b.suit !== c.suit) return false;
  const ranks = new Set([a.rank, b.rank, c.rank]);
  return (ranks.has(1) && ranks.has(2) && ranks.has(3)) || (ranks.has(2) && ranks.has(7) && ranks.has(10));
}

function isValidTriplet(triplet: CardType[]): boolean {
  if (triplet.length !== 3) return false;
  return isSequence(triplet[0], triplet[1], triplet[2]) || isSpecialSequence(triplet[0], triplet[1], triplet[2]);
}

function findPairThird(pair: CardType[], pool: CardType[]): CardType | undefined {
  for (const card of pool) {
    if (card.suit !== pair[0].suit) continue;
    if (isValidTriplet([pair[0], pair[1], card])) return card;
  }
  for (const card of pool) {
    if (card.rank === pair[0].rank && card.suit !== pair[0].suit) return card;
  }
  for (const card of pool) {
    if (card.suit !== pair[0].suit) continue;
    if (Math.abs(card.rank - pair[0].rank) <= 2 && card.rank !== pair[0].rank) return card;
  }
  return undefined;
}

function smartGroup(cards: CardType[]): CardType[] {
  const remaining = [...cards];
  const ordered: CardType[] = [];

  // 1. 坎：3 张相同
  const kanMap = new Map<string, CardType[]>();
  for (const card of remaining) {
    const key = cardKey(card);
    if (!kanMap.has(key)) kanMap.set(key, []);
    kanMap.get(key)!.push(card);
  }
  for (const [, list] of kanMap) {
    if (list.length >= 3) {
      const kan = list.slice(0, 3);
      ordered.push(...kan);
      for (const c of kan) {
        const idx = remaining.findIndex((rc) => rc.id === c.id);
        if (idx >= 0) remaining.splice(idx, 1);
      }
    }
  }

  // 2. 对子：2 张相同，尽量配一张相关牌
  const pairMap = new Map<string, CardType[]>();
  for (const card of remaining) {
    const key = cardKey(card);
    if (!pairMap.has(key)) pairMap.set(key, []);
    pairMap.get(key)!.push(card);
  }
  for (const [, list] of pairMap) {
    if (list.length >= 2) {
      const pair = list.slice(0, 2);
      const third = findPairThird(pair, remaining.filter((c) => !pair.includes(c)));
      ordered.push(pair[0], pair[1]);
      if (third) {
        ordered.push(third);
        const idx = remaining.findIndex((rc) => rc.id === third.id);
        if (idx >= 0) remaining.splice(idx, 1);
      }
      for (const c of pair) {
        const idx = remaining.findIndex((rc) => rc.id === c.id);
        if (idx >= 0) remaining.splice(idx, 1);
      }
    }
  }

  // 3. 顺子：3 张连续同花色
  while (remaining.length >= 3) {
    let found = false;
    for (let i = 0; i < remaining.length - 2; i++) {
      for (let j = i + 1; j < remaining.length - 1; j++) {
        for (let k = j + 1; k < remaining.length; k++) {
          const triplet = [remaining[i], remaining[j], remaining[k]];
          if (isValidTriplet(triplet)) {
            ordered.push(...triplet);
            [k, j, i].sort((a, b) => b - a).forEach((idx) => remaining.splice(idx, 1));
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (found) break;
    }
    if (!found) break;
  }

  // 4. 剩余牌按原顺序接在后面
  ordered.push(...remaining);
  return ordered;
}

function groupByThree(cards: CardType[]): CardType[][] {
  const groups: CardType[][] = [];
  for (let i = 0; i < cards.length; i += 3) {
    groups.push(cards.slice(i, i + 3));
  }
  return groups;
}

export function Hand({
  cards,
  hidden,
  selectable,
  selectedId,
  disabled,
  onSelect,
  small,
  dealing,
  onReorder,
}: HandProps) {
  const [orderedCards, setOrderedCards] = useState<CardType[]>(cards);
  const [hasReordered, setHasReordered] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    if (hasReordered) {
      // 玩家已手动调整过：保留现有顺序，同步新增/移除的牌
      const validIds = new Set(cards.map((c) => c.id));
      const keptCards = orderedCards.filter((c) => validIds.has(c.id));
      const keptIds = new Set(keptCards.map((c) => c.id));
      const newCards = cards.filter((c) => !keptIds.has(c.id));
      const merged = [...keptCards, ...newCards];
      if (merged.length !== orderedCards.length || newCards.length > 0) {
        setOrderedCards(merged);
        onReorder?.(merged);
      }
    } else {
      // 未手动调整过：使用智能分组初始化
      const grouped = smartGroup(cards);
      setOrderedCards(grouped);
      onReorder?.(grouped);
    }
  }, [cards]);

  const flatIndexOf = (cardId: string) => orderedCards.findIndex((c) => c.id === cardId);

  const handleDragStart = (card: CardType) => {
    if (disabled || hidden) return;
    setDragId(card.id);
  };

  const handleDragOver = (e: React.DragEvent, targetCard: CardType) => {
    if (!dragId || dragId === targetCard.id || disabled || hidden) return;
    e.preventDefault();

    const fromIndex = flatIndexOf(dragId);
    const toIndex = flatIndexOf(targetCard.id);
    if (fromIndex === -1 || toIndex === -1) return;

    const newCards = [...orderedCards];
    const [moved] = newCards.splice(fromIndex, 1);
    newCards.splice(toIndex, 0, moved);
    setOrderedCards(newCards);
    setHasReordered(true);
    onReorder?.(newCards);
  };

  const handleDragEnd = () => {
    setDragId(null);
  };

  const groups = useMemo(() => groupByThree(orderedCards), [orderedCards]);
  let cardIndex = 0;

  return (
    <div className={`hand ${hidden ? '' : 'hand-draggable'}`}>
      {groups.map((group, groupIndex) => (
        <div key={`kan-${groupIndex}`} className="hand-kan">
          {group.map((card) => {
            const index = cardIndex++;
            return (
              <div
                key={card.id}
                className="hand-card-slot"
                draggable={!hidden && !disabled}
                onDragStart={() => handleDragStart(card)}
                onDragOver={(e) => handleDragOver(e, card)}
                onDragEnd={handleDragEnd}
              >
                <Card
                  card={card}
                  hidden={hidden}
                  small={small}
                  selected={selectable && card.id === selectedId}
                  disabled={disabled}
                  dealing={dealing}
                  onClick={() => {
                    if (selectable && onSelect && !disabled) {
                      onSelect(card);
                    }
                  }}
                  style={{ animationDelay: dealing ? `${index * 40}ms` : undefined }}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
