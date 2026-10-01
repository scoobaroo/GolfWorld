import { useEffect, useRef, useState, type ReactNode } from 'react';
import { mapPixel, pixelToGeo, type GeoPoint, type Destination } from '@golfworld/shared';
import { Icon } from '../ui/icons';

const template = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export function GlobalMap({ center, onCenter, zoom, onZoom, position, selected, onTravel, annotations = [], onAnnotation }: {
  center: GeoPoint; onCenter(point: GeoPoint): void; zoom: number; onZoom(zoom: number): void;
  position: GeoPoint | null; selected: Destination | null; onTravel(place: Destination): void;
  annotations?: { id: string; point: GeoPoint; label: string }[]; onAnnotation?: (id: string) => void;
}): ReactNode {
  const root = useRef<HTMLDivElement>(null); const drag = useRef<{ x: number; y: number; point: GeoPoint } | null>(null);
  const [size, setSize] = useState({ width: 320, height: 280 }); const [failed, setFailed] = useState(false);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    if (root.current) observer.observe(root.current); return () => observer.disconnect();
  }, []);
  useEffect(() => { setFailed(false); }, [center, zoom]);
  const [cx, cy] = mapPixel(center, zoom); const count = 2 ** zoom;
  const tiles: ReactNode[] = [];
  for (let y = Math.floor((cy - size.height / 2) / 256); y <= Math.floor((cy + size.height / 2) / 256); y++) {
    for (let x = Math.floor((cx - size.width / 2) / 256); x <= Math.floor((cx + size.width / 2) / 256); x++) {
      if (y < 0 || y >= count) continue;
      const tx = ((x % count) + count) % count;
      const url = template.replace('{z}', String(zoom)).replace('{x}', String(tx)).replace('{y}', String(y));
      tiles.push(<img alt="" draggable={false} key={`${zoom}:${x}:${y}`} src={url} onError={() => setFailed(true)} style={{ left: x * 256 - cx + size.width / 2, top: y * 256 - cy + size.height / 2 }} />);
    }
  }
  const marker = (point: GeoPoint): { left: number; top: number } => {
    const [x, y] = mapPixel(point, zoom); const world = 256 * count;
    let delta = x - cx; if (delta > world / 2) delta -= world; if (delta < -world / 2) delta += world;
    return { left: delta + size.width / 2, top: y - cy + size.height / 2 };
  };
  return <div className="global-map" ref={root} role="region" aria-label="Global map" onPointerDown={(event) => {
    if (event.target instanceof Element && event.target.closest('button, a')) return;
    drag.current = { x: event.clientX, y: event.clientY, point: center }; event.currentTarget.setPointerCapture(event.pointerId);
  }} onPointerMove={(event) => {
    if (!drag.current) return;
    const [x, y] = mapPixel(drag.current.point, zoom);
    onCenter(pixelToGeo(x - event.clientX + drag.current.x, y - event.clientY + drag.current.y, zoom));
  }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
    {tiles}
    {position && <span className="map-avatar-marker" aria-label="Your avatar location" style={marker(position)}><span /></span>}
    {selected && <button className="map-destination-marker" aria-label={`Travel to ${selected.name}`} style={marker(selected)} onClick={() => onTravel(selected)}>⌖</button>}
    {annotations.map((item) => onAnnotation ? <button key={item.id} className="map-capture-marker" aria-label={`Local capture: ${item.label}`} style={marker(item.point)} onClick={() => onAnnotation(item.id)}><Icon name="camera" size={19} /></button> : <span key={item.id} className="map-capture-marker" aria-label={item.label} style={marker(item.point)}><Icon name="camera" size={19} /></span>)}
    <div className="map-zoom"><button aria-label="Zoom in map" disabled={zoom >= 19} onClick={() => onZoom(zoom + 1)}>+</button><button aria-label="Zoom out map" disabled={zoom <= 1} onClick={() => onZoom(zoom - 1)}>−</button></div>
    {failed && <p className="map-tile-error">Basemap unavailable. Search and travel remain available.</p>}
    <a className="map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
  </div>;
}
