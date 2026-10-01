import { create } from 'zustand';
import { destinationSchema, geoPointSchema, geoToLocal, localToGeo, type Destination, type GeoPoint, type Neighborhood, type GeoFeature } from '@golfworld/shared';
import { useGame } from '../app/store';
import { fetchNeighborhood } from './client';
import { projectFeatures, safeArrival } from './geometry';

const GEO_SAVE = 'golfworld.geo.v1';
interface GeoState {
  destination: Destination | null; position: GeoPoint | null; scene: Neighborhood | null;
  selectedFeature: GeoFeature | null;
  loading: boolean; error: string; travel(place: Destination): Promise<void>; updatePosition(point: GeoPoint): void;
  loadNearby(): Promise<void>; restore(): Promise<void>;
}
let request = 0; let controller: AbortController | null = null;
let restoreStarted = false;
function save(destination: Destination | null, position: GeoPoint): void {
  try { localStorage.setItem(GEO_SAVE, JSON.stringify({ destination, position, active: true })); } catch { /* Guest world still works without storage. */ }
}
export const useGeo = create<GeoState>((set, get) => ({
  destination: null, position: null, scene: null, selectedFeature: null, loading: false, error: '',
  travel: async (place) => {
    const id = ++request; controller?.abort(); controller = new AbortController();
    set({ loading: true, error: '' });
    try {
      const scene = await fetchNeighborhood(place, controller.signal);
      if (id !== request) return;
      const [tx, , tz] = geoToLocal(place, scene.origin);
      const [x, z] = safeArrival(tx, tz, projectFeatures(scene)); const position = localToGeo(x, z, scene.origin);
      set({ destination: place, position, scene, selectedFeature: null, loading: false });
      save(place, position); useGame.getState().setMode('explore');
    } catch (error) {
      if (id === request) set({ loading: false, error: error instanceof Error ? error.message : 'Travel failed. Retry the location.' });
    }
  },
  updatePosition: (position) => { set({ position }); save(get().destination, position); },
  loadNearby: async () => {
    const state = get(); if (!state.position || state.loading) return;
    const id = ++request; controller?.abort(); controller = new AbortController();
    set({ loading: true, error: '' });
    try {
      const scene = await fetchNeighborhood(state.position, controller.signal);
      if (id === request) set({ scene, selectedFeature: null, loading: false });
    } catch (error) { if (id === request) set({ loading: false, error: error instanceof Error ? error.message : 'Nearby data unavailable.' }); }
  },
  restore: async () => {
    if (restoreStarted) return;
    restoreStarted = true;
    try {
      const data: unknown = JSON.parse(localStorage.getItem(GEO_SAVE) ?? 'null');
      if (!data || typeof data !== 'object' || !('destination' in data) || !('position' in data) || !('active' in data) || !data.active) return;
      const place = destinationSchema.parse(data.destination); const point = geoPointSchema.parse(data.position);
      await get().travel({ ...place, ...point });
      if (get().scene) { set({ destination: place }); save(place, get().position ?? point); }
    } catch { /* Missing/corrupt geo save leaves Meadow Club playable. */ }
  },
}));
useGame.subscribe((state, previous) => {
  if (state.mode !== previous.mode && state.mode !== 'explore') {
    if (useGeo.getState().loading) { request++; controller?.abort(); useGeo.setState({ loading: false }); }
    try { const data: unknown = JSON.parse(localStorage.getItem(GEO_SAVE) ?? 'null'); if (data && typeof data === 'object') localStorage.setItem(GEO_SAVE, JSON.stringify({ ...data, active: false })); } catch { /* Storage is optional. */ }
  }
});
