import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { Destination } from '@golfworld/shared';
import { Icon } from '../ui/icons';
import { searchPlaces } from './client';
import { placeType } from './place-type';

const countryNames = { CA: 'Canada', US: 'USA', TW: 'Taiwan' };

export function AddressLookup({ disabled, onSelect }: { disabled: boolean; onSelect: (place: Destination) => void }): ReactNode {
  const id = useId(); const listId = `${id}-suggestions`;
  const [query, setQuery] = useState(''); const [country, setCountry] = useState('all');
  const [results, setResults] = useState<Destination[]>([]);
  const [status, setStatus] = useState<'idle' | 'waiting' | 'searching' | 'ready' | 'error'>('idle');
  const [error, setError] = useState(''); const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1); const [composing, setComposing] = useState(false);
  const [dismissed, setDismissed] = useState(false); const [submission, setSubmission] = useState(0);
  const root = useRef<HTMLFormElement>(null); const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null); const immediate = useRef(false);
  const nextSearch = useRef(0); const cache = useRef(new Map<string, Destination[]>());
  const valid = query.trim().length >= 3;
  const visible = open && valid && !disabled && !composing;
  const dismiss = (): void => { controller.current?.abort(); setOpen(false); setDismissed(true); setActive(-1); };

  useEffect(() => {
    if (!valid || composing || disabled || dismissed) return;
    const text = query.trim(); const key = `${country}:${text.toLowerCase()}`;
    const abort = new AbortController(); controller.current = abort;
    setOpen(true); setError('');
    const cached = cache.current.get(key);
    if (cached) { setResults(cached); setStatus('ready'); immediate.current = false; return () => abort.abort(); }
    setStatus('waiting');
    // Photon supports suggestions. Debounce typing and respect the API's search budget.
    const delay = Math.max(immediate.current ? 0 : 1200, nextSearch.current - Date.now());
    immediate.current = false;
    const timer = window.setTimeout(() => {
      nextSearch.current = Date.now() + 1150;
      setStatus('searching');
      void searchPlaces(text, country, abort.signal).then((places) => {
        if (abort.signal.aborted) return;
        if (cache.current.size >= 20) cache.current.delete(cache.current.keys().next().value!);
        cache.current.set(key, places); setResults(places); setStatus('ready');
      }).catch((failure: unknown) => {
        if (abort.signal.aborted) return;
        setError(failure instanceof Error ? failure.message : 'Search unavailable.'); setStatus('error');
      });
    }, delay);
    return () => { window.clearTimeout(timer); abort.abort(); };
  }, [query, country, valid, composing, disabled, dismissed, submission]);

  useEffect(() => {
    const outside = (event: PointerEvent): void => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) {
        controller.current?.abort(); setOpen(false); setDismissed(true); setActive(-1);
      }
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  useEffect(() => {
    if (visible && active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, visible, listId]);

  const changed = (): void => {
    controller.current?.abort(); setResults([]); setActive(-1); setDismissed(false); setError('');
    setStatus('waiting'); setOpen(true);
  };
  const submit = (): void => {
    if (!valid || composing || disabled) return;
    immediate.current = true; setDismissed(false); setSubmission((value) => value + 1); input.current?.focus();
  };
  const choose = (place: Destination): void => { if (!disabled) { dismiss(); onSelect(place); } };

  return <form className="map-search address-lookup" ref={root} onSubmit={(event) => { event.preventDefault(); submit(); }}>
    <label htmlFor={`${id}-input`}>Address or golf course</label>
    <div className="address-search-row">
      <div className="row"><input id={`${id}-input`} ref={input} type="search" role="combobox" autoComplete="off" spellCheck={false}
        aria-autocomplete="list" aria-expanded={visible} aria-controls={listId} aria-activedescendant={visible && active >= 0 ? `${listId}-${active}` : undefined}
        aria-describedby={`${id}-hint`} placeholder={country === 'TW' ? '台北市信義區信義路五段7號' : country === 'CA' ? '333 Main Street, Winnipeg' : 'Street address, city, or golf course'} value={query} maxLength={180} disabled={disabled}
        onChange={(event) => { changed(); setQuery(event.target.value); }}
        onFocus={() => { if (valid && !disabled) { setDismissed(false); setOpen(true); } }}
        onCompositionStart={() => { controller.current?.abort(); setComposing(true); }} onCompositionEnd={() => setComposing(false)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || composing) return;
          if (event.key === 'Escape' && visible) { event.preventDefault(); event.stopPropagation(); dismiss(); }
          else if (event.key === 'Tab') dismiss();
          else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && valid) {
            event.preventDefault(); setDismissed(false); setOpen(true);
            if (results.length) setActive((index) => event.key === 'ArrowDown' ? (index + 1) % results.length : (index < 0 ? results.length - 1 : (index - 1 + results.length) % results.length));
          } else if (event.key === 'Enter' && visible && results[active]) { event.preventDefault(); choose(results[active]); }
        }} /><button className="primary" disabled={!valid || disabled || composing || status === 'searching' && visible} type="submit">Search</button></div>
      {visible && <div className="address-dropdown">
        <div className="address-dropdown-heading"><span>Places & addresses</span><span>{status === 'ready' ? `${results.length} found` : 'Live search'}</span></div>
        {(status === 'searching' || status === 'waiting') && <p className="address-search-message" role="status">Finding matching addresses…</p>}
        {status === 'error' && <p className="address-search-message map-error" role="alert">{error} Use Search to retry.</p>}
        {status === 'ready' && !results.length && <p className="address-search-message" role="status">No mapped match. Try a fuller address or nearby landmark.</p>}
        <ul id={listId} role="listbox" aria-label="Address suggestions" className="address-suggestions" aria-busy={status === 'searching'}>
          {results.map((place, index) => {
            const type = placeType(place);
            return <li key={place.id} id={`${listId}-${index}`} role="option" aria-selected={active === index}
              onMouseDown={(event) => event.preventDefault()} onPointerMove={(event) => { if (event.pointerType === 'mouse') setActive(index); }} onClick={() => choose(place)}>
              <span className={`address-place-icon place-${type.tone}`} data-place-icon={type.icon}><Icon name={type.icon} size={23} /></span>
              <span className="address-place-text"><strong>{place.name}</strong><small>{place.address}</small><span className="address-place-type">{type.label} · {countryNames[place.country]}{place.precision === 'address' ? ' · Address' : ''}</span></span>
              <span className="address-travel-arrow"><Icon name="arrow" size={16} /></span>
            </li>;
          })}
        </ul>
        {status === 'ready' && !!results.length && <p role="status" className="address-dropdown-hint">{results.length} matches. Select a place to travel.</p>}
      </div>}
    </div>
    <p id={`${id}-hint`} className="address-input-hint">{country === 'TW' ? 'Taiwan: Traditional Chinese addresses, such as 台北市信義區信義路五段7號.' : country === 'CA' ? 'Canada: street number, street and city, such as 333 Main Street, Winnipeg.' : 'USA, Canadian and Taiwanese addresses. Choose a match to travel.'}</p>
    <label className="map-country">Search region<select aria-label="Search region" value={country} disabled={disabled} onChange={(event) => { changed(); setCountry(event.target.value); }}><option value="all">USA, Canada & Taiwan</option><option value="CA">Canada</option><option value="US">USA</option><option value="TW">Taiwan</option></select></label>
  </form>;
}
