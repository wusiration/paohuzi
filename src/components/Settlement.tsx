import type { GameState } from '../core/types';
import { Card } from './Card';

interface SettlementProps {
  state: GameState;
  onNext: () => void;
}

export function Settlement({ state, onNext }: SettlementProps) {
  const result = state.settlement;
  if (!result) return null;

  const winner = state.players.find((p) => p.id === result.winnerId);

  return (
    <div className="settlement-overlay">
      <div className="settlement-panel">
        <h2>{winner?.name} 胡牌</h2>
        <div className="settlement-source">
          {result.isZiMo ? '自摸' : `胡 ${state.players.find((p) => p.id === result.sourcePlayerId)?.name || ''}`}
        </div>

        <div className="settlement-section">
          <h3>胡息明细</h3>
          <ul>
            {result.huxiDetails.map((item, idx) => (
              <li key={idx}>
                {item.type}: {item.huxi}胡
              </li>
            ))}
          </ul>
          <div className="settlement-total">总胡息：{result.totalHuxi}胡</div>
        </div>

        <div className="settlement-section">
          <h3>囤数</h3>
          <div>基础囤：{result.baseTun}</div>
          <div>自摸加囤：{result.ziMoTun}</div>
          <div className="settlement-total">结算囤：{result.totalTun}</div>
        </div>

        <div className="settlement-section">
          <h3>名堂</h3>
          {result.mingtang.length === 0 ? <div>无</div> : (
            <ul>
              {result.mingtang.map((mt, idx) => (
                <li key={idx}>
                  {mt.name}: {mt.fan}番
                </li>
              ))}
            </ul>
          )}
          <div className="settlement-total">总番数：{result.totalFan}番</div>
        </div>

        <div className="settlement-section">
          <h3>结算</h3>
          <div>底分：{result.baseScore}</div>
          <div>单家输分：{result.scorePerLoser}</div>
          <div className="settlement-total">胡家得分：{result.totalScore}</div>
        </div>

        <div className="settlement-section">
          <h3>胡牌拆解</h3>
          <div className="hu-melds">
            {result.huResult.melds.map((meld) => (
              <div key={meld.id} className={`hu-meld ${meld.type}`}>
                {meld.cards.map((card, idx) => (
                  <Card key={`${meld.id}-${idx}`} card={card} small />
                ))}
              </div>
            ))}
          </div>
          <div>红牌：{result.huResult.redCount} 大字：{result.huResult.bigCount} 小字：{result.huResult.smallCount}</div>
        </div>

        <button className="settlement-next" onClick={onNext}>
          下一局
        </button>
      </div>
    </div>
  );
}
