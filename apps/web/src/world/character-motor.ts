import { Ball, Capsule, QueryFilterFlags, type World, type RigidBody, type Collider, type KinematicCharacterController } from '@dimforge/rapier3d-compat';
import { GRAVITY, clamp, type Vec3 } from '@golfworld/shared';

export interface AvatarStatus { position: Vec3; grounded: boolean; crouched: boolean; punching: boolean; }
export interface AvatarMotion {
  speed: number; grounded: boolean; crouch: number; verticalSpeed: number; punch: number; landing: number;
  effect: { serial: number; kind: 'step' | 'land' | 'impact'; position: Vec3 };
}
export interface MovementBounds { minX: number; maxX: number; minZ: number; maxZ: number; }
export interface MotorInput { forward: number; side: number; jump: boolean; punch: boolean; crouch: boolean; }
export const STANDING_HEIGHT = 1.8;
export const CROUCH_HEIGHT = 1.2;
export const CHARACTER_RADIUS = 0.3;
export const idleMotion = (): AvatarMotion => ({ speed: 0, grounded: false, crouch: 0, verticalSpeed: 0, punch: 0, landing: 0, effect: { serial: 0, kind: 'step', position: [0, 0, 0] } });
const rotation = { x: 0, y: 0, z: 0, w: 1 };

/** One fixed-step Rapier motor for the hub, course, and mapped neighborhoods. */
export class CharacterMotor {
  readonly motion = idleMotion();
  heading = Math.PI;
  private readonly controller: KinematicCharacterController;
  private readonly standing = new Capsule(STANDING_HEIGHT / 2 - CHARACTER_RADIUS, CHARACTER_RADIUS);
  private readonly crouching = new Capsule(CROUCH_HEIGHT / 2 - CHARACTER_RADIUS, CHARACTER_RADIUS);
  private vx = 0; private vz = 0; private vy = 0;
  private grounded = false; private crouched = false;
  private jumpBuffer = 0; private groundGrace = 0; private punchTime = 0; private stride = 0;
  private position: Vec3;
  private readonly excluded = new Set<number>();

