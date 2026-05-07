import { pgTable, text, serial, timestamp, integer, boolean, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { judgmentsTable } from "./judgments";
import { extractionsTable } from "./extractions";

export const priorityLevelEnum = pgEnum("priority_level", ["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const actionPlansTable = pgTable("action_plans", {
  id: serial("id").primaryKey(),
  judgmentId: integer("judgment_id").notNull().references(() => judgmentsTable.id),
  extractionId: integer("extraction_id").references(() => extractionsTable.id),
  complianceRequired: boolean("compliance_required").notNull().default(false),
  complianceRationale: text("compliance_rationale"),
  appealConsideration: boolean("appeal_consideration").notNull().default(false),
  appealRationale: text("appeal_rationale"),
  appealLimitationDays: integer("appeal_limitation_days"),
  appealDeadline: text("appeal_deadline"),
  responsibleDepartments: text("responsible_departments").array(),
  priorityLevel: priorityLevelEnum("priority_level").notNull().default("MEDIUM"),
  priorityRationale: text("priority_rationale"),
  actionItems: jsonb("action_items").$type<Array<Record<string, unknown>>>().default([]),
  natureOfAction: text("nature_of_action"),
  aiRationale: text("ai_rationale"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertActionPlanSchema = createInsertSchema(actionPlansTable).omit({ id: true, generatedAt: true });
export type InsertActionPlan = z.infer<typeof insertActionPlanSchema>;
export type ActionPlan = typeof actionPlansTable.$inferSelect;
