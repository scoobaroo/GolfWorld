import { useEffect, useState, type ReactNode } from 'react';
import { WINNIPEG, geoToLocal, type Destination, type GeoPoint } from '@golfworld/shared';
import { useGame } from '../app/store';
import { useGeo } from './store';
import { AddressLookup } from './address-lookup';
import { GlobalMap } from './global-map';
import { useCaptures } from '../capture/store';
import { ADDRESS_SEARCH_PROVIDER } from './google-places';

export function MapApp({ onOpenCapture }: { onOpenCapture?: () => void }): ReactNode {
  const position = useGeo((state) => state.position); const destination = useGeo((state) => state.destination);
  const loading = useGeo((state) => state.loading); const travelError = useGeo((state) => state.error);
  const mode = useGame((state) => state.mode);
  const [center, setCenter] = useState<GeoPoint>(position ?? WINNIPEG); const [zoom, setZoom] = useState(position ? 16 : 11);
  const [selected, setSelected] = useState<Destination | null>(destination);
  const [expanded, setExpanded] = useState(false);
  const googleOffset = selected?.provider === 'google' ? geoToLocal(selected, center) : null;
  const googlePin = !!googleOffset && Math.hypot(googleOffset[0], googleOffset[2]) < 1;
  const captures = useCaptures((state) => state.drafts);
  useEffect(() => { void useCaptures.getState().load(); }, []);
  const travel = (place: Destination): void => {
    if (useGeo.getState().loading) return;
    setSelected(place); setCenter(place); setZoom(17); void useGeo.getState().travel(place);
  };
  return <section className={`map-app${expanded ? ' map-expanded' : ''}`} aria-label="Find and travel">
    {expanded && <div className="row-between"><h2>Explore the world</h2><button onClick={() => setExpanded(false)}>Close large map</button></div>}
    <AddressLookup disabled={loading} onSelect={travel} center={center} />
    <div className="map-tools"><button onClick={() => { setZoom(1); setCenter({ lat: 20, lon: 0 }); }}>World</button><button disabled={!position || mode !== 'explore'} onClick={() => { if (position) { setCenter(position); setZoom(17); } }}>My avatar</button><button onClick={() => setExpanded(!expanded)}>{expanded ? 'Small map' : 'Large map'}</button></div>
    <GlobalMap center={center} onCenter={setCenter} zoom={zoom} onZoom={setZoom} position={mode === 'explore' ? position : null} selected={selected} onTravel={travel} annotations={captures.map((capture) => ({ id: capture.id, point: capture.target.point, label: capture.target.label }))} onAnnotation={(id) => { useCaptures.setState({ selectedId: id }); onOpenCapture?.(); }} />
    <p className="capture-map-legend">Purple camera pins: your local place drafts ({captures.length}).</p>
    {onOpenCapture && <button disabled={googlePin} onClick={() => {
      const label = selected?.lat === center.lat && selected.lon === center.lon ? selected.name.split(';')[0] : 'Building / area';
      useCaptures.setState({ selectedId: null, pendingTarget: { point: center, label, source: 'map-pin', featureId: null } }); onOpenCapture();
    }}>Capture building or area</button>}
    {googlePin && <p className="map-caption">For a capture, select a mapped building in the world or move the map to place your own pin.</p>}
    <p className="map-caption">{mode === 'explore' && position ? `Avatar · ${position.lat.toFixed(5)}, ${position.lon.toFixed(5)}` : 'Meadow Club is a fictional practice area. Search to enter the real-world map.'}</p>
    {travelError && <p role="alert" className="map-error">{travelError}</p>}
    {loading && <p role="status" className="map-status">Loading streets and buildings… Your current world stays available.</p>}
    <p className="map-caption">{ADDRESS_SEARCH_PROVIDER === 'google' ? 'Address suggestions by Google Maps. Streets and building geometry by OpenStreetMap.' : 'Search uses OpenStreetMap / Photon.'} Building coverage varies; a course on the map is not yet a playable course.</p>
    <div className="map-regions"><button onClick={() => { setCenter(WINNIPEG); setZoom(11); }}>Winnipeg</button><button onClick={() => { setCenter({ lat: 37.7749, lon: -122.4194 }); setZoom(10); }}>Bay Area</button><button onClick={() => { setCenter({ lat: 25.033, lon: 121.5654 }); setZoom(12); }}>Taipei</button></div>
    <button onClick={() => useGame.getState().setMode('hub')}>Return to Meadow Club</button>
  </section>;
}
