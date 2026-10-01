import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instances, Instance } from '@react-three/drei';
import { RigidBody, CapsuleCollider, type RapierRigidBody } from '@react-three/rapier';
import { Group, Vector3, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, geoToLocal, localToGeo, type Neighborhood } from '@golfworld/shared';
import { useGame } from '../app/store';
import { HumanAvatar, type AvatarMotion } from '../world/human-avatar';
import { controls } from '../world/input';
import { useGeo } from './store';
import { blockedAt, featureColor, GROUND_SIDE, polygonGeometry, projectFeatures, roadGeometry, type ProjectedFeature } from './geometry';

function MappedGeometry({ features }: { features: ProjectedFeature[] }): ReactNode {
  const batches = useMemo(() => {
    const groups = new Map<string, { color: string; geometries: BufferGeometry[] }>();
    for (const part of features) {
      if (part.feature.kind === 'poi') continue;
      const color = part.feature.kind === 'road' ? '#c5c2b0' : featureColor(part.feature);
      const key = `${part.feature.kind}:${color}`;
      const geometry = part.feature.kind === 'road' ? roadGeometry(part) : polygonGeometry(part);
      if (part.feature.kind !== 'road') geometry.rotateX(-Math.PI / 2).translate(0, part.feature.kind === 'building' ? 0 : part.feature.tags.golf ? 0.03 : 0.015, 0);
      // Normalize attributes so a varied set of footprints can share a draw call.
      geometry.deleteAttribute('uv');
      if (!groups.has(key)) groups.set(key, { color, geometries: [] });
      groups.get(key)!.geometries.push(geometry);
    }
    return [...groups].flatMap(([key, group]) => {
      const members = features.filter((part) => `${part.feature.kind}:${part.feature.kind === 'road' ? '#c5c2b0' : featureColor(part.feature)}` === key);
      let cursor = 0;
      const ranges = group.geometries.map((source, i) => { const start = cursor; cursor += (source.index?.count ?? source.attributes.position.count) / 3; return { start, end: cursor, feature: members[i].feature }; });
      const geometry = mergeGeometries(group.geometries); for (const source of group.geometries) source.dispose();
      return geometry ? [{ key, color: group.color, geometry, ranges }] : [];
    });
  }, [features]);
  useEffect(() => () => { for (const batch of batches) batch.geometry.dispose(); }, [batches]);
  return batches.map((batch) => <mesh key={batch.key} name={`mapped-${batch.key}`} geometry={batch.geometry} receiveShadow onClick={(event) => {
    if (event.delta > 5 || event.faceIndex === undefined || event.faceIndex === null) return;
    const feature = batch.ranges.find((range) => event.faceIndex! >= range.start && event.faceIndex! < range.end)?.feature;
    if (feature?.kind === 'building') { event.stopPropagation(); useGeo.setState({ selectedFeature: feature }); }
  }}><meshStandardMaterial color={batch.color} side={GROUND_SIDE} roughness={0.95} /></mesh>);
}
function GeoAvatar({ scene, features }: { scene: Neighborhood; features: ProjectedFeature[] }): ReactNode {
  const body = useRef<RapierRigidBody>(null); const actor = useRef<Group>(null);
  const appearance = useGame((state) => state.appearance); const phoneOpen = useGame((state) => state.phoneOpen);
  const motion = useRef<AvatarMotion>({ speed: 0 }); const elapsed = useRef(0);
  const initial = useMemo(() => geoToLocal(useGeo.getState().position ?? scene.origin, scene.origin), [scene]);
  const position = useRef({ x: initial[0], y: 1, z: initial[2] });
  const target = useMemo(() => new Vector3(), []); const focus = useMemo(() => new Vector3(), []); const started = useRef(false);
  useFrame(({ camera }, delta) => {
    motion.current.speed = 0;
    if (!useGame.getState().phoneOpen) {
      const keys = controls.keys;
      let forward = controls.z + Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
      let side = controls.x + Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
      const length = Math.max(1, Math.hypot(forward, side)); forward /= length; side /= length;
      const step = Math.min(delta, 0.04) * 2.2;
      const dx = (side * Math.cos(controls.yaw) - forward * Math.sin(controls.yaw)) * step;
      const dz = (-forward * Math.cos(controls.yaw) - side * Math.sin(controls.yaw)) * step;
      const limit = scene.radius - 12; const x = clamp(position.current.x + dx, -limit, limit); const z = clamp(position.current.z + dz, -limit, limit);
      if (!blockedAt(x, z, features) && !blockedAt(x + 0.3, z, features) && !blockedAt(x - 0.3, z, features) && !blockedAt(x, z + 0.3, features) && !blockedAt(x, z - 0.3, features)) {
        position.current.x = x; position.current.z = z; motion.current.speed = Math.hypot(dx, dz) / (Math.min(delta, 0.04) || 1);
      }
      body.current?.setNextKinematicTranslation(position.current);
      if (actor.current && motion.current.speed > 0.15) {
        const heading = Math.atan2(dx, dz); const difference = Math.atan2(Math.sin(heading - actor.current.rotation.y), Math.cos(heading - actor.current.rotation.y));
        actor.current.rotation.y += difference * (1 - Math.exp(-delta * 12));
      }
    }
    target.set(position.current.x + Math.sin(controls.yaw) * 6.5, 3 + controls.pitch * 4, position.current.z + Math.cos(controls.yaw) * 6.5);
    focus.set(position.current.x - Math.sin(controls.yaw) * 4, 1.4, position.current.z - Math.cos(controls.yaw) * 4);
    if (!started.current) { camera.position.copy(target); started.current = true; }
    camera.position.lerp(target, 1 - Math.exp(-Math.min(delta, 0.1) * 8)); camera.lookAt(focus);
    elapsed.current += delta;
    if (elapsed.current > 0.5) {
      elapsed.current = 0;
      const current = localToGeo(position.current.x, position.current.z, scene.origin);
      const previous = useGeo.getState().position;
      if (!previous || Math.abs(current.lat - previous.lat) + Math.abs(current.lon - previous.lon) > 1e-7) useGeo.getState().updatePosition(current);
    }
  });
  return <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[initial[0], 1, initial[2]]}><CapsuleCollider args={[0.5, 0.3]} /><group ref={actor} name="golfer" rotation={[0, Math.PI, 0]}><HumanAvatar appearance={appearance} motion={motion} phoneOpen={phoneOpen} /></group></RigidBody>;
}
export function GeoWorld(): ReactNode {
  const scene = useGeo((state) => state.scene);
  const features = useMemo(() => scene ? projectFeatures(scene) : [], [scene]);
  useFrame(() => { if (!useGame.getState().worldReady) useGame.setState({ worldReady: true }); });
  if (!scene) return null;
  const trees = features.filter(({ feature }) => feature.kind === 'poi' && feature.tags.natural === 'tree').slice(0, 100);
  return <>
    <color attach="background" args={['#c6e0d7']} /><fog attach="fog" args={['#c6e0d7', 180, 630]} />
    <ambientLight intensity={0.65} /><hemisphereLight args={['#fff4df', '#51704c', 1.1]} /><directionalLight position={[50, 100, 30]} intensity={2} />
    <RigidBody type="fixed" colliders="cuboid"><mesh position={[0, -0.5, 0]} receiveShadow><boxGeometry args={[scene.radius * 2, 1, scene.radius * 2]} /><meshStandardMaterial color="#91a786" /></mesh></RigidBody>
    <MappedGeometry features={features} />
    {!!trees.length && <><Instances limit={100}><cylinderGeometry args={[0.15, 0.22, 3, 6]} /><meshStandardMaterial color="#806c50" />{trees.map((part) => <Instance key={part.feature.id} position={[part.rings[0][0][0], 1.5, part.rings[0][0][1]]} />)}</Instances><Instances limit={100}><icosahedronGeometry args={[2, 1]} /><meshStandardMaterial color="#42734d" />{trees.map((part) => <Instance key={part.feature.id} position={[part.rings[0][0][0], 4, part.rings[0][0][1]]} />)}</Instances></>}
    <GeoAvatar key={`${scene.origin.lat},${scene.origin.lon}`} scene={scene} features={features} />
  </>;
}
