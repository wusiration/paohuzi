# UI 组件说明

## 组件列表

| 组件 | 路径 | 职责 |
|---|---|---|
| Table | `src/components/Table.tsx` | 主牌桌布局，整合 AI 区域、玩家区域、明牌区、操作面板与结算弹层 |
| Card | `src/components/Card.tsx` | 单张牌渲染，支持正反面、选中态、高亮态、大小尺寸 |
| Hand | `src/components/Hand.tsx` | 手牌排列，支持隐藏、选择、点击交互 |
| Meld | `src/components/Meld.tsx` | 落地牌组展示，区分吃/碰/偎/臭偎/跑/提，偎臭偎对非所有者显示牌背 |
| ActionPanel | `src/components/ActionPanel.tsx` | 操作按钮（胡跑提偎碰吃过），强制动作时不显示“过” |
| ChiSelector | `src/components/ChiSelector.tsx` | 多种吃法选择弹层，以真实牌组形式展示 |
| Settlement | `src/components/Settlement.tsx` | 胡牌结算面板，展示胡息、囤数、名堂、结算分数与胡牌拆解 |
| ScorePanel | `src/components/ScorePanel.tsx` | 顶部玩家分数与状态显示 |

## 视觉风格

- 深绿色绒布/木质牌桌背景。
- 牌面比例接近传统字牌，米白底色，红黑文字。
- 悬停轻微上移，选中明显上移。
- 操作按钮按优先级着色，胡按钮最醒目。

## 响应式

- 桌面端优先 16:9 横屏。
- 移动端强制横屏，手牌可压缩，按钮放大。
