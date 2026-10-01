import { afterEach, beforeEach, expect, it, vi } from 'vitest';

let success: PositionCallback; let failure: PositionErrorCallback;
let requests: ReturnType<typeof vi.fn>; let cleared: ReturnType<typeof vi.fn>;
const stored = new Map<string, string>();
beforeEach(() => {
  vi.resetModules(); stored.clear();
  requests = vi.fn((onFix: PositionCallback, onError: PositionErrorCallback) => { success = onFix; failure = onError; return requests.mock.calls.length; });
  cleared = vi.fn();
  vi.stubGlobal('navigator', { geolocation: { watchPosition: requests, clearWatch: cleared } });
  vi.stubGlobal('window', { isSecureContext: true }); vi.stubGlobal('document', { visibilityState: 'visible' });
  vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) });
});
afterEach(() => vi.unstubAllGlobals());
const position = (): GeolocationPosition => ({ coords: { latitude: 49.89503, longitude: -97.13846, accuracy: 8, altitude: 229, altitudeAccuracy: 15 }, timestamp: Date.now() }) as GeolocationPosition;
it('requests GPS once across world entry and Strict Mode reconnection', async () => {
  const { connectWorldLocation, useDeviceLocation } = await import('./device-location');
  const release = connectWorldLocation(); release(); const nextRelease = connectWorldLocation(); await Promise.resolve();
  expect(requests).toHaveBeenCalledTimes(1); expect(cleared).not.toHaveBeenCalled();
  success(position()); expect(useDeviceLocation.getState()).toMatchObject({ status: 'active', fix: { lat: 49.89503, accuracyM: 8 } });
  nextRelease(); await Promise.resolve(); expect(cleared).toHaveBeenCalledWith(1);
});
it('does not repeatedly request denied GPS when apps reconnect', async () => {
  const { connectWorldLocation, useDeviceLocation } = await import('./device-location');
  const release = connectWorldLocation(); failure({ code: 1 } as GeolocationPositionError);
  release(); const nextRelease = connectWorldLocation(); await Promise.resolve();
  expect(requests).toHaveBeenCalledTimes(1); expect(useDeviceLocation.getState()).toMatchObject({ status: 'denied', fix: null });
  useDeviceLocation.getState().enable(); expect(requests).toHaveBeenCalledTimes(2); nextRelease(); await Promise.resolve();
});
it('pauses background GPS, resumes an active session and rejects queued old fixes', async () => {
  const { connectWorldLocation, useDeviceLocation } = await import('./device-location');
  const release = connectWorldLocation(); success(position()); const oldSuccess = success;
  useDeviceLocation.getState().pause(); oldSuccess(position()); expect(useDeviceLocation.getState().fix).toBeNull();
  useDeviceLocation.getState().resume(); expect(requests).toHaveBeenCalledTimes(2); success(position());
  useDeviceLocation.getState().disable(); success(position()); expect(useDeviceLocation.getState()).toMatchObject({ enabled: false, status: 'off', fix: null });
  expect(stored.get('golfworld.location.v1')).toBe('off'); release(); await Promise.resolve();
});
it('remembers GPS off and waits for explicit enable; insecure worlds remain usable', async () => {
  stored.set('golfworld.location.v1', 'off');
  const { connectWorldLocation, useDeviceLocation } = await import('./device-location');
  const release = connectWorldLocation(); expect(requests).not.toHaveBeenCalled();
  useDeviceLocation.getState().enable(); expect(requests).toHaveBeenCalledTimes(1);
  useDeviceLocation.getState().disable(); vi.stubGlobal('window', { isSecureContext: false });
  useDeviceLocation.getState().enable(); expect(useDeviceLocation.getState().status).toBe('unavailable'); expect(requests).toHaveBeenCalledTimes(1);
  release(); await Promise.resolve();
});
it('waits until the world is visible for the first permission request', async () => {
  vi.stubGlobal('document', { visibilityState: 'hidden' });
  const { connectWorldLocation, useDeviceLocation } = await import('./device-location');
  const release = connectWorldLocation(); expect(requests).not.toHaveBeenCalled();
  vi.stubGlobal('document', { visibilityState: 'visible' }); useDeviceLocation.getState().resume(); expect(requests).toHaveBeenCalledTimes(1);
  release(); await Promise.resolve();
});
