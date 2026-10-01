import { describe, it, expect } from 'vitest';
import { shotVelocity, isHoled, surfaceAt, COURSE, scoreLabel, shotIntentSchema } from './index';
describe('shared golf rules', () => {
  it('caps power and face angle and scales each club', () => {
    expect(shotVelocity('driver', 2, 0, 4)).toEqual(shotVelocity('driver', 1, 0, 1));
    expect(shotVelocity('putter', 1, 0, 0)).toEqual([0, 0, -18.5]);
    expect(shotVelocity('iron', 0.5, 0, 0)[1]).toBeGreaterThan(0);
  });
  it('requires a slow, grounded ball inside the cup', () => {
    expect(isHoled([90, 0.03, COURSE.cup[2]], 1)).toBe(true);
    expect(isHoled([90, 2, COURSE.cup[2]], 0)).toBe(false);
    expect(isHoled([90, 0.03, COURSE.cup[2]], 2)).toBe(false);
    expect(isHoled([90.3, 0.03, COURSE.cup[2]], 0)).toBe(false);
  });
  it('classifies hazards and the green from the same course data', () => {
    expect(surfaceAt(COURSE.tee)).toBe('fairway');
    expect(surfaceAt(COURSE.cup)).toBe('green');
    expect(surfaceAt([120, 0, -190])).toBe('water');
    expect(surfaceAt([160, 0, -190])).toBe('oob');
    expect(surfaceAt([65, 0, -80])).toBe('rough');
  });
  it('rejects invalid shot intents at the authority boundary', () => {
    expect(shotIntentSchema.safeParse({ club: 'driver', power: 99, face: 0, heading: 0 }).success).toBe(false);
    expect(shotIntentSchema.safeParse({ club: 'driver', power: 0.5, face: 0, heading: NaN }).success).toBe(false);
    expect(scoreLabel(4)).toBe('Par');
    expect(scoreLabel(6)).toBe('+2 over par');
  });
});
