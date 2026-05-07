import { pgTable, text, serial, timestamp, integer, boolean, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { judgmentsTable } from "./judgments";
import { verificationRecordsTable } from "./verification_records";

export const dashboardStatusEnum = pgEnum("dashboard_status", ["ACTIVE", "COMPLIED", "APPEALED", "CLOSED"]);

export const dashboardEntriesTable = pgTable("dashboard_entries", {
  id: serial("id").primaryKey(),
  verificationId: integer("verification_id").notNull().references(() => verificationRecordsTable.id),
  judgmentId: integer("judgment_id").notNull().references(() => judgmentsTable.id),
  department: text("department"),
  caseNumber: text("case_number"),
  caseTitle: text("case_title"),
  courtName: text("court_name"),
  dateOfOrder: text("date_of_order"),
  priorityLevel: text("priority_level").notNull().default("MEDIUM"),
  complianceRequired: boolean("compliance_required").notNull().default(false),
  appealConsidering: boolean("appeal_considering").notNull().default(false),
  appealDeadline: text("appeal_deadline"),
  keyActions: jsonb("key_actions").$type<Array<Record<string, unknown>>>().default([]),
  importantDates: jsonb("important_dates").$type<Array<Record<string, unknown>>>().default([]),
  status: dashboardStatusEnum("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDashboardEntrySchema = createInsertSchema(dashboardEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDashboardEntry = z.infer<typeof insertDashboardEntrySchema>;
export type DashboardEntry = typeof dashboardEntriesTable.$inferSelect;
