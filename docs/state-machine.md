# 核心状态机说明

本游戏的状态机位于 `src/core/stateMachine.ts`，采用函数式不可变更新方式推进牌局。

## 主要状态

| 状态 | 说明 |
|---|---|
| INIT | 初始空状态 |
| DEALING | 发牌中 |
| CHECK_INITIAL_TI | 检查起手四张提 |
| WAIT_DISCARD | 等待当前玩家出牌 |
| DRAW_REVEAL | 玩家从牌墩摸出明牌 |
| WAIT_RESPONSE | 等待其他玩家对明牌/弃牌做出响应 |
| SELECT_CHI | 玩家选择具体吃法（由 UI 弹层处理） |
| SETTLEMENT | 胡牌后结算 |
| DRAW_GAME | 流局 |

## 核心流转

1. `startNewGame` 洗牌发牌 → `CHECK_INITIAL_TI`。
2. 检查起手四张提，存在则直接落地为提 → `WAIT_DISCARD`。
3. 当前玩家出牌 → `WAIT_RESPONSE`。
4. 其他玩家按优先级生成响应动作：胡 → 跑 → 碰 → 吃。
5. 若无响应，由下家摸牌 → `DRAW_REVEAL`。
6. 摸牌后先检查强制动作：提 → 偎/臭偎 → 胡。
7. 若摸牌者可胡则进入 `SETTLEMENT`；否则其他玩家可对明牌响应。
8. 跑/提后检查是否可胡；第一次跑提后必须出牌，第二次及以后直接由下家摸牌。

## 动作裁决

- 所有动作由 `rules.ts` 和 `solver.ts` 统一检测，状态机只负责按优先级排序和执行。
- `pendingActions` 按优先级与座位距离排序，UI 只展示当前玩家可执行动作。
