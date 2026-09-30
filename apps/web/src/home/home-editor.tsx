import type { ReactNode } from 'react';
import { catalog } from '@golfworld/economy';
import { furnitureSkuSchema } from '@golfworld/shared';
import { useGame } from '../app/store';
export function HomeEditor(): ReactNode {
  const placing = useGame((state) => state.placing);
  const selected = useGame((state) => state.selectedFurniture);
  const items = useGame((state) => state.furniture);
  return <section className="home-editor panel" aria-label="Home editor">
    <div className="row-between"><span className="eyebrow">MAKE YOURSELF AT HOME</span><span className="lie">{items.length}/40 pieces</span></div>
    <h2>Your little corner.</h2>
    <div className="furniture-tabs">{catalog.filter((item) => item.slot === 'furniture').map((item) => <button key={item.sku} className={placing === item.sku ? 'active' : ''} onClick={() => useGame.getState().setPlacing(furnitureSkuSchema.parse(item.sku))}>{item.name}</button>)}</div>
    <p className="control-note">{placing ? 'Tap the sand-colored pad to place your piece.' : 'Choose a piece to place. Tap a placed piece, then drag to move.'}</p>
    {selected && <div className="row"><button onClick={() => useGame.getState().rotateFurniture()}>Rotate 90°</button><button onClick={() => useGame.getState().removeFurniture()}>Remove</button></div>}
    <small className="save-note">Saved on this browser. {items.length === 40 ? 'Your lot is full.' : 'Reload to come home again.'}</small>
  </section>;
}
