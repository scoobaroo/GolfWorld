import { destinationSchema, type Destination } from '@golfworld/shared';

export const ADDRESS_SEARCH_PROVIDER = import.meta.env.VITE_ADDRESS_SEARCH_PROVIDER === 'photon' ? 'photon' : 'google';
export const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? '';
export interface GooglePlace {
  id: string;
  location?: { lat(): number; lng(): number };
}
export interface GoogleAutocomplete extends HTMLElement {
  disabled: boolean; includedRegionCodes: string[]; requestedLanguage: string;
  locationBias: { center: { lat: number; lng: number }; radius: number };
}
export interface GoogleDetails extends HTMLElement { readonly place?: GooglePlace }
export interface GooglePlacesLibrary {
  BasicPlaceAutocompleteElement: new (options: { includedRegionCodes: string[]; placeholder: string }) => GoogleAutocomplete;
}
interface MapsWindow extends Window {
  google?: { maps: { importLibrary(name: 'places'): Promise<GooglePlacesLibrary> } };
  golfworldGoogleReady?: () => void;
}
let loading: Promise<GooglePlacesLibrary> | null = null;
export function loadGooglePlaces(): Promise<GooglePlacesLibrary> {
  if (!GOOGLE_MAPS_KEY) return Promise.reject(new Error('Google address search is not configured yet.'));
  if (loading) return loading;
  const page = window as MapsWindow;
  loading = new Promise<GooglePlacesLibrary>((resolve, reject) => {
    const script = document.createElement('script'); script.async = true;
    const fail = (): void => { clearTimeout(timer); script.remove(); delete page.golfworldGoogleReady; reject(new Error('Google address search could not load. Check your connection and retry.')); };
    const timer = window.setTimeout(fail, 15000);
    page.golfworldGoogleReady = () => {
      if (!page.google) { fail(); return; }
      void page.google.maps.importLibrary('places').then((library) => {
        clearTimeout(timer); delete page.golfworldGoogleReady;
        if (!library.BasicPlaceAutocompleteElement) { fail(); return; }
        resolve(library);
      }, fail);
    };
    const url = new URL('https://maps.googleapis.com/maps/api/js');
    url.search = new URLSearchParams({ key: GOOGLE_MAPS_KEY, v: 'weekly', loading: 'async', libraries: 'places', callback: 'golfworldGoogleReady', auth_referrer_policy: 'origin' }).toString();
    script.src = url.toString(); script.onerror = fail; document.head.append(script);
  }).catch((error: unknown) => { loading = null; throw error; });
  return loading;
}
// UI Kit exposes ID/location/viewport; its visible card owns names and addresses.
// Never fetch extra fields through the standard Places API or persist this content.
export function googleDestination(place: GooglePlace, country: string): Destination {
  return destinationSchema.parse({ id: `google:${place.id}`, name: 'Selected Google location', address: '',
    country: ['US', 'CA', 'TW'].includes(country) ? country : null,
    kind: 'place', precision: 'place', provider: 'google', lat: place.location?.lat(), lon: place.location?.lng() });
}
