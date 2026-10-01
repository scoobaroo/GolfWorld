import { describe, it, expect } from 'vitest';
import { LocalFulfillment, catalog } from './index';
describe('local fulfillment port', () => {
  it('uses unique stable SKUs for every starter item', () => {
    expect(new Set(catalog.map((item) => item.sku)).size).toBe(catalog.length);
    expect(catalog.filter((item) => item.slot === 'furniture')).toHaveLength(3);
  });
  it('previews, grants, and enforces ownership when revoking', async () => {
    const adapter = new LocalFulfillment();
    expect((await adapter.preview('club.driver.basic')).slot).toBe('club');
    const grant = await adapter.grant('guest-1', 'phone.skin.meadow');
    await adapter.revoke('guest-2', grant.id);
    expect(adapter.grants.has(grant.id)).toBe(true);
    await adapter.revoke('guest-1', grant.id);
    expect(adapter.grants.has(grant.id)).toBe(false);
  });
});
