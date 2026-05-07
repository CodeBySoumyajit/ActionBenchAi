import { Router, type IRouter } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { db, judgmentsTable, extractionsTable, actionPlansTable, usersTable } from "@workspace/db";
import { eq, desc, and, like, SQL } from "drizzle-orm";
import { ListJudgmentsQueryParams, GetJudgmentParams, RetryJudgmentParams } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../lib/auth";
import { runProcessingPipeline } from "../lib/pipeline";
import { logger } from "../lib/logger";

const UPLOADS_DIR = path.resolve("uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"));
  },
});

const router: IRouter = Router();

router.get("/judgments", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListJudgmentsQueryParams.safeParse(req.query);
  const page = parsed.success ? (parsed.data.page ?? 1) : 1;
  const limit = parsed.success ? (parsed.data.limit ?? 20) : 20;
  const statusFilter = parsed.success ? parsed.data.status : undefined;

  const conditions: SQL[] = [];
  if (statusFilter) {
    conditions.push(eq(judgmentsTable.status, statusFilter as "PENDING" | "PROCESSING" | "EXTRACTED" | "VERIFIED" | "REJECTED" | "EXTRACTION_FAILED"));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (page - 1) * limit;

  const [rows, totalRows] = await Promise.all([
    db.select().from(judgmentsTable)
      .where(whereClause)
      .orderBy(desc(judgmentsTable.uploadedAt))
      .limit(limit)
      .offset(offset),
    db.select({ id: judgmentsTable.id }).from(judgmentsTable).where(whereClause),
  ]);

  res.json({
    judgments: rows.map(j => ({
      ...j,
      uploadedAt: j.uploadedAt.toISOString(),
    })),
    total: totalRows.length,
    page,
    limit,
  });
});

router.post("/judgments/upload", requireAuth, requireRole("UPLOADER", "REVIEWER"), (req, res, next) => {
  upload.single("file")(req, res, async (err) => {
    if (err) {
      if (err.message?.includes("size")) {
        res.status(400).json({ error: "File too large. Maximum size is 50MB." });
      } else {
        res.status(400).json({ error: err.message || "Upload failed" });
      }
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const { caseNumber, courtName } = req.body as { caseNumber?: string; courtName?: string };

    try {
      const [judgment] = await db.insert(judgmentsTable).values({
        caseNumber: caseNumber || null,
        courtName: courtName || null,
        pdfPath: req.file.path,
        pdfOriginalName: req.file.originalname,
        uploadedBy: req.user!.userId,
        status: "PENDING",
      }).returning();

      // Trigger async processing (don't await)
      runProcessingPipeline(judgment.id).catch((pipelineErr) => {
        logger.error({ err: pipelineErr, judgmentId: judgment.id }, "Pipeline failed");
      });

      res.status(201).json({
        ...judgment,
        uploadedAt: judgment.uploadedAt.toISOString(),
      });
    } catch (insertErr) {
      logger.error({ err: insertErr }, "Failed to insert judgment");
      next(insertErr);
    }
  });
});

router.get("/judgments/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [judgment] = await db.select().from(judgmentsTable).where(eq(judgmentsTable.id, id));
  if (!judgment) { res.status(404).json({ error: "Not found" }); return; }

  const [extraction] = await db.select().from(extractionsTable).where(eq(extractionsTable.judgmentId, id));
  const [actionPlan] = await db.select().from(actionPlansTable).where(eq(actionPlansTable.judgmentId, id));
  const [uploader] = await db.select().from(usersTable).where(eq(usersTable.id, judgment.uploadedBy));

  res.json({
    judgment: { ...judgment, uploadedAt: judgment.uploadedAt.toISOString() },
    extraction: extraction ? { ...extraction, extractedAt: extraction.extractedAt.toISOString() } : undefined,
    actionPlan: actionPlan ? { ...actionPlan, generatedAt: actionPlan.generatedAt.toISOString() } : undefined,
    uploadedByUser: uploader ? { id: uploader.id, name: uploader.name, email: uploader.email, role: uploader.role, department: uploader.department, createdAt: uploader.createdAt.toISOString() } : undefined,
  });
});

router.get("/judgments/:id/pdf", async (req, res): Promise<void> => {
  // Iframes cannot send Authorization headers, so accept token via query param too
  const authHeader = req.headers.authorization;
  const queryToken = typeof req.query.token === "string" ? req.query.token : null;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : queryToken;

  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const { verifyToken } = await import("../lib/auth.js");
    verifyToken(token);
  } catch {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [judgment] = await db.select().from(judgmentsTable).where(eq(judgmentsTable.id, id));
  if (!judgment) { res.status(404).json({ error: "Not found" }); return; }

  if (!fs.existsSync(judgment.pdfPath)) {
    res.status(404).json({ error: "PDF file not found" });
    return;
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${judgment.pdfOriginalName ?? "judgment.pdf"}"`);
  fs.createReadStream(judgment.pdfPath).pipe(res);
});

router.post("/judgments/:id/retry", requireAuth, requireRole("UPLOADER", "REVIEWER"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [judgment] = await db.select().from(judgmentsTable).where(eq(judgmentsTable.id, id));
  if (!judgment) { res.status(404).json({ error: "Not found" }); return; }

  if (!["EXTRACTION_FAILED", "PENDING"].includes(judgment.status)) {
    res.status(400).json({ error: "Can only retry failed or pending judgments" });
    return;
  }

  await db.update(judgmentsTable).set({ status: "PENDING", errorMessage: null }).where(eq(judgmentsTable.id, id));

  runProcessingPipeline(id).catch((err) => {
    logger.error({ err, judgmentId: id }, "Retry pipeline failed");
  });

  const [updated] = await db.select().from(judgmentsTable).where(eq(judgmentsTable.id, id));
  res.json({ ...updated, uploadedAt: updated!.uploadedAt.toISOString() });
});

export default router;
