import type { Card as CardType, PendingAction } from '../core/types';
import { Card } from './Card';

interface PengConfirmProps {
  action: PendingAction;
  handCards: CardType[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function PengConfirm({ action, handCards, onConfirm, onCancel }: PengConfirmProps) {
  return (
    <div className="chi-selector-overlay">
      <div className="chi-selector">
        <h3>确认碰牌</h3>
        <div className="chi-options">
          <button className="chi-option" onClick={onConfirm}>
            <div className="chi-option-cards">
              <Card card={action.card} small />
              {handCards.map((card, idx) => (
                <Card key={`peng-hand-${idx}`} card={card} small />
              ))}
            </div>
            <span className="chi-option-label">确认碰</span>
          </button>
        </div>
        <button className="chi-cancel" onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  );
}
