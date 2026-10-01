import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CLUBS, clamp, distanceToCup, surfaceAt, type ClubId } from '@golfworld/shared';
import { useGame } from '../app/store';

export function Swing(): ReactNode {
  const club = useGame((state) => state.club);
  const ballAtRest = useGame((state) => state.ballAtRest);
  const ball = useGame((state) => state.ball);
  const aim = useGame((state) => state.aim);
  const phoneOpen = useGame((state) => state.phoneOpen);
  const [phase, setPhase] = useState<'idle' | 'power' | 'face'>('idle');
  const [meter, setMeter] = useState(0);
  const timer = useRef({ phase: 'idle', start: 0, power: 0, face: -1 });
  const begin = (): void => {
    if (!useGame.getState().ballAtRest || useGame.getState().phoneOpen) return;
    if (timer.current.phase === 'face') { fire(); return; }
    if (timer.current.phase !== 'idle') return;
    timer.current = { phase: 'power', start: performance.now(), power: 0, face: -1 }; setPhase('power');
  };
  const release = (): void => {
    if (timer.current.phase !== 'power') return;
    timer.current.power = clamp((performance.now() - timer.current.start) / 1200, 0.025, 1);
    timer.current.phase = 'face'; timer.current.start = performance.now(); setPhase('face');
  };
  const fire = (): void => {
    const { power, face } = timer.current;
    timer.current.phase = 'idle'; setPhase('idle'); setMeter(0); useGame.getState().hit(power, face);
  };
  useEffect(() => {
    let frame: number;
    const animate = (): void => {
      const current = timer.current;
      if (current.phase === 'power') setMeter(clamp((performance.now() - current.start) / 1200, 0, 1));
      if (current.phase === 'face') {
        current.face = clamp((performance.now() - current.start) / 650 - 1, -1, 1); setMeter((current.face + 1) / 2);
        if (performance.now() - current.start >= 1300) fire();
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
    // The animation reads refs and the Zustand store, so it always uses the current shot.
  }, []);
  useEffect(() => {
    if (phoneOpen) { timer.current.phase = 'idle'; setPhase('idle'); setMeter(0); }
  }, [phoneOpen]);
  useEffect(() => {
    const down = (event: KeyboardEvent): void => { if (event.code === 'Space' && !event.repeat && !(event.target instanceof HTMLInputElement)) { event.preventDefault(); begin(); } };
    const up = (event: KeyboardEvent): void => { if (event.code === 'Space') release(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  });
  return <section className="swing-panel panel" aria-label="Golf controls">
    <div className="row-between"><span className="eyebrow">{ballAtRest ? 'AT YOUR BALL · NEXT SHOT' : 'FOLLOWING YOUR SHOT'}</span><span className="lie" data-distance={distanceToCup(ball)}>{surfaceAt(ball)} · {distanceToCup(ball) < 20 ? distanceToCup(ball).toFixed(1) : Math.round(distanceToCup(ball))} m</span></div>
    <div className="club-tabs">{(Object.keys(CLUBS) as ClubId[]).map((id) => <button key={id} className={club === id ? 'active' : ''} disabled={!ballAtRest || phase !== 'idle'} onClick={() => useGame.getState().setClub(id)}>{CLUBS[id].label}</button>)}</div>
    <label className="aim-label">Aim <span>{Math.round(aim * 180 / Math.PI)}°</span><input aria-label="Aim angle" type="range" min="-90" max="90" step="1" value={Math.round(aim * 180 / Math.PI)} disabled={!ballAtRest || phase !== 'idle'} onChange={(event) => useGame.getState().setAim(Number(event.target.value) * Math.PI / 180)} /></label>
    <div className={`swing-meter ${phase === 'face' ? 'face-meter' : ''}`} aria-label="Swing meter"><div className="meter-fill" style={{ width: `${meter * 100}%` }} /><span style={{ left: `${meter * 100}%` }} /></div>
    <button className="swing-button" disabled={!ballAtRest} onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); begin(); }} onPointerUp={release} onPointerCancel={() => { timer.current.phase = 'idle'; setPhase('idle'); setMeter(0); }} onClick={(event) => { if (event.detail === 0) { if (phase === 'power') release(); else begin(); } }}>
      {!ballAtRest ? 'Ball in motion…' : phase === 'power' ? `Release · ${Math.round(meter * 100)}% power` : phase === 'face' ? 'Tap at center to strike' : 'Hold to swing'}
    </button>
    <p className="control-note">{phase === 'face' ? 'Center = square face. A miss bends the shot.' : 'Hold for power → release → tap at center. Space works too.'}</p>
  </section>;
}
