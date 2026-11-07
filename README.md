# 怀化红拐弯跑胡子（单机版）

[![CI](https://github.com/wusiration/paohuzi/actions/workflows/ci.yml/badge.svg)](https://github.com/wusiration/paohuzi/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite)](https://vitejs.dev/)

基于湖南怀化地区“红拐弯”规则的三人单机跑胡子游戏。

- 1 名真人玩家 vs 2 名 AI 玩家
- 支持吃、碰、偎、臭偎、提、跑、胡、过等核心动作
- 独立规则引擎 + 状态机驱动
- 基础牌桌 UI、结算面板与名堂展示

## 技术栈

- React 19
- TypeScript 6
- Vite 8
- Vitest（单元测试）

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build

# 单元测试
npm test

# 批量模拟对局（统计胜率/流局率/终局听牌）
npx vite-node scripts/simulate.ts 300

# 新旧 AI A/B 对战（对比策略强度）
npx vite-node scripts/ab-test.ts 300
```

开发服务器默认地址：`http://localhost:5173`

## 在线试玩

GitHub Pages：[https://wusiration.github.io/paohuzi](https://wusiration.github.io/paohuzi)

> 如需启用 GitHub Pages，请在仓库 Settings → Pages 中将 Source 设置为 "Deploy from a branch"，并选择 `gh-pages` 分支（或通过 GitHub Actions 自动部署）。

## 游戏截图

> TODO：补充牌桌、结算面板、名堂展示等界面截图。

```text
建议截图尺寸：1280 × 720 左右
存放位置：docs/screenshots/
引用方式：![牌桌界面](./docs/screenshots/table.png)
```

## 游戏规则摘要

### 牌张

- 全副牌 80 张
- 小字：一、二、三、四、五、六、七、八、九、十，各 4 张
- 大字：壹、贰、叁、肆、伍、陆、柒、捌、玖、拾，各 4 张
- 红牌：二、七、十、贰、柒、拾

### 发牌

- 庄家 21 张，闲家各 20 张，牌墩 19 张
- 第一局随机庄家，胡牌者下一局坐庄，流局原庄家连庄

### 动作优先级

> 提、偎 ＞ 胡 ＞ 跑、碰 ＞ 吃

### 起胡门槛

- 15 胡息自摸可胡
- 18 胡息可平胡
- 15-17 胡息胡他人明牌需有名堂
- 低于 15 胡息不能胡

### 名堂

| 名堂 | 条件 | 番数 |
|---|---|---:|
| 乌胡 | 0 红 | 5 番 |
| 点胡 | 1 红 | 3 番 |
| 普通牌型 | 2-9 红 | 1 番 |
| 红胡 | 10-12 红 | 2 番 |
| 红拐弯 | 13 红 | 4 番 |
| 加红 | 13 红后每多 1 红 | +1 番 |
| 碰碰胡 | 全由碰/跑/提/偎/对子组成 | 5 番 |
| 十八大 | 18 张大字起 | 4 番，每多 1 张大字 +1 番 |
| 十六小 | 16 张小字起 | 4 番，每多 1 张小字 +1 番 |
| 天胡 / 地胡 / 海底胡 | 首摸/末张胡 | 各 1 番 |

### 结算

- 基础囤 = floor((总胡息 - 15) / 3) + 1
- 自摸加囤 = 1
- 单家输分 = 结算囤数 × 总番数 × 底分

## 项目结构

```text
src/
├── core/              # 规则引擎与状态机
│   ├── types.ts       # 核心类型
│   ├── deck.ts        # 牌张生成与发牌
│   ├── rules.ts       # 动作检测、吃碰规则、比牌
│   ├── solver.ts      # 胡牌求解
│   ├── ting.ts        # 听牌/向听分析
│   ├── scoring.ts     # 胡息、名堂、结算
│   ├── stateMachine.ts# 游戏状态机
│   └── ai.ts          # AI 策略（出牌模拟评估、碰/吃决策、明牌）
├── components/        # UI 组件
│   ├── Table.tsx
│   ├── Card.tsx
│   ├── Hand.tsx
│   ├── Meld.tsx
│   ├── ActionPanel.tsx
│   ├── ChiSelector.tsx
│   ├── ScorePanel.tsx
│   └── Settlement.tsx
├── hooks/
│   └── useGame.ts     # 游戏状态管理
├── utils/
│   └── helpers.ts     # 工具函数
└── tests/             # 单元测试
```

## 测试覆盖

- 牌张生成与发牌
- 基础牌组判断（顺子、特殊顺、大小三搭）
- 动作检测（吃、碰、偎、跑、提）
- 胡牌求解与门槛
- 名堂与结算
- 状态机初始化
- AI 听牌分析与出牌/碰牌决策

## 已知问题

1. AI 为启发式 + 听牌模拟评估，无搜索/机器学习，无难度分级与终局策略。
2. 动画效果为首版占位，未实现完整发牌飞入、摸牌移动等动画。
3. 音效、语音暂未接入。
4. 托管、对局日志、牌谱导出、多地方规则等属于后续扩展。
5. 移动端横屏适配已完成基础布局，极端小屏可能需要进一步压缩。

## 后续迭代建议

- 增加音效与背景音乐开关
- 完善动画与快速模式
- 增加 AI 难度与托管功能
- 本地战绩与对局回放
- 支持更多怀化地方规则变体

## 贡献指南

欢迎提交 Issue 和 Pull Request。

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/xxx`
3. 提交改动：`git commit -m "feat: xxx"`
4. 推送分支：`git push origin feature/xxx`
5. 提交 Pull Request

提交前请确保：

- `npm test` 通过
- `npm run lint` 无警告
- `npm run build` 成功

## 开源协议

本项目采用 [MIT 协议](./LICENSE) 开源。
