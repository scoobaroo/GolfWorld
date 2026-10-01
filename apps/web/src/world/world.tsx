import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instances, Instance } from '@react-three/drei';
import { RigidBody, CuboidCollider, CapsuleCollider, type RapierRigidBody } from '@react-three/rapier';
import { Group, Vector3 } from 'three';
import { clamp, COURSE } from '@golfworld/shared';
import { useGame } from '../app/store';
import { controls } from './input';
import { HomeLot } from '../home/home-lot';
import { GolfBall } from '../golf/golf-ball';
import { GolfCameraRig } from '../golf/golf-camera';

function Block({ position, scale, color }: { position: [number, number, number]; scale: [number, number, number]; color: string }): ReactNode {
  return <mesh position={position} scale={scale}><boxGeometry /><meshStandardMaterial color={color} /></mesh>;
}
function Trees(): ReactNode {
  const trees = useMemo(() => Array.from({ length: 70 }, (_, index) => ({ x: index < 14 ? Math.cos(index * 1.8) * 42 : (index % 2 ? 40 : 151) + Math.sin(index * 2) * 6, z: index < 14 ? Math.sin(index * 1.8) * 40 + 8 : -(index - 14) * 7, scale: 1 + (index % 4) * 0.25 })), []);
  return <>
    <Instances limit={70}><cylinderGeometry args={[0.22, 0.4, 3, 6]} /><meshStandardMaterial color="#7c6845" />{trees.map((tree, index) => <Instance key={index} position={[tree.x, 1.5, tree.z]} />)}</Instances>
    <Instances limit={70}><icosahedronGeometry args={[2.4, 0]} /><meshStandardMaterial color="#40794f" />{trees.map((tree, index) => <Instance key={index} position={[tree.x, 4.5, tree.z]} scale={[tree.scale, tree.scale * 1.25, tree.scale]} />)}</Instances>
  </>;
}
function Avatar({ renderedBall }: { renderedBall: Vector3 }): ReactNode {
  const body = useRef<RapierRigidBody>(null);
  const model = useRef<Group>(null);
  const phoneOpen = useGame((state) => state.phoneOpen);
  const mode = useGame((state) => state.mode);
  const appearance = useGame((state) => state.appearance);
  const cameraPosition = useMemo(() => new Vector3(), []);
  const target = useMemo(() => new Vector3(), []);
  const cameraFocus = useMemo(() => new Vector3(0, 1.4, 5), []);
  const golfCamera = useMemo(() => new GolfCameraRig(), []);
  const position = useRef({ x: 0, y: 1, z: 9 });
  useEffect(() => {
    golfCamera.reset();
    if (mode === 'hub') { position.current = { x: 0, y: 1, z: 9 }; body.current?.setTranslation(position.current, true); }
  }, [mode, golfCamera]);
  useFrame(({ camera, clock }, delta) => {
    const state = useGame.getState();
    const ball = state.ball;
    const step = Math.min(delta, 0.04);
    if (state.mode === 'hub' && !state.phoneOpen) {
      const keys = controls.keys;
      let forward = controls.z + (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      let side = controls.x + (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const length = Math.max(1, Math.hypot(side, forward)); forward /= length; side /= length;
      const moveX = (side * Math.cos(controls.yaw) - forward * Math.sin(controls.yaw)) * step * 5;
      const moveZ = (-forward * Math.cos(controls.yaw) - side * Math.sin(controls.yaw)) * step * 5;
      const nextX = clamp(position.current.x + moveX, -42, 150);
      const nextZ = clamp(position.current.z + moveZ, -375, 40);
      if (!(nextX > -10 && nextX < 10 && nextZ > -26 && nextZ < -13)) { position.current.x = nextX; position.current.z = nextZ; }
      body.current?.setNextKinematicTranslation(position.current);
      if (model.current && Math.abs(moveX) + Math.abs(moveZ) > 0.001) {
        model.current.rotation.y = Math.atan2(moveX, moveZ);
        model.current.position.y = Math.sin(clock.elapsedTime * 12) * 0.045;
      }
    }
    if (state.mode === 'golf') {
      // Stay at the launch lie in flight, then take a stance beside the settled ball.
      if (state.ballAtRest) {
        const heading = Math.atan2(COURSE.cup[0] - ball[0], ball[2] - COURSE.cup[2]) + state.aim;
        position.current = { x: ball[0] - Math.cos(heading) * 1.5 - Math.sin(heading) * 0.6, y: 1, z: ball[2] - Math.sin(heading) * 1.5 + Math.cos(heading) * 0.6 };
        body.current?.setTranslation(position.current, true);
        if (model.current) model.current.rotation.y = Math.PI - heading;
      }
      if (model.current) model.current.position.y = 0;
    }
    if (state.mode === 'home') {
      cameraPosition.set(-15, 22, 18); target.set(-15, 0, 0);
    } else if (state.mode === 'golf') {
      golfCamera.update(camera, state.ballAtRest ? cameraPosition.set(...ball) : renderedBall, state.shot, state.ballAtRest, state.aim, delta);
      return;
    } else {
      cameraPosition.set(position.current.x + Math.sin(controls.yaw) * 13, 5 + controls.pitch * 7, position.current.z + Math.cos(controls.yaw) * 13);
      target.set(position.current.x - Math.sin(controls.yaw) * 4, 1.4, position.current.z - Math.cos(controls.yaw) * 4);
    }
    const blend = 1 - Math.exp(-Math.min(delta, 0.1) * 8);
    camera.position.lerp(cameraPosition, blend); cameraFocus.lerp(target, blend); camera.lookAt(cameraFocus);
  });
  return <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[0, 1, 9]}><CapsuleCollider args={[0.5, 0.3]} />
    <group ref={model} name="golfer">
      <mesh position={[0, 0.35, 0]}><capsuleGeometry args={[0.28, 0.55, 4, 8]} /><meshStandardMaterial color={appearance.shirtColor} /></mesh>
      <mesh position={[0, 0.98, 0]}><sphereGeometry args={[0.24, 12, 8]} /><meshStandardMaterial color={appearance.skinColor} /></mesh>
      <Block position={[0, 1.16, 0.03]} scale={[0.56, 0.12, 0.5]} color={appearance.hatColor} />
      <Block position={[-0.15, -0.5, 0]} scale={[0.2, 0.7, 0.25]} color={appearance.pantsColor} /><Block position={[0.15, -0.5, 0]} scale={[0.2, 0.7, 0.25]} color={appearance.pantsColor} />
      {phoneOpen && <group position={[0.42, 0.45, 0.3]} rotation={[-0.5, 0, 0]}><Block position={[0, 0, 0]} scale={[0.18, 0.34, 0.025]} color="#153e33" /><Block position={[0, 0, 0.017]} scale={[0.14, 0.28, 0.01]} color="#bce3d0" /></group>}
    </group>
  </RigidBody>;
}
export function World(): ReactNode {
  const ready = useRef(false);
  const renderedBall = useMemo(() => new Vector3(...COURSE.tee), []);
  useFrame(() => { if (!ready.current) { ready.current = true; useGame.setState({ worldReady: true }); } });
  return <>
    <color attach="background" args={['#c6e0d7']} /><fog attach="fog" args={['#c6e0d7', 180, 550]} />
    <ambientLight intensity={1.1} /><hemisphereLight args={['#fff4df', '#51704c', 1.6]} /><directionalLight position={[50, 90, 20]} intensity={2.2} />
    <RigidBody type="fixed" colliders={false}><CuboidCollider args={[300, 0.5, 400]} position={[0, -0.5, -170]} friction={0.7} restitution={0.1} />
      <Block position={[0, -0.51, -170]} scale={[600, 1, 800]} color="#659963" />
    </RigidBody>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}><circleGeometry args={[36, 48]} /><meshStandardMaterial color="#84af77" /></mesh>
    <Block position={[0, 0.03, -6]} scale={[7, 0.05, 26]} color="#d6cbb0" />
    <Block position={[40, 0.025, 12]} scale={[80, 0.04, 4]} color="#d6cbb0" />
    <RigidBody type="fixed" colliders="cuboid"><Block position={[0, 3, -20]} scale={[18, 6, 10]} color="#ede4cd" /></RigidBody>
    <mesh position={[0, 6.7, -20]} rotation={[0, Math.PI / 4, 0]} scale={[14, 2.2, 8]}><coneGeometry args={[1, 1, 4]} /><meshStandardMaterial color="#35574a" /></mesh>
    <Block position={[0, 1.7, -14.92]} scale={[2.7, 3.4, 0.1]} color="#32574b" />
    {[-6, 6].map((x) => <Block key={x} position={[x, 2.8, -14.9]} scale={[3, 2.8, 0.12]} color="#a5c5ba" />)}
    <Block position={[90, 0.02, -167]} scale={[36, 0.035, 364]} color="#8db675" />
    {Array.from({ length: 11 }, (_, index) => <Block key={index} position={[90, 0.045, -index * 32]} scale={[36, 0.02, 16]} color="#95bc7b" />)}
    <mesh position={[90, 0.07, COURSE.cup[2]]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[13, 48]} /><meshStandardMaterial color="#aec987" /></mesh>
    <Block position={[128, 0.055, -190]} scale={[36, 0.035, 64]} color="#70b7c3" />
    <mesh position={[COURSE.cup[0], 0.085, COURSE.cup[2]]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[COURSE.cupRadius, 24]} /><meshBasicMaterial color="#203d2d" /></mesh>
    <mesh position={[90, 1.7, COURSE.cup[2]]}><cylinderGeometry args={[0.035, 0.035, 3.4, 8]} /><meshStandardMaterial color="#f9f4de" /></mesh>
    <Block position={[90.6, 3, COURSE.cup[2]]} scale={[1.2, 0.65, 0.05]} color="#db854c" />
    <Trees /><HomeLot /><Avatar renderedBall={renderedBall} /><GolfBall renderedPosition={renderedBall} />
  </>;
}
