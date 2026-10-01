import type { ReactNode } from 'react';
import { CLUBS, scoreLabel } from '@golfworld/shared';
import { useGame } from '../app/store';
import { Scorecard } from '../golf/scorecard';
export function Scores(): ReactNode {
  const scores = useGame((state) => state.scores);
  const strokes = useGame((state) => state.strokes);
  return <>
    <p className="muted">Meadow Run · par 4 · scores saved on this browser</p>
    {strokes > 0 && <Scorecard expanded />}
    {scores.length === 0 ? <div className="empty-state"><h3>Your first round awaits.</h3><p>Hole out on Meadow Run to write your name here.</p><button className="primary" onClick={() => useGame.getState().setMode('golf')}>Go to the tee</button></div> : <ol className="score-list">{[...scores].sort((left, right) => left.strokes - right.strokes).map((score, index) => <li key={score.id}>
      <span className="rank">{String(index + 1).padStart(2, '0')}</span><div><strong>{score.name}</strong><small>{scoreLabel(score.strokes)} · {CLUBS[score.lastClub].label}</small><time dateTime={score.timestamp}>{new Date(score.timestamp).toLocaleString()}</time></div><b>{score.strokes}</b>
    </li>)}</ol>}
  </>;
}
