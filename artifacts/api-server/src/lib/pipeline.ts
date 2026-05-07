import path from "path";
import fs from "fs/promises";
import { db, judgmentsTable, extractionsTable, actionPlansTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logger } from "./logger";

const EXTRACTION_SYSTEM_PROMPT = `You are a legal document analysis AI for the Indian government's Court Case Monitoring System. 
Analyze the court judgment text provided and extract structured data.

This is an Indian High Court judgment. Common patterns:
- Case numbers: W.P., W.A., O.S., Crl., CMA formats
- Dates in DD.MM.YYYY or DD/MM/YYYY format
- Directives often preceded by "It is hereby directed", "The respondent shall", "Liberty is granted"
- Limitation periods under Limitation Act 1963: typically 90 days for High Court appeals
- Government respondents are often referred to as "State", "Union of India", department names
Extract with high precision. If unsure, mark confidenceScore below 0.7 and explain in confidenceNotes.

Return ONLY valid JSON with this exact schema:
{
  "caseTitle": "",
  "caseNumber": "",
  "courtName": "",
  "dateOfOrder": "YYYY-MM-DD or null",
  "bench": [],
  "petitioner": { "name": "", "advocate": "" },
  "respondent": { "name": "", "advocate": "" },
  "keyDirections": [
    { "directive": "", "pageHint": "", "confidenceScore": 0.0, "isExplicit": true }
  ],
  "timelines": [
    { "event": "", "date": "YYYY-MM-DD or null", "isInferred": false, "inferenceReason": "" }
  ],
  "relevantActs": [],
  "summaryText": "",
  "overallConfidenceScore": 0.0,
  "confidenceNotes": ""
}`;

const ACTION_PLAN_SYSTEM_PROMPT = `Based on this court judgment extraction for an Indian government department, generate an actionable compliance plan.

Return ONLY valid JSON:
{
  "complianceRequired": true,
  "complianceRationale": "",
  "appealConsideration": false,
  "appealRationale": "",
  "appealLimitationDays": 90,
  "appealDeadline": "YYYY-MM-DD or null",
  "priorityLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "priorityRationale": "",
  "responsibleDepartments": [],
  "natureOfAction": "",
  "actionItems": [
    { "action": "", "owner": "", "dueDate": "YYYY-MM-DD or null", "isInferred": false, "urgency": "LOW|MEDIUM|HIGH" }
  ],
  "aiRationale": ""
}`;

async function extractPdfText(pdfPath: string): Promise<{ text: string; ocrUsed: string }> {
  try {
    const pdfParse = await import("pdf-parse");
    const buffer = await fs.readFile(pdfPath);
    const data = await pdfParse.default(buffer);
    if (data.text && data.text.trim().length > 100) {
      return { text: data.text, ocrUsed: "pdf-parse" };
    }
    return { text: data.text || "", ocrUsed: "pdf-parse-low-quality" };
  } catch (err) {
    logger.error({ err, pdfPath }, "PDF extraction failed");
    throw new Error("PDF text extraction failed");
  }
}

function chunkText(text: string, maxChars = 80000): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n\n[Document truncated for processing...]";
}

