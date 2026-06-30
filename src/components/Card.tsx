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
  dealing?: boolean;
  played?: boolean;
  style?: React.CSSProperties;
}

export function Card({ card, hidden, small, selected, disabled, onClick, highlight, dealing, played, style }: CardProps) {
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
        ${dealing ? 'card-dealing' : ''}
        ${played ? 'card-played' : ''}
        ${isBig ? 'card-big-suit' : 'card-small-suit'}
      `}
      onClick={disabled ? undefined : onClick}
      style={style}
      title={`${display}${isBig ? '（大）' : '（小）'}${card.isRed ? ' 红牌' : ''}`}
    >
      <span className={`card-rank ${card.isRed ? 'card-red' : 'card-black'}`}>{display}</span>
      <span className="card-suit-mark">{isBig ? '大' : '小'}</span>
    </div>
  );
}
