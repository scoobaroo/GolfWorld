import type { ReactNode } from 'react';
import { defaultAppearance, type AvatarAppearance } from '@golfworld/shared';
import { useGame } from '../app/store';

const fields: { key: keyof AvatarAppearance; label: string }[] = [
  { key: 'skinColor', label: 'Skin color' }, { key: 'shirtColor', label: 'Shirt color' },
  { key: 'pantsColor', label: 'Pants color' }, { key: 'hatColor', label: 'Hat color' },
];
export function Appearance(): ReactNode {
  const appearance = useGame((state) => state.appearance);
  return <section className="appearance-editor" aria-labelledby="appearance-title">
    <h2 id="appearance-title">Your appearance</h2>
    <p className="muted">Make the starter avatar your own. Changes save automatically on this browser.</p>
    <div className="avatar-preview" role="img" aria-label="Preview of your avatar colors">
      <span className="preview-hat" style={{ background: appearance.hatColor }} />
      <span className="preview-head" style={{ background: appearance.skinColor }} />
      <span className="preview-shirt" style={{ background: appearance.shirtColor }} />
      <span className="preview-pants" style={{ background: appearance.pantsColor }} />
    </div>
    <div className="appearance-colors">{fields.map((field) => <label key={field.key}>{field.label}<input type="color" value={appearance[field.key]} onChange={(event) => useGame.getState().setAppearance({ ...appearance, [field.key]: event.target.value })} /></label>)}</div>
    <div className="row appearance-presets"><button onClick={() => useGame.getState().setAppearance({ ...appearance, shirtColor: '#1267ab', pantsColor: '#24394c', hatColor: '#e9eff4' })}>Ocean outfit</button><button onClick={() => useGame.getState().setAppearance({ ...appearance, shirtColor: '#b96948', pantsColor: '#4b5239', hatColor: '#f3debb' })}>Clay outfit</button></div>
    <button onClick={() => useGame.getState().setAppearance(defaultAppearance)}>Reset appearance</button>
  </section>;
}
