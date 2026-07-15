import type { PendingAction } from '../core/types';

interface ActionPanelProps {
  actions: PendingAction[];
  onAction: (actionId: string, optionId?: string) => void;
}

export function ActionPanel({ actions, onAction }: ActionPanelProps) {
  const playerActions = actions.filter((a) => a.playerId === 'player');
  if (playerActions.length === 0) return null;

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
          onClick={() => onAction(action.id)}
        >
          {getLabel(action)}
        </button>
      ))}
    </div>
  );
}
