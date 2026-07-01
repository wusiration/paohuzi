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
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    setOrderedCards(cards);
  }, [cards]);

  const flatIndexOf = (cardId: string) => orderedCards.findIndex((c) => c.id === cardId);

  const handleDragStart = (card: CardType) => {
    if (disabled || hidden || !onReorder) return;
    setDragId(card.id);
  };

  const handleDragOver = (e: React.DragEvent, targetCard: CardType) => {
    if (!dragId || dragId === targetCard.id || disabled || hidden || !onReorder) return;
    e.preventDefault();

    const fromIndex = flatIndexOf(dragId);
    const toIndex = flatIndexOf(targetCard.id);
    if (fromIndex === -1 || toIndex === -1) return;

    const newCards = [...orderedCards];
    const [moved] = newCards.splice(fromIndex, 1);
    newCards.splice(toIndex, 0, moved);
    setOrderedCards(newCards);
    onReorder(newCards);
  };

  const handleDragEnd = () => {
    setDragId(null);
  };

  const groups = useMemo(() => groupByThree(orderedCards), [orderedCards]);
  let cardIndex = 0;

  return (
    <div className={`hand ${onReorder && !hidden ? 'hand-draggable' : ''}`}>
      {groups.map((group, groupIndex) => (
        <div key={`kan-${groupIndex}`} className="hand-kan">
          {group.map((card) => {
            const index = cardIndex++;
            return (
              <div
                key={card.id}
                className="hand-card-slot"
                draggable={!!onReorder && !hidden && !disabled}
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
