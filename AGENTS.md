# AGENTS.md

本文件供 AI 编码助手阅读。以下信息基于项目实际代码与配置，而非通用假设。修改代码前请先通读本文件。

## 项目概述

`paohuzi-game` 是一个基于湖南怀化地区“红拐弯”规则的三人单机跑胡子游戏。当前为纯前端实现，无后端服务。

- 1 名真人玩家 vs 2 名 AI 玩家
- 支持吃、碰、偎、臭偎、提、跑、胡、过等核心动作
- 独立规则引擎 + 函数式状态机驱动牌局
- 基础牌桌 UI、结算面板、名堂展示、对局日志、弃牌堆、明牌（翻倍）与 AI 透视调试开关

仓库入口：`src/main.tsx`；主组件：`src/App.tsx`；核心状态机：`src/core/stateMachine.ts`。

## 技术栈

| 领域 | 技术 |
|---|---|
| 框架 | React 19（函数组件 + Hooks） |
| 语言 | TypeScript 6 |
| 构建工具 | Vite 8 |
| 测试 | Vitest 4 + jsdom + `@testing-library/react` / `jest-dom` |
| Lint | oxlint（.oxlintrc.json） |
| 音效 | Web Audio API 合成占位音效（`src/audio/soundManager.ts`） |
| 样式 | 纯 CSS（`src/App.css`、`src/index.css`），无 CSS-in-JS 框架 |

项目类型为 ES Module（`package.json` 中 `"type": "module"`），构建产物输出到 `dist/`。

## 项目结构

```text
src/
├── core/                  # 规则引擎与状态机
│   ├── types.ts           # 核心类型、常量与简单工具
│   ├── deck.ts            # 牌张生成、洗牌、发牌
│   ├── rules.ts           # 动作检测、吃法选项、比牌、落地牌组构建
│   ├── solver.ts          # 胡牌拆分/求解、起胡门槛判断
│   ├── scoring.ts         # 胡息、名堂、结算计算
│   ├── stateMachine.ts    # 游戏状态机推进
│   └── ai.ts              # AI 策略（出牌、动作选择、明牌）
├── components/            # UI 组件
│   ├── Table.tsx          # 主牌桌布局
│   ├── Card.tsx           # 单张牌渲染
│   ├── Hand.tsx           # 手牌排列与交互
│   ├── Meld.tsx           # 落地牌组展示
│   ├── ActionPanel.tsx    # 动作按钮面板
│   ├── ChiSelector.tsx    # 多种吃法选择弹层
│   ├── Settlement.tsx     # 胡牌结算面板
│   ├── ScorePanel.tsx     # 顶部分数与状态
│   ├── GameLog.tsx        # 对局日志弹层
│   ├── DiscardPile.tsx    # 弃牌堆弹层
│   └── PlayerMeldsPanel.tsx # 玩家落地牌详情弹层
├── hooks/
│   └── useGame.ts         # 连接 React 与状态机，管理 AI 定时器与设置
├── audio/
│   └── soundManager.ts    # 音效开关与播放
├── utils/
│   └── helpers.ts         # ID 生成、克隆、胡息表、通用工具
├── tests/                 # 单元测试
│   ├── deck.test.ts
│   ├── rules.test.ts
│   ├── solver.test.ts
│   ├── scoring.test.ts
│   ├── stateMachine.test.ts
│   └── simulation.test.ts
├── App.tsx                # 顶层组件，含开始界面与工具栏
├── App.css                # 主要样式
├── index.css              # 基础样式
└── main.tsx               # React 挂载入口

docs/                      # 人工撰写的规则/架构说明
├── ai-strategy.md
├── state-machine.md
└── ui-components.md
```

## 常用命令

```bash
# 安装依赖
npm install

# 开发服务器（默认 http://localhost:5173）
npm run dev

# 生产构建（输出到 dist/）
npm run build

# 单元测试
npm test

# 静态检查 / Lint
npm run lint

# 本地预览生产构建
npm run preview
```

## 代码风格约定

- 使用 TypeScript 严格模式相关配置（`noUnusedLocals`、`noUnusedParameters`、`noFallthroughCasesInSwitch`、`verbatimModuleSyntax` 等）。
- React 组件与 Hook 使用默认导出或具名导出均可，但尽量保持文件内一致。
- 状态机使用纯函数 + 不可变更新：所有状态转换函数返回新的 `GameState`，不要直接修改入参。
- 跨模块导入类型时请用 `import type` 以配合 `verbatimModuleSyntax`。
- UI 文本与注释主要使用中文，标识符（变量、函数、类型）使用英文。
- CSS 类名使用中划线命名（如 `action-panel-floating`），变量使用 CSS 自定义属性（`--felt-dark` 等）。
- 音效、日志、结算等文案使用中文。

## 测试策略

测试使用 Vitest，配置文件为 `vite.config.ts`（通过 `vitest/config`）。

- 测试文件命名：`*.test.ts`、`*.test.tsx`，位于 `src/tests/` 或被 `vite.config.ts` 的 `include` 捕获。
- 测试覆盖范围：
  - 牌张生成与发牌（`deck.test.ts`）
  - 基础牌组判断：顺子、特殊顺、大小三搭（`rules.test.ts`）
  - 动作检测：吃、碰、偎、跑、提、比牌、坎限制（`rules.test.ts`）
  - 胡牌求解与起胡门槛：15/18 胡息、自摸、15-17 胡息需有效名堂（`solver.test.ts`）
  - 名堂与结算：红牌名堂、碰碰胡、十八大、十六小、天/地/海底胡、囤数、明牌翻倍（`scoring.test.ts`）
  - 状态机初始化、发牌、起手提、摸牌后提（`stateMachine.test.ts`）
  - 模拟对局：50 局随机对局检测无异常（`simulation.test.ts`）
