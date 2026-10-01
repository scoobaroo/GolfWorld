import { beforeAll, describe, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { CharacterMotor, type MotorInput } from './character-motor';
import { controls, movementInput, resetControls } from './input';

beforeAll(async () => { await RAPIER.init(); });
const idle: MotorInput = { forward: 0, side: 0, jump: false, punch: false, crouch: false };
const bounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
function simulation(): { world: RAPIER.World; body: RAPIER.RigidBody; motor: CharacterMotor; tick: (input?: Partial<MotorInput>, count?: number) => void; free: () => void } {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }); world.timestep = 1 / 60;
  world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.02, 0));
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.6, 0.3).setTranslation(0, 0.9, 0), body);
  const motor = new CharacterMotor(world, body, collider);
  const tick = (input: Partial<MotorInput> = {}, count = 1): void => {
    for (let i = 0; i < count; i++) { motor.step({ ...idle, ...input }, 0, true, bounds); world.step(); }
  };
  world.step(); tick({}, 10);
  return { world, body, motor, tick, free: () => { motor.dispose(); world.free(); } };
}
describe('avatar movement using actual Rapier collisions', () => {
  it('jumps with gravity, cannot jump again in midair, and lands at ground level', () => {
    const sim = simulation();
    try {
      expect(sim.motor.snapshot().grounded).toBe(true);
      sim.tick({ jump: true });
      let peak = 0;
      for (let i = 0; i < 75; i++) {
        sim.tick({ jump: i === 15 }); peak = Math.max(peak, sim.body.translation().y);
      }
      expect(peak).toBeGreaterThan(1); expect(peak).toBeLessThan(1.3);
      expect(sim.body.translation().y).toBeCloseTo(0.015, 2);
      expect(sim.motor.snapshot().grounded).toBe(true);
      expect(sim.motor.motion.effect.kind).toBe('land');
    } finally { sim.free(); }
  });
  it('stops at walls and crouches under a low ceiling without standing into it', () => {
    const sim = simulation();
    try {
      sim.world.createCollider(RAPIER.ColliderDesc.cuboid(0.1, 2, 5).setTranslation(1.2, 2, 0));
      sim.world.step(); sim.tick({ side: 1 }, 90);
      expect(sim.body.translation().x).toBeLessThan(0.81);
      sim.motor.teleport([0, 0.02, 0]); sim.tick({ crouch: true }, 10);
      sim.world.createCollider(RAPIER.ColliderDesc.cuboid(0.6, 0.1, 0.6).setTranslation(0, 1.5, 0)); sim.world.step();
      sim.tick({}, 20); expect(sim.motor.snapshot().crouched).toBe(true);
      sim.tick({ forward: 1 }, 90); sim.tick({}, 20);
      expect(sim.body.translation().z).toBeLessThan(-1.2);
      expect(sim.motor.snapshot().crouched).toBe(false);
    } finally { sim.free(); }
  });
  it('punches only the first solid obstacle and never impulses the scoring ball', () => {
    const sim = simulation();
    try {
      const prop = sim.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.7, -1.1));
      sim.world.createCollider(RAPIER.ColliderDesc.cuboid(0.35, 0.7, 0.35).setMass(12), prop);
      const ball = sim.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 1.25, -0.6)); ball.userData = { kind: 'golf-ball' };
      sim.world.createCollider(RAPIER.ColliderDesc.ball(0.04).setMass(0.0459), ball);
      sim.world.step(); sim.tick({ punch: true }); sim.tick({}, 14);
      expect(prop.linvel().z).toBeLessThan(-0.5); expect(Math.abs(ball.linvel().z)).toBeLessThan(0.05);
      expect(sim.motor.motion.effect.kind).toBe('impact');
      sim.tick({}, 30);
      prop.setTranslation({ x: 0, y: 0.7, z: -1.1 }, true); prop.setLinvel({ x: 0, y: 0, z: 0 }, true);
      prop.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true); prop.setAngvel({ x: 0, y: 0, z: 0 }, true);
      sim.world.createCollider(RAPIER.ColliderDesc.cuboid(2, 2, 0.05).setTranslation(0, 2, -0.6)); sim.world.step();
      sim.tick({ punch: true }); sim.tick({}, 14);
      expect(Math.abs(prop.linvel().z)).toBeLessThan(0.05);
    } finally { sim.free(); }
  });
  it('normalizes diagonals and clears queued actions when controls are reset', () => {
    resetControls(); controls.keys.add('KeyW'); controls.keys.add('KeyD'); controls.jump = true; controls.punch = true; controls.crouch = true;
    const input = movementInput(); expect(Math.hypot(input.forward, input.side)).toBeCloseTo(1);
    expect(input.jump).toBe(true); expect(movementInput().jump).toBe(false);
    resetControls(); expect(movementInput()).toEqual(idle);
  });
});
