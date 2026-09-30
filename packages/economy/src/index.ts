import type { FurnitureSku } from '@golfworld/shared';

export type ItemSku = FurnitureSku | 'club.driver.basic' | 'club.iron7.basic' | 'club.putter.basic' | 'phone.skin.meadow';
export interface CatalogItem { sku: ItemSku; name: string; slot: 'club' | 'furniture' | 'phone_skin'; cosmetic: boolean; fulfillment: 'local'; price: number; }
export const catalog: readonly CatalogItem[] = [
  { sku: 'club.driver.basic', name: 'Meadow Driver', slot: 'club', cosmetic: false, fulfillment: 'local', price: 0 },
  { sku: 'club.iron7.basic', name: 'Meadow 7-iron', slot: 'club', cosmetic: false, fulfillment: 'local', price: 0 },
  { sku: 'club.putter.basic', name: 'Meadow Putter', slot: 'club', cosmetic: false, fulfillment: 'local', price: 0 },
  { sku: 'furn.chair.midcentury', name: 'Oak chair', slot: 'furniture', cosmetic: true, fulfillment: 'local', price: 0 },
  { sku: 'furn.table.round', name: 'Garden table', slot: 'furniture', cosmetic: true, fulfillment: 'local', price: 0 },
  { sku: 'furn.planter.fern', name: 'Fern planter', slot: 'furniture', cosmetic: true, fulfillment: 'local', price: 0 },
  { sku: 'phone.skin.meadow', name: 'Meadow phone skin', slot: 'phone_skin', cosmetic: true, fulfillment: 'local', price: 0 },
];
export interface InventoryGrant { id: string; userId: string; sku: ItemSku; grantedAt: string; }
export interface FulfillmentAdapter {
  preview(sku: ItemSku): Promise<CatalogItem>;
  grant(userId: string, sku: ItemSku): Promise<InventoryGrant>;
  revoke(userId: string, grantId: string): Promise<void>;
}
export class LocalFulfillment implements FulfillmentAdapter {
  // TODO: replace this development store with Drizzle inventory rows; keep the port stable.
  readonly grants = new Map<string, InventoryGrant>();
  async preview(sku: ItemSku): Promise<CatalogItem> {
    const item = catalog.find((entry) => entry.sku === sku);
    if (!item) throw new Error('Unknown SKU');
    return item;
  }
  async grant(userId: string, sku: ItemSku): Promise<InventoryGrant> {
    await this.preview(sku);
    const grant = { id: crypto.randomUUID(), userId, sku, grantedAt: new Date().toISOString() };
    this.grants.set(grant.id, grant);
    return grant;
  }
  async revoke(userId: string, grantId: string): Promise<void> {
    if (this.grants.get(grantId)?.userId === userId) this.grants.delete(grantId);
  }
}
