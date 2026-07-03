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

  const groups: CardType[][] = [];
  for (let i = 0; i < cards.length; i += 3) {
    groups.push(cards.slice(i, i + 3));
  }

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
                onDragStart={(e) => {
                  handleDragStart();
                  e.dataTransfer.setData('text/plain', card.id);
                }}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, card)}
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
