import { useEffect, useRef, useState, type ReactNode } from 'react';
import { WINNIPEG, type Destination, type GeoPoint } from '@golfworld/shared';
import { useGame } from '../app/store';
import { useGeo } from './store';
import { searchPlaces } from './client';
import { GlobalMap } from './global-map';

export function MapApp(): ReactNode {
  const position = useGeo((state) => state.position); const destination = useGeo((state) => state.destination);
  const loading = useGeo((state) => state.loading); const travelError = useGeo((state) => state.error);
  const mode = useGame((state) => state.mode);
  const [center, setCenter] = useState<GeoPoint>(position ?? WINNIPEG); const [zoom, setZoom] = useState(position ? 16 : 11);
  const [query, setQuery] = useState(''); const [country, setCountry] = useState('all');
  const [results, setResults] = useState<Destination[]>([]); const [selected, setSelected] = useState<Destination | null>(destination);
  const [searching, setSearching] = useState(false); const [error, setError] = useState(''); const [searched, setSearched] = useState(false);
  const [expanded, setExpanded] = useState(false); const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const search = async (): Promise<void> => {
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    setSearching(true); setError(''); setSearched(false);
    try {
      const places = await searchPlaces(query.trim(), country, abort.signal);
      if (abort.signal.aborted) return;
      setResults(places); setSearched(true);
      if (places[0]) { setCenter(places[0]); setZoom(15); }
    } catch (error) { if (!abort.signal.aborted) setError(error instanceof Error ? error.message : 'Search unavailable.'); }
    finally { if (!abort.signal.aborted) setSearching(false); }
  };
  const travel = (place: Destination): void => {
    if (useGeo.getState().loading) return;
    setSelected(place); setCenter(place); setZoom(17); void useGeo.getState().travel(place);
  };
  return <section className={`map-app${expanded ? ' map-expanded' : ''}`} aria-label="Find and travel">
    {expanded && <div className="row-between"><h2>Explore the world</h2><button onClick={() => setExpanded(false)}>Close large map</button></div>}
    <form className="map-search" onSubmit={(event) => { event.preventDefault(); void search(); }}>
      <label htmlFor="location-search">Address or golf course</label>
      <div className="row"><input id="location-search" type="search" placeholder="Street address, city, or golf course" value={query} maxLength={180} onChange={(event) => setQuery(event.target.value)} /><button className="primary" disabled={query.trim().length < 3 || searching || loading} type="submit">{searching ? 'Searching…' : 'Search'}</button></div>
      <label className="map-country">Search region<select aria-label="Search region" value={country} onChange={(event) => setCountry(event.target.value)}><option value="all">USA, Canada & Taiwan</option><option value="CA">Canada</option><option value="US">USA</option><option value="TW">Taiwan</option></select></label>
    </form>
    <div className="map-tools"><button onClick={() => { setZoom(1); setCenter({ lat: 20, lon: 0 }); }}>World</button><button disabled={!position || mode !== 'explore'} onClick={() => { if (position) { setCenter(position); setZoom(17); } }}>My avatar</button><button onClick={() => setExpanded(!expanded)}>{expanded ? 'Small map' : 'Large map'}</button></div>
    <GlobalMap center={center} onCenter={setCenter} zoom={zoom} onZoom={setZoom} position={mode === 'explore' ? position : null} selected={selected} onTravel={travel} />
    <p className="map-caption">{mode === 'explore' && position ? `Avatar · ${position.lat.toFixed(5)}, ${position.lon.toFixed(5)}` : 'Meadow Club is a fictional practice area. Search to enter the real-world map.'}</p>
    {(error || travelError) && <p role="alert" className="map-error">{error || travelError}</p>}
    {loading && <p role="status" className="map-status">Loading streets and buildings… Your current world stays available.</p>}
    {searched && !results.length && <p role="status">No mapped match. Try a fuller address, local spelling, or a nearby landmark.</p>}
    {!!results.length && <ul className="location-results" aria-label="Location results">{results.map((place) => <li key={place.id}><button disabled={loading} onClick={() => travel(place)}><span><strong>{place.name}</strong><small>{place.address}</small><em>{place.precision === 'address' ? 'Mapped address' : `${place.precision} match`} · {place.kind.replaceAll('_', ' ')}</em></span><span aria-hidden="true">↗</span></button></li>)}</ul>}
    <p className="map-caption">Search uses OpenStreetMap / Photon. Address and building coverage varies; a course on the map is not yet a playable course.</p>
    <div className="map-regions"><button onClick={() => { setCenter(WINNIPEG); setZoom(11); }}>Winnipeg</button><button onClick={() => { setCenter({ lat: 37.7749, lon: -122.4194 }); setZoom(10); }}>Bay Area</button><button onClick={() => { setCenter({ lat: 25.033, lon: 121.5654 }); setZoom(12); }}>Taipei</button></div>
    <button onClick={() => useGame.getState().setMode('hub')}>Return to Meadow Club</button>
  </section>;
}
