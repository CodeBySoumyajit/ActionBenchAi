import { Router, type IRouter } from "express";
import { db, judgmentsTable, extractionsTable, actionPlansTable, verificationRecordsTable, dashboardEntriesTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { EditJudgmentBody, EditJudgmentParams, RejectJudgmentBody, RejectJudgmentParams, ApproveJudgmentParams, GetVerifyDetailParams } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../lib/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/verify/queue", requireAuth, requireRole("REVIEWER", "UPLOADER"), async (req, res): Promise<void> => {
  const extracted = await db.select({
    id: judgmentsTable.id,
    caseNumber: judgmentsTable.caseNumber,
    courtName: judgmentsTable.courtName,
    uploadedAt: judgmentsTable.uploadedAt,
    status: judgmentsTable.status,
    uploadedBy: judgmentsTable.uploadedBy,
  })
    .from(judgmentsTable)
    .where(eq(judgmentsTable.status, "EXTRACTED"))
    .orderBy(desc(judgmentsTable.uploadedAt));

  const results = await Promise.all(
    extracted.map(async (j) => {
      const [extraction] = await db.select({ caseTitle: extractionsTable.caseTitle, aiConfidenceScore: extractionsTable.aiConfidenceScore })
        .from(extractionsTable).where(eq(extractionsTable.judgmentId, j.id));
      const [uploader] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, j.uploadedBy));
      return {
        id: j.id,
        caseNumber: j.caseNumber,
        courtName: j.courtName,
        uploadedAt: j.uploadedAt.toISOString(),
        status: j.status,
        aiConfidenceScore: extraction?.aiConfidenceScore ?? null,
        caseTitle: extraction?.caseTitle ?? null,
        uploadedByName: uploader?.name ?? null,
      };
    })
  );

  res.json(results);
});

router.get("/verify/:judgmentId", requireAuth, requireRole("REVIEWER", "UPLOADER"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.judgmentId) ? req.params.judgmentId[0] : req.params.judgmentId;
  const judgmentId = parseInt(raw, 10);
  if (isNaN(judgmentId)) { res.status(400).json({ error: "Invalid judgmentId" }); return; }

  const [judgment] = await db.select().from(judgmentsTable).where(eq(judgmentsTable.id, judgmentId));
  if (!judgment) { res.status(404).json({ error: "Not found" }); return; }

  const [extraction] = await db.select().from(extractionsTable).where(eq(extractionsTable.judgmentId, judgmentId));
  const [actionPlan] = await db.select().from(actionPlansTable).where(eq(actionPlansTable.judgmentId, judgmentId));

  res.json({
    judgment: { ...judgment, uploadedAt: judgment.uploadedAt.toISOString() },
    extraction: extraction ? { ...extraction, extractedAt: extraction.extractedAt.toISOString() } : undefined,
    actionPlan: actionPlan ? { ...actionPlan, generatedAt: actionPlan.generatedAt.toISOString() } : undefined,
    pdfUrl: `/api/judgments/${judgmentId}/pdf`,
  });
});

async function createDashboardEntry(judgmentId: number, verificationId: number, extraction: Record<string, unknown> | null, actionPlan: Record<string, unknown> | null): Promise<void> {
  const e = extraction as Record<string, unknown> | null;
  const a = actionPlan as Record<string, unknown> | null;

  const keyActions = Array.isArray(a?.actionItems) ? a.actionItems : [];
  const importantDates: Record<string, unknown>[] = [];
  if (a?.appealDeadline) importantDates.push({ label: "Appeal Deadline", date: a.appealDeadline });
  if (e?.dateOfOrder) importantDates.push({ label: "Date of Order", date: e.dateOfOrder });

  const depts = Array.isArray(a?.responsibleDepartments) ? a.responsibleDepartments : [];
  const dept = depts.length > 0 ? String(depts[0]) : null;

  await db.insert(dashboardEntriesTable).values({
    verificationId,
    judgmentId,
    department: dept,
    caseNumber: e?.caseNumber ? String(e.caseNumber) : null,
    caseTitle: e?.caseTitle ? String(e.caseTitle) : null,
    courtName: e?.courtName ? String(e.courtName) : null,
    dateOfOrder: e?.dateOfOrder ? String(e.dateOfOrder) : null,
    priorityLevel: String(a?.priorityLevel ?? "MEDIUM"),
    complianceRequired: Boolean(a?.complianceRequired),
    appealConsidering: Boolean(a?.appealConsideration),
    appealDeadline: a?.appealDeadline ? String(a.appealDeadline) : null,
    keyActions,
    importantDates,
    status: "ACTIVE",
  });
}

