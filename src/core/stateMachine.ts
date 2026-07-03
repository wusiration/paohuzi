import type { Card, GameState, Meld, PendingAction, PlayerState, SourceType } from './types';
import { createInitialGameDeck, dealCards, sortHand } from './deck';
import {
  buildChiMeld,
  buildChouWeiMeld,
  buildPaoMeldFromHand,
  buildPaoMeldFromUpgrade,
  buildPengMeld,
  buildTiMeldFromHand,
  buildTiMeldFromUpgrade,
  buildWeiMeld,
  canChi,
  canPaoFromHand,
  canPeng,
  canTiFromHand,
  canWei,
  findAllChiOptions,
  findExistingPeng,
  findExistingWei,
  findInitialTi,
} from './rules';
import { calculateHu, canHu } from './solver';
import { computeSettlement } from './scoring';
import { clonePlayer, clonePlayers, createLogId, createPendingActionId, nextPlayerId } from '../utils/helpers';

const ACTION_PRIORITY: Record<string, number> = {
  ti: 1,
  wei: 1,
  hu: 2,
  pao: 3,
  peng: 4,
  chi: 5,
  pass: 6,
};

export interface ActionPayload {
  actionId?: string;
  cardId?: string;
  optionId?: string;
  playerId?: string;
}

export function createInitialState(): GameState {
  return {
    phase: 'INIT',
    dealerId: '',
    currentPlayerId: '',
    deck: [],
    players: [],
    pendingActions: [],
    roundIndex: 1,
    baseScore: 1,
    turnCount: 0,
    logs: [],
  };
}

export function startNewGame(state: GameState): GameState {
  const deck = createInitialGameDeck();
  const dealerSeat = state.roundIndex === 1 ? Math.floor(Math.random() * 3) : findNextDealerSeat(state);
  const { players, remainingDeck } = dealCards(deck, dealerSeat);
  const dealer = players.find((p) => p.seat === dealerSeat)!;

  let newState: GameState = {
    ...state,
    phase: 'DEALING',
    dealerId: dealer.id,
    currentPlayerId: dealer.id,
    deck: remainingDeck,
    players,
    revealedCard: undefined,
    lastDiscard: undefined,
    lastDiscardPlayerId: undefined,
    pendingActions: [],
    turnCount: 0,
    logs: [],
    settlement: undefined,
  };

  newState = addLog(newState, 'system', 'system', 'START', undefined, `第${newState.roundIndex}局开始，庄家：${dealer.name}`);

  // 检查起手提
  return checkInitialTi(newState);
}

function findNextDealerSeat(state: GameState): number {
  if (state.settlement) {
    const winner = state.players.find((p) => p.id === state.settlement!.winnerId);
    if (winner) return winner.seat;
  }
  const dealer = state.players.find((p) => p.isDealer);
  return dealer ? dealer.seat : 0;
}

export function checkInitialTi(state: GameState): GameState {
  let newState: GameState = { ...state, phase: 'CHECK_INITIAL_TI' };
  for (const player of newState.players) {
    const ti = findInitialTi(player);
    if (ti) {
      newState = applyMeld(newState, player.id, ti);
      newState = removeCardsFromHand(newState, player.id, ti.cards.map((c) => c.id));
      newState = updatePlayer(newState, player.id, (p) => ({
        ...p,
        paoTiCount: p.paoTiCount + 1,
      }));
      newState = addLog(newState, player.id, player.id, 'ti', ti.cards[0], `起手${ti.cards[0].suit === 'big' ? '大' : '小'}${ti.cards[0].rank}提`);
    }
  }
  return transitionToDiscard(newState, newState.dealerId);
}

function transitionToDiscard(state: GameState, playerId: string): GameState {
  return {
    ...state,
    phase: 'WAIT_DISCARD',
    currentPlayerId: playerId,
    pendingActions: [],
  };
}

