import type { BallState, ShotIntent, Lot } from '@golfworld/shared';
export interface MatchConnection { submitShot(intent: ShotIntent): void; onBall(listener: (ball: BallState) => void): () => void; disconnect(): void; }
export interface LotPersistence { save(lot: Lot): Promise<void>; load(lotId: string): Promise<Lot>; }
// TODO: Colyseus client implements MatchConnection; authenticated Hono API implements LotPersistence.
