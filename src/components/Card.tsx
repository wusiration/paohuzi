import type { Card as CardType } from '../core/types';
import { getCardDisplay } from '../core/scoring';

interface CardProps {
  card?: CardType;
  hidden?: boolean;
  small?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  highlight?: boolean;
}

export function Card({ card, hidden, small, selected, disabled, onClick, highlight }: CardProps) {
  if (hidden) {
    return (
      <div
        className={`card card-back ${small ? 'card-small' : ''} ${highlight ? 'card-highlight' : ''}`}
        onClick={onClick}
      >
        <div className="card-back-pattern" />
      </div>
    );
  }

  if (!card) {
    return <div className={`card card-empty ${small ? 'card-small' : ''}`} />;
  }

  const display = getCardDisplay(card);
  const isBig = card.suit === 'big';

  return (
    <div
      className={`
        card card-front ${small ? 'card-small' : ''}
        ${selected ? 'card-selected' : ''}
        ${disabled ? 'card-disabled' : ''}
        ${highlight ? 'card-highlight' : ''}
        ${isBig ? 'card-big-suit' : 'card-small-suit'}
      `}
      onClick={disabled ? undefined : onClick}
    >
      <span className={`card-rank ${card.isRed ? 'card-red' : 'card-black'}`}>{display}</span>
      {isBig && <span className="card-suit-mark">大</span>}
    </div>
  );
}
