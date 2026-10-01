import { expect, it } from 'vitest';
import { uniqueDestinations } from './places';
import type { Destination } from './geo';
const tower: Destination = { id: 'W:1', lat: 25.0338352, lon: 121.5644995, name: '台北101', address: '台北市, 信義路五段7號, 11049, 臺灣', country: 'TW', kind: 'attraction', precision: 'address' };
it('merges duplicate map objects while retaining different tenants and distant same-name places', () => {
  const restaurant = { ...tower, id: 'N:4', name: '欣葉食藝軒', kind: 'restaurant' };
  const far = { ...tower, id: 'W:5', lat: 25.1338352 };
  expect(uniqueDestinations([tower, { ...tower }, { ...tower, id: 'W:2', lat: 25.033829, name: '臺北１０１' }, restaurant, far])).toEqual([tower, restaurant, far]);
});
it('groups Canadian street segments with different postcodes but keeps other cities and house numbers', () => {
  const street: Destination = { id: 'W:1', name: 'Main Street', address: 'Winnipeg, Manitoba, R2V 2C2, Canada', country: 'CA', kind: 'primary', precision: 'street', lat: 49.949586, lon: -97.1065814 };
  const otherCity = { ...street, id: 'W:3', address: 'Toronto, Ontario, M1B 2K6, Canada' };
  const firstHouse = { ...street, id: 'W:4', name: '333 Main Street', precision: 'address' as const, address: '333 Main Street, Winnipeg, Canada' };
  const secondHouse = { ...firstHouse, id: 'W:5', name: '335 Main Street', address: '335 Main Street, Winnipeg, Canada' };
  expect(uniqueDestinations([street, { ...street, id: 'W:2', lat: 49.8870293, address: 'Winnipeg, Manitoba, R3C 1A3, Canada' }, otherCity, firstHouse, secondHouse])).toEqual([street, otherCity, firstHouse, secondHouse]);
});
