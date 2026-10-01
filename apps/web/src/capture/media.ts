import { MAX_CAPTURE_BYTES, MAX_CAPTURE_MS, type BuildingCapture } from '@golfworld/shared';

export function photoFromVideo(video: HTMLVideoElement): Promise<Blob> {
  if (!video.videoWidth || !video.videoHeight) return Promise.reject(new Error('Wait for the camera preview to start.'));
  const canvas = document.createElement('canvas'); const scale = Math.min(1, 1600 / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext('2d');
  if (!context) return Promise.reject(new Error('Photo capture is unavailable. Use Add photo.'));
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not capture the photo.')), 'image/jpeg', 0.9));
}
export async function describeMedia(blob: Blob, kind: 'photo' | 'video'): Promise<BuildingCapture['media']> {
  if (!blob.size || blob.size > MAX_CAPTURE_BYTES) throw new Error('Choose a capture smaller than 25 MB.');
  if (!blob.type.startsWith(kind === 'photo' ? 'image/' : 'video/') || blob.type === 'image/svg+xml') throw new Error('Choose a photo or a video file.');
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const element = kind === 'photo' ? new Image() : document.createElement('video');
      const timer = window.setTimeout(() => reject(new Error('The media could not be opened. Try a JPEG photo or MP4/WebM video.')), 10000);
      const fail = (): void => { clearTimeout(timer); reject(new Error('This media format could not be opened. Try JPEG, MP4, or WebM.')); };
      const loaded = (): void => {
        clearTimeout(timer);
        const width = element instanceof HTMLVideoElement ? element.videoWidth : element.naturalWidth;
        const height = element instanceof HTMLVideoElement ? element.videoHeight : element.naturalHeight;
        const durationMs = element instanceof HTMLVideoElement ? element.duration * 1000 : null;
        if (!width || !height || durationMs !== null && (!Number.isFinite(durationMs) || durationMs > MAX_CAPTURE_MS + 2000)) { reject(new Error('Use a photo or a video of 20 seconds or less.')); return; }
        resolve({ kind, mimeType: blob.type, bytes: blob.size, width, height, durationMs, facingMode: null });
      };
      element.onerror = fail;
      if (element instanceof HTMLVideoElement) { element.preload = 'metadata'; element.onloadedmetadata = loaded; }
      else element.onload = loaded;
      element.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
}
export function exportBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function mediaExtension(type: string): string {
  const mime = type.split(';')[0];
  return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/heic': 'heic', 'image/heif': 'heif', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' } as Record<string, string>)[mime] || 'bin';
}
