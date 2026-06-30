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
}

export function Hand({ cards, hidden, selectable, selectedId, disabled, onSelect, small, dealing }: HandProps) {
  return (
    <div className={`hand ${small ? 'hand-compact' : ''}`}>
      {cards.map((card, index) => (
        <Card
          key={card.id}
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
      ))}
    </div>
  );
}

