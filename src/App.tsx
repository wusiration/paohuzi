import { Table } from './components/Table';
import { useGame } from './hooks/useGame';
import { soundManager } from './audio/soundManager';
import './App.css';

function App() {
  const game = useGame();
  const { state, started, aiDelayEnabled, fastMode, soundEnabled, cheatMode, start, restart, reset, doDiscard, doAction, doOpenHand, setAiDelayEnabled, setFastMode, setSoundEnabled, setCheatMode, updateHandOrder } = game;

  if (!started) {
    return (
      <div className="app-start">
        <div className="start-panel">
          <h1>怀化红拐弯跑胡子</h1>
          <p>三人单机版 · 1名真人 vs 2名AI</p>
          <button className="start-btn" onClick={() => { soundManager.play('click'); start(); }}>
            开始游戏
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="app-toolbar">
        <button onClick={() => { soundManager.play('click'); reset(); }}>退出</button>
        <button onClick={() => { soundManager.play('click'); restart(); }}>下一局</button>
        <label>
          <input
            type="checkbox"
            checked={aiDelayEnabled}
            onChange={(e) => setAiDelayEnabled(e.target.checked)}
          />
          AI延迟
        </label>
        <label>
          <input
            type="checkbox"
            checked={fastMode}
            onChange={(e) => setFastMode(e.target.checked)}
          />
          快速模式
        </label>
        <label className="sound-toggle">
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={(e) => { soundManager.setEnabled(e.target.checked); setSoundEnabled(e.target.checked); }}
          />
          音效
        </label>
        <label className="cheat-toggle" title="开启后可查看 AI 手牌，仅本地可见">
          <input
            type="checkbox"
            checked={cheatMode}
            onChange={(e) => setCheatMode(e.target.checked)}
          />
          透视
        </label>
        <button onClick={() => alert('怀化红拐弯跑胡子基本规则：\n\n• 三人游戏，80张牌（小字1-10、大字1-10各4张）\n• 红牌为2、7、10，大字与小字对应\n• 起手庄家21张，其余20张\n• 可吃、碰、跑、提、偎、胡\n• 胡牌需至少15胡息，自摸15胡即可，非自摸需18胡（或15-17胡且有名堂）\n• 名堂包括红胡、乌胡、点胡、碰碰胡、十八大、十六小、天胡、地胡、海底胡等')}>
          规则
        </button>
      </div>
      <Table
        state={state}
        cheatMode={cheatMode}
        onDiscard={doDiscard}
        onAction={doAction}
        onNextRound={restart}
        onOpenHand={doOpenHand}
        onHandOrderChange={updateHandOrder}
      />
    </div>
  );
}

export default App;
