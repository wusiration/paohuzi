import type { GameState, PlayerState } from '../core/types';

interface ScorePanelProps {
  state: GameState;
}

export function ScorePanel({ state }: ScorePanelProps) {
  return (
    <div className="score-panel">
      {state.players.map((player) => (
        <PlayerScore key={player.id} player={player} isDealer={player.isDealer} isCurrent={state.currentPlayerId === player.id} />
      ))}
    </div>
  );
}

function PlayerScore({ player, isDealer, isCurrent }: { player: PlayerState; isDealer: boolean; isCurrent: boolean }) {
  return (
    <div className={`player-score ${isCurrent ? 'current' : ''} ${player.isAI ? 'ai' : 'human'}`}>
      <div className="player-name">
        {player.name}
        {isDealer && <span className="dealer-badge">庄</span>}
      </div>
      <div className="player-score-value">{player.score}</div>
      <div className="player-meta">
        <span>胡息：{player.huxi}</span>
        <span>手牌：{player.hand.length}</span>
      </div>
    </div>
  );
}
