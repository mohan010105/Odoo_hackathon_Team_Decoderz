import { Router } from "express";
import { db } from "@workspace/db";
import { activityLogsTable } from "@workspace/db";
import { desc, eq, and, sql, ilike, or, gte, lte } from "drizzle-orm";

const router = Router();

/**
 * Compute a human-readable date group label for a timestamp.
 */
function getDateGroup(ts: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const actDate = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate());
  const diffMs = today.getTime() - actDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 7) return "Last 7 Days";
  if (diffDays <= 30) return "Last 30 Days";
  return "Older";
}

// GET /activity-logs — paginated, filtered, date-grouped
router.get("/activity-logs", async (req, res) => {
  const {
    page = "1",
    limit = "20",
    module: moduleFilter,
    status,
    priority,
    entityType,
    dateFrom,
    dateTo,
    search,
  } = req.query as Record<string, string | undefined>;

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  if (moduleFilter) conditions.push(eq(activityLogsTable.module, moduleFilter));
  if (status) conditions.push(eq(activityLogsTable.status, status));
  if (priority) conditions.push(eq(activityLogsTable.priority, priority));
  if (entityType) conditions.push(eq(activityLogsTable.entityType, entityType));
  if (dateFrom) conditions.push(gte(activityLogsTable.timestamp, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(activityLogsTable.timestamp, new Date(dateTo)));
  if (search) {
    conditions.push(
      or(
        ilike(activityLogsTable.title, `%${search}%`),
        ilike(activityLogsTable.action, `%${search}%`)
      )!
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activityLogsTable)
    .where(where);

  const total = countResult?.count ?? 0;

  const rows = await db
    .select()
    .from(activityLogsTable)
    .where(where)
    .orderBy(desc(activityLogsTable.timestamp))
    .limit(limitNum)
    .offset(offset);

  const pages = Math.ceil(total / limitNum) || 1;

  return res.json({
    records: rows.map((r) => ({
      ...r,
      previousState: r.previousState ?? null,
      description: r.description ?? null,
      metadata: r.metadata ?? null,
      timestamp: r.timestamp.toISOString(),
      dateGroup: getDateGroup(r.timestamp),
    })),
    total,
    page: pageNum,
    pages,
  });
});

// GET /activity-logs/stats — counts for widgets
router.get("/activity-logs/stats", async (req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [unreadCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activityLogsTable)
    .where(eq(activityLogsTable.status, "unread"));

  const [criticalCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activityLogsTable)
    .where(and(eq(activityLogsTable.priority, "critical"), eq(activityLogsTable.status, "unread")));

  const [todayCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activityLogsTable)
    .where(gte(activityLogsTable.timestamp, todayStart));

  return res.json({
    unreadCount: unreadCount?.count ?? 0,
    criticalCount: criticalCount?.count ?? 0,
    todayCount: todayCount?.count ?? 0,
  });
});

// PATCH /activity-logs/:id/read — mark as read
router.patch("/activity-logs/:id/read", async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(activityLogsTable).where(eq(activityLogsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Activity log not found" });

  const [updated] = await db
    .update(activityLogsTable)
    .set({ status: "read" })
    .where(eq(activityLogsTable.id, id))
    .returning();

  return res.json({ ...updated, timestamp: updated.timestamp.toISOString(), dateGroup: getDateGroup(updated.timestamp) });
});

// PATCH /activity-logs/:id/archive — archive
router.patch("/activity-logs/:id/archive", async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(activityLogsTable).where(eq(activityLogsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Activity log not found" });

  const [updated] = await db
    .update(activityLogsTable)
    .set({ status: "archived" })
    .where(eq(activityLogsTable.id, id))
    .returning();

  return res.json({ ...updated, timestamp: updated.timestamp.toISOString(), dateGroup: getDateGroup(updated.timestamp) });
});

export default router;
