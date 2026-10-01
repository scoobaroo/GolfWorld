import type { ReactNode } from 'react';
import { RigidBody, CuboidCollider, interactionGroups } from '@react-three/rapier';

export function PracticeProps(): ReactNode {
  return [[0, 0.7, 6.5], [3, 0.7, 6], [86.5, 0.7, 4]].map((position, i) => <RigidBody key={i} position={position as [number, number, number]} colliders={false} userData={{ kind: 'practice-prop' }} linearDamping={0.4} angularDamping={0.5} ccd>
    <CuboidCollider args={[0.4, 0.7, 0.4]} collisionGroups={interactionGroups(2, [0, 1, 2])} mass={12} friction={0.65} restitution={0.05} />
    <group name={`practice-crate-${i}`}>
      <mesh castShadow receiveShadow><boxGeometry args={[0.8, 1.4, 0.8]} /><meshStandardMaterial color="#b8915d" roughness={0.9} /></mesh>
      {[-0.5, 0.5].map((y) => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[0.82, 0.08, 0.82]} /><meshStandardMaterial color="#745b39" /></mesh>)}
    </group>
  </RigidBody>);
}
