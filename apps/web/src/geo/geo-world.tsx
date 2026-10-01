import { useEffect, useMemo, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instances, Instance } from '@react-three/drei';
import { RigidBody, CylinderCollider } from '@react-three/rapier';
import { type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { geoToLocal, localToGeo } from '@golfworld/shared';
import { useGame } from '../app/store';
import { PlayerAvatar } from '../world/player-avatar';
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
  return batches.map((batch) => <RigidBody key={batch.key} type="fixed" colliders={batch.key.startsWith('building:') ? 'trimesh' : false}><mesh key={batch.key} name={`mapped-${batch.key}`} geometry={batch.geometry} receiveShadow onClick={(event) => {
    if (event.delta > 5 || event.faceIndex === undefined || event.faceIndex === null) return;
    const feature = batch.ranges.find((range) => event.faceIndex! >= range.start && event.faceIndex! < range.end)?.feature;
    if (feature?.kind === 'building') { event.stopPropagation(); useGeo.setState({ selectedFeature: feature }); }
  }}><meshStandardMaterial color={batch.color} side={GROUND_SIDE} roughness={0.95} /></mesh></RigidBody>);
}
export function GeoWorld(): ReactNode {
  const scene = useGeo((state) => state.scene);
  const features = useMemo(() => scene ? projectFeatures(scene) : [], [scene]);
  useFrame(() => { if (!useGame.getState().worldReady) useGame.setState({ worldReady: true }); });
  if (!scene) return null;
  const initial = geoToLocal(useGeo.getState().position ?? scene.origin, scene.origin); initial[1] = 0.02;
  const water = features.filter(({ feature }) => feature.kind !== 'building' && (feature.tags.natural === 'water' || feature.tags.water));
  const trees = features.filter(({ feature }) => feature.kind === 'poi' && feature.tags.natural === 'tree').slice(0, 100);
  return <>
    <color attach="background" args={['#c6e0d7']} /><fog attach="fog" args={['#c6e0d7', 180, 630]} />
    <ambientLight intensity={0.65} /><hemisphereLight args={['#fff4df', '#51704c', 1.1]} /><directionalLight position={[50, 100, 30]} intensity={2} />
    <RigidBody type="fixed" colliders="cuboid"><mesh position={[0, -0.5, 0]} receiveShadow><boxGeometry args={[scene.radius * 2, 1, scene.radius * 2]} /><meshStandardMaterial color="#91a786" /></mesh></RigidBody>
    <MappedGeometry features={features} />
    {!!trees.length && <><RigidBody type="fixed" colliders={false}>{trees.map((part) => <CylinderCollider key={part.feature.id} args={[1.5, 0.22]} position={[part.rings[0][0][0], 1.5, part.rings[0][0][1]]} />)}</RigidBody><Instances limit={100}><cylinderGeometry args={[0.15, 0.22, 3, 6]} /><meshStandardMaterial color="#806c50" />{trees.map((part) => <Instance key={part.feature.id} position={[part.rings[0][0][0], 1.5, part.rings[0][0][1]]} />)}</Instances><Instances limit={100}><icosahedronGeometry args={[2, 1]} /><meshStandardMaterial color="#42734d" />{trees.map((part) => <Instance key={part.feature.id} position={[part.rings[0][0][0], 4, part.rings[0][0][1]]} />)}</Instances></>}
    <PlayerAvatar key={`${scene.origin.lat},${scene.origin.lon}`} initial={initial} bounds={{ minX: -scene.radius + 12, maxX: scene.radius - 12, minZ: -scene.radius + 12, maxZ: scene.radius - 12 }} walkable={(x, z) => !blockedAt(x, z, water)} onPosition={([x, , z]) => {
      const current = localToGeo(x, z, scene.origin); const previous = useGeo.getState().position;
      if (!previous || Math.abs(current.lat - previous.lat) + Math.abs(current.lon - previous.lon) > 1e-7) useGeo.getState().updatePosition(current);
    }} />
  </>;
}
