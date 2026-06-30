import type { PendingAction } from '../core/types';

interface ActionPanelProps {
  actions: PendingAction[];
  onAction: (actionId: string, optionId?: string) => void;
  onPass: () => void;
}

export function ActionPanel({ actions, onAction, onPass }: ActionPanelProps) {
  const playerActions = actions.filter((a) => a.playerId === 'player');
  if (playerActions.length === 0) return null;

  const hasForced = playerActions.some((a) => ['hu', 'pao', 'ti', 'wei', 'chouWei'].includes(a.actionType));
  const showPass = !hasForced;

  const getLabel = (action: PendingAction) => {
    switch (action.actionType) {
      case 'hu':
        return '胡';
      case 'pao':
        return '跑';
      case 'ti':
        return '提';
      case 'wei':
        return '偎';
      case 'chouWei':
        return '臭偎';
      case 'peng':
        return '碰';
      case 'chi':
        return `吃 (${action.options?.length || 0})`;
      case 'pass':
        return '过';
      default:
        return action.actionType;
    }
  };

  return (
    <div className="action-panel">
      {playerActions.map((action) => (
        <button
          key={action.id}
          className={`action-btn action-${action.actionType}`}
          onClick={() => {
            if (action.actionType === 'chi' && action.options && action.options.length > 1) {
              // 多种吃法通过外部选择器处理，这里选默认第一种
              onAction(action.id, action.options[0].id);
            } else {
              onAction(action.id);
            }
          }}
        >
          {getLabel(action)}
        </button>
      ))}
      {showPass && (
        <button className="action-btn action-pass" onClick={onPass}>
          过
        </button>
      )}
    </div>
  );
}
