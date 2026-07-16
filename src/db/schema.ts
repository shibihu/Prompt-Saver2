import { pgTable, serial, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(), // email
  password: text('password').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const prompts = pgTable('prompts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  tags: text('tags'), // category
  createdAt: timestamp('created_at').defaultNow(),
  isPinned: integer('is_pinned').default(0),
  useCount: integer('use_count').default(0),
  folder: text('folder'),
});

export const usersRelations = relations(users, ({ many }) => ({
  prompts: many(prompts),
}));

export const promptsRelations = relations(prompts, ({ one }) => ({
  user: one(users, {
    fields: [prompts.userId],
    references: [users.id],
  }),
}));
