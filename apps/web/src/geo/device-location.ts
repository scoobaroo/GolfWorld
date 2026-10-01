import { useEffect } from 'react';
import { create } from 'zustand';
import { captureFixSchema, type CaptureFix } from '@golfworld/shared';

type LocationStatus = 'idle' | 'requesting' | 'active' | 'paused' | 'denied' | 'error' | 'unavailable' | 'off';
interface DeviceLocationState {
  enabled: boolean; status: LocationStatus; fix: CaptureFix | null;
  enable(): void; disable(): void; pause(): void; resume(): void;
}
const PREFERENCE = 'golfworld.location.v1';
let enabled = true;
try { enabled = localStorage.getItem(PREFERENCE) !== 'off'; } catch { /* Permission still works without storage. */ }
let watch: number | null = null; let generation = 0; let entered = false; let owners = 0;
let resumeAllowed = false; let attemptedPermission = false;
function remember(value: boolean): void {
  try { localStorage.setItem(PREFERENCE, value ? 'on' : 'off'); } catch { /* Session preference still works. */ }
}
function clearWatch(): void {
  generation++;
  if (watch !== null) navigator.geolocation.clearWatch(watch);
  watch = null;
}
function start(): void {
  if (watch !== null) return;
  if (!window.isSecureContext || !navigator.geolocation) {
    useDeviceLocation.setState({ status: 'unavailable', fix: null }); return;
  }
  if (document.visibilityState === 'hidden') {
    useDeviceLocation.setState({ status: 'paused', fix: null }); return;
  }
  const token = ++generation;
  attemptedPermission = true;
  useDeviceLocation.setState({ status: 'requesting', fix: null });
  watch = navigator.geolocation.watchPosition((position) => {
    if (token !== generation || !useDeviceLocation.getState().enabled) return;
    const fix = captureFixSchema.safeParse({ lat: position.coords.latitude, lon: position.coords.longitude, accuracyM: position.coords.accuracy,
      altitudeM: position.coords.altitude, altitudeAccuracyM: position.coords.altitudeAccuracy, timestamp: new Date(position.timestamp).toISOString() });
    if (fix.success) useDeviceLocation.setState({ status: 'active', fix: fix.data });
  }, (error) => {
    if (token !== generation) return;
    clearWatch(); resumeAllowed = false;
    useDeviceLocation.setState({ status: error.code === 1 ? 'denied' : 'error', fix: null });
  }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 });
}
export const useDeviceLocation = create<DeviceLocationState>((set, get) => ({
  enabled, status: enabled ? 'idle' : 'off', fix: null,
  enable: () => { remember(true); set({ enabled: true }); start(); },
  disable: () => { remember(false); clearWatch(); resumeAllowed = false; set({ enabled: false, status: 'off', fix: null }); },
  pause: () => {
    if (watch === null) return;
    // Resume a previously active session; an unanswered permission request requires an explicit retry.
    resumeAllowed = get().status === 'active'; clearWatch(); set({ status: 'paused', fix: null });
  },
  resume: () => { if (get().enabled && get().status === 'paused' && (resumeAllowed || !attemptedPermission)) { resumeAllowed = false; start(); } },
}));
export function locationMessage(status: LocationStatus): string {
  return ({ idle: 'GPS has not started. Enable it to use your device location.', requesting: 'Waiting for GPS permission or a location fix…',
    active: 'GPS readings available', paused: 'GPS is paused. Return to the world or tap Retry GPS.',
    denied: 'GPS permission denied. You can keep playing and choose a place pin manually.',
    error: 'GPS is unavailable right now. You can retry or choose a place pin manually.',
    unavailable: 'GPS needs HTTPS (or localhost) and browser location support. Choose a place pin manually.', off: 'GPS is off' })[status];
}
// One foreground world session owns GPS, independently of avatar travel and Capture mounting.
export function connectWorldLocation(): () => void {
  owners++;
  if (!entered) { entered = true; if (useDeviceLocation.getState().enabled) start(); }
  else useDeviceLocation.getState().resume();
  return () => {
    owners--;
    // Strict Mode reconnects synchronously; do not cancel/re-request permission during its effect replay.
    queueMicrotask(() => { if (!owners) useDeviceLocation.getState().pause(); });
  };
}
export function useWorldLocation(ready: boolean): void {
  useEffect(() => {
    if (!ready) return;
    const release = connectWorldLocation();
    const visibility = (): void => { if (document.visibilityState === 'hidden') useDeviceLocation.getState().pause(); else useDeviceLocation.getState().resume(); };
    const pageHide = (): void => useDeviceLocation.getState().pause();
    window.addEventListener('pagehide', pageHide); window.addEventListener('pageshow', visibility); document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('pagehide', pageHide); window.removeEventListener('pageshow', visibility); document.removeEventListener('visibilitychange', visibility); release(); };
  }, [ready]);
}
