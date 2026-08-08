import { pgTable, uuid, varchar, boolean, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { categoryTypeEnum } from './enums';
import { users } from './users';

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  type: categoryTypeEnum('type').notNull(),
  color: varchar('color', { length: 7 }).default('#000000'),
  icon: varchar('icon', { length: 50 }),
  isDefault: boolean('is_default').default(false).notNull(),
}, (table) => {
  return {
    userIdIdx: index('category_user_id_idx').on(table.userId),
  };
});

export const categoriesRelations = relations(categories, ({ one }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
}));
