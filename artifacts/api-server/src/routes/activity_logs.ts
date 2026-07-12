import { Router } from "express";
import { db } from "@workspace/db";
import { activityLogsTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const router = Router();

router.get("/activity-logs", async (req, res) => {
  const rows = await db
    .select()
    .from(activityLogsTable)
    .orderBy(desc(activityLogsTable.timestamp));

  return res.json(rows.map(r => ({
    ...r,
    previousState: r.previousState ?? null,
    timestamp: r.timestamp.toISOString(),
  })));
});

export default router;