  constructor(private readonly world: World, private readonly body: RigidBody, private readonly collider: Collider) {
    const p = body.translation(); this.position = [p.x, p.y, p.z];
    this.controller = world.createCharacterController(0.015);
    this.controller.setSlideEnabled(true);
    this.controller.enableAutostep(0.25, 0.3, false);
    this.controller.enableSnapToGround(0.15);
    this.controller.setMaxSlopeClimbAngle(Math.PI / 4);
    this.controller.setMinSlopeSlideAngle(Math.PI / 3);
    this.controller.setApplyImpulsesToDynamicBodies(true);
    this.controller.setCharacterMass(75);
  }
  dispose(): void { this.world.removeCharacterController(this.controller); }
  snapshot(): AvatarStatus { return { position: [...this.position], grounded: this.grounded, crouched: this.crouched, punching: this.punchTime > 0 }; }
  teleport(position: Vec3, heading = this.heading): void {
    this.position = [...position]; this.heading = heading;
    this.body.setTranslation({ x: position[0], y: position[1], z: position[2] }, true);
    this.body.setNextKinematicTranslation({ x: position[0], y: position[1], z: position[2] });
    this.vx = 0; this.vz = 0; this.vy = 0; this.grounded = false;
    this.jumpBuffer = 0; this.groundGrace = 0; this.punchTime = 0; this.stride = 0;
    this.resize(false); Object.assign(this.motion, idleMotion());
  }
  // Query predicates run while Rapier borrows its sets. Read metadata beforehand;
  // calling collider.parent()/isSensor() from inside them can reborrow WASM state.
  private refreshFilter(): void {
    this.excluded.clear();
    this.world.forEachRigidBody((body) => {
      if (body.handle === this.body.handle || (body.userData as { kind?: string } | undefined)?.kind === 'golf-ball') {
        for (let i = 0; i < body.numColliders(); i++) this.excluded.add(body.collider(i).handle);
      }
    });
  }
  private accepts = (collider: Collider): boolean => !this.excluded.has(collider.handle);
  private resize(crouch: boolean): void {
    this.crouched = crouch;
    this.collider.setShape(crouch ? this.crouching : this.standing);
    this.collider.setTranslationWrtParent({ x: 0, y: (crouch ? CROUCH_HEIGHT : STANDING_HEIGHT) / 2, z: 0 });
  }
  private canStand(): boolean {
    const p = this.body.translation(); let blocked = false;
    this.world.intersectionsWithShape({ x: p.x, y: p.y + STANDING_HEIGHT / 2, z: p.z }, rotation, this.standing,
      () => { blocked = true; return false; }, QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.collider, this.body, this.accepts);
    return !blocked;
  }
  private effect(kind: AvatarMotion['effect']['kind'], position: Vec3): void {
    this.motion.effect = { serial: this.motion.effect.serial + 1, kind, position };
  }
  private strike(): void {
    const p = this.body.translation(); const dx = Math.sin(this.heading); const dz = Math.cos(this.heading);
    const origin = { x: p.x + dx * 0.35, y: p.y + (this.crouched ? 0.8 : 1.25), z: p.z + dz * 0.35 };
    // First solid hit only: a wall shields props behind it. The scoring ball is excluded.
    const hit = this.world.castShape(origin, rotation, { x: dx * 0.9, y: 0, z: dz * 0.9 }, new Ball(0.2), 0, 1, true,
      QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.collider, this.body, this.accepts);
    if (!hit) return;
    const target = hit.collider.parent();
    const point = { x: origin.x + dx * 0.9 * hit.time_of_impact, y: origin.y, z: origin.z + dz * 0.9 * hit.time_of_impact };
    if (target?.isDynamic()) target.applyImpulseAtPoint({ x: dx * 12, y: 1.5, z: dz * 12 }, point, true);
    this.effect('impact', [point.x, point.y, point.z]);
  }
  step(input: MotorInput, yaw: number, enabled: boolean, bounds: MovementBounds, walkable?: (x: number, z: number) => boolean): void {
    const dt = this.world.timestep;
    this.refreshFilter();
    const p = this.body.translation(); this.position = [p.x, p.y, p.z];
    if (!enabled) { this.vx = 0; this.vz = 0; this.jumpBuffer = 0; this.punchTime = 0; }
    const wantsCrouch = enabled && input.crouch;
    if (wantsCrouch !== this.crouched && (wantsCrouch || this.canStand())) this.resize(wantsCrouch);
    this.motion.crouch += (Number(this.crouched) - this.motion.crouch) * (1 - Math.exp(-dt * 16));
    this.motion.landing *= Math.exp(-dt * 12);
    this.jumpBuffer = enabled && input.jump ? 0.12 : Math.max(0, this.jumpBuffer - dt);
    this.groundGrace = this.grounded ? 0.1 : Math.max(0, this.groundGrace - dt);
    if (this.jumpBuffer > 0 && this.groundGrace > 0 && !this.crouched && this.punchTime === 0) {
      this.vy = 4.8; this.grounded = false; this.groundGrace = 0; this.jumpBuffer = 0;
    } else this.vy = this.grounded && this.vy <= 0 ? -0.5 : Math.max(-30, this.vy - GRAVITY * dt);
    if (enabled && input.punch && this.grounded && this.punchTime === 0) this.punchTime = 0.001;
    if (this.punchTime > 0) {
      const previous = this.punchTime; this.punchTime += dt;
      if (previous < 0.22 && this.punchTime >= 0.22) this.strike();
      if (this.punchTime >= 0.55) this.punchTime = 0;
    }
    this.motion.punch = this.punchTime / 0.55;
    const speed = this.crouched ? 1.15 : 2.6;
    const forward = enabled ? input.forward : 0; const side = enabled ? input.side : 0;
    const acceleration = this.grounded ? 18 : 5;
    const blend = 1 - Math.exp(-acceleration * dt);
    this.vx += ((side * Math.cos(yaw) - forward * Math.sin(yaw)) * speed - this.vx) * blend;
    this.vz += ((-forward * Math.cos(yaw) - side * Math.sin(yaw)) * speed - this.vz) * blend;
    let dx = clamp(p.x + this.vx * dt, bounds.minX, bounds.maxX) - p.x;
    let dz = clamp(p.z + this.vz * dt, bounds.minZ, bounds.maxZ) - p.z;
    const safe = (x: number, z: number): boolean => !walkable || [walkable(x, z), walkable(x + 0.3, z), walkable(x - 0.3, z), walkable(x, z + 0.3), walkable(x, z - 0.3)].every(Boolean);
    if (!safe(p.x + dx, p.z)) dx = 0;
    if (!safe(p.x + dx, p.z + dz)) dz = 0;
    const falling = this.vy;
    this.controller.computeColliderMovement(this.collider, { x: dx, y: this.vy * dt, z: dz }, QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.accepts);
    const moved = this.controller.computedMovement();
    const grounded = this.controller.computedGrounded() && this.vy <= 0;
    if (grounded && !this.grounded && falling < -1.5) {
      this.motion.landing = Math.min(0.14, -falling * 0.015);
      this.effect('land', [p.x + moved.x, p.y + moved.y + 0.02, p.z + moved.z]);
    }
    if (grounded || (this.vy > 0 && moved.y < this.vy * dt * 0.5)) this.vy = 0;
    this.grounded = grounded; this.motion.grounded = grounded; this.motion.verticalSpeed = this.vy;
    this.motion.speed = Math.hypot(moved.x, moved.z) / dt;
    if (this.motion.speed > 0.15 && this.punchTime === 0) this.heading = Math.atan2(this.vx, this.vz);
    this.stride += grounded ? Math.hypot(moved.x, moved.z) : 0;
    if (this.stride > (this.crouched ? 0.65 : 0.85)) { this.stride = 0; this.effect('step', [p.x, p.y + 0.02, p.z]); }
    this.position = [p.x + moved.x, p.y + moved.y, p.z + moved.z];
    this.body.setNextKinematicTranslation({ x: this.position[0], y: this.position[1], z: this.position[2] });
  }
}
