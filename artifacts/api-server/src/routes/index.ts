import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import judgmentsRouter from "./judgments";
import verifyRouter from "./verify";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(judgmentsRouter);
router.use(verifyRouter);
router.use(dashboardRouter);

export default router;
