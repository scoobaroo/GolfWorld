import { geoToLocal, pointInRing, type GeoFeature, type GeoPoint, type Neighborhood } from '@golfworld/shared';
import { BufferGeometry, DoubleSide, ExtrudeGeometry, Float32BufferAttribute, Path, Shape, ShapeGeometry } from 'three';

export type GroundRing = [number, number][];
export interface ProjectedFeature { feature: GeoFeature; rings: GroundRing[]; holes: GroundRing[]; }
export function projectFeatures(scene: Neighborhood): ProjectedFeature[] {
  const ring = (points: GeoPoint[]): GroundRing => points.map((p) => { const [x, , z] = geoToLocal(p, scene.origin); return [x, z]; });
  return scene.features.map((feature) => ({ feature, rings: feature.rings.map(ring), holes: feature.holes.map(ring) }));
}
export function buildingUse(tags: Record<string, string>): string {
  const type = tags['building:use'] || (tags.building === 'yes' ? '' : tags.building) || tags.amenity || (tags.shop ? 'retail' : '') || 'unknown';
  return type.replaceAll('_', ' ');
}
export function featureColor(feature: GeoFeature): string {
  const t = feature.tags;
  if (feature.kind === 'building') {
    const use = buildingUse(t);
    if (/house|residential|apartment|detached|bungalow/.test(use)) return '#dfc9a3';
    if (/industrial|warehouse|factory|commercial|retail|office/.test(use)) return '#a1b1bf';
    if (/church|temple|mosque|religious/.test(use)) return '#d8bb9e';
    if (/school|university|hospital|civic|public|government/.test(use)) return '#c2c8b6';
    return '#c4beb4';
  }
  if (t.natural === 'water' || t.water || t.landuse === 'reservoir') return '#6dabba';
  if (t.golf === 'bunker') return '#decaa0';
  if (t.golf === 'green') return '#a5cc7d';
  if (t.leisure === 'golf_course' || t.golf) return '#86b478';
  if (t.landuse === 'residential') return '#acb59a';
  if (t.landuse === 'commercial' || t.landuse === 'industrial') return '#b6b5a1';
  return '#7da077';
}
function polygonShape(ring: GroundRing, holes: GroundRing[]): Shape {
  const shape = new Shape(); ring.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
  for (const hole of holes) {
    if (!pointInRing(hole[0][0], hole[0][1], ring)) continue;
    const path = new Path(); hole.forEach(([x, z], i) => i ? path.lineTo(x, -z) : path.moveTo(x, -z)); shape.holes.push(path);
  }
  return shape;
}
export function polygonGeometry(part: ProjectedFeature): BufferGeometry {
  const shapes = part.rings.map((ring) => polygonShape(ring, part.holes));
  return part.feature.kind === 'building'
    ? new ExtrudeGeometry(shapes, { depth: part.feature.height, bevelEnabled: false, steps: 1, curveSegments: 1 })
    : new ShapeGeometry(shapes);
}
export function roadWidth(feature: GeoFeature): number {
  const explicit = Number.parseFloat(feature.tags.width); if (explicit > 0) return Math.min(30, explicit);
  if (feature.tags.golf || /footway|path|cycleway|steps/.test(feature.tags.highway)) return 2;
  if (/motorway|trunk/.test(feature.tags.highway)) return 16;
  return Math.max(4, Math.min(16, (Number(feature.tags.lanes) || 2) * 3.2));
}
export function roadGeometry(part: ProjectedFeature): BufferGeometry {
  const vertices: number[] = []; const half = roadWidth(part.feature) / 2;
  for (const ring of part.rings) for (let i = 1; i < ring.length; i++) {
    const [ax, az] = ring[i - 1]; const [bx, bz] = ring[i]; const length = Math.hypot(bx - ax, bz - az);
    if (!length) continue;
    const dx = (bz - az) / length * half; const dz = -(bx - ax) / length * half;
    vertices.push(ax + dx, 0.045, az + dz, ax - dx, 0.045, az - dz, bx + dx, 0.045, bz + dz,
      bx + dx, 0.045, bz + dz, ax - dx, 0.045, az - dz, bx - dx, 0.045, bz - dz);
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3)); geometry.computeVertexNormals(); return geometry;
}
export function blockedAt(x: number, z: number, features: ProjectedFeature[]): boolean {
  return features.some(({ feature, rings, holes }) => {
    if (feature.kind !== 'building' && feature.tags.natural !== 'water' && !feature.tags.water) return false;
    if (holes.some((hole) => pointInRing(x, z, hole))) return false;
    return rings.some((ring) => pointInRing(x, z, ring));
  });
}
export function safeArrival(x: number, z: number, features: ProjectedFeature[]): [number, number] {
  if (!blockedAt(x, z, features)) return [x, z];
  let nearest: [number, number] | null = null; let distance = 120;
  for (const part of features.filter(({ feature }) => feature.kind === 'road' && !feature.tags.golf)) for (const ring of part.rings) for (let i = 1; i < ring.length; i++) {
    const [ax, az] = ring[i - 1]; const [bx, bz] = ring[i];
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2 || 1)));
    const candidate: [number, number] = [ax + t * (bx - ax), az + t * (bz - az)]; const d = Math.hypot(candidate[0] - x, candidate[1] - z);
    if (d < distance && !blockedAt(...candidate, features)) { nearest = candidate; distance = d; }
  }
  if (nearest) return nearest;
  for (let radius = 2; radius <= 150; radius += 2) for (let i = 0; i < 24; i++) {
    const px = x + Math.cos(i / 24 * Math.PI * 2) * radius; const pz = z + Math.sin(i / 24 * Math.PI * 2) * radius;
    if (!blockedAt(px, pz, features)) return [px, pz];
  }
  throw new Error('No safe outdoor arrival point was found near this location.');
}
export const GROUND_SIDE = DoubleSide;
