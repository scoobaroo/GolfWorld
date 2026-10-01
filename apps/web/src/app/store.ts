import { create } from 'zustand';
import { COURSE, savedDataSchema, defaultAppearance, clamp, type AvatarAppearance, type Profile, type Furniture, type FurnitureSku, type Vec3, type Score, type SavedData, type ClubId, type ShotIntent, type StrokeEvent } from '@golfworld/shared';

export const STORAGE_KEY = 'golfworld.local.v1';
export const defaultData: SavedData = { profile: { name: 'Guest golfer', invertY: false }, appearance: defaultAppearance, furniture: [], scores: [] };
export function readSavedData(storage: Pick<Storage, 'getItem'>): SavedData {
  try {
    const parsed = savedDataSchema.safeParse(JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null'));
    return parsed.success ? parsed.data : defaultData;
  } catch { return defaultData; }
}
let saved = defaultData;
try { saved = readSavedData(localStorage); } catch { /* Private browsing can deny storage. */ }
export type Mode = 'hub' | 'home' | 'golf';
type ShotCommand = ShotIntent & { id: number };
interface GameStore extends SavedData {
  mode: Mode; phoneOpen: boolean; worldReady: boolean; storageError: boolean; selectedFurniture: string | null; placing: FurnitureSku | null;
  ball: Vec3; ballAtRest: boolean; strokes: number; roundEvents: StrokeEvent[]; club: ClubId; aim: number; round: number; shot: ShotCommand | null; complete: Score | null; notice: string;
  setMode(mode: Mode): void; togglePhone(open?: boolean): void; setProfile(profile: Profile): void;
  setAppearance(appearance: AvatarAppearance): void;
  selectFurniture(id: string | null): void; setPlacing(sku: FurnitureSku | null): void; placeFurniture(pos: Vec3): void; moveFurniture(id: string, pos: Vec3): void; rotateFurniture(): void; removeFurniture(): void;
  setClub(club: ClubId): void; setAim(aim: number): void; hit(power: number, face: number): void; updateBall(ball: Vec3, ballAtRest: boolean): void; penalty(): void; finish(): void; resetRound(): void;
}
export const useGame = create<GameStore>((set, get) => ({
  ...saved, mode: 'hub', phoneOpen: false, worldReady: false, storageError: false, selectedFurniture: null, placing: null,
  ball: [...COURSE.tee], ballAtRest: true, strokes: 0, roundEvents: [], club: 'driver', aim: 0, round: 0, shot: null, complete: null, notice: '',
  setMode: (mode) => set({ mode, phoneOpen: false, placing: null, selectedFurniture: null }),
  togglePhone: (open) => set({ phoneOpen: open ?? !get().phoneOpen }),
  setProfile: (profile) => set({ profile }),
  setAppearance: (appearance) => set({ appearance }),
  selectFurniture: (selectedFurniture) => set({ selectedFurniture, placing: null }),
  setPlacing: (placing) => set({ placing, selectedFurniture: null }),
  placeFurniture: (pos) => {
    const sku = get().placing;
    if (!sku || get().furniture.length >= 40) return;
    const item: Furniture = { id: crypto.randomUUID(), sku, pos: [clamp(pos[0], -23, -7), 0, clamp(pos[2], -8, 8)], rot: 0 };
    set({ furniture: [...get().furniture, item], selectedFurniture: item.id, placing: null });
  },
  moveFurniture: (id, pos) => set({ furniture: get().furniture.map((item) => item.id === id ? { ...item, pos: [clamp(pos[0], -23, -7), 0, clamp(pos[2], -8, 8)] } : item) }),
  rotateFurniture: () => set({ furniture: get().furniture.map((item) => item.id === get().selectedFurniture ? { ...item, rot: (item.rot + Math.PI / 2) % (Math.PI * 2) } : item) }),
  removeFurniture: () => set({ furniture: get().furniture.filter((item) => item.id !== get().selectedFurniture), selectedFurniture: null }),
  setClub: (club) => { if (get().ballAtRest) set({ club }); },
  setAim: (aim) => set({ aim }),
  hit: (power, face) => {
    const state = get();
    if (!state.ballAtRest || state.complete || state.mode !== 'golf') return;
    const heading = Math.atan2(COURSE.cup[0] - state.ball[0], state.ball[2] - COURSE.cup[2]) + state.aim;
    const strokeIndex = state.strokes + 1;
    set({ strokes: strokeIndex, roundEvents: [...state.roundEvents, { strokeIndex, club: state.club, power, face, penalty: false }], ballAtRest: false, shot: { club: state.club, power, face, heading, id: (state.shot?.id ?? 0) + 1 }, notice: '' });
  },
  updateBall: (ball, ballAtRest) => set({ ball, ballAtRest }),
  penalty: () => {
    const state = get();
    if (state.complete || state.ballAtRest) return;
    const strokeIndex = state.strokes + 1;
    set({ strokes: strokeIndex, roundEvents: [...state.roundEvents, { strokeIndex, club: state.shot?.club ?? state.club, power: 0, face: 0, penalty: true }], notice: 'Water or out of bounds · +1 penalty · dropped at your last lie' });
  },
  finish: () => {
    const state = get();
    if (state.complete || state.strokes === 0) return;
    const score: Score = { id: crypto.randomUUID(), name: state.profile.name, strokes: state.strokes, lastClub: state.shot?.club ?? state.club, timestamp: new Date().toISOString(), courseId: COURSE.id };
    set({ complete: score, scores: [score, ...state.scores].slice(0, 100), ballAtRest: true });
  },
  resetRound: () => set({ round: get().round + 1, ball: [...COURSE.tee], ballAtRest: true, strokes: 0, roundEvents: [], club: 'driver', aim: 0, shot: null, complete: null, notice: '', mode: 'golf', phoneOpen: false }),
}));
useGame.subscribe((state, previous) => {
  if (state.profile === previous.profile && state.appearance === previous.appearance && state.furniture === previous.furniture && state.scores === previous.scores) return;
  try {
    // TODO: persist lots and authoritative score events via authenticated API.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile: state.profile, appearance: state.appearance, furniture: state.furniture, scores: state.scores }));
  } catch { if (!state.storageError) useGame.setState({ storageError: true }); }
});
