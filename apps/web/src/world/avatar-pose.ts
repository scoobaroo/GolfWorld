import { Object3D, Quaternion, Vector3 } from 'three';
import type { AvatarMotion } from './character-motor';

/** Add local action poses after the existing idle/walk mixer, restoring before its next tick. */
export class AvatarPose {
  private readonly changed = new Map<Object3D, Quaternion>();
  private readonly rootY: number;
  constructor(private readonly scene: Object3D) { this.rootY = scene.position.y; }
  restore(): void {
    for (const [bone, quaternion] of this.changed) bone.quaternion.copy(quaternion);
    this.changed.clear(); this.scene.position.y = this.rootY;
  }
  private remember(bone: Object3D): void { if (!this.changed.has(bone)) this.changed.set(bone, bone.quaternion.clone()); }
  private rotateWorld(bone: Object3D, rotation: Quaternion, weight = 1): void {
    this.remember(bone);
    const parent = bone.parent?.getWorldQuaternion(new Quaternion()) ?? new Quaternion();
    const target = parent.invert().multiply(rotation).multiply(bone.getWorldQuaternion(new Quaternion()));
    bone.quaternion.slerp(target, weight); bone.updateWorldMatrix(false, true);
  }
  private aim(bone: Object3D, child: Object3D, target: Vector3, weight: number): void {
    const origin = bone.getWorldPosition(new Vector3());
    const current = child.getWorldPosition(new Vector3()).sub(origin).normalize();
    const desired = target.clone().sub(origin).normalize();
    this.rotateWorld(bone, new Quaternion().setFromUnitVectors(current, desired), weight);
  }
  private limb(prefix: string, endName: string, target: Vector3, bend: Vector3, weight: number): void {
    const upper = this.scene.getObjectByName(`mixamorig${prefix}`);
    const lower = this.scene.getObjectByName(`mixamorig${prefix.replace('UpLeg', 'Leg').replace('Arm', 'ForeArm')}`);
    const end = this.scene.getObjectByName(`mixamorig${endName}`);
    if (!upper || !lower || !end) return;
    const origin = upper.getWorldPosition(new Vector3()); const joint = lower.getWorldPosition(new Vector3()); const tip = end.getWorldPosition(new Vector3());
    const a = joint.distanceTo(origin); const b = tip.distanceTo(joint);
    const axis = target.clone().sub(origin); const distance = Math.min(a + b - 0.001, Math.max(0.01, axis.length())); axis.normalize();
    const along = (a * a - b * b + distance * distance) / (2 * distance);
    const height = Math.sqrt(Math.max(0, a * a - along * along));
    const plane = bend.clone().addScaledVector(axis, -bend.dot(axis)).normalize();
    const knee = origin.clone().addScaledVector(axis, along).addScaledVector(plane, height);
    this.aim(upper, lower, knee, weight); this.aim(lower, end, target, weight);
  }
  apply(motion: AvatarMotion): void {
    const crouch = motion.crouch; const punch = motion.punch;
    const air = motion.grounded ? 0 : 1;
    const crouching = crouch > 0.005 || motion.landing > 0.005;
    const feet = ['Left', 'Right'].map((side) => this.scene.getObjectByName(`mixamorig${side}Foot`)?.getWorldPosition(new Vector3()));
    const facing = this.scene.getWorldQuaternion(new Quaternion());
    const forward = new Vector3(0, 0, 1).applyQuaternion(facing).setY(0).normalize();
    const right = new Vector3(1, 0, 0).applyQuaternion(facing).setY(0).normalize();
    this.scene.position.y = this.rootY - crouch * 0.38 - motion.landing;
    this.scene.updateWorldMatrix(true, true);
    if (crouching || air) ['Left', 'Right'].forEach((side, i) => {
      const foot = feet[i]; if (!foot) return;
      if (air) foot.y += 0.16;
      this.limb(`${side}UpLeg`, `${side}Foot`, foot, forward, 1);
    });
    const spine = this.scene.getObjectByName('mixamorigSpine');
    if (spine && crouching) this.rotateWorld(spine, new Quaternion().setFromAxisAngle(right, crouch * 0.15 + motion.landing * 0.5));
    if (punch > 0) {
      const extension = Math.sin(Math.PI * Math.min(1, punch / 0.8));
      const weight = Math.min(1, punch * 12, (1 - punch) * 8);
      if (spine) this.rotateWorld(spine, new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -0.25 * extension), weight);
      const shoulder = this.scene.getObjectByName('mixamorigRightArm')?.getWorldPosition(new Vector3());
      if (shoulder) {
        const target = shoulder.addScaledVector(forward, 0.2 + 0.52 * extension).addScaledVector(right, 0.08); target.y -= 0.08;
        this.limb('RightArm', 'RightHand', target, new Vector3(0, -1, 0), weight);
      }
    }
  }
}
