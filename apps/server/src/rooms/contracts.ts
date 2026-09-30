import type { GolfMatchState, HubPresence, ShotIntent, Lot } from '@golfworld/shared';
export interface GolfMatchRoomPort { state: GolfMatchState; submitShot(userId: string, intent: ShotIntent): void; }
export interface HubRoomPort { presence: Map<string, HubPresence>; lots: Map<string, Lot>; }
// TODO: implement Colyseus 0.16+ rooms at 20 Hz with validated messages and authoritative Rapier scoring.
