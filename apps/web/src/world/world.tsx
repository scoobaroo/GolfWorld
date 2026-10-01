import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instances, Instance } from '@react-three/drei';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import { DirectionalLight, Vector3 } from 'three';
import { COURSE } from '@golfworld/shared';
import { useGame } from '../app/store';
import { HomeLot } from '../home/home-lot';
import { GolfBall } from '../golf/golf-ball';
import { PlayerAvatar } from './player-avatar';
import { PracticeProps } from './practice-props';

function Block({ position, scale, color }: { position: [number, number, number]; scale: [number, number, number]; color: string }): ReactNode {
  return <mesh position={position} scale={scale} receiveShadow><boxGeometry /><meshStandardMaterial color={color} /></mesh>;
}
function Trees(): ReactNode {
  const trees = useMemo(() => Array.from({ length: 70 }, (_, index) => ({ x: index < 14 ? Math.cos(index * 1.8) * 42 : (index % 2 ? 40 : 151) + Math.sin(index * 2) * 6, z: index < 14 ? Math.sin(index * 1.8) * 40 + 8 : -(index - 14) * 7, scale: 1 + (index % 4) * 0.25 })), []);
  return <>
    <RigidBody type="fixed" colliders={false}>{trees.map((tree, i) => <CylinderCollider key={i} args={[1.5, 0.4]} position={[tree.x, 1.5, tree.z]} />)}</RigidBody>
    <Instances limit={70}><cylinderGeometry args={[0.22, 0.4, 3, 6]} /><meshStandardMaterial color="#7c6845" />{trees.map((tree, index) => <Instance key={index} position={[tree.x, 1.5, tree.z]} />)}</Instances>
    <Instances limit={70}><icosahedronGeometry args={[2.4, 0]} /><meshStandardMaterial color="#40794f" />{trees.map((tree, index) => <Instance key={index} position={[tree.x, 4.5, tree.z]} scale={[tree.scale, tree.scale * 1.25, tree.scale]} />)}</Instances>
  </>;
}
function Daylight({ renderedBall }: { renderedBall: Vector3 }): ReactNode {
  const light = useRef<DirectionalLight>(null);
  const center = useMemo(() => new Vector3(), []);
  const offset = useMemo(() => new Vector3(14, 28, 18), []);
  useFrame(({ camera, scene }) => {
    if (!light.current) return;
    const state = useGame.getState();
    if (state.mode === 'hub') scene.getObjectByName('golfer')?.getWorldPosition(center);
    else center.copy(state.mode === 'golf' ? renderedBall : camera.position);
    center.y = 0;
    light.current.position.copy(center).add(offset);
    light.current.target.position.copy(center); light.current.target.updateMatrixWorld();
  });
  return <directionalLight ref={light} intensity={2.2} castShadow shadow-mapSize={[512, 512]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-camera-near={1} shadow-camera-far={75} shadow-normalBias={0.015} shadow-bias={-0.0001} />;
}
export function World(): ReactNode {
  const ready = useRef(false);
  const renderedBall = useMemo(() => new Vector3(...COURSE.tee), []);
  useFrame(() => { if (!ready.current) { ready.current = true; useGame.setState({ worldReady: true }); } });
  return <>
    <color attach="background" args={['#c6e0d7']} /><fog attach="fog" args={['#c6e0d7', 180, 550]} />
    <ambientLight intensity={0.3} /><hemisphereLight args={['#fff4df', '#51704c', 0.9]} /><Daylight renderedBall={renderedBall} />
    <RigidBody type="fixed" colliders={false}><CuboidCollider args={[300, 0.5, 400]} position={[0, -0.5, -170]} friction={0.7} restitution={0.1} />
      <Block position={[0, -0.51, -170]} scale={[600, 1, 800]} color="#659963" />
    </RigidBody>
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}><circleGeometry args={[36, 48]} /><meshStandardMaterial color="#84af77" /></mesh>
    <Block position={[0, 0.03, -6]} scale={[7, 0.05, 26]} color="#d6cbb0" />
    <Block position={[40, 0.025, 12]} scale={[80, 0.04, 4]} color="#d6cbb0" />
    <RigidBody type="fixed" colliders="cuboid"><Block position={[0, 3, -20]} scale={[18, 6, 10]} color="#ede4cd" /></RigidBody>
    <mesh position={[0, 6.7, -20]} rotation={[0, Math.PI / 4, 0]} scale={[14, 2.2, 8]}><coneGeometry args={[1, 1, 4]} /><meshStandardMaterial color="#35574a" /></mesh>
    <Block position={[0, 1.7, -14.92]} scale={[2.7, 3.4, 0.1]} color="#32574b" />
    {[-6, 6].map((x) => <Block key={x} position={[x, 2.8, -14.9]} scale={[3, 2.8, 0.12]} color="#a5c5ba" />)}
    <Block position={[90, 0.02, -167]} scale={[36, 0.035, 364]} color="#8db675" />
    {Array.from({ length: 11 }, (_, index) => <Block key={index} position={[90, 0.045, -index * 32]} scale={[36, 0.02, 16]} color="#95bc7b" />)}
    <mesh receiveShadow position={[90, 0.07, COURSE.cup[2]]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[13, 48]} /><meshStandardMaterial color="#aec987" /></mesh>
    <Block position={[128, 0.055, -190]} scale={[36, 0.035, 64]} color="#70b7c3" />
    <mesh position={[COURSE.cup[0], 0.085, COURSE.cup[2]]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[COURSE.cupRadius, 24]} /><meshBasicMaterial color="#203d2d" /></mesh>
    <mesh position={[90, 1.7, COURSE.cup[2]]}><cylinderGeometry args={[0.035, 0.035, 3.4, 8]} /><meshStandardMaterial color="#f9f4de" /></mesh>
    <Block position={[90.6, 3, COURSE.cup[2]]} scale={[1.2, 0.65, 0.05]} color="#db854c" />
    <Trees /><HomeLot /><PracticeProps /><PlayerAvatar initial={[0, 0.02, 9]} bounds={{ minX: -42, maxX: 150, minZ: -375, maxZ: 40 }} walkable={(x, z) => !(x > 110 && x < 146 && z > -222 && z < -158)} renderedBall={renderedBall} /><GolfBall renderedPosition={renderedBall} />
  </>;
}
