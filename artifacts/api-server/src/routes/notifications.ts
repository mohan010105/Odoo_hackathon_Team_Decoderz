import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";

const router = Router();

// GET /notifications — paginated, filtered
router.get("/notifications", async (req, res) => {
  const {
    page = "1",
    limit = "20",
    category,
    priority,
    status,
  } = req.query as Record<string, string | undefined>;

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  if (category) conditions.push(eq(notificationsTable.category, category));
  if (priority) conditions.push(eq(notificationsTable.priority, priority));
  if (status) conditions.push(eq(notificationsTable.status, status));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notificationsTable)
    .where(where);

  const total = countResult?.count ?? 0;

  const rows = await db
    .select()
    .from(notificationsTable)
    .where(where)
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limitNum)
    .offset(offset);

  const pages = Math.ceil(total / limitNum) || 1;

  return res.json({
    records: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      readAt: r.readAt ? r.readAt.toISOString() : null,
    })),
    total,
    page: pageNum,
    pages,
  });
});

// GET /notifications/stats — unread count, category breakdown
router.get("/notifications/stats", async (req, res) => {
  const [unreadCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notificationsTable)
    .where(eq(notificationsTable.status, "unread"));

  const [criticalCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.category, "critical"), eq(notificationsTable.status, "unread")));

  const categoryBreakdown = await db
    .select({ category: notificationsTable.category, count: sql<number>`count(*)::int` })
    .from(notificationsTable)
    .where(eq(notificationsTable.status, "unread"))
    .groupBy(notificationsTable.category);

  return res.json({
    unreadCount: unreadCount?.count ?? 0,
    criticalCount: criticalCount?.count ?? 0,
    categoryBreakdown: categoryBreakdown.map((r) => ({ category: r.category, count: r.count })),
  });
});

// POST /notifications/read-all — mark all as read
router.post("/notifications/read-all", async (req, res) => {
  await db
    .update(notificationsTable)
    .set({ read: true, status: "read", readAt: new Date() })
    .where(eq(notificationsTable.status, "unread"));
  return res.json({ success: true });
});

// PATCH /notifications/:id/read — mark single as read
router.patch("/notifications/:id/read", async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(notificationsTable).where(eq(notificationsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Notification not found" });

  const [updated] = await db
    .update(notificationsTable)
    .set({ read: true, status: "read", readAt: new Date() })
    .where(eq(notificationsTable.id, id))
    .returning();

  return res.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    readAt: updated.readAt ? updated.readAt.toISOString() : null,
  });
});

// PATCH /notifications/:id/unread — mark single as unread
router.patch("/notifications/:id/unread", async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(notificationsTable).where(eq(notificationsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Notification not found" });

  const [updated] = await db
    .update(notificationsTable)
    .set({ read: false, status: "unread", readAt: null })
    .where(eq(notificationsTable.id, id))
    .returning();

  return res.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    readAt: null,
  });
});

// PATCH /notifications/:id/archive — archive single
router.patch("/notifications/:id/archive", async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(notificationsTable).where(eq(notificationsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Notification not found" });

  const [updated] = await db
    .update(notificationsTable)
    .set({ status: "archived" })
    .where(eq(notificationsTable.id, id))
    .returning();

  return res.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    readAt: updated.readAt ? updated.readAt.toISOString() : null,
  });
});

export default router;
