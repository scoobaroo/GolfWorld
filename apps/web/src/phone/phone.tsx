import { useEffect, useRef, useState, type ReactNode } from 'react';
import { catalog } from '@golfworld/economy';
import { useGame } from '../app/store';
import { Icon, type IconName } from '../ui/icons';
import { Scores } from '../ui/scores';
import { Appearance } from './appearance';
import { MapApp } from '../geo/map-app';
type PhoneApp = 'home-screen' | 'map' | 'scores' | 'home' | 'inventory' | 'friends' | 'shop' | 'settings';
const apps: { id: Exclude<PhoneApp, 'home-screen'>; label: string; icon: IconName; color: string }[] = [
  { id: 'map', label: 'Map', icon: 'map', color: '#568777' }, { id: 'scores', label: 'Scores', icon: 'scores', color: '#d39f53' },
  { id: 'home', label: 'Home', icon: 'home', color: '#bd846c' }, { id: 'inventory', label: 'Inventory', icon: 'inventory', color: '#738b9d' },
  { id: 'friends', label: 'Friends', icon: 'friends', color: '#989079' }, { id: 'shop', label: 'Shop', icon: 'shop', color: '#759564' },
  { id: 'settings', label: 'Settings', icon: 'settings', color: '#697777' },
];
function Settings(): ReactNode {
  const profile = useGame((state) => state.profile);
  const [name, setName] = useState(profile.name);
  const [saved, setSaved] = useState(false);
  return <form className="settings" onSubmit={(event) => { event.preventDefault(); useGame.getState().setProfile({ ...profile, name: name.trim() || 'Guest golfer' }); setSaved(true); }}>
    <label>Display name<input maxLength={24} value={name} onChange={(event) => { setName(event.target.value); setSaved(false); }} /></label>
    <label className="toggle-row">Invert look Y<input type="checkbox" checked={profile.invertY} onChange={(event) => useGame.getState().setProfile({ ...profile, invertY: event.target.checked })} /></label>
    <p className="muted">Drag the world to look around. Invert Y changes the vertical camera direction.</p>
    <button className="primary" type="submit">Save name</button>{saved && <p role="status" className="saved-message">Name saved.</p>}
  </form>;
}
export function Phone(): ReactNode {
  const [current, setCurrent] = useState<PhoneApp>(() => useGame.getState().phonePage);
  const profile = useGame((state) => state.profile);
  const panel = useRef<HTMLDivElement>(null);
  const swipeStart = useRef(0);
  const close = (): void => useGame.getState().togglePhone(false);
  useEffect(() => { panel.current?.focus(); }, []);
  const app = apps.find((entry) => entry.id === current);
  return <div className="phone-backdrop"><div className="phone" ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label="In-world phone" onKeyDown={(event) => {
    if (event.key !== 'Tab') return;
    const focusable = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]');
    if (!focusable?.length) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }}>
    <div className="phone-top" onTouchStart={(event) => { swipeStart.current = event.touches[0].clientY; }} onTouchEnd={(event) => { if (event.changedTouches[0].clientY - swipeStart.current > 70) close(); }}><span>Meadow</span><span className="phone-island" /><span>● ▰</span></div>
    <div className="phone-toolbar">{current !== 'home-screen' ? <button aria-label="Phone home" onClick={() => setCurrent('home-screen')}>‹ Apps</button> : <span className="eyebrow">YOUR WORLD, IN YOUR POCKET</span>}<button className="icon-button" aria-label="Close phone" onClick={close}><Icon name="close" /></button></div>
    <div className="phone-content">
      {current === 'home-screen' ? <><h1>Hello,<br />{profile.name}.</h1><p className="muted">A good day to get outside.</p><div className="phone-widget"><Icon name="flag" size={28} /><div><small>YOUR NEXT ROUND</small><strong>Meadow Run</strong><span>Par 4 · 380 yards</span></div></div><div className="app-grid">{apps.map((entry) => <button key={entry.id} onClick={() => setCurrent(entry.id)}><span className="app-icon" style={{ background: entry.color }}><Icon name={entry.icon} size={28} /></span><span>{entry.label}</span></button>)}</div><p className="phone-footer">Local guest session · swipe down from the top to close</p></> : <><h1>{app?.label}</h1>
        {current === 'map' && <MapApp />}{current === 'scores' && <Scores />}{current === 'settings' && <><Settings /><Appearance /></>}
        {current === 'home' && <div className="empty-state"><Icon name="home" size={36} /><h3>A place of your own.</h3><p>Your lot comes with three furniture pieces to arrange.</p><button className="primary" onClick={() => useGame.getState().setMode('home')}>Arrange your home</button></div>}
        {(current === 'inventory' || current === 'shop') && <><p className="muted">{current === 'shop' ? 'Catalog preview. All starter items are included; checkout is disabled.' : 'Your starter kit. Included with every guest session.'}</p><ul className="catalog-list">{catalog.map((item) => <li key={item.sku}><Icon name={item.slot === 'club' ? 'flag' : item.slot === 'phone_skin' ? 'phone' : 'home'} /><div><strong>{item.name}</strong><small>{item.slot.replace('_', ' ')}</small></div><span>Included</span></li>)}</ul></>}
        {current === 'friends' && <div className="empty-state"><Icon name="friends" size={36} /><h3>Company is coming.</h3><p>Friends and shared rounds arrive with multiplayer. Enjoy a local practice round today.</p></div>}
      </>}
    </div><button className="phone-home-indicator" aria-label="Return to phone apps" onClick={() => setCurrent('home-screen')}><span /></button>
  </div></div>;
}
