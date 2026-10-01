import { beforeEach, describe, it, expect } from 'vitest';
import { COURSE, defaultAppearance } from '@golfworld/shared';
import { readSavedData, defaultData, useGame } from './store';
describe('local persistence and round state', () => {
  beforeEach(() => { useGame.setState({ ...defaultData, mode: 'golf', strokes: 0, ballAtRest: true, shot: null, complete: null, ball: [...COURSE.tee], selectedFurniture: null, placing: null }); });
  it('recovers from corrupt, outdated, or unavailable storage', () => {
    expect(readSavedData({ getItem: () => '{broken' })).toEqual(defaultData);
    expect(readSavedData({ getItem: () => JSON.stringify({ profile: { name: 5 } }) })).toEqual(defaultData);
    expect(readSavedData({ getItem: () => { throw new Error('denied'); } })).toEqual(defaultData);
  });
  it('counts a stroke once, counts a drop, and records exactly one hole-out', () => {
    useGame.getState().setClub('iron'); useGame.getState().hit(1, 0); useGame.getState().hit(1, 0);
    expect(useGame.getState().strokes).toBe(1);
    useGame.getState().penalty(); useGame.getState().finish(); useGame.getState().finish();
    expect(useGame.getState().scores).toHaveLength(1);
    expect(useGame.getState().scores[0]).toMatchObject({ strokes: 2, lastClub: 'iron', name: 'Guest golfer' });
    expect(useGame.getState().scores[0].timestamp).toMatch(/^\d{4}-/);
  });
  it('keeps furniture within the lot and restores a serialized layout', () => {
    useGame.getState().setPlacing('furn.chair.midcentury'); useGame.getState().placeFurniture([-100, 0, 100]);
    expect(useGame.getState().furniture[0].pos).toEqual([-23, 0, 8]);
    useGame.getState().rotateFurniture();
    const data = { profile: useGame.getState().profile, furniture: useGame.getState().furniture, scores: [] };
    expect(readSavedData({ getItem: () => JSON.stringify(data) }).furniture[0].rot).toBe(Math.PI / 2);
  });
  it('restarts without erasing previously completed scores', () => {
    useGame.getState().hit(1, 0); useGame.getState().finish(); useGame.getState().resetRound();
    expect(useGame.getState().strokes).toBe(0); expect(useGame.getState().scores).toHaveLength(1);
    expect(useGame.getState().complete).toBeNull();
  });
  it('preserves existing saves and restores a customized appearance', () => {
    expect(readSavedData({ getItem: () => JSON.stringify({ profile: defaultData.profile, furniture: [], scores: [] }) }).appearance).toEqual(defaultAppearance);
    useGame.getState().setAppearance({ ...defaultAppearance, shirtColor: '#1267ab' });
    const data = { ...defaultData, appearance: useGame.getState().appearance };
    expect(readSavedData({ getItem: () => JSON.stringify(data) }).appearance.shirtColor).toBe('#1267ab');
    expect(readSavedData({ getItem: () => JSON.stringify({ ...data, appearance: { ...data.appearance, skinColor: 'invalid' } }) })).toEqual(defaultData);
  });
});
