import type { GameState } from '../core/types';

interface GameLogProps {
  state: GameState;
  onClose: () => void;
}

export function GameLog({ state, onClose }: GameLogProps) {
  return (
    <div className="gamelog-overlay" onClick={onClose}>
      <div className="gamelog-panel" onClick={(e) => e.stopPropagation()}>
        <h3>对局日志</h3>
        <div className="gamelog-list">
          {state.logs.length === 0 ? (
            <div className="gamelog-empty">暂无记录</div>
          ) : (
            state.logs.map((log) => (
              <div key={log.id} className={`gamelog-item gamelog-${log.action}`}>
                <span className="gamelog-turn">[{log.turn}]</span>
                <span className="gamelog-player">
                  {state.players.find((p) => p.id === log.playerId)?.name || log.playerId}
                </span>
                <span className="gamelog-action">{log.action}</span>
                <span className="gamelog-message">{log.message}</span>
              </div>
            ))
          )}
        </div>
        <button className="gamelog-close" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  );
}
