import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const opsRoleEnum = pgEnum('ops_role', ['ADMIN', 'EDITOR', 'AUDITOR'])

export const bannerStatusEnum = pgEnum('banner_status', [
  'active',
  'hidden',
  'deleted',
])

export const maskingStatusEnum = pgEnum('masking_status', [
  'pending',
  'success',
  'fail',
  'review',
])

export const appealReasonTypeEnum = pgEnum('appeal_reason_type', [
  'privacy',
  'portrait',
  'false_info',
  'other',
])

export const appealStatusEnum = pgEnum('appeal_status', [
  'received',
  'under_review',
  'actioned',
  'rejected',
])

// ─── Tables ───────────────────────────────────────────────────────────────────

export const opsUsers = pgTable('ops_users', {
  id: uuid('id').primaryKey().notNull(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: opsRoleEnum('role').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const banners = pgTable('banners', {
  id: uuid('id').primaryKey().notNull().default(sql`gen_random_uuid()`),
  title: text('title'),
  hashtags: text('hashtags').array().notNull().default(sql`ARRAY[]::text[]`),
  subjectType: text('subject_type'),
  regionText: text('region_text').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
  observedCount: integer('observed_count').notNull().default(1),
  status: bannerStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const images = pgTable('images', {
  id: uuid('id').primaryKey().notNull().default(sql`gen_random_uuid()`),
  bannerId: uuid('banner_id')
    .notNull()
    .references(() => banners.id, { onDelete: 'cascade' }),
  maskedImageUrl: text('masked_image_url').notNull(),
  originalImageUrl: text('original_image_url'),
  maskingStatus: maskingStatusEnum('masking_status').notNull().default('pending'),
  maskingMetadata: jsonb('masking_metadata'),
  phash: text('phash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const bannerObservations = pgTable('banner_observations', {
  id: uuid('id').primaryKey().notNull().default(sql`gen_random_uuid()`),
  bannerId: uuid('banner_id')
    .notNull()
    .references(() => banners.id, { onDelete: 'cascade' }),
  observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
  regionText: text('region_text').notNull(),
  uploaderHash: text('uploader_hash').notNull(),
  sourceImageId: uuid('source_image_id').references(() => images.id, {
    onDelete: 'set null',
  }),
  isDuplicateSubmission: boolean('is_duplicate_submission').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const appeals = pgTable('appeals', {
  id: uuid('id').primaryKey().notNull().default(sql`gen_random_uuid()`),
  bannerId: uuid('banner_id')
    .notNull()
    .references(() => banners.id, { onDelete: 'cascade' }),
  reasonType: appealReasonTypeEnum('reason_type').notNull(),
  reasonDetail: text('reason_detail'),
  status: appealStatusEnum('status').notNull().default('received'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Relations ────────────────────────────────────────────────────────────────

export const bannersRelations = relations(banners, ({ many }) => ({
  images: many(images),
  observations: many(bannerObservations),
}))

export const imagesRelations = relations(images, ({ one }) => ({
  banner: one(banners, {
    fields: [images.bannerId],
    references: [banners.id],
  }),
}))

export const bannerObservationsRelations = relations(bannerObservations, ({ one }) => ({
  banner: one(banners, {
    fields: [bannerObservations.bannerId],
    references: [banners.id],
  }),
  sourceImage: one(images, {
    fields: [bannerObservations.sourceImageId],
    references: [images.id],
  }),
}))
