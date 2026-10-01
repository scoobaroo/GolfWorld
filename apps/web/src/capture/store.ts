import { create } from 'zustand';
import type { BuildingCapture } from '@golfworld/shared';
import { listMetadata, saveDraft, removeDraft, type CaptureDraft } from './storage';

interface CaptureState {
  drafts: BuildingCapture[]; selectedId: string | null; pendingTarget: BuildingCapture['target'] | null; error: string;
  load(): Promise<void>; save(draft: CaptureDraft): Promise<void>; remove(id: string): Promise<void>;
}
export const useCaptures = create<CaptureState>((set, get) => ({
  drafts: [], selectedId: null, pendingTarget: null, error: '',
  load: async () => {
    try { set({ drafts: await listMetadata(), error: '' }); }
    catch (failure) { set({ error: failure instanceof Error ? failure.message : 'Draft storage unavailable.' }); }
  },
  save: async (draft) => { await saveDraft(draft); await get().load(); },
  remove: async (id) => { await removeDraft(id); set({ selectedId: null }); await get().load(); },
}));
