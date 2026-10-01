import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { COURSE, type ShotIntent } from '@golfworld/shared';
import { GolfCameraRig } from './golf-camera';

const shot: ShotIntent = { club: 'driver', power: 1, heading: 0, face: 0 };

describe('golf camera continuity', () => {
  it('keeps following the launch direction as the ball crosses the cup', () => {
    const camera = new PerspectiveCamera();
    camera.position.set(90, 7, COURSE.cup[2] + 20);
    camera.lookAt(90, 0, COURSE.cup[2]);
    const rig = new GolfCameraRig();
    const ball = new Vector3(90, 0.04, COURSE.cup[2] + 7);
    for (let frame = 0; frame < 120; frame++) {
      ball.z -= 0.1;
      rig.update(camera, ball, shot, false, 0, 1 / 60);
      // Passing the flag must not swing the camera around to face the tee.
      expect(camera.position.z).toBeGreaterThan(ball.z + 12);
    }
  });
  it('uses frame-time damping and eases into the next shot view', () => {
    const makeView = (fps: number): PerspectiveCamera => {
      const camera = new PerspectiveCamera();
      camera.position.set(90, 7, 0); camera.lookAt(90, 0, -10);
      const rig = new GolfCameraRig();
      const ball = new Vector3(90, 0.04, -100);
      for (let frame = 0; frame < fps; frame++) rig.update(camera, ball, shot, false, 0, 1 / fps);
      return camera;
    };
    const slow = makeView(24); const fast = makeView(120);
    expect(slow.position.distanceTo(fast.position)).toBeLessThan(0.000001);
    expect(slow.quaternion.angleTo(fast.quaternion)).toBeLessThan(0.000001);
    const rig = new GolfCameraRig();
    const ball = new Vector3(90, 0.04, COURSE.cup[2] - 3);
    const before = fast.position.clone(); const rotation = fast.quaternion.clone();
    rig.update(fast, ball, shot, true, 0, 1 / 60);
    expect(fast.position.distanceTo(before)).toBeLessThan(40);
    expect(fast.quaternion.angleTo(rotation)).toBeLessThan(0.3);
  });
});
