import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, useBeforePhysicsStep, useRapier, interactionGroups, type RapierRigidBody, type RapierCollider } from '@react-three/rapier';
import { Group, Vector3 } from 'three';
import { COURSE, type Vec3 } from '@golfworld/shared';
import { useGame } from '../app/store';
import { controls, movementInput, resetControls } from './input';
import { HumanAvatar } from './human-avatar';
import { CharacterMotor, idleMotion, type AvatarStatus, type MovementBounds } from './character-motor';
import { AvatarEffects } from './avatar-effects';
import { GolfCameraRig } from '../golf/golf-camera';

export function PlayerAvatar({ initial, bounds, renderedBall, walkable, onPosition }: {
  initial: Vec3; bounds: MovementBounds; renderedBall?: Vector3;
  walkable?: (x: number, z: number) => boolean; onPosition?: (position: Vec3) => void;
}): ReactNode {
  const body = useRef<RapierRigidBody>(null); const collider = useRef<RapierCollider>(null); const actor = useRef<Group>(null);
  const { world } = useRapier(); const motor = useRef<CharacterMotor | null>(null);
  const motion = useRef(idleMotion());
  const appearance = useGame((state) => state.appearance); const phoneOpen = useGame((state) => state.phoneOpen);
  const cameraPosition = useMemo(() => new Vector3(), []); const focus = useMemo(() => new Vector3(), []);
  const focusTarget = useMemo(() => new Vector3(), []); const rendered = useMemo(() => new Vector3(), []);
  const golfCamera = useMemo(() => new GolfCameraRig(), []);
  const last = useRef({ mode: '', round: -1, atRest: true, stance: -1, aim: 0 });
  const ticks = useRef(0); const previous = useRef<AvatarStatus | null>(null); const started = useRef(false);
  useEffect(() => {
    if (!body.current || !collider.current) return;
    const controller = new CharacterMotor(world, body.current, collider.current);
    motor.current = controller; motion.current = controller.motion;
    return () => { controller.dispose(); motor.current = null; useGame.setState({ avatar: null, swingActive: false }); };
  }, [world]);
  useBeforePhysicsStep(() => {
    const controller = motor.current; if (!controller) return;
    const state = useGame.getState(); const prior = last.current;
    if (state.mode === 'hub' && prior.mode !== 'hub') {
      controller.teleport(initial, Math.PI); controls.yaw = 0;
    }
    if (state.mode === 'golf' && (prior.mode !== 'golf' || prior.round !== state.round ||
      (!prior.atRest && state.ballAtRest) || prior.stance !== state.stanceRequest)) {
      // One move when the lie settles, rather than snapping to the ball every frame.
      const [x, , z] = state.ball;
      const heading = Math.atan2(COURSE.cup[0] - x, z - COURSE.cup[2]) + state.aim;
      resetControls(); controls.yaw = -heading;
      controller.teleport([x - Math.cos(heading) * 1.5 - Math.sin(heading) * 0.6, 0.02, z - Math.sin(heading) * 1.5 + Math.cos(heading) * 0.6], Math.PI - heading);
      if (actor.current) actor.current.rotation.y = controller.heading;
      golfCamera.reset();
    }
    if (state.mode === 'golf' && state.ballAtRest && prior.aim !== state.aim &&
      Math.hypot(controller.snapshot().position[0] - state.ball[0], controller.snapshot().position[2] - state.ball[2]) < 2.6) {
      const heading = Math.atan2(COURSE.cup[0] - state.ball[0], state.ball[2] - COURSE.cup[2]) + state.aim;
      controller.heading = Math.PI - heading; controls.yaw = -heading;
    }
    last.current = { mode: state.mode, round: state.round, atRest: state.ballAtRest, stance: state.stanceRequest, aim: state.aim };
    const input = movementInput();
    controller.step(input, controls.yaw, !state.phoneOpen && state.mode !== 'home' && !(state.mode === 'golf' && state.complete) && !state.swingActive, bounds, walkable);
    const snapshot = controller.snapshot(); const old = previous.current;
    ticks.current++;
    if (ticks.current % 6 === 0 || !old || old.grounded !== snapshot.grounded || old.crouched !== snapshot.crouched || old.punching !== snapshot.punching) {
      previous.current = snapshot; useGame.setState({ avatar: snapshot });
    }
    if (ticks.current % 30 === 0) onPosition?.(snapshot.position);
  });
  useFrame(({ camera, size }, delta) => {
    const controller = motor.current; if (!actor.current || !controller) return;
    const state = useGame.getState();
    const difference = Math.atan2(Math.sin(controller.heading - actor.current.rotation.y), Math.cos(controller.heading - actor.current.rotation.y));
    actor.current.rotation.y += difference * (1 - Math.exp(-Math.min(delta, 0.1) * 14));
    actor.current.userData = { ...controller.snapshot(), action: motion.current.punch > 0 ? 'punch' : !motion.current.grounded ? 'airborne' : motion.current.crouch > 0.5 ? 'crouch' : motion.current.speed > 0.15 ? 'walk' : 'idle' };
    // Sample the interpolated Rapier transform, not the 10 Hz HUD position.
    actor.current.getWorldPosition(rendered);
    if (state.mode === 'golf' && renderedBall && (!state.ballAtRest || state.swingActive)) {
      golfCamera.update(camera, renderedBall, state.shot, state.ballAtRest, state.aim, delta); started.current = true;
      camera.getWorldDirection(focus).multiplyScalar(10).add(camera.position); return;
    }
    if (state.mode === 'home') { cameraPosition.set(-15, 22, 18); focusTarget.set(-15, 0, 0); }
    else {
      const phoneGolf = state.mode === 'golf' && size.width < 720;
      const distance = phoneGolf ? 8.5 : 6.5; const ahead = phoneGolf ? 0.6 : 4;
      cameraPosition.set(rendered.x + Math.sin(controls.yaw) * distance, rendered.y + 3 + controls.pitch * 4 - motion.current.crouch * 0.35, rendered.z + Math.cos(controls.yaw) * distance);
      focusTarget.set(rendered.x - Math.sin(controls.yaw) * ahead, rendered.y + 1.25 - motion.current.crouch * 0.35, rendered.z - Math.cos(controls.yaw) * ahead);
    }
    if (!started.current) { camera.position.copy(cameraPosition); focus.copy(focusTarget); started.current = true; }
    const blend = 1 - Math.exp(-Math.min(delta, 0.1) * 8);
    camera.position.lerp(cameraPosition, blend); focus.lerp(focusTarget, blend); camera.lookAt(focus);
  });
  return <>
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={initial} userData={{ kind: 'avatar' }}>
      <CapsuleCollider ref={collider} args={[0.6, 0.3]} position={[0, 0.9, 0]} collisionGroups={interactionGroups(0, [1, 2])} />
      <group ref={actor} name="golfer" rotation={[0, Math.PI, 0]}><HumanAvatar appearance={appearance} phoneOpen={phoneOpen} motion={motion} feetY={0} /></group>
    </RigidBody>
    <AvatarEffects motion={motion} />
  </>;
}
