import { Table } from './components/Table';
import { useGame } from './hooks/useGame';
import './App.css';

function App() {
  const game = useGame();
  const { state, started, aiDelayEnabled, fastMode, start, restart, reset, doDiscard, doAction, doPass, setAiDelayEnabled, setFastMode } = game;

  if (!started) {
    return (
      <div className="app-start">
        <div className="start-panel">
          <h1>怀化红拐弯跑胡子</h1>
          <p>三人单机版 · 1名真人 vs 2名AI</p>
          <button className="start-btn" onClick={start}>
            开始游戏
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="app-toolbar">
        <button onClick={reset}>退出</button>
        <button onClick={restart}>下一局</button>
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
      </div>
      <Table
        state={state}
        onDiscard={doDiscard}
        onAction={doAction}
        onPass={doPass}
        onNextRound={restart}
      />
    </div>
  );
}

export default App;
