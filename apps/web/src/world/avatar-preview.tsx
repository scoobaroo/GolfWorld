import { Suspense, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { AvatarAppearance } from '@golfworld/shared';
import { HumanAvatar } from './human-avatar';

function PreviewCamera({ portrait }: { portrait: boolean }): ReactNode {
  const camera = useThree((state) => state.camera);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  useEffect(() => {
    camera.position.set(0, portrait ? 1.65 : 0.95, portrait ? 1.05 : 3.3);
    controls.current?.target.set(0, portrait ? 1.65 : 0.9, 0);
    controls.current?.update();
  }, [camera, portrait]);
  return <OrbitControls ref={controls} enablePan={false} enableZoom={false} minPolarAngle={0.8} maxPolarAngle={1.9} />;
}
export default function AvatarPreview({ appearance }: { appearance: AvatarAppearance }): ReactNode {
  const [portrait, setPortrait] = useState(true);
  return <>
    <div className="avatar-preview" role="img" aria-label="3D preview of your avatar; drag to turn">
      <Canvas camera={{ position: [0, 1.65, 1.05], fov: 38, near: 0.05, far: 15 }} dpr={[1, 1.5]} gl={{ antialias: true }}>
        <color attach="background" args={['#e7eddf']} />
        <ambientLight intensity={0.5} /><hemisphereLight args={['#fff7e7', '#536658', 1.1]} />
        <directionalLight position={[2, 3, 4]} intensity={2} /><directionalLight position={[-2, 1, -2]} intensity={0.7} />
        <Suspense fallback={null}><HumanAvatar appearance={appearance} feetY={0} /></Suspense>
        <PreviewCamera portrait={portrait} />
      </Canvas>
    </div>
    <div className="row appearance-preview-controls"><button aria-pressed={portrait} onClick={() => setPortrait(true)}>Face</button><button aria-pressed={!portrait} onClick={() => setPortrait(false)}>Full body</button><small>Drag to turn</small></div>
  </>;
}
