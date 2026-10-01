import { geoToLocal, type Destination } from './geo';

function comparable(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replaceAll('臺', '台').replace(/[\s.,，。]/gu, '');
}
function streetLocality(place: Destination): string {
  // Street segments can have different postcodes. Keep the city/state/country in their identity.
  return comparable(place.address.replace(/\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/gi, '').split(',').filter((part) => !/^\s*\d{3,6}(?:-\d{4})?\s*$/.test(part)).join(','));
}
export function uniqueDestinations(places: readonly Destination[]): Destination[] {
  const result: Destination[] = [];
  for (const place of places) {
    const duplicate = result.findIndex((other) => {
      if (place.country !== other.country) return false;
      if (place.id && comparable(place.id) === comparable(other.id)) return true;
      if (comparable(place.name) !== comparable(other.name)) return false;
      if (place.precision === 'street' && other.precision === 'street') return streetLocality(place) === streetLocality(other);
      if (comparable(place.address) !== comparable(other.address)) return false;
      const [x, , z] = geoToLocal(place, other);
      return Math.hypot(x, z) <= 80;
    });
    if (duplicate < 0) result.push(place);
    else if (place.precision === 'address' && result[duplicate].precision !== 'address') result[duplicate] = place;
  }
  return result;
}
