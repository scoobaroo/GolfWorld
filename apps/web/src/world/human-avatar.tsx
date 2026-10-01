import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal, useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { Color, FrontSide, Mesh, MeshStandardMaterial, Quaternion, SkinnedMesh, Vector3 } from 'three';
import type { AvatarAppearance } from '@golfworld/shared';

export interface AvatarMotion { speed: number; }
const MODEL_URL = '/models/golfer.glb';
const SKIN_ALBEDO = new Color('#775439');

export function HumanAvatar({ appearance, phoneOpen = false, motion, feetY = -1 }: {
  appearance: AvatarAppearance; phoneOpen?: boolean; motion?: RefObject<AvatarMotion>; feetY?: number;
}): ReactNode {
  const loaded = useGLTF(MODEL_URL);
  const scene = useMemo(() => {
    const copy = clone(loaded.scene);
    copy.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.castShadow = true; object.receiveShadow = false;
      // A split skinned mesh's static bounds do not follow its animated bones.
      // There is one golfer in this slice; avoid clipping individual garments.
      object.frustumCulled = false;
      // Keep the character's separate skin/clothing passes together after terrain.
      object.renderOrder = 5;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const owned = materials.map((source) => {
        const material = source.clone();
        if (material instanceof MeshStandardMaterial) {
          material.transparent = false; material.alphaTest = 0.25;
          material.side = FrontSide;
          material.roughness = material.name === 'GolfWorld.skin' ? 0.68 : material.roughness;
          if (material.name === 'GolfWorld.shirt' || material.name === 'GolfWorld.pants') {
            // Keep baked fabric detail while making outfit colors independent
            // of the original atlas. Skin and shoe textures remain unaltered.
            material.onBeforeCompile = (shader) => {
              shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
                #ifdef USE_MAP
                  vec4 fabric = texture2D(map, vMapUv);
                  float weave = clamp(sqrt(dot(fabric.rgb, vec3(0.2126, 0.7152, 0.0722))) * 3.5, 0.15, 1.0);
                  diffuseColor.rgb *= weave;
                  diffuseColor.a *= fabric.a;
                #endif
              `);
            };
            material.customProgramCacheKey = () => 'golfworld-fabric-v1';
          }
        }
        return material;
      });
      object.material = Array.isArray(object.material) ? owned : owned[0];
    });
    copy.updateMatrixWorld(true);
    return copy;
  }, [loaded.scene]);
  const { actions } = useAnimations(loaded.animations, scene);
  const currentClip = useRef('');
  useEffect(() => { currentClip.current = ''; }, [actions]);
  useFrame(() => {
    // Sync the inherited world transform before skinning, including the Rapier
    // wrapper and preview scale. Bone attachments use the same current matrices.
    scene.updateWorldMatrix(true, false);
    scene.updateMatrixWorld(true);
    const next = (motion?.current.speed ?? 0) > 0.15 ? 'walk' : 'idle';
    if (currentClip.current !== next && actions[next]) {
      actions[currentClip.current]?.fadeOut(0.2);
      actions[next]?.reset().fadeIn(0.2).play();
      currentClip.current = next;
    }
    const walk = actions.walk;
    // Match the animation stride to movement rather than sliding at the old hub speed.
    if (walk && next === 'walk') walk.timeScale = Math.min(1.65, Math.max(0.7, (motion?.current.speed ?? 0) / 1.4));
  });
  useEffect(() => {
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!(material instanceof MeshStandardMaterial)) continue;
        if (material.name === 'GolfWorld.skin') {
          material.color.set(appearance.skinColor);
          // The diffuse map already contains skin color; compensate its base
          // albedo so the chosen tone is not multiplied into an overly dark face.
          material.color.setRGB(material.color.r / SKIN_ALBEDO.r, material.color.g / SKIN_ALBEDO.g, material.color.b / SKIN_ALBEDO.b);
        }
        if (material.name === 'GolfWorld.shirt') material.color.set(appearance.shirtColor);
        if (material.name === 'GolfWorld.pants') material.color.set(appearance.pantsColor);
      }
    });
  }, [scene, appearance]);
  useEffect(() => () => {
    scene.traverse((object) => {
      if (object instanceof Mesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
      if (object instanceof SkinnedMesh) object.skeleton.dispose();
    });
  }, [scene]);
  const headDetails = useMemo(() => {
    const head = scene.getObjectByName('mixamorigHead');
    if (!head) return null;
    return {
      head, rotation: head.getWorldQuaternion(new Quaternion()).invert(),
      scale: 1 / head.getWorldScale(new Vector3()).x,
      cap: head.worldToLocal(new Vector3(0, 1.63, 0.025)),
    };
  }, [scene]);
  const hand = scene.getObjectByName('mixamorigRightHand');
  return <group position={[0, feetY, 0]} scale={1.06}>
    <primitive object={scene} dispose={null} />
    {headDetails && createPortal(<group position={headDetails.cap} quaternion={headDetails.rotation} scale={headDetails.scale}>
      <mesh castShadow scale={[1, 0.9, 1.12]}><sphereGeometry args={[0.125, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={appearance.hatColor} roughness={0.9} /></mesh>
      <mesh castShadow position={[0, 0, 0.135]} scale={[0.13, 0.008, 0.105]}><sphereGeometry args={[1, 24, 12]} /><meshStandardMaterial color={appearance.hatColor} roughness={0.9} /></mesh>
    </group>, headDetails.head)}
    {phoneOpen && hand && createPortal(<mesh position={[0, 2.5, 5]} scale={100} rotation={[0.1, 0, 0]}><boxGeometry args={[0.07, 0.145, 0.009]} /><meshStandardMaterial color="#18322c" roughness={0.3} /></mesh>, hand)}
  </group>;
}
