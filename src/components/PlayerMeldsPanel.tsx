import type { GameState, Meld as MeldType } from '../core/types';
import { Card } from './Card';
import { meldTypeLabel } from '../utils/helpers';

interface PlayerMeldsPanelProps {
  state: GameState;
  playerId: string | null;
  onClose: () => void;
}

export function PlayerMeldsPanel({ state, playerId, onClose }: PlayerMeldsPanelProps) {
  if (!playerId) return null;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;

  const grouped = groupMeldsByType(player.melds);

  return (
    <div className="player-melds-overlay" onClick={onClose}>
      <div className="player-melds-panel" onClick={(e) => e.stopPropagation()}>
        <h3>
          {player.name} 的落地牌
          {player.isOpenHand && <span className="open-hand-badge">明</span>}
        </h3>

        {player.melds.length === 0 ? (
          <div className="player-melds-empty">暂无落地牌</div>
        ) : (
          <div className="player-melds-list">
            {grouped.map(([type, melds]) => (
              <div key={type} className="player-melds-section">
                <h4 className="player-melds-type">
                  {meldTypeLabel(type as MeldType['type'])} ({melds.length})
                </h4>
                <div className="player-melds-items">
                  {melds.map((meld) => (
                    <div key={meld.id} className="player-meld-item">
                      <div className="player-meld-cards">
                        {meld.cards.map((card, idx) => (
                          <Card
                            key={`${meld.id}-${card.id}-${idx}`}
                            card={meld.isHidden && player.isAI ? undefined : card}
                            hidden={meld.isHidden && player.isAI}
                            small
                          />
                        ))}
                      </div>
                      <span className="player-meld-huxi">{meld.huxi}胡</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <button className="player-melds-close" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  );
}

function groupMeldsByType(melds: MeldType[]): [string, MeldType[]][] {
  const map = new Map<string, MeldType[]>();
  const order = ['ti', 'pao', 'wei', 'chouWei', 'peng', 'chi', 'sequence', 'specialSequence', 'mixedTriplet', 'pair'];

  for (const meld of melds) {
    if (!map.has(meld.type)) map.set(meld.type, []);
    map.get(meld.type)!.push(meld);
  }

  const result: [string, MeldType[]][] = [];
  for (const type of order) {
    if (map.has(type)) {
      result.push([type, map.get(type)!]);
    }
  }
  return result;
}
