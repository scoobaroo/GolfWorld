import { pgTable, text, jsonb, integer, timestamp } from 'drizzle-orm/pg-core';
import type { Furniture } from '@golfworld/shared';
export const profiles = pgTable('profiles', { id: text('id').primaryKey(), name: text('name').notNull() });
export const lots = pgTable('lots', { id: text('id').primaryKey(), ownerId: text('owner_id').notNull().references(() => profiles.id), items: jsonb('items').$type<Furniture[]>().notNull() });
export const scoreEvents = pgTable('score_events', { id: text('id').primaryKey(), userId: text('user_id').notNull().references(() => profiles.id), courseId: text('course_id').notNull(), strokes: integer('strokes').notNull(), lastClub: text('last_club').notNull(), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull() });
export const inventoryGrants = pgTable('inventory_grants', { id: text('id').primaryKey(), userId: text('user_id').notNull().references(() => profiles.id), sku: text('sku').notNull(), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull() });
