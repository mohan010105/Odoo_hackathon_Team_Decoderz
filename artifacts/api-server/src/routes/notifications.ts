import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/notifications", async (req, res) => {
  const rows = await db
    .select()
    .from(notificationsTable)
    .orderBy(desc(notificationsTable.createdAt));
  
  return res.json(rows.map(r => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/notifications/read-all", async (req, res) => {
  await db.update(notificationsTable).set({ read: true });
  return res.json({ success: true });
});

router.patch("/notifications/:id/read", async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(notificationsTable).where(eq(notificationsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Notification not found" });

  const [updated] = await db
    .update(notificationsTable)
    .set({ read: true })
    .where(eq(notificationsTable.id, id))
    .returning();

  return res.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
  });
});

export default router;
