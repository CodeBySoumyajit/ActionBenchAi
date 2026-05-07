import { Router, type IRouter } from "express";
import { db, dashboardEntriesTable, judgmentsTable, extractionsTable, actionPlansTable } from "@workspace/db";
import { eq, desc, and, gte, lte, ilike, SQL, or } from "drizzle-orm";
import { GetDashboardEntriesQueryParams, GetDashboardEntryParams, UpdateDashboardEntryStatusBody, UpdateDashboardEntryStatusParams } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

function serializeEntry(e: typeof dashboardEntriesTable.$inferSelect) {
  return {
    ...e,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

router.get("/dashboard/entries", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetDashboardEntriesQueryParams.safeParse(req.query);
  const page = parsed.success ? (parsed.data.page ?? 1) : 1;
  const limit = parsed.success ? (parsed.data.limit ?? 50) : 50;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (parsed.success) {
    const { department, priority, status, dateFrom, dateTo, search } = parsed.data;
    if (department) conditions.push(eq(dashboardEntriesTable.department, department));
    if (priority) conditions.push(eq(dashboardEntriesTable.priorityLevel, priority));
    if (status) conditions.push(eq(dashboardEntriesTable.status, status as "ACTIVE" | "COMPLIED" | "APPEALED" | "CLOSED"));
    if (search) {
      conditions.push(
        or(
          ilike(dashboardEntriesTable.caseNumber, `%${search}%`),
          ilike(dashboardEntriesTable.caseTitle, `%${search}%`),
          ilike(dashboardEntriesTable.courtName, `%${search}%`)
        ) as SQL
      );
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, all] = await Promise.all([
    db.select().from(dashboardEntriesTable).where(where).orderBy(desc(dashboardEntriesTable.createdAt)).limit(limit).offset(offset),
    db.select({ id: dashboardEntriesTable.id }).from(dashboardEntriesTable).where(where),
  ]);

  res.json({ entries: rows.map(serializeEntry), total: all.length, page, limit });
});

router.get("/dashboard/stats", requireAuth, async (req, res): Promise<void> => {
  const [entries, judgments] = await Promise.all([
    db.select().from(dashboardEntriesTable),
    db.select().from(judgmentsTable),
  ]);

  const byPriority: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  const byDepartment: Record<string, number> = {};
  const byStatus: Record<string, number> = { ACTIVE: 0, COMPLIED: 0, APPEALED: 0, CLOSED: 0 };

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const upcomingDeadlines: Record<string, unknown>[] = [];
  const recentActivity: Record<string, unknown>[] = [];

  for (const e of entries) {
    byPriority[e.priorityLevel] = (byPriority[e.priorityLevel] ?? 0) + 1;
    byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
    if (e.department) byDepartment[e.department] = (byDepartment[e.department] ?? 0) + 1;
    if (e.appealDeadline) {
      const d = new Date(e.appealDeadline);
      if (d >= now && d <= in30Days) {
        const daysLeft = Math.ceil((d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        upcomingDeadlines.push({ id: e.id, caseNumber: e.caseNumber, caseTitle: e.caseTitle, deadline: e.appealDeadline, daysLeft, priorityLevel: e.priorityLevel });
      }
    }
  }

  const recentEntries = [...entries].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5);
  for (const e of recentEntries) {
    recentActivity.push({ id: e.id, caseNumber: e.caseNumber, caseTitle: e.caseTitle, priorityLevel: e.priorityLevel, createdAt: e.createdAt.toISOString(), status: e.status });
  }

  const pendingVerification = judgments.filter(j => j.status === "EXTRACTED").length;
  const processingCount = judgments.filter(j => j.status === "PROCESSING" || j.status === "PENDING").length;

  res.json({
    total: entries.length,
    byPriority,
    byDepartment,
    byStatus,
    upcomingDeadlines: upcomingDeadlines.sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(a.daysLeft) - Number(b.daysLeft)),
    pendingVerification,
    processingCount,
    recentActivity,
  });
});

router.get("/dashboard/entries/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [entry] = await db.select().from(dashboardEntriesTable).where(eq(dashboardEntriesTable.id, id));
  if (!entry) { res.status(404).json({ error: "Not found" }); return; }

  res.json(serializeEntry(entry));
});

router.patch("/dashboard/entries/:id/status", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateDashboardEntryStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [entry] = await db.update(dashboardEntriesTable)
    .set({ status: parsed.data.status as "ACTIVE" | "COMPLIED" | "APPEALED" | "CLOSED" })
    .where(eq(dashboardEntriesTable.id, id))
    .returning();

  if (!entry) { res.status(404).json({ error: "Not found" }); return; }

  res.json(serializeEntry(entry));
});

export default router;
