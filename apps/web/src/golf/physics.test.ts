import { beforeAll, describe, it, expect } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { COURSE, GRAVITY, shotVelocity, groundVelocity, surfaceAt, surfaceMaterial, isHoled, distanceToCup, type Vec3, type ClubId } from '@golfworld/shared';
beforeAll(async () => { await RAPIER.init(); });

function simulate(club: ClubId, power: number, lie: Vec3): { position: Vec3; holed: boolean } {
  const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
  world.timestep = 1 / 60;
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(300, 0.5, 400).setTranslation(0, -0.5, -170).setFriction(0.7).setRestitution(0.1), ground);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(lie[0], lie[1], lie[2]).setLinearDamping(0.02).setCcdEnabled(true).lockRotations());
  const collider = world.createCollider(RAPIER.ColliderDesc.ball(COURSE.ballRadius).setMass(0.0459).setFriction(0.65).setRestitution(0.14), body);
  const heading = Math.atan2(COURSE.cup[0] - lie[0], lie[2] - COURSE.cup[2]);
  const launch = shotVelocity(club, power, heading, 0);
  body.setLinvel({ x: launch[0], y: launch[1], z: launch[2] }, true);
  let restTicks = 0;
  let position: Vec3 = lie;
  for (let tick = 0; tick < 1800; tick++) {
    const translation = body.translation(); const velocity = body.linvel();
    position = [translation.x, translation.y, translation.z];
    const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
    const material = surfaceMaterial[surfaceAt(position)]; collider.setFriction(material.friction); collider.setRestitution(material.restitution);
    if (isHoled(position, speed)) { world.free(); return { position, holed: true }; }
    if (position[1] < 0.1) {
      const slowed = groundVelocity([velocity.x, velocity.y, velocity.z], surfaceAt(position), 1 / 60);
      body.setLinvel({ x: slowed[0], y: slowed[1], z: slowed[2] }, true);
      restTicks = speed < 0.2 ? restTicks + 1 : 0;
    }
    if (restTicks > 25) break;
    world.step();
  }
  world.free(); return { position, holed: false };
}
describe('Rapier ball simulation', () => {
  it('lands the driver, distinguishes clubs, and comes to rest', () => {
    const driver = simulate('driver', 1, COURSE.tee);
    const iron = simulate('iron', 1, COURSE.tee);
    expect(driver.position[2]).toBeLessThan(-160);
    expect(driver.position[2]).toBeGreaterThan(-320);
    expect(iron.position[2]).toBeGreaterThan(driver.position[2]);
    expect(driver.position[1]).toBeLessThan(0.1);
  });
  it('can hole a short putt, and a fast putt crosses the cup without holing', () => {
    const lie: Vec3 = [90, 0.04, COURSE.cup[2] + 2];
    let foundHoleOut = false;
    for (let power = 0.15; power <= 0.5; power += 0.005) {
      if (simulate('putter', power, lie).holed) { foundHoleOut = true; break; }
    }
    expect(foundHoleOut).toBe(true);
    expect(simulate('putter', 1, lie).holed).toBe(false);
  });
  it('plays a complete 380-yard hole using shared rules and actual rigid bodies', () => {
    const drive = simulate('driver', 1, COURSE.tee);
    const remaining = distanceToCup(drive.position);
    let best = drive;
    for (let approach = 0; approach < 3 && distanceToCup(best.position) > 10; approach++) {
      const lie = best.position;
      let next = simulate('iron', 0.1, lie);
      for (let power = 0.1; power <= 1; power += 0.02) {
        const result = simulate('iron', power, lie);
        if (distanceToCup(result.position) < distanceToCup(next.position)) next = result;
      }
      best = next;
    }
    expect(remaining).toBeLessThan(180);
    expect(distanceToCup(best.position)).toBeLessThan(10);
    let foundHoleOut = best.holed;
    for (let power = 0.025; power <= 1 && !foundHoleOut; power += 0.005) foundHoleOut = simulate('putter', power, best.position).holed;
    expect(foundHoleOut).toBe(true);
  });
});
