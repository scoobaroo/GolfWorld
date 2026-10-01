import type { Destination } from '@golfworld/shared';
import type { IconName } from '../ui/icons';

type PlaceType = { icon: IconName; label: string; tone: string };
const categories: { kinds: string[]; type: PlaceType }[] = [
  { kinds: ['golf_course', 'golf', 'driving_range'], type: { icon: 'flag', label: 'Golf course', tone: 'green' } },
  { kinds: ['house', 'detached', 'semidetached_house', 'terrace', 'bungalow', 'residential'], type: { icon: 'home', label: 'Home', tone: 'clay' } },
  { kinds: ['apartments', 'dormitory'], type: { icon: 'building', label: 'Apartments', tone: 'clay' } },
  { kinds: ['office', 'commercial'], type: { icon: 'office', label: 'Office / commercial', tone: 'blue' } },
  { kinds: ['retail', 'shop', 'supermarket', 'convenience', 'mall', 'department_store'], type: { icon: 'shop', label: 'Shop', tone: 'gold' } },
  { kinds: ['restaurant', 'cafe', 'fast_food', 'food_court', 'bar', 'pub'], type: { icon: 'food', label: 'Food & drink', tone: 'gold' } },
  { kinds: ['hospital', 'clinic', 'doctors', 'dentist', 'pharmacy'], type: { icon: 'medical', label: 'Healthcare', tone: 'rose' } },
  { kinds: ['school', 'university', 'college', 'kindergarten'], type: { icon: 'school', label: 'Education', tone: 'blue' } },
  { kinds: ['attraction', 'museum', 'townhall', 'civic', 'church', 'temple', 'mosque', 'place_of_worship'], type: { icon: 'landmark', label: 'Landmark', tone: 'violet' } },
  { kinds: ['industrial', 'warehouse', 'factory', 'manufacture'], type: { icon: 'factory', label: 'Industry', tone: 'blue' } },
  { kinds: ['building', 'yes', 'service', 'hotel'], type: { icon: 'building', label: 'Building', tone: 'blue' } },
];

// Use only the provider's type. Unknown places keep a neutral location icon.
export function placeType(place: Destination): PlaceType {
  if (place.precision === 'street') return { icon: 'map', label: 'Street', tone: 'blue' };
  const kind = place.kind.toLowerCase();
  const category = categories.find((entry) => entry.kinds.includes(kind));
  if (category) return category.type;
  return { icon: 'pin', label: kind === 'place' ? 'Location' : kind.replaceAll('_', ' '), tone: 'green' };
}
