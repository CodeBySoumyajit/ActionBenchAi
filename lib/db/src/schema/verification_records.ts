import { pgTable, text, serial, timestamp, integer, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { judgmentsTable } from "./judgments";
import { usersTable } from "./users";

export const verificationStatusEnum = pgEnum("verification_status", ["APPROVED", "EDITED", "REJECTED"]);

export const verificationRecordsTable = pgTable("verification_records", {
  id: serial("id").primaryKey(),
  judgmentId: integer("judgment_id").notNull().references(() => judgmentsTable.id),
  extractionId: integer("extraction_id"),
  actionPlanId: integer("action_plan_id"),
  reviewedBy: integer("reviewed_by").notNull().references(() => usersTable.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
  status: verificationStatusEnum("status").notNull(),
  reviewerNotes: text("reviewer_notes"),
  editedExtraction: jsonb("edited_extraction").$type<Record<string, unknown>>(),
  editedActionPlan: jsonb("edited_action_plan").$type<Record<string, unknown>>(),
});

export const insertVerificationSchema = createInsertSchema(verificationRecordsTable).omit({ id: true, reviewedAt: true });
export type InsertVerification = z.infer<typeof insertVerificationSchema>;
export type VerificationRecord = typeof verificationRecordsTable.$inferSelect;
