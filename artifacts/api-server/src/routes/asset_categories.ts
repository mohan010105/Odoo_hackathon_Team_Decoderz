import { Router } from "express";
import { db } from "@workspace/db";
import { assetCategoriesTable, assetsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/asset-categories", async (req, res) => {
  const { status } = req.query as { status?: string };

  const rows = await db.select().from(assetCategoriesTable).orderBy(assetCategoriesTable.name);
  const filtered = status ? rows.filter((c) => c.status === status) : rows;

  const assetCounts = await db
    .select({ categoryId: assetsTable.categoryId, count: sql<number>`count(*)::int` })
    .from(assetsTable)
    .where(sql`${assetsTable.deletedAt} IS NULL AND ${assetsTable.categoryId} IS NOT NULL`)
    .groupBy(assetsTable.categoryId);
  const assetCountMap = new Map(assetCounts.map((r) => [r.categoryId, r.count]));

  return res.json(
    filtered.map((cat) => ({
      id: cat.id,
      name: cat.name,
      code: cat.code,
      description: cat.description ?? null,
      warrantyPeriod: cat.warrantyPeriod ?? null,
      status: cat.status,
      assetCount: assetCountMap.get(cat.id) ?? 0,
      createdAt: cat.createdAt.toISOString(),
    })),
  );
});

router.post("/asset-categories", async (req, res) => {
  const { name, code, description, warrantyPeriod, status } = req.body as {
    name: string;
    code: string;
    description?: string | null;
    warrantyPeriod?: number | null;
    status?: string;
  };

  if (!name || !code) return res.status(400).json({ error: "name and code are required" });

  const dup = await db.select().from(assetCategoriesTable).where(eq(assetCategoriesTable.code, code));
  if (dup.length > 0) return res.status(400).json({ error: "Category code already exists" });

  const [cat] = await db
    .insert(assetCategoriesTable)
    .values({ name, code, description: description ?? null, warrantyPeriod: warrantyPeriod ?? null, status: status ?? "active" })
    .returning();

  return res.status(201).json({
    id: cat.id,
    name: cat.name,
    code: cat.code,
    description: cat.description ?? null,
    warrantyPeriod: cat.warrantyPeriod ?? null,
    status: cat.status,
    assetCount: 0,
    createdAt: cat.createdAt.toISOString(),
  });
});

router.get("/asset-categories/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [cat] = await db.select().from(assetCategoriesTable).where(eq(assetCategoriesTable.id, id));
  if (!cat) return res.status(404).json({ error: "Category not found" });

  const [assetCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(assetsTable)
    .where(sql`${assetsTable.categoryId} = ${id} AND ${assetsTable.deletedAt} IS NULL`);

  return res.json({
    id: cat.id,
    name: cat.name,
    code: cat.code,
    description: cat.description ?? null,
    warrantyPeriod: cat.warrantyPeriod ?? null,
    status: cat.status,
    assetCount: assetCount?.count ?? 0,
    createdAt: cat.createdAt.toISOString(),
  });
});

router.patch("/asset-categories/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(assetCategoriesTable).where(eq(assetCategoriesTable.id, id));
  if (!existing) return res.status(404).json({ error: "Category not found" });

  const { name, code, description, warrantyPeriod, status } = req.body as Partial<{
    name: string;
    code: string;
    description: string | null;
    warrantyPeriod: number | null;
    status: string;
  }>;

  if (code && code !== existing.code) {
    const dup = await db.select().from(assetCategoriesTable).where(eq(assetCategoriesTable.code, code));
    if (dup.length > 0) return res.status(400).json({ error: "Category code already exists" });
  }

  const updates: Partial<typeof existing> = {};
  if (name !== undefined) updates.name = name;
  if (code !== undefined) updates.code = code;
  if (description !== undefined) updates.description = description;
  if (warrantyPeriod !== undefined) updates.warrantyPeriod = warrantyPeriod;
  if (status !== undefined) updates.status = status;

  const [updated] = await db.update(assetCategoriesTable).set(updates).where(eq(assetCategoriesTable.id, id)).returning();

  const [assetCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(assetsTable)
    .where(sql`${assetsTable.categoryId} = ${id} AND ${assetsTable.deletedAt} IS NULL`);

  return res.json({
    id: updated.id,
    name: updated.name,
    code: updated.code,
    description: updated.description ?? null,
    warrantyPeriod: updated.warrantyPeriod ?? null,
    status: updated.status,
    assetCount: assetCount?.count ?? 0,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.delete("/asset-categories/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [cat] = await db.select().from(assetCategoriesTable).where(eq(assetCategoriesTable.id, id));
  if (!cat) return res.status(404).json({ error: "Category not found" });

  const [assetCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(assetsTable)
    .where(sql`${assetsTable.categoryId} = ${id} AND ${assetsTable.deletedAt} IS NULL`);

  if ((assetCount?.count ?? 0) > 0) {
    return res.status(400).json({ error: "Cannot delete category with existing assets. Reassign or remove assets first." });
  }

  await db.delete(assetCategoriesTable).where(eq(assetCategoriesTable.id, id));
  return res.status(204).send();
});

export default router;
