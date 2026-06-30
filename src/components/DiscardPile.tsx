import type { GameState } from '../core/types';
import { Card } from './Card';

interface DiscardPileProps {
  state: GameState;
  onClose: () => void;
}

export function DiscardPile({ state, onClose }: DiscardPileProps) {
  const discards = state.logs
    .filter((log) => log.action === 'discard' && log.card)
    .map((log) => ({
      id: log.id,
      playerName: state.players.find((p) => p.id === log.playerId)?.name || log.playerId,
      card: log.card!,
      turn: log.turn,
    }));

  return (
    <div className="discard-overlay" onClick={onClose}>
      <div className="discard-panel" onClick={(e) => e.stopPropagation()}>
        <h3>弃牌堆</h3>
        <div className="discard-list">
          {discards.length === 0 ? (
            <div className="discard-empty">暂无弃牌</div>
          ) : (
            discards.map((item) => (
              <div key={item.id} className="discard-item">
                <span className="discard-turn">[{item.turn}]</span>
                <span className="discard-player">{item.playerName}</span>
                <Card card={item.card} small />
              </div>
            ))
          )}
        </div>
        <button className="discard-close" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  );
}