export function discardCard(state: GameState, playerId: string, cardId: string): GameState {
  if (state.phase !== 'WAIT_DISCARD') return state;
  if (state.currentPlayerId !== playerId) return state;

  const player = state.players.find((p) => p.id === playerId)!;
  const cardIndex = player.hand.findIndex((c) => c.id === cardId);
  if (cardIndex < 0) return state;

  const card = player.hand[cardIndex];
  const newHand = player.hand.slice();
  newHand.splice(cardIndex, 1);

  let newState = updatePlayer(state, playerId, (p) => ({ ...p, hand: sortHand(newHand) }));
  newState = {
    ...newState,
    lastDiscard: card,
    lastDiscardPlayerId: playerId,
    revealedCard: undefined,
  };
  newState = addLog(newState, playerId, playerId, 'discard', card, `${player.name}打出${cardLabel(card)}`);

  return resolveDiscardResponses(newState, card, playerId);
}

function resolveDiscardResponses(state: GameState, card: Card, sourcePlayerId: string): GameState {
  const actions = buildResponseActions(state, card, sourcePlayerId, 'discard');
  if (actions.length === 0) {
    return startNextTurn(state);
  }
  return {
    ...state,
    phase: 'WAIT_RESPONSE',
    pendingActions: actions,
  };
}

function buildResponseActions(
  state: GameState,
  card: Card,
  sourcePlayerId: string,
  sourceType: SourceType
): PendingAction[] {
  const actions: PendingAction[] = [];
  const sourcePlayer = state.players.find((p) => p.id === sourcePlayerId)!;

  for (const player of state.players) {
    if (player.id === sourcePlayerId) continue;

    const isSelfDraw = false;
    const context = { player, card, sourcePlayerId, sourceType, isSelfDraw, isSourceFromDeck: false };
    let hasAction = false;
    let hasForced = false;

    // 胡：主动出牌不可胡；摸出的明牌可胡
    if (sourceType === 'drawReveal') {
      const isZiMo = player.id === sourcePlayerId;
      if (canHu(player, card, sourcePlayerId, sourceType, isZiMo)) {
        actions.push({
          id: createPendingActionId(),
          playerId: player.id,
          actionType: 'hu',
          card,
          sourcePlayerId,
          sourceType,
          priority: ACTION_PRIORITY.hu,
        });
        hasAction = true;
        hasForced = true;
      }
    }

    // 跑：手中三张遇第四张
    if (canPaoFromHand(player.hand, card)) {
      actions.push({
        id: createPendingActionId(),
        playerId: player.id,
        actionType: 'pao',
        card,
        sourcePlayerId,
        sourceType,
        priority: ACTION_PRIORITY.pao,
      });
      hasAction = true;
      hasForced = true;
      continue; // 跑优先于碰吃
    }

    // 碰
    if (canPeng(player.hand, card) && !player.passedPengRanks.includes(`${card.suit}-${card.rank}`)) {
      actions.push({
        id: createPendingActionId(),
        playerId: player.id,
        actionType: 'peng',
        card,
        sourcePlayerId,
        sourceType,
        priority: ACTION_PRIORITY.peng,
      });
      hasAction = true;
    }

    // 吃
    const chiResult = canChi(context, state.players);
    if (chiResult.can) {
      actions.push({
        id: createPendingActionId(),
        playerId: player.id,
        actionType: 'chi',
        card,
        sourcePlayerId,
        sourceType,
        options: chiResult.options,
        priority: ACTION_PRIORITY.chi,
      });
      hasAction = true;
    }

    // 有可选择的动作时添加“过”
    if (hasAction && !hasForced) {
      actions.push({
        id: createPendingActionId(),
        playerId: player.id,
        actionType: 'pass',
        card,
        sourcePlayerId,
        sourceType,
        priority: ACTION_PRIORITY.pass,
      });
    }
  }

  return sortActions(actions, sourcePlayer.seat, state.players.length, state.players);
}

