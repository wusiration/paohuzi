import type { Card as CardType } from '../core/types';
import { useState } from 'react';
import { Hand } from './Hand';
import { Meld } from './Meld';
import { Card } from './Card';
import { ActionPanel } from './ActionPanel';
import { ChiSelector } from './ChiSelector';
import { Settlement } from './Settlement';
import { ScorePanel } from './ScorePanel';
import { GameLog } from './GameLog';
import { DiscardPile } from './DiscardPile';
import type { GameState } from '../core/types';

interface TableProps {
  state: GameState;
  onDiscard: (cardId: string) => void;
  onAction: (actionId: string, optionId?: string) => void;
  onNextRound: () => void;
}

export function Table({ state, onDiscard, onAction, onNextRound }: TableProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [chiAction, setChiAction] = useState<import('../core/types').PendingAction | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);

  const player = state.players.find((p) => p.id === 'player')!;
  const leftAI = state.players.find((p) => p.seat === (player.seat + 2) % 3)!;
  const rightAI = state.players.find((p) => p.seat === (player.seat + 1) % 3)!;
  const currentPlayer = state.players.find((p) => p.id === state.currentPlayerId);

  const isPlayerTurn = state.phase === 'WAIT_DISCARD' && state.currentPlayerId === 'player';
  const isPlayerResponse = state.phase === 'WAIT_RESPONSE' && state.pendingActions.some((a) => a.playerId === 'player');

  const handleCardClick = (card: CardType) => {
    if (!isPlayerTurn) return;
    if (selectedCardId === card.id) {
      onDiscard(card.id);
      setSelectedCardId(null);
    } else {
      setSelectedCardId(card.id);
    }
  };

  const handleAction = (actionId: string, optionId?: string) => {
    const action = state.pendingActions.find((a) => a.id === actionId);
    if (action?.actionType === 'chi' && action.options && action.options.length > 1) {
      setChiAction(action);
      return;
    }
    onAction(actionId, optionId);
  };

  const handleChiSelect = (optionId: string) => {
    if (chiAction) {
      onAction(chiAction.id, optionId);
      setChiAction(null);
    }
  };

  if (state.phase === 'SETTLEMENT') {
    return <Settlement state={state} onNext={onNextRound} />;
  }

  if (state.phase === 'DRAW_GAME') {
    return (
      <div className="draw-game-overlay">
        <div className="draw-game-panel">
          <h2>流局</h2>
          <p>牌墩已摸完，无人胡牌</p>
          <button onClick={onNextRound}>下一局</button>
        </div>
      </div>
    );
  }

  return (
    <div className="table">
      <div className="table-header">
        <div className="header-left">
          <span>局数：{state.roundIndex}</span>
          <span>牌墩：{state.deck.length}</span>
          <button className="log-btn" onClick={() => setShowLog(true)}>
            日志
          </button>
          <button className="log-btn" onClick={() => setShowDiscard(true)}>
            弃牌堆
          </button>
        </div>
        <div className="header-center">
          {state.revealedCard && (
            <div className="revealed-card-area">
              <span>明牌</span>
              <Card card={state.revealedCard} dealing />
            </div>
          )}
          {state.lastDiscard && (
            <div className="last-discard-area">
              <span>弃牌</span>
              <Card card={state.lastDiscard} played />
            </div>
          )}
        </div>
        <div className="header-right">
          <ScorePanel state={state} />
        </div>
      </div>

      <div className="table-body">
        <div className="table-center">
          <span className="table-center-text">跑胡子</span>
        </div>

        <div className="ai-area ai-left">
          <div className="ai-info">
            <div className="ai-name">{leftAI.name}</div>
            <div className="ai-status">{getStatus(state, leftAI.id)}</div>
          </div>
          <Hand cards={leftAI.hand} hidden small />
          <div className="ai-melds">
            {leftAI.melds.map((meld) => (
              <Meld key={meld.id} meld={meld} viewerId="player" players={state.players} small />
            ))}
          </div>
        </div>

        <div className="ai-area ai-right">
          <div className="ai-info">
            <div className="ai-name">{rightAI.name}</div>
            <div className="ai-status">{getStatus(state, rightAI.id)}</div>
          </div>
          <Hand cards={rightAI.hand} hidden small />
          <div className="ai-melds">
            {rightAI.melds.map((meld) => (
              <Meld key={meld.id} meld={meld} viewerId="player" players={state.players} small />
            ))}
          </div>
        </div>
      </div>

      <div className="player-area">
        <div className="player-info">
          <div className="player-name">{player.name}</div>
          <div className="player-huxi">胡息：{player.huxi}</div>
          <div className="player-red">红牌：{player.redCount}</div>
          <div className="player-hand-count">手牌：{player.hand.length}</div>
        </div>
        <div className="player-melds">
          {player.melds.map((meld) => (
            <Meld key={meld.id} meld={meld} viewerId="player" players={state.players} />
          ))}
        </div>
        {isPlayerResponse && (
          <ActionPanel
            actions={state.pendingActions}
            onAction={handleAction}
          />
        )}
        <Hand
          cards={player.hand}
          selectable={isPlayerTurn}
          selectedId={selectedCardId || undefined}
          onSelect={handleCardClick}
        />
        {isPlayerTurn ? (
          <div className="turn-tip">你的回合，请选择一张牌打出</div>
        ) : isPlayerResponse ? (
          <div className="turn-tip">响应阶段：请选择是否吃/碰/胡/过</div>
        ) : (
          <div className="turn-tip">{currentPlayer?.name} 的回合</div>
        )}
      </div>

      {chiAction && (
        <ChiSelector
          action={chiAction}
          onSelect={handleChiSelect}
          onCancel={() => setChiAction(null)}
        />
      )}
      {showLog && <GameLog state={state} onClose={() => setShowLog(false)} />}
      {showDiscard && <DiscardPile state={state} onClose={() => setShowDiscard(false)} />}
    </div>
  );
}

function getStatus(state: GameState, playerId: string): string {
  if (state.currentPlayerId === playerId && state.phase === 'WAIT_DISCARD') return '思考中...';
  const action = state.pendingActions.find((a) => a.playerId === playerId);
  if (action) {
    switch (action.actionType) {
      case 'hu':
        return '可胡';
      case 'peng':
        return '可碰';
      case 'chi':
        return '可吃';
      case 'pao':
        return '可跑';
      default:
        return '';
    }
  }
  return '';
}
