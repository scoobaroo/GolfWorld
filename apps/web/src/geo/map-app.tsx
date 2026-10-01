import { useState, type ReactNode } from 'react';
import { WINNIPEG, type Destination, type GeoPoint } from '@golfworld/shared';
import { useGame } from '../app/store';
import { useGeo } from './store';
import { AddressLookup } from './address-lookup';
import { GlobalMap } from './global-map';

export function MapApp(): ReactNode {
  const position = useGeo((state) => state.position); const destination = useGeo((state) => state.destination);
  const loading = useGeo((state) => state.loading); const travelError = useGeo((state) => state.error);
  const mode = useGame((state) => state.mode);
  const [center, setCenter] = useState<GeoPoint>(position ?? WINNIPEG); const [zoom, setZoom] = useState(position ? 16 : 11);
  const [selected, setSelected] = useState<Destination | null>(destination);
  const [expanded, setExpanded] = useState(false);
  const travel = (place: Destination): void => {
    if (useGeo.getState().loading) return;
    setSelected(place); setCenter(place); setZoom(17); void useGeo.getState().travel(place);
  };
  return <section className={`map-app${expanded ? ' map-expanded' : ''}`} aria-label="Find and travel">
    {expanded && <div className="row-between"><h2>Explore the world</h2><button onClick={() => setExpanded(false)}>Close large map</button></div>}
    <AddressLookup disabled={loading} onSelect={travel} />
    <div className="map-tools"><button onClick={() => { setZoom(1); setCenter({ lat: 20, lon: 0 }); }}>World</button><button disabled={!position || mode !== 'explore'} onClick={() => { if (position) { setCenter(position); setZoom(17); } }}>My avatar</button><button onClick={() => setExpanded(!expanded)}>{expanded ? 'Small map' : 'Large map'}</button></div>
    <GlobalMap center={center} onCenter={setCenter} zoom={zoom} onZoom={setZoom} position={mode === 'explore' ? position : null} selected={selected} onTravel={travel} />
    <p className="map-caption">{mode === 'explore' && position ? `Avatar · ${position.lat.toFixed(5)}, ${position.lon.toFixed(5)}` : 'Meadow Club is a fictional practice area. Search to enter the real-world map.'}</p>
    {travelError && <p role="alert" className="map-error">{travelError}</p>}
    {loading && <p role="status" className="map-status">Loading streets and buildings… Your current world stays available.</p>}
    <p className="map-caption">Search uses OpenStreetMap / Photon. Address and building coverage varies; a course on the map is not yet a playable course.</p>
    <div className="map-regions"><button onClick={() => { setCenter(WINNIPEG); setZoom(11); }}>Winnipeg</button><button onClick={() => { setCenter({ lat: 37.7749, lon: -122.4194 }); setZoom(10); }}>Bay Area</button><button onClick={() => { setCenter({ lat: 25.033, lon: 121.5654 }); setZoom(12); }}>Taipei</button></div>
    <button onClick={() => useGame.getState().setMode('hub')}>Return to Meadow Club</button>
  </section>;
}
