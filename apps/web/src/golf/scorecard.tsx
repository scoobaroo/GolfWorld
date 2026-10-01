import type { ReactNode } from 'react';
import { CLUBS, COURSE } from '@golfworld/shared';
import { useGame } from '../app/store';

export function Scorecard({ expanded = false }: { expanded?: boolean }): ReactNode {
  const strokes = useGame((state) => state.strokes);
  const events = useGame((state) => state.roundEvents);
  const complete = useGame((state) => state.complete);
  const ballAtRest = useGame((state) => state.ballAtRest);
  const difference = strokes - COURSE.par;
  return <details className="scorecard" open={expanded || undefined}>
    <summary>Scorecard <span>{complete ? 'Hole complete' : !ballAtRest ? 'Shot in progress' : `Next: stroke ${strokes + 1}`}</span></summary>
    <table aria-label="Meadow Run scorecard">
      <thead><tr><th scope="col">Hole</th><th scope="col">Par</th><th scope="col">Strokes</th><th scope="col">To par</th></tr></thead>
      <tbody><tr><th scope="row">01</th><td>{COURSE.par}</td><td>{strokes}</td><td>{complete ? difference === 0 ? 'E' : difference > 0 ? `+${difference}` : difference : '—'}</td></tr></tbody>
    </table>
    {!complete && <p>To par is final when you hole out. Penalties count as strokes.</p>}
    {events.length > 0 ? <ol aria-label="Stroke log">{events.map((event) => <li key={event.strokeIndex}><span>{event.strokeIndex}</span>{event.penalty ? 'Penalty · +1 · drop at last lie' : `${CLUBS[event.club].label} · ${Math.round(event.power * 100)}% power`}</li>)}</ol> : <p>Your first stroke starts the card.</p>}
  </details>;
}