router.post("/verify/:judgmentId/approve", requireAuth, requireRole("REVIEWER"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.judgmentId) ? req.params.judgmentId[0] : req.params.judgmentId;
  const judgmentId = parseInt(raw, 10);
  if (isNaN(judgmentId)) { res.status(400).json({ error: "Invalid judgmentId" }); return; }

  const [judgment] = await db.select().from(judgmentsTable).where(eq(judgmentsTable.id, judgmentId));
  if (!judgment) { res.status(404).json({ error: "Not found" }); return; }

  const [extraction] = await db.select().from(extractionsTable).where(eq(extractionsTable.judgmentId, judgmentId));
  const [actionPlan] = await db.select().from(actionPlansTable).where(eq(actionPlansTable.judgmentId, judgmentId));

  const [record] = await db.insert(verificationRecordsTable).values({
    judgmentId,
    extractionId: extraction?.id ?? null,
    actionPlanId: actionPlan?.id ?? null,
    reviewedBy: req.user!.userId,
    status: "APPROVED",
    reviewerNotes: null,
  }).returning();

  await db.update(judgmentsTable).set({ status: "VERIFIED" }).where(eq(judgmentsTable.id, judgmentId));

  await createDashboardEntry(judgmentId, record.id, extraction as unknown as Record<string, unknown>, actionPlan as unknown as Record<string, unknown>);

  res.json({ ...record, reviewedAt: record.reviewedAt.toISOString() });
});

router.post("/verify/:judgmentId/edit", requireAuth, requireRole("REVIEWER"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.judgmentId) ? req.params.judgmentId[0] : req.params.judgmentId;
  const judgmentId = parseInt(raw, 10);
  if (isNaN(judgmentId)) { res.status(400).json({ error: "Invalid judgmentId" }); return; }

  const parsed = EditJudgmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [judgment] = await db.select().from(judgmentsTable).where(eq(judgmentsTable.id, judgmentId));
  if (!judgment) { res.status(404).json({ error: "Not found" }); return; }

  const [extraction] = await db.select().from(extractionsTable).where(eq(extractionsTable.judgmentId, judgmentId));
  const [actionPlan] = await db.select().from(actionPlansTable).where(eq(actionPlansTable.judgmentId, judgmentId));

  const [record] = await db.insert(verificationRecordsTable).values({
    judgmentId,
    extractionId: extraction?.id ?? null,
    actionPlanId: actionPlan?.id ?? null,
    reviewedBy: req.user!.userId,
    status: "EDITED",
    reviewerNotes: parsed.data.reviewerNotes ?? null,
    editedExtraction: parsed.data.editedExtraction as Record<string, unknown>,
    editedActionPlan: parsed.data.editedActionPlan as Record<string, unknown>,
  }).returning();

  await db.update(judgmentsTable).set({ status: "VERIFIED" }).where(eq(judgmentsTable.id, judgmentId));

  await createDashboardEntry(
    judgmentId,
    record.id,
    { ...(extraction ?? {}), ...parsed.data.editedExtraction } as Record<string, unknown>,
    { ...(actionPlan ?? {}), ...parsed.data.editedActionPlan } as Record<string, unknown>
  );

  res.json({ ...record, reviewedAt: record.reviewedAt.toISOString() });
});

router.post("/verify/:judgmentId/reject", requireAuth, requireRole("REVIEWER"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.judgmentId) ? req.params.judgmentId[0] : req.params.judgmentId;
  const judgmentId = parseInt(raw, 10);
  if (isNaN(judgmentId)) { res.status(400).json({ error: "Invalid judgmentId" }); return; }

  const parsed = RejectJudgmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [judgment] = await db.select().from(judgmentsTable).where(eq(judgmentsTable.id, judgmentId));
  if (!judgment) { res.status(404).json({ error: "Not found" }); return; }

  const [extraction] = await db.select().from(extractionsTable).where(eq(extractionsTable.judgmentId, judgmentId));
  const [actionPlan] = await db.select().from(actionPlansTable).where(eq(actionPlansTable.judgmentId, judgmentId));

  const [record] = await db.insert(verificationRecordsTable).values({
    judgmentId,
    extractionId: extraction?.id ?? null,
    actionPlanId: actionPlan?.id ?? null,
    reviewedBy: req.user!.userId,
    status: "REJECTED",
    reviewerNotes: parsed.data.reviewerNotes,
  }).returning();

  await db.update(judgmentsTable).set({ status: "REJECTED" }).where(eq(judgmentsTable.id, judgmentId));

  res.json({ ...record, reviewedAt: record.reviewedAt.toISOString() });
});

export default router;
