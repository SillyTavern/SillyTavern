import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const notebooks = sqliteTable('notebooks', { userId: text('user_id').primaryKey(), data: text('data').notNull(), version: integer('version').notNull().default(0) });
