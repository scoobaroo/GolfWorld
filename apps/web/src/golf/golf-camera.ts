import { Vector3, type Camera } from 'three';
import { COURSE, clamp, type ShotIntent } from '@golfworld/shared';

/** Follow the rendered ball, keeping the launch direction throughout a shot. */
export class GolfCameraRig {
  private readonly position = new Vector3();
  private readonly focus = new Vector3();
  private readonly target = new Vector3();
  private initialized = false;

  reset(): void { this.initialized = false; }

  update(camera: Camera, ball: Vector3, shot: ShotIntent | null, atRest: boolean, aim: number, delta: number): void {
    const heading = !atRest && shot
      ? shot.heading + clamp(shot.face, -1, 1) * 0.13
      : Math.atan2(COURSE.cup[0] - ball.x, ball.z - COURSE.cup[2]) + aim;
    this.position.set(ball.x - Math.sin(heading) * 13, Math.max(7, ball.y + 6), ball.z + Math.cos(heading) * 13);
    this.target.set(ball.x + Math.sin(heading) * 2, ball.y + 0.3, ball.z - Math.cos(heading) * 2);
    if (!this.initialized) {
      camera.getWorldDirection(this.focus).multiplyScalar(13).add(camera.position);
      this.initialized = true;
    }
    const blend = 1 - Math.exp(-Math.min(delta, 0.1) * 8);
    camera.position.lerp(this.position, blend);
    this.focus.lerp(this.target, blend);
    camera.lookAt(this.focus);
  }
}
