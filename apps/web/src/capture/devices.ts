import { useEffect, useRef, useState } from 'react';
import { captureFixSchema, captureOrientationSchema, type CaptureFix, type CaptureOrientation, type CaptureSample } from '@golfworld/shared';

type CompassEvent = DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number };
type OrientationPermission = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };
export function useCaptureDevices() {
  const [stream, setStream] = useState<MediaStream | null>(null); const [busy, setBusy] = useState(false);
  const [gps, setGps] = useState<CaptureFix | null>(null); const [orientation, setOrientation] = useState<CaptureOrientation | null>(null);
  const [locationStatus, setLocationStatus] = useState('GPS is off'); const [orientationStatus, setOrientationStatus] = useState('Direction sensor is off');
  const [error, setError] = useState('');
  const mounted = useRef(false); const camera = useRef<MediaStream | null>(null); const generation = useRef(0); const lifecycle = useRef(0);
  const watch = useRef<number | null>(null); const listening = useRef(false); const lastPaint = useRef(0);
  const latest = useRef<{ gps: CaptureFix | null; orientation: CaptureOrientation | null }>({ gps: null, orientation: null });
  const onOrientation = useRef((event: CompassEvent): void => {
    if (!mounted.current || !listening.current) return;
    const parsed = captureOrientationSchema.safeParse({ alphaDeg: event.alpha, betaDeg: event.beta, gammaDeg: event.gamma,
      absolute: event.absolute, compassHeadingDeg: event.webkitCompassHeading ?? null, compassAccuracyDeg: event.webkitCompassAccuracy ?? null,
      screenAngleDeg: window.screen.orientation?.angle ?? 0, timestamp: new Date().toISOString() });
    if (!parsed.success || [event.alpha, event.beta, event.gamma, event.webkitCompassHeading].every((value) => value == null)) return;
    latest.current.orientation = parsed.data;
    if (Date.now() - lastPaint.current > 500) { lastPaint.current = Date.now(); setOrientation(parsed.data); setOrientationStatus('Direction readings available'); }
  });
  const stop = (): void => {
    generation.current++; lifecycle.current++; camera.current?.getTracks().forEach((track) => track.stop()); camera.current = null;
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current); watch.current = null;
    window.removeEventListener('deviceorientation', onOrientation.current); window.removeEventListener('deviceorientationabsolute', onOrientation.current);
    listening.current = false; latest.current = { gps: null, orientation: null };
    if (mounted.current) { setStream(null); setBusy(false); setGps(null); setOrientation(null); setLocationStatus('GPS is off'); setOrientationStatus('Direction sensor is off'); }
  };
  useEffect(() => {
    mounted.current = true; const handler = onOrientation.current;
    const visibility = (): void => { if (document.visibilityState === 'hidden') stop(); };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      mounted.current = false; generation.current++; lifecycle.current++; camera.current?.getTracks().forEach((track) => track.stop());
      if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
      window.removeEventListener('deviceorientation', handler); window.removeEventListener('deviceorientationabsolute', handler);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  const enableCamera = async (): Promise<void> => {
    if (busy || camera.current) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setError('Camera access needs HTTPS (or localhost). You can use Add photo/video below.'); return; }
    const token = ++generation.current; setBusy(true); setError('');
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } } });
      if (!mounted.current || token !== generation.current) { media.getTracks().forEach((track) => track.stop()); return; }
      camera.current = media; setStream(media);
    } catch { if (mounted.current && token === generation.current) setError('Camera could not open. Check camera permission, or use Add photo/video.'); }
    finally { if (mounted.current && token === generation.current) setBusy(false); }
  };
  const enableLocation = (): void => {
    if (!window.isSecureContext || !navigator.geolocation) { setLocationStatus('GPS needs HTTPS (or localhost). Choose the building pin manually.'); return; }
    if (watch.current !== null) return;
    const token = lifecycle.current;
    setLocationStatus('Waiting for a GPS fix…');
    watch.current = navigator.geolocation.watchPosition((position) => {
      if (!mounted.current || token !== lifecycle.current) return;
      const fix = captureFixSchema.safeParse({ lat: position.coords.latitude, lon: position.coords.longitude, accuracyM: position.coords.accuracy, altitudeM: position.coords.altitude, altitudeAccuracyM: position.coords.altitudeAccuracy, timestamp: new Date(position.timestamp).toISOString() });
      if (fix.success) { latest.current.gps = fix.data; setGps(fix.data); setLocationStatus('GPS readings available'); }
    }, () => {
      if (!mounted.current || token !== lifecycle.current) return;
      if (mounted.current) { latest.current.gps = null; setGps(null); setLocationStatus('GPS unavailable or denied. Your building pin can still be saved.'); }
      if (watch.current !== null) navigator.geolocation.clearWatch(watch.current); watch.current = null;
    }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 });
  };
  const enableOrientation = async (): Promise<void> => {
    if (!window.isSecureContext || typeof DeviceOrientationEvent === 'undefined') { setOrientationStatus('Direction sensor unavailable; direction will be unknown.'); return; }
    if (listening.current) return;
    const token = lifecycle.current;
    try {
      const requestPermission = (DeviceOrientationEvent as OrientationPermission).requestPermission;
      if (requestPermission && await requestPermission.call(DeviceOrientationEvent) !== 'granted') { setOrientationStatus('Direction permission denied; direction will be unknown.'); return; }
      if (!mounted.current || token !== lifecycle.current) return;
      listening.current = true; setOrientationStatus('Waiting for direction readings…');
      window.addEventListener('deviceorientation', onOrientation.current); window.addEventListener('deviceorientationabsolute', onOrientation.current);
    } catch { if (mounted.current) setOrientationStatus('Direction sensor unavailable; direction will be unknown.'); }
  };
  const sample = (offsetMs: number): CaptureSample => {
    const fresh = <T extends { timestamp: string }>(value: T | null, maxAge: number): T | null => value && Date.now() - Date.parse(value.timestamp) <= maxAge ? { ...value } : null;
    return { offsetMs, gps: fresh(latest.current.gps, 15000), orientation: fresh(latest.current.orientation, 2000) };
  };
  return { stream, busy, gps, orientation, locationStatus, orientationStatus, error, enableCamera, enableLocation, enableOrientation, sample, stop };
}