- 新增核心规则或状态机改动时，必须在对应测试文件中补充用例。
- 运行全部测试：`npm test`。

## 核心架构说明

### 1. 牌张模型

- 牌：`{ id, suit: 'small'|'big', rank: 1..10, isRed }`
- 全副牌 80 张：小字一~十、大字壹~拾，各 4 张。
- 红牌：`2、7、10` 对应的大小字。
- 牌的唯一标识是 `id`，比较是否同牌使用 `suit + rank`。

### 2. 状态机

详见 `docs/state-machine.md`，实现位于 `src/core/stateMachine.ts`。

主要阶段：`INIT` → `DEALING` → `CHECK_INITIAL_TI` → `WAIT_DISCARD` → `DRAW_REVEAL` / `WAIT_RESPONSE` → `SETTLEMENT` / `DRAW_GAME`。

关键规则：

- 发牌：庄家 21 张，闲家 20 张，牌墩 19 张。
- 起手四张相同自动提成落地牌。
- 动作优先级：胡 > 跑 > 碰 > 吃；提/偎为摸牌阶段强制动作。
- 跑/提后检查胡牌；第一次跑/提后必须出牌，第二次及以后直接由下家摸牌。
- 摸出的明牌若无人响应，自动弃入弃牌堆，由下家继续摸牌。
- 流局条件：牌墩摸完且无人胡牌。

### 3. 胡牌求解

实现位于 `src/core/solver.ts`。

- 使用递归 + 记忆化搜索对手牌进行拆分。
- 要求：无跑/提时任意合法拆分即可胡；有跑/提时必须有且仅有一对“将”。
- 起胡门槛：
  - 自摸：≥15 胡息即可胡。
  - 非自摸：≥18 胡息可胡；15-17 胡息需具备“有效名堂”（即不能仅为普通牌型）。

### 4. 名堂与结算

实现位于 `src/core/scoring.ts`。

- 红牌名堂：乌胡（0 红）、点胡（1 红）、普通牌型（2-9 红）、红胡（10-12 红）、红拐弯（13 红）、加红（>13 红每多 1 红 +1 番）。
- 其他名堂：碰碰胡、十八大、十六小、天胡、地胡、海底胡。
- 结算公式：`scorePerLoser = totalTun × totalFan × baseScore × openHandMultiplier`；`totalTun = baseTun + ziMoTun`。
- 明牌翻倍：胡牌者或被胡者任一方明牌，结算翻倍。

### 5. AI

实现位于 `src/core/ai.ts`。

- AI 只能读取公开信息：自己手牌、落地牌、公开牌、历史日志等。
- 强制动作（胡、跑、提、偎、臭偎）自动执行，不可选择。
- 碰/吃/出牌基于简单启发式评分。
- 明牌策略：听牌概率高、红牌多、大字多、已有跑/提时可能选择明牌。
- AI 执行延迟：普通模式约 800ms，快速模式 200ms，可在工具栏关闭延迟。

### 6. React 层

- `App.tsx` 管理开始界面、工具栏设置（AI 延迟、快速模式、音效、透视）。
- `useGame.ts` 维护 `GameState`，并在 `useEffect` 中驱动 AI 自动执行。
- `Table.tsx` 负责主要 UI 布局、手牌顺序状态、响应弹层控制。
- 玩家出牌：点击手牌选中，再次点击打出。
- 明牌按钮：仅在首次摸牌前、且为当前出牌玩家时可用。
- 透视（cheatMode）仅本地显示 AI 手牌，不影响游戏逻辑，仅用于调试。

## 安全与注意事项

- 本项目为纯客户端单机游戏，无网络通信、无用户认证、无持久化存储。
- `cheatMode`（透视）和 `isOpenHand`（明牌）均为本地调试/玩法开关，不应用于任何需要安全性的场景。
- 音效使用 Web Audio API，首次用户交互前可能处于 `suspended` 状态，代码中已做自动恢复处理。
- 不要向仓库提交 `.env`、真实音频资源或大型二进制文件。

## 已知限制与后续方向

- AI 策略为首版简单启发式，未使用搜索或机器学习。
- 动画为首版占位实现（`card-dealing`、`card-played` 等类），未实现完整飞入/移动动画。
- 音效为 Web Audio 合成占位，未接入真实音频文件。
- 无托管、无对局回放、无本地战绩持久化。
- 移动端已做基础横屏适配，极端小屏可能需进一步压缩。

## 给 AI 助手的开发建议

1. 修改 `core/` 中任何规则、状态机、求解、结算逻辑后，务必运行 `npm test`，并优先补充对应测试用例。
2. 新增 UI 组件时，参考 `components/Table.tsx` 的 props 风格与 `App.css` 的类名命名。
3. 需要共享状态时优先通过 `useGame.ts` 向下传递，避免在组件内部直接操作 `GameState`。
4. 涉及随机发牌的测试请固定构造牌张，不要依赖真实随机结果。
5. 游戏文案与注释使用中文，保持与现有代码一致。
