import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { Destination, GeoPoint } from '@golfworld/shared';
import { GOOGLE_MAPS_KEY, googleDestination, loadGooglePlaces, type GoogleAutocomplete, type GoogleDetails, type GooglePlace } from './google-places';

export function GoogleAddressLookup({ disabled, onSelect, center }: { disabled: boolean; onSelect: (place: Destination) => void; center: GeoPoint }): ReactNode {
  const id = useId(); const host = useRef<HTMLDivElement>(null); const detailsHost = useRef<HTMLDivElement>(null);
  const widget = useRef<GoogleAutocomplete | null>(null);
  const latest = useRef({ disabled, onSelect, center }); latest.current = { disabled, onSelect, center };
  const [country, setCountry] = useState('all'); const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'resolving' | 'error'>('loading');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true; let pending = 0; let timeout = 0;
    let autocomplete: GoogleAutocomplete | null = null;
    let details: GoogleDetails | null = null;
    const fail = (message: string): void => {
      if (!active) return;
      pending++; window.clearTimeout(timeout); details?.remove(); details = null;
      setError(message); setStatus('error');
    };
    setStatus('loading'); setError('');
    void loadGooglePlaces().then(({ BasicPlaceAutocompleteElement }) => {
      if (!active) return;
      autocomplete = new BasicPlaceAutocompleteElement({ includedRegionCodes: country === 'all' ? ['us', 'ca', 'tw'] : [country.toLowerCase()],
        placeholder: country === 'TW' ? '台北市信義區信義路五段7號' : 'Street address, city, or golf course' });
      widget.current = autocomplete;
      autocomplete.id = `${id}-input`; autocomplete.setAttribute('aria-label', 'Address or golf course');
      autocomplete.disabled = latest.current.disabled;
      autocomplete.requestedLanguage = country === 'TW' ? 'zh-TW' : 'en';
      autocomplete.locationBias = { center: { lat: latest.current.center.lat, lng: latest.current.center.lon }, radius: 25000 };
      autocomplete.addEventListener('gmp-error', () => fail('Google suggestions are unavailable. Retry shortly.'));
      autocomplete.addEventListener('gmp-select', (event) => {
        if (!active || latest.current.disabled) return;
        const place = (event as Event & { place?: GooglePlace }).place;
        if (!place?.id) { fail('This location could not be selected. Try another suggestion.'); return; }
        const selection = ++pending; window.clearTimeout(timeout); details?.remove();
        const card = document.createElement('gmp-place-details-compact') as GoogleDetails; details = card;
        const request = document.createElement('gmp-place-details-place-request'); request.setAttribute('place', place.id);
        card.append(request, document.createElement('gmp-place-standard-content'));
        card.addEventListener('gmp-error', () => { if (pending === selection) fail('Google could not resolve this location. Try another suggestion.'); });
        card.addEventListener('gmp-load', () => {
          if (!active || selection !== pending || !card.place || card.place.id !== place.id) return;
          window.clearTimeout(timeout);
          try { const destination = googleDestination(card.place, country); pending++; setStatus('ready'); latest.current.onSelect(destination); }
          catch { fail('This suggestion has no supported map position. Try another location.'); }
        });
        setError(''); setStatus('resolving'); detailsHost.current?.append(card);
        timeout = window.setTimeout(() => { if (pending === selection) fail('Google took too long to resolve this location. Try again.'); }, 15000);
      });
      host.current?.replaceChildren(autocomplete); setStatus('ready');
    }).catch((failure: unknown) => fail(failure instanceof Error ? failure.message : 'Google address search is unavailable.'));
    return () => { active = false; pending++; window.clearTimeout(timeout); autocomplete?.remove(); details?.remove(); if (widget.current === autocomplete) widget.current = null; };
  }, [country, retry, id]);
  useEffect(() => {
    if (widget.current) {
      widget.current.disabled = disabled || status === 'resolving';
      widget.current.locationBias = { center: { lat: center.lat, lng: center.lon }, radius: 25000 };
    }
  }, [disabled, center.lat, center.lon, status]);
  return <div className="map-search address-lookup google-address-lookup">
    <label htmlFor={`${id}-input`}>Address or golf course</label>
    <div ref={host} className="google-address-input" />
    {!GOOGLE_MAPS_KEY && <input id={`${id}-input`} aria-label="Address or golf course" placeholder="Street address, city, or golf course" disabled />}
    {status === 'loading' && <p role="status">Loading Google suggestions…</p>}
    {status === 'resolving' && <p role="status">Finding the selected location…</p>}
    {status === 'error' && <div className="map-error" role="alert"><p>{error}</p>{GOOGLE_MAPS_KEY && <button disabled={disabled} onClick={() => setRetry((value) => value + 1)}>Retry Google search</button>}</div>}
    <p className="address-input-hint">Google address suggestions for USA, Canada and Taiwan. Choose a place to travel.</p>
    <label className="map-country">Search region<select aria-label="Search region" value={country} disabled={disabled || status === 'resolving'} onChange={(event) => setCountry(event.target.value)}><option value="all">USA, Canada & Taiwan</option><option value="CA">Canada</option><option value="US">USA</option><option value="TW">Taiwan</option></select></label>
    <div ref={detailsHost} className="google-place-details" />
  </div>;
}
