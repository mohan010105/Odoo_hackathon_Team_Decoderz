import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import departmentsRouter from "./departments";
import employeesRouter from "./employees";
import assetCategoriesRouter from "./asset_categories";
import assetsRouter from "./assets";
import allocationsRouter from "./allocations";
import transfersRouter from "./transfers";
import allocationHistoryRouter from "./allocation_history";
import bookingsRouter from "./bookings";
import maintenancesRouter from "./maintenances";
import notificationsRouter from "./notifications";
import activityLogsRouter from "./activity_logs";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(departmentsRouter);
router.use(employeesRouter);
router.use(assetCategoriesRouter);
router.use(assetsRouter);
router.use(allocationsRouter);
router.use(transfersRouter);
router.use(allocationHistoryRouter);
router.use(bookingsRouter);
router.use(maintenancesRouter);
router.use(notificationsRouter);
router.use(activityLogsRouter);

export default router;

