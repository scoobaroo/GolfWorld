import { Suspense, lazy, useEffect, useRef, Component, type ReactNode, type ErrorInfo } from 'react';
import { clamp } from '@golfworld/shared';
import { Hud } from '../ui/hud';
import { Phone } from '../phone/phone';
import { useGame } from './store';
import { controls, resetControls } from '../world/input';
const WorldScene = lazy(() => import('../world/world-scene'));

class WorldBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error): { error: Error } { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo): void { console.error(error, info); }
  render(): ReactNode {
    if (this.state.error) return <div className="loading"><h2>The world couldn’t load</h2><p>World assets or graphics could not start. Reload to try again.</p><details><summary>Error details</summary><p>{this.state.error.message}</p></details><button onClick={() => location.reload()}>Reload world</button></div>;
    return this.props.children;
  }
}
export function App(): ReactNode {
  const phoneOpen = useGame((state) => state.phoneOpen);
  const mode = useGame((state) => state.mode);
  const worldReady = useGame((state) => state.worldReady);
  const drag = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const keyDown = (event: KeyboardEvent): void => {
      if (event.code === 'Escape') useGame.getState().togglePhone(false);
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.code === 'KeyP' && !event.repeat) useGame.getState().togglePhone();
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
      controls.keys.add(event.code);
    };
    const keyUp = (event: KeyboardEvent): void => { controls.keys.delete(event.code); };
    window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp); window.addEventListener('blur', resetControls);
    return () => { window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); window.removeEventListener('blur', resetControls); };
  }, []);
  useEffect(resetControls, [phoneOpen, mode]);
  return <main className="relative h-dvh w-screen overflow-hidden bg-emerald-950" data-world-ready={worldReady}>
    <div className="world-canvas" onPointerDown={(event) => {
      if (mode === 'home' || phoneOpen || event.button !== 0) return;
      drag.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId);
    }} onPointerMove={(event) => {
      const last = drag.current; if (!last) return;
      controls.yaw -= (event.clientX - last.x) * 0.006;
      controls.pitch = clamp(controls.pitch + (event.clientY - last.y) * 0.003 * (useGame.getState().profile.invertY ? -1 : 1), -0.1, 0.9);
      drag.current = { x: event.clientX, y: event.clientY };
    }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <WorldBoundary><Suspense fallback={<div className="loading">Opening Meadow Club…</div>}>
        <WorldScene />
      </Suspense></WorldBoundary>
    </div>
    <Hud />{phoneOpen && <Phone />}
  </main>;
}
