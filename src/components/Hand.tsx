import type { Card as CardType } from '../core/types';
import { Card } from './Card';

interface HandProps {
  cards: CardType[];
  hidden?: boolean;
  selectable?: boolean;
  selectedId?: string;
  disabled?: boolean;
  onSelect?: (card: CardType) => void;
  small?: boolean;
  dealing?: boolean;
  onReorder?: (fromId: string, toId: string) => void;
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
  const handleDragStart = () => {
    if (disabled || hidden || !onReorder) return;
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (disabled || hidden || !onReorder) return;
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetCard: CardType) => {
    if (disabled || hidden || !onReorder) return;
    e.preventDefault();
    const dragId = e.dataTransfer.getData('text/plain');
    if (!dragId || dragId === targetCard.id) return;
    onReorder(dragId, targetCard.id);
  };

  const handleEmptySlotDrop = (e: React.DragEvent, group: CardType[]) => {
    if (disabled || hidden || !onReorder) return;
    e.preventDefault();
    const dragId = e.dataTransfer.getData('text/plain');
    const firstCard = group[0];
    if (!dragId || !firstCard || dragId === firstCard.id) return;
    onReorder(dragId, firstCard.id);
  };

  const groups: CardType[][] = [];
  for (let i = 0; i < cards.length; i += 3) {
    groups.push(cards.slice(i, i + 3));
  }

  let cardIndex = 0;

  return (
    <div className={`hand ${onReorder && !hidden ? 'hand-draggable' : ''}`}>
      {groups.map((group, groupIndex) => (
        <div key={`kan-${groupIndex}`} className="hand-kan">
          {Array.from({ length: 3 }).map((_, slotIndex) => {
            const card = group[slotIndex];
            const index = card ? cardIndex++ : cardIndex;
            return (
              <div
                key={card ? card.id : `slot-${groupIndex}-${slotIndex}`}
                className={`hand-card-slot ${!card ? 'hand-card-slot-empty' : ''}`}
                draggable={!!card && !!onReorder && !hidden && !disabled}
                onDragStart={(e) => {
                  if (!card) return;
                  handleDragStart();
                  e.dataTransfer.setData('text/plain', card.id);
                }}
                onDragOver={handleDragOver}
                onDrop={(e) => {
                  if (card) {
                    handleDrop(e, card);
                  } else {
                    handleEmptySlotDrop(e, group);
                  }
                }}
              >
                {card ? (
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
                ) : (
                  <div className="card card-empty" />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