function sortActions(actions: PendingAction[], sourceSeat: number, playerCount: number, players: PlayerState[]): PendingAction[] {
  const seatMap = new Map(players.map((p) => [p.id, p.seat]));
  return actions.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const seatA = (playerCount + (seatMap.get(a.playerId) || 0) - sourceSeat) % playerCount;
    const seatB = (playerCount + (seatMap.get(b.playerId) || 0) - sourceSeat) % playerCount;
    return seatA - seatB;
  });
}

export function drawCard(state: GameState, playerId: string): GameState {
  if (state.deck.length === 0) {
    return { ...state, phase: 'DRAW_GAME' };
  }

  const card = state.deck[0];
  const newDeck = state.deck.slice(1);
  const player = state.players.find((p) => p.id === playerId)!;

  let newState: GameState = {
    ...state,
    deck: newDeck,
    revealedCard: card,
    currentPlayerId: playerId,
    turnCount: state.turnCount + 1,
  };
  newState = addLog(newState, playerId, playerId, 'discard', card, `${player.name}摸出${cardLabel(card)}`);

  return resolveDrawReveal(newState, playerId, card);
}

function resolveDrawReveal(state: GameState, playerId: string, card: Card): GameState {
  const player = state.players.find((p) => p.id === playerId)!;

  // 提/偎/跑最高优先级
  // 自己摸到第四张：提
  if (canTiFromHand(player.hand, card)) {
    return executeActionInternal(state, playerId, 'ti', card);
  }

  // 自己摸到第三张：偎（或臭偎）
  if (canWei(player.hand, card)) {
    const rankKey = `${card.suit}-${card.rank}`;
    if (player.passedPengRanks.includes(rankKey)) {
      return executeActionInternal(state, playerId, 'chouWei', card);
    }
    return executeActionInternal(state, playerId, 'wei', card);
  }

  // 已碰/偎升级成跑（自己摸到第四张的情况已被提处理，这里是其他玩家？不，摸牌的是自己）
  // 摸牌阶段只可能是自己摸到第四张（提）或第三张（偎）

  // 检查是否可以胡这张摸出的明牌（自摸）
  if (canHu(player, card, playerId, 'drawReveal', true)) {
    return executeActionInternal(state, playerId, 'hu', card);
  }

  // 所有玩家对这张明牌的响应：
  // - 摸牌者自己可以吃自己摸出的明牌
  // - 其他玩家可以胡/跑/碰/吃
  const actions = buildDrawRevealResponseActions(state, card, playerId);
  if (actions.length === 0) {
    // 无人响应，明牌直接弃入弃牌堆，由下家摸牌
    return discardRevealedCard(state, card, playerId);
  }

  return {
    ...state,
    phase: 'WAIT_RESPONSE',
    pendingActions: actions,
  };
}

function discardRevealedCard(state: GameState, card: Card, playerId: string): GameState {
  const player = state.players.find((p) => p.id === playerId)!;
  let newState: GameState = {
    ...state,
    revealedCard: undefined,
    lastDiscard: card,
    lastDiscardPlayerId: playerId,
  };
  newState = addLog(newState, playerId, playerId, 'discard', card, `${player.name}摸出${cardLabel(card)}无人要，弃入弃牌堆`);
  return startNextTurn(newState);
}

