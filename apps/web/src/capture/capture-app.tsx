import { useEffect, useRef, useState, type ReactNode } from 'react';
import { WINNIPEG, geoToLocal, MAX_CAPTURE_BYTES, MAX_CAPTURE_MS, type BuildingCapture, type CaptureSample, type GeoPoint } from '@golfworld/shared';
import { useGeo } from '../geo/store';
import { GlobalMap } from '../geo/global-map';
import { Icon } from '../ui/icons';
import { useCaptureDevices } from './devices';
import { describeMedia, exportBlob, mediaExtension, photoFromVideo } from './media';
import { readDraft, type CaptureDraft } from './storage';
import { useCaptures } from './store';
import { useDeviceLocation } from '../geo/device-location';

type Target = BuildingCapture['target'];
function initialTarget(): Target {
  const pendingTarget = useCaptures.getState().pendingTarget;
  if (pendingTarget) return pendingTarget;
  const { selectedFeature, destination, position } = useGeo.getState();
  const ring = selectedFeature?.rings[0];
  if (selectedFeature?.kind === 'building' && ring?.length) {
    const point = { lat: ring.reduce((sum, p) => sum + p.lat, 0) / ring.length, lon: ring.reduce((sum, p) => sum + p.lon, 0) / ring.length };
    return { point, label: selectedFeature.tags.name?.split(';')[0] || [selectedFeature.tags['addr:housenumber'], selectedFeature.tags['addr:street']].filter(Boolean).join(' ') || 'Building / area', source: 'mapped-building', featureId: selectedFeature.id };
  }
  const point = destination?.provider === 'google' ? useDeviceLocation.getState().fix ?? WINNIPEG : destination ?? position ?? WINNIPEG;
  return { point: { lat: point.lat, lon: point.lon }, label: destination?.provider === 'google' ? 'Building / area' : destination?.name.split(';')[0] || 'Building / area', source: 'map-pin', featureId: null };
}
function localId(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) => value.toString(16).padStart(2, '0')).join('');
}
export function CaptureApp(): ReactNode {
  const devices = useCaptureDevices();
  const [target, setTarget] = useState<Target>(initialTarget); const [center, setCenter] = useState<GeoPoint>(target.point); const [zoom, setZoom] = useState(17);
  const [note, setNote] = useState(''); const [draft, setDraft] = useState<CaptureDraft | null>(null); const [saved, setSaved] = useState(false);
  const [coverage, setCoverage] = useState<BuildingCapture['coverage']>('exterior'); const [floor, setFloor] = useState(''); const [room, setRoom] = useState('');
  const [error, setError] = useState(''); const [working, setWorking] = useState(false); const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false); const [elapsed, setElapsed] = useState(0); const [preview, setPreview] = useState('');
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const drafts = useCaptures((state) => state.drafts); const storageError = useCaptures((state) => state.error); const selectedId = useCaptures((state) => state.selectedId);
  const video = useRef<HTMLVideoElement>(null); const recorder = useRef<MediaRecorder | null>(null);
  const reviewVideo = useRef<HTMLVideoElement>(null);
  const timers = useRef<number[]>([]); const mounted = useRef(false); const operation = useRef(0);
  const clearTimers = (): void => { timers.current.forEach((timer) => { clearTimeout(timer); clearInterval(timer); }); timers.current = []; };
  useEffect(() => {
    mounted.current = true; useCaptures.setState({ pendingTarget: null }); void useCaptures.getState().load();
    return () => { mounted.current = false; operation.current++; clearTimers(); if (recorder.current?.state === 'recording') recorder.current.stop(); };
  }, []);
  useEffect(() => {
    setReady(false);
    if (video.current) { video.current.srcObject = devices.stream; if (devices.stream) void video.current.play().catch(() => setError('Tap the preview to start the camera.')); }
  }, [devices.stream, draft]);
  useEffect(() => {
    if (!draft) { setPreview(''); return; }
    const url = URL.createObjectURL(draft.blob); setPreview(url); return () => URL.revokeObjectURL(url);
  }, [draft]);
  useEffect(() => { if (preview) reviewVideo.current?.load(); }, [preview]);
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    void readDraft(selectedId).then((selected) => {
      if (cancelled || !selected) return;
      devices.stop(); setDraft(selected); setTarget(selected.metadata.target); setCenter(selected.metadata.target.point); setNote(selected.metadata.note); setCoverage(selected.metadata.coverage); setFloor(selected.metadata.floor); setRoom(selected.metadata.room); setSaved(true); setError('');
    }).catch(() => { if (!cancelled) setError('Could not open this local draft.'); });
    return () => { cancelled = true; };
  }, [selectedId]);
  const finish = (blob: Blob, media: BuildingCapture['media'], acquisition: BuildingCapture['acquisition'], capturedAt: string | null, samples: CaptureSample[]): void => {
    if (!mounted.current) return;
    devices.stop(); setDraft({ blob, metadata: { version: 1, id: localId(), status: 'local-draft', createdAt: new Date().toISOString(), capturedAt, acquisition, target, coverage, floor: coverage === 'interior' ? floor : '', room: coverage === 'interior' ? room : '', note, media, samples, cameraPose: 'unresolved', cameraIntrinsics: null } });
    setSaved(false); setWorking(false); setRecording(false); useCaptures.setState({ selectedId: null });
  };
  const takePhoto = async (): Promise<void> => {
    if (!video.current || working || recording) return;
    const token = ++operation.current; const capturedAt = new Date().toISOString(); const samples = [devices.sample(0)];
    const facingMode = devices.stream?.getVideoTracks()[0]?.getSettings().facingMode ?? null;
    setWorking(true); setError('');
    try {
      const blob = await photoFromVideo(video.current); const media = await describeMedia(blob, 'photo');
      if (mounted.current && token === operation.current) finish(blob, { ...media, facingMode }, 'live-camera', capturedAt, samples);
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : 'Photo capture failed.'); }
    finally { if (mounted.current) setWorking(false); }
  };
  const startVideo = (): void => {
    if (!devices.stream || !video.current || recording || working) return;
    if (typeof MediaRecorder === 'undefined') { setError('Live video recording is unavailable. Use Add video.'); return; }
    setError(''); const token = ++operation.current; const capturedAt = new Date().toISOString(); const chunks: Blob[] = [];
    const samples = [devices.sample(0)]; const start = performance.now(); const settings = devices.stream.getVideoTracks()[0].getSettings();
    try {
      const mimeType = ['video/mp4', 'video/webm;codecs=vp8', 'video/webm'].find((type) => MediaRecorder.isTypeSupported(type));
      const capture = new MediaRecorder(devices.stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 1800000 }); recorder.current = capture;
      let bytes = 0; let failed = false;
      capture.ondataavailable = (event) => { if (event.data.size) { chunks.push(event.data); bytes += event.data.size; if (bytes > MAX_CAPTURE_BYTES && capture.state === 'recording') capture.stop(); } };
      capture.onerror = () => { failed = true; clearTimers(); if (mounted.current) { setError('Video recording failed. Try Add video.'); setRecording(false); } };
      capture.onstop = async () => {
        clearTimers(); if (!mounted.current || token !== operation.current || failed) return;
        const durationMs = performance.now() - start; samples.push(devices.sample(durationMs));
        const blob = new Blob(chunks, { type: capture.mimeType || chunks[0]?.type || 'video/webm' });
        if (!blob.size || blob.size > MAX_CAPTURE_BYTES || durationMs > MAX_CAPTURE_MS + 2000) { setError('The video was too large or could not finish. Try a shorter recording.'); setRecording(false); return; }
        const width = settings.width || video.current!.videoWidth; const height = settings.height || video.current!.videoHeight;
        setRecording(false); setWorking(true);
        try {
          // Detach recorder chunks into a self-contained buffer for review and storage.
          const media = new Blob([await blob.arrayBuffer()], { type: blob.type });
          if (mounted.current && token === operation.current) finish(media, { kind: 'video', mimeType: media.type, bytes: media.size, width, height, durationMs, facingMode: settings.facingMode ?? null }, 'live-camera', capturedAt, samples);
        } catch { if (mounted.current) setError('The video could not finish. Try Add video.'); }
        finally { if (mounted.current) setWorking(false); }
      };
      capture.start(500); setRecording(true); setElapsed(0);
      timers.current = [window.setInterval(() => {
        const offset = performance.now() - start; setElapsed(offset); if (samples.length < 99) samples.push(devices.sample(offset));
      }, 500), window.setTimeout(() => { if (capture.state === 'recording') capture.stop(); }, MAX_CAPTURE_MS)];
    } catch { setError('Video recording could not start. Use Add video.'); }
  };
  const importMedia = async (file: File | undefined, kind: 'photo' | 'video'): Promise<void> => {
    if (!file) return;
    const token = ++operation.current; setWorking(true); setError('');
    try {
      const media = await describeMedia(file, kind);
      // A picker may be an old file or native camera capture. Never attach today's GPS as the original camera pose.
      if (mounted.current && token === operation.current) finish(file, media, 'file-picker', null, []);
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : 'Could not open the file.'); }
    finally { if (mounted.current) setWorking(false); }
  };
  const exportDraft = draft ? { ...draft, metadata: { ...draft.metadata, target: { ...target, label: target.label.trim() || 'Building / area' }, coverage, floor: coverage === 'interior' ? floor : '', room: coverage === 'interior' ? room : '', note } } : null;
  const save = async (): Promise<void> => {
    if (!exportDraft) return;
    setWorking(true); setError('');
    try { await useCaptures.getState().save(exportDraft); if (mounted.current) { setDraft(exportDraft); setSaved(true); } }
    catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : 'Could not save. Export this capture instead.'); }
    finally { if (mounted.current) setWorking(false); }
  };
  const fixedGps = draft ? draft.metadata.samples.find((sample) => sample.gps)?.gps ?? null : devices.gps;
  const fixedOrientation = draft ? draft.metadata.samples.find((sample) => sample.orientation)?.orientation ?? null : devices.orientation;
  const distance = fixedGps ? geoToLocal(target.point, fixedGps) : null;
  const distanceM = distance ? Math.hypot(distance[0], distance[2]) : null;
  return <section className="capture-app" aria-label="Area capture">
    <p className="muted">Document a place, inside and outside. Link photos or video to a building or area pin, then add the details you see.</p>
    <div className="capture-local-label"><Icon name="camera" size={18} />Local drafts · saved on this device</div>
    <label className="capture-field">Building / place name<input value={target.label} maxLength={120} disabled={recording} onChange={(event) => { setTarget({ ...target, label: event.target.value }); setSaved(false); }} /></label>
    <fieldset className="capture-coverage" disabled={recording || working}><legend>Capture type</legend>{(['exterior', 'interior', 'area'] as const).map((value) => <label key={value}><input type="radio" name="coverage" value={value} checked={coverage === value} onChange={() => { setCoverage(value); setSaved(false); }} />{value === 'area' ? 'Area' : value === 'interior' ? 'Interior' : 'Exterior'}</label>)}</fieldset>
    {coverage === 'interior' && <><div className="capture-indoor-fields"><label className="capture-field">Floor / level (optional)<input value={floor} maxLength={80} disabled={recording} onChange={(event) => { setFloor(event.target.value); setSaved(false); }} placeholder="Ground, 2, basement…" /></label><label className="capture-field">Room / space (optional)<input value={room} maxLength={120} disabled={recording} onChange={(event) => { setRoom(event.target.value); setSaved(false); }} placeholder="Lobby, kitchen, hallway…" /></label></div><p className="capture-pin-info">Indoor GPS may be weak or unavailable. The place pin, floor and room labels keep your details linked; they do not measure your position inside.</p></>}
    <details className="capture-target-details"><summary>Review / adjust building pin</summary><div className="capture-target-map"><GlobalMap center={center} onCenter={setCenter} zoom={zoom} onZoom={setZoom} position={null} selected={null} onTravel={() => {}} annotations={[{ id: 'target', point: target.point, label: 'Building pin' }]} /><span className="capture-map-crosshair" aria-hidden="true">+</span></div>
      <div className="capture-actions"><button disabled={recording || working} onClick={() => { setTarget({ point: center, label: target.label, source: 'map-pin', featureId: null }); setSaved(false); }}>Set building pin at map center</button>{devices.gps && <button disabled={recording} onClick={() => setCenter(devices.gps!)}>View GPS area</button>}</div>
    </details><p className="capture-pin-info">Building pin · {target.point.lat.toFixed(6)}, {target.point.lon.toFixed(6)}{target.featureId ? ` · ${target.featureId}` : ' · manual map pin'}</p>
    {!draft ? <>
      <div className="capture-camera">{devices.stream ? <video ref={video} autoPlay muted playsInline aria-label="Live building camera" onLoadedData={() => setReady(true)} onClick={() => { if (video.current) void video.current.play(); }} /> : <div><Icon name="camera" size={36} /><p>{coverage === 'interior' ? 'Capture room layouts, walls, doors, materials and interior details.' : coverage === 'area' ? 'Capture paths, grounds, landmarks and details around this place.' : 'Frame the facade, roofline, entrances and building corners.'}</p><button className="primary" disabled={devices.busy} onClick={() => void devices.enableCamera()}>{devices.busy ? 'Opening camera…' : 'Enable camera'}</button></div>}</div>
      <div className="capture-actions"><button className="primary" disabled={!ready || recording || working} onClick={() => void takePhoto()}>Take photo</button><button disabled={!ready || working} onClick={() => recording ? recorder.current?.stop() : startVideo()}>{recording ? 'Stop video' : 'Record video'}</button></div>
      {recording && <p className="capture-recording" role="status">Recording · {(elapsed / 1000).toFixed(0)} / 20 seconds · no audio</p>}
      <div className="capture-actions">{!devices.gps && !devices.locationPending && <button disabled={recording} onClick={devices.enableLocation}>Retry GPS</button>}<button disabled={recording} onClick={() => void devices.enableOrientation()}>Enable direction sensor</button></div>
      <p className="capture-sensor-status">{devices.locationStatus}<br />{devices.orientationStatus}</p>
      {(devices.stream || devices.orientation) && <button disabled={recording} onClick={devices.stop}>Stop camera & direction</button>}
      <div className="capture-import"><label>Add photo<input type="file" accept="image/*" capture="environment" disabled={recording || working} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void importMedia(file, 'photo'); }} /></label><label>Add video<input type="file" accept="video/*" capture="environment" disabled={recording || working} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void importMedia(file, 'video'); }} /></label></div>
      <p className="capture-pin-info">Live video: up to 20 seconds. Files: up to 25 MB. Added files keep the building pin; their original camera position and capture time are unknown.</p>
    </> : <>
      {/* A new element prevents the live video's srcObject stream from overriding the recorded URL. */}
      <div className="capture-preview">{preview && (draft.metadata.media.kind === 'photo' ? <img src={preview} alt={`Capture of ${target.label}`} /> : <video key={preview} ref={reviewVideo} src={preview} controls playsInline preload="metadata" aria-label="Recorded building video" onError={() => setError('This video could not play in the browser. Download it to review, or try a new recording.')} />)}</div>
      {draft.metadata.media.kind === 'video' && <button onClick={() => { void reviewVideo.current?.play().catch(() => setError('This video could not play in the browser. Download it to review, or try a new recording.')); }}>Play video</button>}
      <p className="capture-pin-info">{draft.metadata.media.kind === 'photo' ? 'Photo' : 'Video'} · {draft.metadata.media.width} × {draft.metadata.media.height} · {(draft.blob.size / 1024 / 1024).toFixed(1)} MB{draft.metadata.media.durationMs !== null ? ` · ${(draft.metadata.media.durationMs / 1000).toFixed(1)} seconds` : ''}<br />Capture time: {draft.metadata.capturedAt ? new Date(draft.metadata.capturedAt).toLocaleString() : 'Unknown (added file)'}</p>
    </>}
    <div className="capture-metadata" aria-label="Capture location and camera data"><strong>Camera location & direction</strong><p>{fixedGps ? `${fixedGps.lat.toFixed(6)}, ${fixedGps.lon.toFixed(6)} · ±${fixedGps.accuracyM.toFixed(0)} m GPS accuracy` : 'Camera GPS: unknown'}</p><p>{fixedGps?.altitudeM != null ? `Altitude: ${fixedGps.altitudeM.toFixed(1)} m${fixedGps.altitudeAccuracyM !== null ? ` · ±${fixedGps.altitudeAccuracyM.toFixed(1)} m` : ' · accuracy unknown'}` : 'Camera altitude: unknown'}</p><p>{fixedOrientation ? `Device angles: α ${fixedOrientation.alphaDeg?.toFixed(0) ?? '?'}°, β ${fixedOrientation.betaDeg?.toFixed(0) ?? '?'}°, γ ${fixedOrientation.gammaDeg?.toFixed(0) ?? '?'}° · ${fixedOrientation.absolute ? 'absolute' : 'relative'}` : 'Device direction: unknown'}</p>{distanceM !== null && <p>{distanceM > 150 ? 'Building pin is far from camera GPS' : 'Camera is near the building pin'} · {distanceM.toFixed(0)} m separation (approximate)</p>}<small>GPS and device angles are approximate. A calibrated 3D camera pose is not available.</small></div>
    <label className="capture-field">Detail notes<textarea value={note} maxLength={1000} disabled={recording} onChange={(event) => { setNote(event.target.value); setSaved(false); }} placeholder={coverage === 'interior' ? 'Room layout, doors, finishes, fixtures, missing interior details…' : 'Building type, entrances, materials, paths, missing map details…'} /></label>
    {draft && <><div className="capture-actions"><button className="primary" disabled={working || saved || !target.label.trim()} onClick={() => void save()}>{working ? 'Saving…' : saved ? 'Saved locally' : 'Save local draft'}</button><button disabled={working} onClick={() => { operation.current++; setDraft(null); setSaved(false); setNote(''); setError(''); useCaptures.setState({ selectedId: null }); }}>New capture</button></div><div className="capture-actions"><button onClick={() => { if (exportDraft) exportBlob(exportDraft.blob, `${exportDraft.metadata.id}.${mediaExtension(exportDraft.blob.type)}`); }}>Download media</button><button onClick={() => { if (exportDraft) exportBlob(new Blob([JSON.stringify(exportDraft.metadata, null, 2)], { type: 'application/json' }), `${exportDraft.metadata.id}.json`); }}>Download metadata</button></div>{saved && <p role="status" className="saved-message">Draft saved on this device. Its pin is now on your global map.</p>}</>}
    {(error || devices.error || storageError) && <p role="alert" className="map-error">{error || devices.error || storageError}</p>}
    <div className="capture-library"><h2>Your local drafts</h2><p className="muted">{drafts.length} / 30 saved · 100 MB total budget</p>{!drafts.length && <p className="capture-pin-info">No captures saved yet.</p>}<ul>{drafts.map((item) => <li key={item.id}><button onClick={() => { if (!recording && !working) useCaptures.setState({ selectedId: item.id }); }} disabled={recording || working}><Icon name={item.media.kind === 'photo' ? 'camera' : 'video'} /><span><strong>{item.target.label}</strong><small>{item.media.kind} · {item.coverage}{item.floor ? ` · ${item.floor}` : ''}{item.room ? ` · ${item.room}` : ''} · {new Date(item.createdAt).toLocaleDateString()}</small></span></button>{removeConfirm === item.id ? <button disabled={working} onClick={() => { void useCaptures.getState().remove(item.id).then(() => { if (draft?.metadata.id === item.id) { setDraft(null); setSaved(false); } setRemoveConfirm(null); }).catch((failure: unknown) => setError(failure instanceof Error ? failure.message : 'Could not remove draft.')); }}>Confirm remove</button> : <button disabled={recording || working} aria-label={`Remove draft ${item.target.label}`} onClick={() => setRemoveConfirm(item.id)}>Remove</button>}</li>)}</ul></div>
  </section>;
}
