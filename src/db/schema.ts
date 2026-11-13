import { pgTable, pgEnum, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const STATUSES = ["wishlist", "applied", "assessment", "interview", "offer", "rejected", "ghosted", "withdrawn"] as const;
export const SOURCES = ["jobthai", "jobsdb", "jobbkk", "linkedin", "company_site", "referral", "other"] as const;
export const EVENT_TYPES = ["applied", "viewed", "assessment", "interview", "offer", "rejected", "note"] as const;

export const status = pgEnum("status", STATUSES);
export const source = pgEnum("source", SOURCES);
export const eventType = pgEnum("event_type", EVENT_TYPES);
export const processState = pgEnum("process_state", ["pending", "matched", "needs_review", "ignored"]);

// ponytail: userId = login email, single user; swap to a users table when going multi-user
export const applications = pgTable("applications", {
  id: uuid().primaryKey().defaultRandom(),
  userId: text().notNull(),
  company: text().notNull(),
  companyAliases: text().array().notNull().default([]),
  position: text().notNull(),
  source: source().notNull().default("other"),
  jobUrl: text(),
  location: text(),
  salaryText: text(),
  status: status().notNull().default("applied"),
  appliedAt: timestamp({ withTimezone: true }),
  lastActivityAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  notes: text(),
});

export const emails = pgTable("emails", {
  id: uuid().primaryKey().defaultRandom(),
  userId: text().notNull(),
  gmailMessageId: text().notNull().unique(),
  from: text().notNull(),
  subject: text().notNull(),
  receivedAt: timestamp({ withTimezone: true }).notNull(),
  processState: processState().notNull().default("pending"),
  parsedJson: jsonb(),
});

export const events = pgTable("events", {
  id: uuid().primaryKey().defaultRandom(),
  applicationId: uuid().notNull().references(() => applications.id, { onDelete: "cascade" }),
  type: eventType().notNull(),
  occurredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  summary: text().notNull(),
  emailId: uuid().references(() => emails.id),
  scheduledAt: timestamp({ withTimezone: true }),
});

export type Application = typeof applications.$inferSelect;

export const SILENT_DAYS = 14;
export const isSilent = (a: Pick<Application, "status" | "lastActivityAt">) =>
  ["applied", "assessment", "interview"].includes(a.status) && Date.now() - new Date(a.lastActivityAt).getTime() > SILENT_DAYS * 864e5;