function buildDrawRevealResponseActions(state: GameState, card: Card, sourcePlayerId: string): PendingAction[] {
  const actions: PendingAction[] = [];
  const sourcePlayer = state.players.find((p) => p.id === sourcePlayerId)!;

  for (const player of state.players) {
    const isSelf = player.id === sourcePlayerId;

    const context = {
      player,
      card,
      sourcePlayerId,
      sourceType: 'drawReveal' as SourceType,
      isSelfDraw: isSelf,
      isSourceFromDeck: true,
    };
    let hasAction = false;
    let hasForced = false;

    if (isSelf) {
      // 摸牌者自己只能吃自己摸出的明牌（提/偎/胡已前置处理）
      const chiResult = canChi(context, state.players);
      if (chiResult.can) {
        actions.push({
          id: createPendingActionId(),
          playerId: player.id,
          actionType: 'chi',
          card,
          sourcePlayerId,
          sourceType: 'drawReveal',
          options: chiResult.options,
          priority: ACTION_PRIORITY.chi,
        });
        hasAction = true;
      }
    } else {
      // 胡别人摸出的明牌
      if (canHu(player, card, sourcePlayerId, 'drawReveal', false)) {
        actions.push({
          id: createPendingActionId(),
          playerId: player.id,
          actionType: 'hu',
          card,
          sourcePlayerId,
          sourceType: 'drawReveal',
          priority: ACTION_PRIORITY.hu,
        });
        hasAction = true;
        hasForced = true;
      }

      // 跑：手中三张遇第四张
      if (canPaoFromHand(player.hand, card)) {
        actions.push({
          id: createPendingActionId(),
          playerId: player.id,
          actionType: 'pao',
          card,
          sourcePlayerId,
          sourceType: 'drawReveal',
          priority: ACTION_PRIORITY.pao,
        });
        hasAction = true;
        hasForced = true;
        continue;
      }

      // 碰
      if (canPeng(player.hand, card) && !player.passedPengRanks.includes(`${card.suit}-${card.rank}`)) {
        actions.push({
          id: createPendingActionId(),
          playerId: player.id,
          actionType: 'peng',
          card,
          sourcePlayerId,
          sourceType: 'drawReveal',
          priority: ACTION_PRIORITY.peng,
        });
        hasAction = true;
      }

      // 吃：下家可吃
      const chiResult = canChi(context, state.players);
      if (chiResult.can) {
        actions.push({
          id: createPendingActionId(),
          playerId: player.id,
          actionType: 'chi',
          card,
          sourcePlayerId,
          sourceType: 'drawReveal',
          options: chiResult.options,
          priority: ACTION_PRIORITY.chi,
        });
        hasAction = true;
      }
    }

    if (hasAction && !hasForced) {
      actions.push({
        id: createPendingActionId(),
        playerId: player.id,
        actionType: 'pass',
        card,
        sourcePlayerId,
        sourceType: 'drawReveal',
        priority: ACTION_PRIORITY.pass,
      });
    }
  }

  return sortActions(actions, sourcePlayer.seat, state.players.length, state.players);
}

export function executeAction(state: GameState, actionId: string, optionId?: string): GameState {
  const action = state.pendingActions.find((a) => a.id === actionId);
  if (!action) return state;

  return executeActionInternal(state, action.playerId, action.actionType, action.card, action, optionId);
}

function executeActionInternal(
  state: GameState,
  playerId: string,
  actionType: string,
  card: Card,
  action?: PendingAction,
  optionId?: string
): GameState {
  const player = state.players.find((p) => p.id === playerId)!;

  switch (actionType) {
    case 'hu': {
      const isZiMo = playerId === (state.currentPlayerId || state.revealedCard ? playerId : '');
      const sourcePlayerId = action?.sourcePlayerId || state.currentPlayerId;
      const sourceType = action?.sourceType || 'drawReveal';
      const huResult = calculateHu(player, card, sourcePlayerId, sourceType, isZiMo);
      return enterSettlement(state, playerId, huResult);
    }
    case 'pao': {
      return executePao(state, playerId, card, action);
    }
    case 'ti': {
      return executeTi(state, playerId, card);
    }
    case 'wei': {
      return executeWei(state, playerId, card);
    }
    case 'chouWei': {
      return executeChouWei(state, playerId, card);
    }
    case 'peng': {
      return executePeng(state, playerId, card, action);
    }
    case 'chi': {
      return executeChi(state, playerId, card, action, optionId);
    }
    case 'pass': {
      return executePass(state, playerId, card, action);
    }
    default:
      return state;
  }
}

