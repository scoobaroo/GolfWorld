import { z } from 'zod';

export const clubIdSchema = z.enum(['driver', 'iron', 'putter']);
export type ClubId = z.infer<typeof clubIdSchema>;
export const vectorSchema = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
export type Vec3 = z.infer<typeof vectorSchema>;
export const profileSchema = z.object({ name: z.string().trim().min(1).max(24), invertY: z.boolean() });
export type Profile = z.infer<typeof profileSchema>;
export const furnitureSkuSchema = z.enum(['furn.chair.midcentury', 'furn.table.round', 'furn.planter.fern']);
export type FurnitureSku = z.infer<typeof furnitureSkuSchema>;
export const furnitureSchema = z.object({ id: z.string(), sku: furnitureSkuSchema, pos: vectorSchema, rot: z.number().finite() });
export type Furniture = z.infer<typeof furnitureSchema>;
export const scoreSchema = z.object({
  id: z.string(), name: profileSchema.shape.name, strokes: z.number().int().positive(),
  lastClub: clubIdSchema, timestamp: z.string().datetime(), courseId: z.literal('meadow-1'),
});
export type Score = z.infer<typeof scoreSchema>;
export const savedDataSchema = z.object({ profile: profileSchema, furniture: z.array(furnitureSchema).max(40), scores: z.array(scoreSchema).max(100) });
export type SavedData = z.infer<typeof savedDataSchema>;

export const COURSE = {
  id: 'meadow-1' as const, name: 'Meadow Run', par: 4, length: 347.472,
  tee: [90, 0.08, 0] as Vec3, cup: [90, 0, -347.472] as Vec3,
  cupRadius: 0.22, cupSpeed: 1.6, ballRadius: 0.02135,
  water: { minX: 110, maxX: 146, minZ: -222, maxZ: -158 },
};
export const CLUBS: Record<ClubId, { label: string; speed: number; loft: number; hint: string }> = {
  driver: { label: 'Driver', speed: 47, loft: 0.39, hint: 'Long flight · tee & fairway' },
  iron: { label: '7-iron', speed: 33, loft: 0.62, hint: 'High approach · ~110 m' },
  putter: { label: 'Putter', speed: 8, loft: 0, hint: 'Ground roll · up to 20 m' },
};
export const GRAVITY = 9.81;
export const SERVER_TICK_RATE = 20;
export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
export function shotVelocity(club: ClubId, power: number, heading: number, face: number): Vec3 {
  const spec = CLUBS[club];
  const speed = spec.speed * clamp(power, 0.025, 1);
  const angle = heading + clamp(face, -1, 1) * 0.13;
  return [Math.sin(angle) * speed * Math.cos(spec.loft), speed * Math.sin(spec.loft), -Math.cos(angle) * speed * Math.cos(spec.loft)];
}
export function distanceToCup(position: Vec3): number {
  return Math.hypot(position[0] - COURSE.cup[0], position[2] - COURSE.cup[2]);
}
export function isHoled(position: Vec3, speed: number): boolean {
  return position[1] < 0.25 && distanceToCup(position) <= COURSE.cupRadius && speed <= COURSE.cupSpeed;
}
export type Surface = 'green' | 'fairway' | 'rough' | 'water' | 'oob';
export function surfaceAt(position: Vec3): Surface {
  const [x, , z] = position;
  if (x < 48 || x > 150 || z > 22 || z < -375) return 'oob';
  const water = COURSE.water;
  if (x >= water.minX && x <= water.maxX && z >= water.minZ && z <= water.maxZ) return 'water';
  if (distanceToCup(position) < 13) return 'green';
  return Math.abs(x - 90) < 18 ? 'fairway' : 'rough';
}
export const surfaceDrag: Record<Surface, number> = { green: 1.6, fairway: 2.8, rough: 5.5, water: 5.5, oob: 5.5 };
export function scoreLabel(strokes: number): string {
  const difference = strokes - COURSE.par;
  if (strokes === 1) return 'Hole in one';
  if (difference <= -2) return 'Eagle';
  if (difference === -1) return 'Birdie';
  if (difference === 0) return 'Par';
  if (difference === 1) return 'Bogey';
  return `+${difference} over par`;
}
export interface StrokeEvent { strokeIndex: number; club: ClubId; power: number; face: number; penalty: boolean; }
export interface BallState { position: Vec3; velocity: Vec3; ballAtRest: boolean; }
export interface GolfMatchState { id: string; sport: 'golf'; courseId: string; players: string[]; activePlayerId: string; ball: BallState; strokes: StrokeEvent[]; }
export interface HubPresence { userId: string; position: Vec3; yaw: number; phoneOpen: boolean; }
export interface Lot { lotId: string; ownerId: string; items: Furniture[]; }
export const shotIntentSchema = z.object({ club: clubIdSchema, power: z.number().min(0.025).max(1), heading: z.number().finite(), face: z.number().min(-1).max(1) });
export type ShotIntent = z.infer<typeof shotIntentSchema>;
