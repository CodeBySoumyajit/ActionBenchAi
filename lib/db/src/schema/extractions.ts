import { pgTable, text, serial, timestamp, integer, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { judgmentsTable } from "./judgments";

export const extractionsTable = pgTable("extractions", {
  id: serial("id").primaryKey(),
  judgmentId: integer("judgment_id").notNull().references(() => judgmentsTable.id),
  caseTitle: text("case_title"),
  caseNumber: text("case_number"),
  courtName: text("court_name"),
  dateOfOrder: text("date_of_order"),
  bench: text("bench").array(),
  petitionerName: text("petitioner_name"),
  petitionerAdvocate: text("petitioner_advocate"),
  respondentName: text("respondent_name"),
  respondentAdvocate: text("respondent_advocate"),
  keyDirections: jsonb("key_directions").$type<Array<Record<string, unknown>>>().default([]),
  timelines: jsonb("timelines").$type<Array<Record<string, unknown>>>().default([]),
  relevantActs: text("relevant_acts").array(),
  summaryText: text("summary_text"),
  rawExtractedText: text("raw_extracted_text"),
  aiConfidenceScore: real("ai_confidence_score"),
  confidenceNotes: text("confidence_notes"),
  extractionModel: text("extraction_model"),
  ocrUsed: text("ocr_used"),
  extractedAt: timestamp("extracted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertExtractionSchema = createInsertSchema(extractionsTable).omit({ id: true, extractedAt: true });
export type InsertExtraction = z.infer<typeof insertExtractionSchema>;
export type Extraction = typeof extractionsTable.$inferSelect;