async function callClaudeWithRetry(messages: Array<{ role: "user" | "assistant"; content: string }>, system: string): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system,
        messages,
      });
      const block = response.content[0];
      return block.type === "text" ? block.text : "";
    } catch (err: unknown) {
      lastErr = err;
      const errMsg = String(err);
      if (errMsg.includes("429") || errMsg.toLowerCase().includes("rate")) {
        logger.warn({ attempt }, "Claude rate limited, retrying...");
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

function parseJsonFromResponse(raw: string): Record<string, unknown> {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");
  return JSON.parse(jsonMatch[0]);
}

export async function runProcessingPipeline(judgmentId: number): Promise<void> {
  logger.info({ judgmentId }, "Starting processing pipeline");

  const [judgment] = await db.select().from(judgmentsTable).where(eq(judgmentsTable.id, judgmentId));
  if (!judgment) throw new Error(`Judgment ${judgmentId} not found`);

  await db.update(judgmentsTable).set({ status: "PROCESSING" }).where(eq(judgmentsTable.id, judgmentId));

  try {
    // Step 1: Extract PDF text
    const { text, ocrUsed } = await extractPdfText(judgment.pdfPath);
    const chunkedText = chunkText(text);

    // Step 2: AI Extraction
    const extractionRaw = await callClaudeWithRetry(
      [{ role: "user", content: `Extract structured data from this court judgment:\n\n${chunkedText}` }],
      EXTRACTION_SYSTEM_PROMPT
    );

    let extractionData: Record<string, unknown>;
    try {
      extractionData = parseJsonFromResponse(extractionRaw);
    } catch {
      throw new Error("Failed to parse extraction JSON from Claude");
    }

    const petitioner = extractionData.petitioner as Record<string, string> | undefined;
    const respondent = extractionData.respondent as Record<string, string> | undefined;

    const [extraction] = await db.insert(extractionsTable).values({
      judgmentId,
      caseTitle: String(extractionData.caseTitle ?? ""),
      caseNumber: String(extractionData.caseNumber ?? judgment.caseNumber ?? ""),
      courtName: String(extractionData.courtName ?? judgment.courtName ?? ""),
      dateOfOrder: extractionData.dateOfOrder ? String(extractionData.dateOfOrder) : null,
      bench: Array.isArray(extractionData.bench) ? extractionData.bench.map(String) : [],
      petitionerName: petitioner?.name ?? null,
      petitionerAdvocate: petitioner?.advocate ?? null,
      respondentName: respondent?.name ?? null,
      respondentAdvocate: respondent?.advocate ?? null,
      keyDirections: (extractionData.keyDirections as Array<Record<string, unknown>>) ?? [],
      timelines: (extractionData.timelines as Array<Record<string, unknown>>) ?? [],
      relevantActs: Array.isArray(extractionData.relevantActs) ? extractionData.relevantActs.map(String) : [],
      summaryText: extractionData.summaryText ? String(extractionData.summaryText) : null,
      rawExtractedText: text.slice(0, 10000),
      aiConfidenceScore: typeof extractionData.overallConfidenceScore === "number" ? extractionData.overallConfidenceScore : null,
      confidenceNotes: extractionData.confidenceNotes ? String(extractionData.confidenceNotes) : null,
      extractionModel: "claude-sonnet-4-6",
      ocrUsed,
    }).returning();

    // Step 3: Action Plan Generation
    const actionPlanRaw = await callClaudeWithRetry(
      [{ role: "user", content: `Generate an action plan for this court judgment extraction:\n\n${JSON.stringify(extractionData, null, 2)}` }],
      ACTION_PLAN_SYSTEM_PROMPT
    );

    let actionPlanData: Record<string, unknown>;
    try {
      actionPlanData = parseJsonFromResponse(actionPlanRaw);
    } catch {
      throw new Error("Failed to parse action plan JSON from Claude");
    }

    await db.insert(actionPlansTable).values({
      judgmentId,
      extractionId: extraction.id,
      complianceRequired: Boolean(actionPlanData.complianceRequired),
      complianceRationale: actionPlanData.complianceRationale ? String(actionPlanData.complianceRationale) : null,
      appealConsideration: Boolean(actionPlanData.appealConsideration),
      appealRationale: actionPlanData.appealRationale ? String(actionPlanData.appealRationale) : null,
      appealLimitationDays: typeof actionPlanData.appealLimitationDays === "number" ? actionPlanData.appealLimitationDays : 90,
      appealDeadline: actionPlanData.appealDeadline ? String(actionPlanData.appealDeadline) : null,
      responsibleDepartments: Array.isArray(actionPlanData.responsibleDepartments) ? actionPlanData.responsibleDepartments.map(String) : [],
      priorityLevel: (["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(String(actionPlanData.priorityLevel))
        ? actionPlanData.priorityLevel as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
        : "MEDIUM"),
      priorityRationale: actionPlanData.priorityRationale ? String(actionPlanData.priorityRationale) : null,
      actionItems: (actionPlanData.actionItems as Array<Record<string, unknown>>) ?? [],
      natureOfAction: actionPlanData.natureOfAction ? String(actionPlanData.natureOfAction) : null,
      aiRationale: actionPlanData.aiRationale ? String(actionPlanData.aiRationale) : null,
    });

    await db.update(judgmentsTable).set({ status: "EXTRACTED" }).where(eq(judgmentsTable.id, judgmentId));
    logger.info({ judgmentId }, "Processing pipeline complete");

  } catch (err) {
    logger.error({ err, judgmentId }, "Processing pipeline failed");
    await db.update(judgmentsTable)
      .set({ status: "EXTRACTION_FAILED", errorMessage: String(err) })
      .where(eq(judgmentsTable.id, judgmentId));
    throw err;
  }
}
