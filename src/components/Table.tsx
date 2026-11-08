import type { Card as CardType } from '../core/types';
import { useState, useEffect, useMemo } from 'react';
import { Hand } from './Hand';
import { Card } from './Card';
import { ActionPanel } from './ActionPanel';
import { ChiSelector } from './ChiSelector';
import { PengConfirm } from './PengConfirm';
import { Settlement } from './Settlement';
import { ScorePanel } from './ScorePanel';
import { GameLog } from './GameLog';
import { DiscardPile } from './DiscardPile';
import { PlayerMeldsPanel } from './PlayerMeldsPanel';
import type { GameState } from '../core/types';
import { isSameCard } from '../core/rules';

interface TableProps {
  state: GameState;
  cheatMode?: boolean;
  onDiscard: (cardId: string) => void;
  onAction: (actionId: string, optionId?: string) => void;
  onNextRound: () => void;
  onOpenHand?: () => void;
  onHandOrderChange?: (playerId: string, handOrder: string[]) => void;
}

export function Table({ state, cheatMode, onDiscard, onAction, onNextRound, onOpenHand, onHandOrderChange }: TableProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [chiAction, setChiAction] = useState<import('../core/types').PendingAction | null>(null);
  const [pengAction, setPengAction] = useState<import('../core/types').PendingAction | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [viewPlayerId, setViewPlayerId] = useState<string | null>(null);
  const [handOrder, setHandOrder] = useState<string[]>(() => state.players.find((p) => p.id === 'player')?.handOrder || state.players.find((p) => p.id === 'player')?.hand.map((c) => c.id) || []);

  const player = state.players.find((p) => p.id === 'player')!;
  const leftAI = state.players.find((p) => p.seat === (player.seat + 2) % 3)!;
  const rightAI = state.players.find((p) => p.seat === (player.seat + 1) % 3)!;
  const currentPlayer = state.players.find((p) => p.id === state.currentPlayerId);

  // 同步手牌顺序：外部 handOrder 优先，缺失的牌追加到末尾
  useEffect(() => {
    const currentIds = player.hand.map((c) => c.id);
    const currentIdSet = new Set(currentIds);
    const externalOrder = player.handOrder || [];

    const filteredOrder = externalOrder.filter((id) => currentIdSet.has(id));
    const filteredIdSet = new Set(filteredOrder);
    const newIds = currentIds.filter((id) => !filteredIdSet.has(id));
    const mergedOrder = [...filteredOrder, ...newIds];

    if (JSON.stringify(mergedOrder) !== JSON.stringify(handOrder)) {
      setHandOrder(mergedOrder);
    }
  }, [player.hand, player.handOrder, handOrder]);

  const orderedPlayerHand = useMemo(() => {
    const map = new Map(player.hand.map((c) => [c.id, c]));
    return handOrder.map((id) => map.get(id)!).filter(Boolean);
  }, [player.hand, handOrder]);

  const handleReorder = (fromId: string, toId: string) => {
    const fromIndex = handOrder.indexOf(fromId);
    const toIndex = handOrder.indexOf(toId);
    if (fromIndex === -1 || toIndex === -1 || fromId === toId) return;

    // 先移除被拖的牌
    const withoutFrom = [...handOrder];
    withoutFrom.splice(fromIndex, 1);

    // 重新计算目标牌在新数组中的位置
    let newToIndex = withoutFrom.indexOf(toId);
    if (newToIndex === -1) newToIndex = toIndex;

    const targetKanIndex = Math.floor(newToIndex / 3);
    const targetKanStart = targetKanIndex * 3;
    const targetKanCards = withoutFrom.slice(targetKanStart, targetKanStart + 3);

    // 如果目标坎未满 3 张，把牌补到该坎末尾
    let insertIndex: number;
    if (targetKanCards.length < 3) {
      insertIndex = targetKanStart + targetKanCards.length;
    } else {
      // 否则插到目标牌位置（交换效果）
      insertIndex = newToIndex;
    }

    withoutFrom.splice(insertIndex, 0, fromId);
    const newOrder = withoutFrom;
    setHandOrder(newOrder);
    onHandOrderChange?.('player', newOrder);
  };

  const isPlayerTurn = state.phase === 'WAIT_DISCARD' && state.currentPlayerId === 'player';
  const isPlayerResponse = state.phase === 'WAIT_RESPONSE' && state.pendingActions.some((a) => a.playerId === 'player');
  const canOpenHand = state.phase === 'WAIT_DISCARD' && state.turnCount === 0 && state.currentPlayerId === 'player' && !player.isOpenHand;

  const handleCardClick = (card: CardType) => {
    if (!isPlayerTurn) return;
    setSelectedCardId(card.id);
  };

  const handleDiscard = () => {
    if (selectedCardId) {
      onDiscard(selectedCardId);
      setSelectedCardId(null);
    }
  };

  const handleAction = (actionId: string, optionId?: string) => {
    const action = state.pendingActions.find((a) => a.id === actionId);
    if (!action) return;

    if (action.actionType === 'chi') {
      setChiAction(action);
      return;
    }
    if (action.actionType === 'peng') {
      setPengAction(action);
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

  const handlePengConfirm = () => {
    if (pengAction) {
      onAction(pengAction.id);
      setPengAction(null);
    }
  };

  const handlePengCancel = () => {
    setPengAction(null);
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
          <div className="bottom-card-area" title="挡底：牌墩最后一张，对所有玩家公开">
            <span>挡底</span>
            {state.bottomCard ? (
              <Card card={state.bottomCard} small />
            ) : (
              <div className="card card-small card-empty" />
            )}
          </div>
          <div className="revealed-card-area">
            <span>明牌</span>
            {state.revealedCard ? (
              <Card card={state.revealedCard} small dealing />
            ) : (
              <div className="card card-small card-empty" />
            )}
          </div>
          <div className="last-discard-area">
            <span>弃牌</span>
            {state.lastDiscard ? (
              <Card card={state.lastDiscard} small played />
            ) : (
              <div className="card card-small card-empty" />
            )}
          </div>
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
            <div className="ai-name">
              {leftAI.name}
              {leftAI.isOpenHand && <span className="open-hand-badge">明</span>}
            </div>
            <div className="ai-status">{getStatus(state, leftAI.id)}</div>
            <button
              className="view-melds-btn"
              onClick={() => setViewPlayerId(leftAI.id)}
              title="查看 AI 落地牌详情"
            >
              牌型
            </button>
          </div>
          <Hand cards={leftAI.hand} hidden={!cheatMode && !leftAI.isOpenHand} small />
          <div className="ai-melds ai-melds-summary">
            落地牌 {leftAI.melds.length} 组 · {leftAI.huxi}胡
          </div>
        </div>

        <div className="ai-area ai-right">
          <div className="ai-info">
            <div className="ai-name">
              {rightAI.name}
              {rightAI.isOpenHand && <span className="open-hand-badge">明</span>}
            </div>
            <div className="ai-status">{getStatus(state, rightAI.id)}</div>
            <button
              className="view-melds-btn"
              onClick={() => setViewPlayerId(rightAI.id)}
              title="查看 AI 落地牌详情"
            >
              牌型
            </button>
          </div>
          <Hand cards={rightAI.hand} hidden={!cheatMode && !rightAI.isOpenHand} small />
          <div className="ai-melds ai-melds-summary">
            落地牌 {rightAI.melds.length} 组 · {rightAI.huxi}胡
          </div>
        </div>
      </div>

      <div className="player-area">
        <div className="player-info">
          <div className="player-name">
            {player.name}
            {player.isOpenHand && <span className="open-hand-badge">明</span>}
          </div>
          <div className="player-huxi">胡息：{player.huxi}</div>
          <div className="player-red">红牌：{player.redCount}</div>
          <div className="player-hand-count">手牌：{player.hand.length}</div>
          <span className="player-melds-summary">
            落地牌 {player.melds.length} 组
          </span>
          {canOpenHand && onOpenHand && (
            <button
              className="open-hand-btn"
              onClick={onOpenHand}
              title="明牌后所有玩家可见你的手牌，本局胡牌结算翻倍"
            >
              明牌
            </button>
          )}
          <button
            className="view-melds-btn"
            onClick={() => setViewPlayerId(player.id)}
            title="查看自己的落地牌详情"
          >
            牌型
          </button>
        </div>
        {isPlayerResponse && (
          <div className="action-panel action-panel-inline">
            <ActionPanel
              actions={state.pendingActions}
              onAction={handleAction}
            />
          </div>
        )}
        <Hand
          key={state.roundIndex}
          cards={orderedPlayerHand}
          selectable={isPlayerTurn}
          selectedId={selectedCardId || undefined}
          onSelect={handleCardClick}
          onReorder={handleReorder}
        />
        {isPlayerTurn ? (
          selectedCardId ? (
            <div className="turn-tip">
              <button className="discard-confirm-btn" onClick={handleDiscard}>
                打出
              </button>
            </div>
          ) : (
            <div className="turn-tip">你的回合，请选择一张牌打出</div>
          )
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
      {pengAction && (
        <PengConfirm
          action={pengAction}
          handCards={player.hand.filter((c) => isSameCard(c, pengAction.card)).slice(0, 2)}
          onConfirm={handlePengConfirm}
          onCancel={handlePengCancel}
        />
      )}
      {showLog && <GameLog state={state} onClose={() => setShowLog(false)} />}
      {showDiscard && <DiscardPile state={state} onClose={() => setShowDiscard(false)} />}
      {viewPlayerId && <PlayerMeldsPanel state={state} playerId={viewPlayerId} onClose={() => setViewPlayerId(null)} />}
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
