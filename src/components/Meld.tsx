import type { Meld as MeldType, PlayerState } from '../core/types';
import { Card } from './Card';
import { meldTypeLabel } from '../utils/helpers';

interface MeldProps {
  meld: MeldType;
  viewerId: string;
  players: PlayerState[];
  small?: boolean;
}

export function Meld({ meld, viewerId, players, small }: MeldProps) {
  const isOwner = meld.ownerId === viewerId;
  const owner = players.find((p) => p.id === meld.ownerId);

  return (
    <div className={`meld ${meld.type} ${meld.isHidden ? 'meld-hidden' : ''}`}>
      <div className="meld-cards">
        {meld.cards.map((card, index) => (
          <Card
            key={`${meld.id}-${card.id}-${index}`}
            card={meld.isHidden && !isOwner ? undefined : card}
            hidden={meld.isHidden && !isOwner}
            small={small}
          />
        ))}
      </div>
      <div className="meld-info">
        <span className="meld-type">{meldTypeLabel(meld.type)}</span>
        <span className="meld-huxi">{meld.huxi}胡</span>
        {owner && <span className="meld-owner">{owner.name}</span>}
      </div>
    </div>
  );
}
