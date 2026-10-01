import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { GRAVITY } from '@golfworld/shared';
import type { ReactNode } from 'react';
import { World } from './world';
export default function WorldScene(): ReactNode {
  return <Canvas camera={{ position: [9, 8, 14], fov: 48, near: 0.05, far: 650 }} dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: 'high-performance' }}>
    <Physics gravity={[0, -GRAVITY, 0]} timeStep={1 / 60} interpolate updatePriority={-2}><World /></Physics>
  </Canvas>;
}