function executePao(state: GameState, playerId: string, card: Card, action?: PendingAction): GameState {
  const player = state.players.find((p) => p.id === playerId)!;
  const rankKey = `${card.suit}-${card.rank}`;
  const existingPeng = findExistingPeng(player, rankKey);
  const existingWei = findExistingWei(player, rankKey);

  let newState = state;
  let meld: Meld;
  if (existingPeng) {
    newState = removeMeld(newState, playerId, existingPeng.id);
    meld = buildPaoMeldFromUpgrade(existingPeng, card, action?.sourcePlayerId || state.currentPlayerId, action?.sourceType || 'drawReveal');
  } else if (existingWei) {
    newState = removeMeld(newState, playerId, existingWei.id);
    meld = buildPaoMeldFromUpgrade(existingWei, card, action?.sourcePlayerId || state.currentPlayerId, action?.sourceType || 'drawReveal');
  } else {
    meld = buildPaoMeldFromHand(player, card, action?.sourcePlayerId || state.currentPlayerId, action?.sourceType || 'drawReveal');
    newState = removeCardsFromHand(newState, playerId, player.hand.filter((c) => isSameCardForAction(c, card)).slice(0, 3).map((c) => c.id));
  }

  newState = applyMeld(newState, playerId, meld);
  newState = updatePlayer(newState, playerId, (p) => ({
    ...p,
    paoTiCount: p.paoTiCount + 1,
  }));
  newState = addLog(newState, playerId, playerId, 'pao', card, `${player.name}跑${cardLabel(card)}`);

  return afterPaoTi(newState, playerId);
}

function executeTi(state: GameState, playerId: string, card: Card): GameState {
  const player = state.players.find((p) => p.id === playerId)!;
  const rankKey = `${card.suit}-${card.rank}`;
  const existingWei = findExistingWei(player, rankKey);

  let newState = state;
  let meld: Meld;
  if (existingWei) {
    newState = removeMeld(newState, playerId, existingWei.id);
    meld = buildTiMeldFromUpgrade(existingWei, card);
  } else {
    meld = buildTiMeldFromHand(player, card);
    newState = removeCardsFromHand(newState, playerId, player.hand.filter((c) => isSameCardForAction(c, card)).slice(0, 3).map((c) => c.id));
  }

  newState = applyMeld(newState, playerId, meld);
  newState = updatePlayer(newState, playerId, (p) => ({
    ...p,
    paoTiCount: p.paoTiCount + 1,
  }));
  newState = addLog(newState, playerId, playerId, 'ti', card, `${player.name}提${cardLabel(card)}`);

  return afterPaoTi(newState, playerId);
}

function executeWei(state: GameState, playerId: string, card: Card): GameState {
  const player = state.players.find((p) => p.id === playerId)!;
  const meld = buildWeiMeld(player, card);
  let newState = removeCardsFromHand(state, playerId, player.hand.filter((c) => isSameCardForAction(c, card)).slice(0, 2).map((c) => c.id));
  newState = applyMeld(newState, playerId, meld);
  newState = addLog(newState, playerId, playerId, 'wei', card, `${player.name}偎${cardLabel(card)}`);

  // 偎后检查是否可以胡
  if (canHu(player, card, playerId, 'drawReveal', true)) {
    return enterSettlement(newState, playerId, calculateHu(player, card, playerId, 'drawReveal', true));
  }

  return transitionToDiscard(newState, playerId);
}

function executeChouWei(state: GameState, playerId: string, card: Card): GameState {
  const player = state.players.find((p) => p.id === playerId)!;
  const meld = buildChouWeiMeld(player, card);
  let newState = removeCardsFromHand(state, playerId, player.hand.filter((c) => isSameCardForAction(c, card)).slice(0, 2).map((c) => c.id));
  newState = applyMeld(newState, playerId, meld);
  newState = addLog(newState, playerId, playerId, 'wei', card, `${player.name}臭偎${cardLabel(card)}`);

  if (canHu(player, card, playerId, 'drawReveal', true)) {
    return enterSettlement(newState, playerId, calculateHu(player, card, playerId, 'drawReveal', true));
  }

  return transitionToDiscard(newState, playerId);
}

