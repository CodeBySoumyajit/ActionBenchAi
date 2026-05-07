import { pgTable, text, serial, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const judgmentStatusEnum = pgEnum("judgment_status", [
  "PENDING",
  "PROCESSING",
  "EXTRACTED",
  "VERIFIED",
  "REJECTED",
  "EXTRACTION_FAILED",
]);

export const judgmentsTable = pgTable("judgments", {
  id: serial("id").primaryKey(),
  caseNumber: text("case_number"),
  courtName: text("court_name"),
  pdfPath: text("pdf_path").notNull(),
  pdfOriginalName: text("pdf_original_name"),
  uploadedBy: integer("uploaded_by").notNull().references(() => usersTable.id),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  status: judgmentStatusEnum("status").notNull().default("PENDING"),
  errorMessage: text("error_message"),
});

export const insertJudgmentSchema = createInsertSchema(judgmentsTable).omit({ id: true, uploadedAt: true });
export type InsertJudgment = z.infer<typeof insertJudgmentSchema>;
export type Judgment = typeof judgmentsTable.$inferSelect;
