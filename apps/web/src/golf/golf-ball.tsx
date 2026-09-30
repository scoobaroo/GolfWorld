import { useEffect, useRef, type ReactNode } from 'react';
import { BallCollider, RigidBody, useBeforePhysicsStep, type RapierRigidBody } from '@react-three/rapier';
import { Line } from '@react-three/drei';
import { COURSE, shotVelocity, isHoled, surfaceAt, surfaceDrag, type Vec3 } from '@golfworld/shared';
import { useGame } from '../app/store';

export function GolfBall(): ReactNode {
  const body = useRef<RapierRigidBody>(null);
  const round = useGame((state) => state.round);
  const mode = useGame((state) => state.mode);
  const shot = useGame((state) => state.shot);
  const ball = useGame((state) => state.ball);
  const aim = useGame((state) => state.aim);
  const ballAtRest = useGame((state) => state.ballAtRest);
  const phoneOpen = useGame((state) => state.phoneOpen);
  const lastLie = useRef<Vec3>([...COURSE.tee]);
  const settledTicks = useRef(0);
  const ticks = useRef(0);
  useEffect(() => {
    body.current?.setTranslation({ x: COURSE.tee[0], y: COURSE.tee[1], z: COURSE.tee[2] }, true);
    body.current?.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.current?.setAngvel({ x: 0, y: 0, z: 0 }, true);
    lastLie.current = [...COURSE.tee]; settledTicks.current = 0;
  }, [round]);
  useEffect(() => { body.current?.setEnabled(mode === 'golf'); }, [mode]);
  useEffect(() => {
    if (!shot || !body.current) return;
    const position = body.current.translation();
    lastLie.current = [position.x, Math.max(0.06, position.y), position.z];
    const velocity = shotVelocity(shot.club, shot.power, shot.heading, shot.face);
    body.current.setLinvel({ x: velocity[0], y: velocity[1], z: velocity[2] }, true);
    body.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
    settledTicks.current = 0;
  }, [shot]);
  useBeforePhysicsStep(() => {
    const state = useGame.getState();
    if (!body.current || state.mode !== 'golf' || state.complete || state.ballAtRest) return;
    const position = body.current.translation();
    const velocity = body.current.linvel();
    const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
    const current: Vec3 = [position.x, position.y, position.z];
    const surface = surfaceAt(current);
    if (position.y < 0.4 && (surface === 'water' || surface === 'oob')) {
      const lie = lastLie.current;
      body.current.setTranslation({ x: lie[0], y: lie[1], z: lie[2] }, true);
      body.current.setLinvel({ x: 0, y: 0, z: 0 }, true); body.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      state.penalty(); state.updateBall([...lie], true); return;
    }
    if (isHoled(current, speed)) {
      body.current.setLinvel({ x: 0, y: 0, z: 0 }, true); body.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      state.updateBall([COURSE.cup[0], 0.04, COURSE.cup[2]], true); state.finish(); return;
    }
    if (position.y < 0.1) {
      const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
      const factor = horizontalSpeed > 0 ? Math.max(0, 1 - surfaceDrag[surface] / 60 / horizontalSpeed) : 0;
      body.current.setLinvel({ x: velocity.x * factor, y: velocity.y, z: velocity.z * factor }, true);
      if (speed < 0.2) settledTicks.current++; else settledTicks.current = 0;
    }
    ticks.current++;
    if (settledTicks.current > 25) {
      body.current.setLinvel({ x: 0, y: 0, z: 0 }, true); body.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      state.updateBall(current, true);
    } else if (ticks.current % 6 === 0) state.updateBall(current, false);
  });
  const heading = Math.atan2(COURSE.cup[0] - ball[0], ball[2] - COURSE.cup[2]) + aim;
  return <>
    <RigidBody ref={body} colliders={false} position={COURSE.tee} ccd enabledRotations={[false, false, false]} linearDamping={0.02} restitution={0.12} friction={0.7}>
      <BallCollider args={[COURSE.ballRadius]} mass={0.0459} />
      <mesh visible={mode === 'golf'}><sphereGeometry args={[0.11, 12, 8]} /><meshStandardMaterial color="#fffef5" /></mesh>
    </RigidBody>
    {mode === 'golf' && ballAtRest && !phoneOpen && <>
      <mesh position={[ball[0], 0.12, ball[2]]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.4, 0.5, 32]} /><meshBasicMaterial color="#fff9de" /></mesh>
      <Line points={[[ball[0], 0.15, ball[2]], [ball[0] + Math.sin(heading) * 18, 0.15, ball[2] - Math.cos(heading) * 18]]} color="#fff5c8" lineWidth={1.5} dashed dashSize={0.7} gapSize={0.6} />
    </>}
  </>;
}