function executePeng(state: GameState, playerId: string, card: Card, action?: PendingAction): GameState {
  const player = state.players.find((p) => p.id === playerId)!;
  const meld = buildPengMeld(player, card, action?.sourcePlayerId || state.currentPlayerId, action?.sourceType || 'discard');
  let newState = removeCardsFromHand(state, playerId, player.hand.filter((c) => isSameCardForAction(c, card)).slice(0, 2).map((c) => c.id));
  newState = applyMeld(newState, playerId, meld);
  newState = addLog(newState, playerId, playerId, 'peng', card, `${player.name}碰${cardLabel(card)}`);
  return transitionToDiscard(newState, playerId);
}

function executeChi(state: GameState, playerId: string, card: Card, action?: PendingAction, optionId?: string): GameState {
  if (!action?.options || action.options.length === 0) return state;
  const option = action.options.find((o) => o.id === optionId) || action.options[0];
  const player = state.players.find((p) => p.id === playerId)!;

  // 移除主吃牌组合中除target外的手牌
  const usedIds = option.mainCards.filter((c) => c.id !== card.id).map((c) => c.id);
  let newState = removeCardsFromHand(state, playerId, usedIds);

  // 处理比牌：手中仍有与 target 相同的牌时，必须同时组成合法组合
  const sameCards = player.hand.filter((c) => isSameCardForAction(c, card) && !usedIds.includes(c.id));
  for (const sameCard of sameCards) {
    const rest = player.hand.filter((c) => c.id !== sameCard.id && !usedIds.includes(c.id));
    const biOptions = findAllChiOptions(rest, sameCard);
    if (biOptions.length > 0) {
      const biOption = biOptions[0];
      // 比牌组合中的全部牌（含 sameCard）都要从手牌移除
      const biUsedIds = biOption.mainCards.map((c) => c.id);
      newState = removeCardsFromHand(newState, playerId, biUsedIds);
      const biMeld = buildChiMeld(player, biOption, action.sourcePlayerId);
      newState = applyMeld(newState, playerId, biMeld);
    }
  }

  const meld = buildChiMeld(player, option, action.sourcePlayerId);
  newState = applyMeld(newState, playerId, meld);
  newState = addLog(newState, playerId, playerId, 'chi', card, `${player.name}吃${cardLabel(card)}`);

  return transitionToDiscard(newState, playerId);
}

function executePass(state: GameState, playerId: string, card: Card, action?: PendingAction): GameState {
  let newState = state;

  if (action?.actionType === 'peng') {
    newState = updatePlayer(newState, playerId, (p) => ({
      ...p,
      passedPengRanks: [...p.passedPengRanks, `${card.suit}-${card.rank}`],
    }));
  } else if (action?.actionType === 'hu') {
    newState = updatePlayer(newState, playerId, (p) => ({
      ...p,
      passedHuRanks: [...p.passedHuRanks, `${card.suit}-${card.rank}`],
    }));
  }

  // 玩家选择“过”时，移除该玩家所有 pending 动作
  newState = {
    ...newState,
    pendingActions: newState.pendingActions.filter((a) => a.playerId !== playerId),
  };

  if (newState.pendingActions.length === 0) {
    return startNextTurn(newState);
  }

  return newState;
}

function afterPaoTi(state: GameState, playerId: string): GameState {
  const player = state.players.find((p) => p.id === playerId)!;
  const card = state.revealedCard || state.lastDiscard;
  if (!card) return state;

  // 检查胡牌
  const sourceType = state.revealedCard ? 'drawReveal' : 'discard';
  const sourcePlayerId = state.revealedCard ? playerId : state.lastDiscardPlayerId || playerId;
  const isZiMo = sourcePlayerId === playerId;
  if (canHu(player, card, sourcePlayerId, sourceType, isZiMo)) {
    return enterSettlement(state, playerId, calculateHu(player, card, sourcePlayerId, sourceType, isZiMo));
  }

  if (player.paoTiCount <= 1) {
    // 第一次跑提后必须出牌
    return transitionToDiscard(state, playerId);
  } else {
    // 第二次及以后直接由下家摸牌
    return startNextTurn(state);
  }
}

