import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MeshStandardMaterial } from 'three';
import type { AvatarMotion } from './character-motor';

export function AvatarEffects({ motion }: { motion: RefObject<AvatarMotion> }): ReactNode {
  const group = useRef<Group>(null); const active = useRef({ serial: 0, age: 1, impact: false });
  const material = useMemo(() => new MeshStandardMaterial({ color: '#e4d5aa', transparent: true, depthWrite: false, roughness: 1 }), []);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((_, delta) => {
    if (!group.current) return;
    const effect = motion.current.effect;
    if (effect.serial !== active.current.serial) {
      active.current = { serial: effect.serial, age: 0, impact: effect.kind === 'impact' };
      group.current.position.set(...effect.position);
      material.color.set(effect.kind === 'impact' ? '#f1c46e' : '#ddd2b1');
    }
    active.current.age += delta;
    const life = active.current.age / 0.35;
    group.current.visible = life < 1;
    material.opacity = Math.max(0, 0.4 * (1 - life));
    group.current.children.forEach((particle, i) => {
      const angle = i * Math.PI / 3;
      const radius = 0.04 + life * (active.current.impact ? 0.25 : 0.5);
      particle.position.set(Math.sin(angle) * radius, life * 0.2, Math.cos(angle) * radius);
      particle.scale.setScalar(1 + life);
    });
  });
  return <group ref={group} name="avatar-effects" visible={false}>{Array.from({ length: 6 }, (_, i) => <mesh key={i} material={material}><sphereGeometry args={[0.035, 6, 4]} /></mesh>)}</group>;
}
