import { buildingCaptureSchema, MAX_CAPTURE_BYTES, type BuildingCapture } from '@golfworld/shared';
export type CaptureDraft = { metadata: BuildingCapture; blob: Blob };
const DATABASE = 'golfworld.captures.v1'; const TABLE = 'drafts';
const MAX_TOTAL_BYTES = 100 * 1024 * 1024; const MAX_DRAFTS = 30;
type StoredCapture = { metadata: BuildingCapture; mediaBytes?: ArrayBuffer; blob?: Blob };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(TABLE, { keyPath: 'metadata.id' });
    request.onsuccess = () => { const db = request.result; db.onversionchange = () => db.close(); resolve(db); };
    request.onerror = () => reject(new Error('Draft storage is unavailable. You can still export your capture.'));
    request.onblocked = () => reject(new Error('Close older GolfWorld tabs to open draft storage.'));
  });
}
export async function listMetadata(): Promise<BuildingCapture[]> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(TABLE).objectStore(TABLE).openCursor(); const metadata: BuildingCapture[] = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) { resolve(metadata.sort((a, b) => b.createdAt.localeCompare(a.createdAt))); return; }
        const parsed = buildingCaptureSchema.safeParse((cursor.value as StoredCapture).metadata);
        if (parsed.success) metadata.push(parsed.data); cursor.continue();
      };
      request.onerror = () => reject(new Error('Could not read local captures.'));
    });
  } finally { db.close(); }
}
export async function readDraft(id: string): Promise<CaptureDraft | null> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(TABLE).objectStore(TABLE).get(id);
      request.onsuccess = () => {
        const stored = request.result as StoredCapture | undefined;
        const parsed = buildingCaptureSchema.safeParse(stored?.metadata);
        if (!stored || !parsed.success) { resolve(null); return; }
        // ArrayBuffer storage avoids Blob serialization failures in Safari. Read early Blob drafts too.
        const blob = stored.mediaBytes instanceof ArrayBuffer ? new Blob([stored.mediaBytes], { type: parsed.data.media.mimeType }) : stored.blob;
        resolve(blob instanceof Blob ? { metadata: parsed.data, blob } : null);
      };
      request.onerror = () => reject(new Error('Could not open this local capture.'));
    });
  } finally { db.close(); }
}
export async function saveDraft(draft: CaptureDraft): Promise<void> {
  const metadata = buildingCaptureSchema.parse(draft.metadata);
  if (!draft.blob.size || draft.blob.size > MAX_CAPTURE_BYTES || draft.blob.size !== draft.metadata.media.bytes) throw new Error('The capture must be no larger than 25 MB.');
  const mediaBytes = await draft.blob.arrayBuffer();
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(TABLE, 'readwrite'); const store = transaction.objectStore(TABLE);
      const request = store.openCursor(); let capacityError = ''; let totalBytes = 0; let count = 0;
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const entry = cursor.value as StoredCapture;
          if (entry.metadata.id !== metadata.id) { count++; totalBytes += entry.mediaBytes?.byteLength ?? entry.blob?.size ?? 0; }
          cursor.continue(); return;
        }
        if (count >= MAX_DRAFTS || totalBytes + draft.blob.size > MAX_TOTAL_BYTES) {
          capacityError = 'Draft storage is full (30 captures / 100 MB). Export and remove older drafts.'; transaction.abort(); return;
        }
        try { store.put({ metadata, mediaBytes }); }
        catch { capacityError = 'Could not save the draft. Storage may be full; export it instead.'; transaction.abort(); }
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(new Error(capacityError || 'Could not save the draft. Storage may be full; export it instead.'));
    });
  } finally { db.close(); }
}
export async function removeDraft(id: string): Promise<void> {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(TABLE, 'readwrite'); transaction.objectStore(TABLE).delete(id);
      transaction.oncomplete = () => resolve(); transaction.onabort = () => reject(new Error('Could not remove this draft.'));
    });
  } finally { db.close(); }
}