function enterSettlement(state: GameState, winnerId: string, huResult: import('./types').HuResult): GameState {
  const winner = state.players.find((p) => p.id === winnerId)!;
  const settlement = computeSettlement(winner, huResult, state.players, state.baseScore, state.turnCount, state.deck.length);

  let newState: GameState = { ...state, phase: 'SETTLEMENT', settlement };
  for (const loserId of settlement.loserIds) {
    newState = updatePlayer(newState, loserId, (p) => ({ ...p, score: p.score - settlement.scorePerLoser }));
  }
  newState = updatePlayer(newState, winnerId, (p) => ({ ...p, score: p.score + settlement.totalScore }));
  newState = addLog(newState, winnerId, winnerId, 'hu', undefined, `${winner.name}胡牌，${settlement.totalHuxi}胡，${settlement.totalTun}囤`);

  return newState;
}

function startNextTurn(state: GameState): GameState {
  const nextId = nextPlayerId(state.currentPlayerId, state.players);
  return drawCard(state, nextId);
}

export function startNextRound(state: GameState): GameState {
  return startNewGame({ ...state, roundIndex: state.roundIndex + 1 });
}

export function toggleOpenHand(state: GameState, playerId: string): GameState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;
  // 只允许在发牌后、首次摸牌前明牌
  if (state.phase !== 'WAIT_DISCARD' || state.turnCount > 0) return state;
  // 庄家只有在未出牌前才能明牌
  if (state.currentPlayerId !== playerId) return state;

  return {
    ...state,
    players: clonePlayers(state.players).map((p) =>
      p.id === playerId ? { ...p, isOpenHand: true } : p
    ),
  };
}

// ==================== 状态辅助函数 ====================

function updatePlayer(state: GameState, playerId: string, updater: (p: PlayerState) => PlayerState): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? updater(clonePlayer(p)) : p)),
  };
}

function computePlayerStats(p: PlayerState): Partial<PlayerState> {
  const allCards = [...p.hand, ...p.melds.flatMap((m) => m.cards)];
  const huxi = p.melds.reduce((sum, m) => sum + m.huxi, 0);
  const redCount = allCards.filter((c) => c.isRed).length;
  return { huxi, redCount };
}

function applyMeld(state: GameState, playerId: string, meld: Meld): GameState {
  return updatePlayer(state, playerId, (p) => {
    const updated = { ...p, melds: [...p.melds, meld], hand: sortHand(p.hand) };
    return { ...updated, ...computePlayerStats(updated) };
  });
}

function removeMeld(state: GameState, playerId: string, meldId: string): GameState {
  return updatePlayer(state, playerId, (p) => {
    const updated = { ...p, melds: p.melds.filter((m) => m.id !== meldId) };
    return { ...updated, ...computePlayerStats(updated) };
  });
}

function removeCardsFromHand(state: GameState, playerId: string, cardIds: string[]): GameState {
  const idSet = new Set(cardIds);
  return updatePlayer(state, playerId, (p) => {
    const updated = { ...p, hand: sortHand(p.hand.filter((c) => !idSet.has(c.id))) };
    return { ...updated, ...computePlayerStats(updated) };
  });
}

function addLog(
  state: GameState,
  playerId: string,
  targetPlayerId: string,
  action: string,
  card?: Card,
  message?: string
): GameState {
  return {
    ...state,
    logs: [
      ...state.logs,
      {
        id: createLogId(),
        turn: state.turnCount,
        playerId,
        action: action as import('./types').ActionType,
        card,
        targetPlayerId,
        timestamp: Date.now(),
        message: message || '',
      },
    ],
  };
}

function cardLabel(card: Card): string {
  if (card.suit === 'big') {
    const map = ['', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾'];
    return map[card.rank];
  }
  const map = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  return map[card.rank];
}

function isSameCardForAction(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}
