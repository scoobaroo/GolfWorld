import { useEffect, useRef, type ReactNode, type PointerEvent } from 'react';
import { COURSE, scoreLabel } from '@golfworld/shared';
import { useGame } from '../app/store';
import { controls } from '../world/input';
import { HomeEditor } from '../home/home-editor';
import { Swing } from '../golf/swing';
import { Scorecard } from '../golf/scorecard';
import { Icon } from './icons';
import { useGeo } from '../geo/store';
import { geoToLocal } from '@golfworld/shared';
import { buildingUse } from '../geo/geometry';
import { useCaptures } from '../capture/store';

function Joystick(): ReactNode {
  const thumb = useRef<HTMLSpanElement>(null);
  const active = useRef<number | null>(null);
  const stop = (event?: PointerEvent<HTMLDivElement>): void => {
    if (event && event.pointerId !== active.current) return;
    active.current = null; controls.x = 0; controls.z = 0; if (thumb.current) thumb.current.style.transform = 'translate(0,0)';
  };
  useEffect(() => stop, []);
  const move = (event: PointerEvent<HTMLDivElement>): void => {
    if (active.current !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const horizontal = (event.clientX - rect.left - rect.width / 2) / 32;
    const vertical = (event.clientY - rect.top - rect.height / 2) / 32;
    const length = Math.max(1, Math.hypot(horizontal, vertical));
    controls.x = horizontal / length; controls.z = -vertical / length;
    if (thumb.current) thumb.current.style.transform = `translate(${controls.x * 30}px,${-controls.z * 30}px)`;
  };
  return <div className="joystick-wrap"><div role="group" aria-label="Touch movement joystick" className="joystick" onPointerDown={(event) => {
    if (active.current !== null) return;
    active.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); move(event);
  }} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}><span ref={thumb} /></div><small>MOVE</small></div>;
}
function AvatarActions(): ReactNode {
  const avatar = useGame((state) => state.avatar); const swinging = useGame((state) => state.swingActive);
  const disabled = !avatar || swinging;
  return <div className="avatar-actions" role="group" aria-label="Avatar actions">
    <button disabled={disabled || !avatar?.grounded || avatar?.crouched} onPointerDown={(event) => { event.preventDefault(); controls.jump = true; }} onClick={(event) => { if (event.detail === 0) controls.jump = true; }}><Icon name="jump" size={19} /><span>Jump</span><kbd>Space</kbd></button>
    <button disabled={disabled} aria-pressed={avatar?.crouched ?? false} onPointerDown={(event) => { event.preventDefault(); controls.crouch = !avatar?.crouched; }} onClick={(event) => { if (event.detail === 0) controls.crouch = !avatar?.crouched; }}><Icon name="crouch" size={19} /><span>Crouch</span><kbd>C</kbd></button>
    <button disabled={disabled || !avatar?.grounded || avatar?.punching} onPointerDown={(event) => { event.preventDefault(); controls.punch = true; }} onClick={(event) => { if (event.detail === 0) controls.punch = true; }}><Icon name="punch" size={19} /><span>Punch</span><kbd>F</kbd></button>
    <small className="avatar-action-status" role="status">{avatar?.punching ? 'Punching' : !avatar?.grounded ? 'In the air' : avatar?.crouched ? 'Crouching' : 'Ready to move'}</small>
  </div>;
}
export function Hud(): ReactNode {
  const mode = useGame((state) => state.mode);
  const phoneOpen = useGame((state) => state.phoneOpen);
  const strokes = useGame((state) => state.strokes);
  const complete = useGame((state) => state.complete);
  const notice = useGame((state) => state.notice);
  const storageError = useGame((state) => state.storageError);
  const destination = useGeo((state) => state.destination); const scene = useGeo((state) => state.scene);
  const geoPosition = useGeo((state) => state.position); const geoLoading = useGeo((state) => state.loading); const geoError = useGeo((state) => state.error);
  const building = useGeo((state) => state.selectedFeature);
  const offset = scene && geoPosition ? geoToLocal(geoPosition, scene.origin) : [0, 0, 0];
  return <div className="hud" data-mode={mode}>
    <header className="hud-header"><div className="brand"><span className="brand-mark"><Icon name="flag" /></span><div><strong>GolfWorld</strong><small>{mode === 'explore' ? 'GLOBAL EXPLORER' : 'MEADOW CLUB'}</small></div></div><span className="session-badge"><i /> LOCAL GUEST</span></header>
    {!phoneOpen && <>
      <div className="location-pill"><span className="location-dot" />{mode === 'explore' ? destination?.name : mode === 'golf' ? 'Meadow Run / Hole 01' : mode === 'home' ? 'The neighborhood / Your lot' : 'The neighborhood / Clubhouse'}</div>
      {mode === 'explore' && <section className="geo-info panel"><span className="eyebrow">REAL-WORLD EXPLORER</span><h2>{destination?.name}</h2><p>{destination?.address}</p><small>{geoPosition?.lat.toFixed(5)}, {geoPosition?.lon.toFixed(5)} · 1 unit = 1 meter</small><p>{scene?.features.filter((f) => f.kind === 'building').length ?? 0} mapped buildings · {scene?.features.filter((f) => f.kind === 'building' && f.estimatedHeight).length ?? 0} estimated heights. Terrain is currently flat.{scene?.truncated ? ' Dense area: some features exceed the current mobile budget.' : ''}</p><button className="primary" onClick={() => useGame.getState().openMap()}>Search locations & map</button>{Math.max(Math.abs(offset[0]), Math.abs(offset[2])) > 180 && <button disabled={geoLoading} onClick={() => void useGeo.getState().loadNearby()}>{geoLoading ? 'Loading…' : 'Load next neighborhood'}</button>}{geoError && <p role="alert">{geoError}</p>}</section>}
      {mode === 'hub' && <section className="welcome panel"><span className="eyebrow">A LITTLE PLACE TO PLAY</span><h1>Good days<br />start on the green.</h1><p>Take a walk. Make yourself at home.<br />There’s a round waiting just over there.</p><button className="primary" onClick={() => useGame.getState().setMode('golf')}>Play Meadow Run <Icon name="arrow" size={18} /></button><div className="welcome-meta"><span>01 HOLE</span><span>PAR 4</span><span>380 YD</span></div></section>}
      {mode === 'home' && <HomeEditor />}
      {mode === 'explore' && building && <section className="geo-building panel" aria-label="Building details"><div className="row-between"><span className="eyebrow">MAPPED BUILDING</span><button aria-label="Close building details" onClick={() => useGeo.setState({ selectedFeature: null })}>×</button></div><h2>{building.tags.name?.split(';')[0] || buildingUse(building.tags)}</h2><p>{[building.tags['addr:housenumber'], building.tags['addr:street']].filter(Boolean).join(' ')}</p><p>Type: {buildingUse(building.tags)} · {building.height.toFixed(1)} m {building.estimatedHeight ? '(estimated)' : '(mapped height)'}</p><small>OpenStreetMap · {building.id}</small><button className="capture-building-button" onClick={() => { useCaptures.setState({ selectedId: null }); useGame.getState().openCapture(); }}><Icon name="camera" size={18} />Capture details</button></section>}
      {mode === 'golf' && !complete && <>
        <section className="hole-card panel"><div className="row-between"><div><span className="eyebrow">HOLE 01 · PAR {COURSE.par}</span><h2>Meadow Run</h2><small>380 yards · local practice</small></div><div className="stroke-count"><b>{strokes}</b><span>STROKES</span></div></div><Scorecard /></section>
        <Swing />
      </>}
      {(notice || storageError) && <div className="notice" role="status">{storageError ? 'Browser storage is unavailable. This session will not survive a reload.' : notice}</div>}
      {mode !== 'home' && !(mode === 'golf' && complete) && <><Joystick /><AvatarActions /><div className="desktop-controls"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>or arrows · move · drag to look</span></div></>}
      <nav className="world-nav" aria-label="World destinations"><button className={mode === 'hub' ? 'active' : ''} onClick={() => useGame.getState().setMode('hub')}><Icon name="map" />Hub</button><button className={mode === 'home' ? 'active' : ''} onClick={() => useGame.getState().setMode('home')}><Icon name="home" />Home</button><button className={mode === 'golf' ? 'active' : ''} onClick={() => useGame.getState().setMode('golf')}><Icon name="flag" />Golf</button><button onClick={() => useGame.getState().togglePhone(true)}><Icon name="phone" />Phone <kbd>P</kbd></button></nav>
      {complete && mode === 'golf' && <div className="modal-backdrop"><section className="round-complete panel" role="dialog" aria-modal="true" aria-labelledby="round-title"><span className="completion-icon"><Icon name="flag" size={34} /></span><span className="eyebrow">MEADOW RUN · HOLE COMPLETE</span><h1 id="round-title">{scoreLabel(complete.strokes)}.</h1><p>{complete.name}, you’re on the board.</p><div className="round-number">{complete.strokes}<small>strokes / par 4</small></div><Scorecard /><button className="primary" autoFocus onClick={() => useGame.getState().resetRound()}>Play another round</button><button onClick={() => useGame.getState().togglePhone(true)}>Open phone & scores</button></section></div>}
      <button className="global-map-shortcut" onClick={() => useGame.getState().openMap()}><Icon name="map" />Global map</button>
      {mode === 'explore' && <div className="world-map-attribution">{destination?.provider === 'google' && <span className="google-coordinate-attribution">Location lookup: <span translate="no">Google Maps</span> · </span>}<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">World data © OpenStreetMap contributors</a></div>}
    </>}
  </div>;
}
