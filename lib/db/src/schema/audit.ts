import {
  pgTable,
  text,
  serial,
  integer,
  real,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const auditStatusEnum = pgEnum("audit_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const deploymentTypeEnum = pgEnum("deployment_type", [
  "server",
  "datacenter",
  "cloud",
  "unknown",
]);

export const findingCategoryEnum = pgEnum("finding_category", [
  "system_info",
  "plugins",
  "custom_fields",
  "workflows",
  "permissions",
  "users",
  "data_volume",
  "automation",
  "projects",
]);

export const findingSeverityEnum = pgEnum("finding_severity", [
  "blocker",
  "warning",
  "info",
]);

export const auditSessionsTable = pgTable("audit_sessions", {
  id: serial("id").primaryKey(),
  label: text("label"),
  jiraUrl: text("jira_url").notNull(),
  username: text("username").notNull(),
  encryptedPassword: text("encrypted_password").notNull(),
  jiraVersion: text("jira_version"),
  serverTitle: text("server_title"),
  deploymentType: deploymentTypeEnum("deployment_type").default("unknown"),
  status: auditStatusEnum("status").default("pending").notNull(),
  readinessScore: real("readiness_score"),
  blockerCount: integer("blocker_count").default(0),
  warningCount: integer("warning_count").default(0),
  infoCount: integer("info_count").default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const auditFindingsTable = pgTable("audit_findings", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => auditSessionsTable.id, { onDelete: "cascade" }),
  category: findingCategoryEnum("category").notNull(),
  severity: findingSeverityEnum("severity").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  count: integer("count"),
  details: text("details"),
  migrationNote: text("migration_note"),
});

export const insertAuditSessionSchema = createInsertSchema(
  auditSessionsTable,
).omit({ id: true, createdAt: true, completedAt: true });

export const insertAuditFindingSchema = createInsertSchema(
  auditFindingsTable,
).omit({ id: true });

export type AuditSession = typeof auditSessionsTable.$inferSelect;
export type InsertAuditSession = z.infer<typeof insertAuditSessionSchema>;
export type AuditFinding = typeof auditFindingsTable.$inferSelect;
export type InsertAuditFinding = z.infer<typeof insertAuditFindingSchema>;
