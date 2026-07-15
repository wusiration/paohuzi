import type { PendingAction } from '../core/types';
import { Card } from './Card';

interface ChiSelectorProps {
  action: PendingAction;
  onSelect: (optionId: string) => void;
  onCancel: () => void;
}

export function ChiSelector({ action, onSelect, onCancel }: ChiSelectorProps) {
  if (!action.options || action.options.length === 0) return null;

  return (
    <div className="chi-selector-overlay">
      <div className="chi-selector">
        <h3>{action.options.length > 1 ? '请选择吃法' : '确认吃牌'}</h3>
        <div className="chi-options">
          {action.options.map((option) => (
            <button
              key={option.id}
              className="chi-option"
              onClick={() => onSelect(option.id)}
            >
              <div className="chi-option-cards">
                {option.mainCards.map((card) => (
                  <Card key={card.id} card={card} small />
                ))}
              </div>
              <span className="chi-option-label">
                {option.huxi > 0 ? `${option.huxi}胡` : '0胡'}
              </span>
            </button>
          ))}
        </div>
        <button className="chi-cancel" onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  );
}
