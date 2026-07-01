import type { Card as CardType } from '../core/types';
import { Card } from './Card';
import { useState, useEffect } from 'react';

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

  // 当外部手牌变化时，重置内部顺序（保持与游戏状态同步）
  useEffect(() => {
    setOrderedCards(cards);
  }, [cards]);

  const handleDragStart = (card: CardType) => {
    if (disabled || hidden || !onReorder) return;
    setDragId(card.id);
  };

  const handleDragOver = (e: React.DragEvent, targetCard: CardType) => {
    if (!dragId || dragId === targetCard.id || disabled || hidden || !onReorder) return;
    e.preventDefault();

    const fromIndex = orderedCards.findIndex((c) => c.id === dragId);
    const toIndex = orderedCards.findIndex((c) => c.id === targetCard.id);
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

  return (
    <div className={`hand ${small ? 'hand-compact' : ''} ${onReorder && !hidden ? 'hand-draggable' : ''}`}>
      {orderedCards.map((card, index) => (
        <div
          key={card.id}
          className={`hand-card-slot ${index > 0 && index % 3 === 0 ? 'hand-group-gap' : ''}`}
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
      ))}
    </div>
  );
}
