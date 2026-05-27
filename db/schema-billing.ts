import {
  pgTable,
  pgEnum,
  serial,
  varchar,
  timestamp,
  bigint,
  boolean,
} from 'drizzle-orm/pg-core';
import { users } from './schema';

export const planEnum = pgEnum('billing_plan', ['free', 'starter', 'pro']);
export const billingProviderEnum = pgEnum('billing_provider', ['stripe', 'mercadopago']);
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'past_due',
  'canceled',
  'trialing',
]);

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: bigint('userId', { mode: 'number' })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  plan: planEnum('plan').notNull().default('free'),
  provider: billingProviderEnum('provider').notNull(),
  externalId: varchar('externalId', { length: 255 }),
  status: subscriptionStatusEnum('status').notNull().default('active'),
  currentPeriodEnd: timestamp('currentPeriodEnd'),
  trialEndsAt: timestamp('trialEndsAt'),
  cancelAtPeriodEnd: boolean('cancelAtPeriodEnd').default(false),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;
