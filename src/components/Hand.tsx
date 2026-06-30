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
}

export function Hand({ cards, hidden, selectable, selectedId, disabled, onSelect, small }: HandProps) {
  return (
    <div className="hand">
      {cards.map((card) => (
        <Card
          key={card.id}
          card={card}
          hidden={hidden}
          small={small}
          selected={selectable && card.id === selectedId}
          disabled={disabled}
          onClick={() => {
            if (selectable && onSelect && !disabled) {
              onSelect(card);
            }
          }}
        />
      ))}
    </div>
  );
}
