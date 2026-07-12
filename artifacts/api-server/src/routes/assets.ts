import { Router } from "express";
import { db } from "@workspace/db";
import { assetsTable, assetCategoriesTable, departmentsTable, employeesTable } from "@workspace/db";
import { eq, sql, ilike, or } from "drizzle-orm";

const router = Router();

async function generateAssetTag(): Promise<string> {
  const [row] = await db.select({ maxId: sql<number>`COALESCE(MAX(id), 0)` }).from(assetsTable);
  // Use a sequence-based approach: count total assets including deleted ones
  const [countRow] = await db.select({ count: sql<number>`count(*)::int` }).from(assetsTable);
  const nextNum = (countRow?.count ?? 0) + 1;
  return `AF-${String(nextNum).padStart(6, "0")}`;
}

function computeAgeMonths(purchaseDateStr: string | null): number | null {
  if (!purchaseDateStr) return null;
  const purchase = new Date(purchaseDateStr);
  const now = new Date();
  return Math.floor((now.getTime() - purchase.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
}

function computeWarrantyRemaining(purchaseDateStr: string | null, warrantyPeriod: number | null): number | null {
  if (!purchaseDateStr || !warrantyPeriod) return null;
  const ageMonths = computeAgeMonths(purchaseDateStr);
  if (ageMonths === null) return null;
  return Math.max(0, warrantyPeriod - ageMonths);
}

async function enrichAsset(asset: typeof assetsTable.$inferSelect, warrantyPeriod: number | null) {
  return {
    id: asset.id,
    name: asset.name,
    tag: asset.tag,
    serialNumber: asset.serialNumber ?? null,
    categoryId: asset.categoryId ?? null,
    categoryName: null as string | null,
    departmentId: asset.departmentId ?? null,
    departmentName: null as string | null,
    employeeId: asset.employeeId ?? null,
    employeeName: null as string | null,
    purchaseDate: asset.purchaseDate ?? null,
    purchaseCost: asset.purchaseCost !== null ? Number(asset.purchaseCost) : null,
    currentValue: asset.currentValue !== null ? Number(asset.currentValue) : null,
    vendor: asset.vendor ?? null,
    condition: asset.condition,
    status: asset.status,
    bookable: asset.bookable,
    location: asset.location ?? null,
    description: asset.description ?? null,
    currentAgeMonths: computeAgeMonths(asset.purchaseDate),
    warrantyRemainingMonths: computeWarrantyRemaining(asset.purchaseDate, warrantyPeriod),
    deletedAt: asset.deletedAt ? asset.deletedAt.toISOString() : null,
    createdAt: asset.createdAt.toISOString(),
  };
}

router.get("/assets", async (req, res) => {
  const { categoryId, departmentId, employeeId, status, condition, bookable, search } = req.query as {
    categoryId?: string;
    departmentId?: string;
    employeeId?: string;
    status?: string;
    condition?: string;
    bookable?: string;
    search?: string;
  };

  let rows = await db
    .select()
    .from(assetsTable)
    .where(sql`${assetsTable.deletedAt} IS NULL`)
    .orderBy(assetsTable.tag);

  if (categoryId) rows = rows.filter((a) => a.categoryId === Number(categoryId));
  if (departmentId) rows = rows.filter((a) => a.departmentId === Number(departmentId));
  if (employeeId) rows = rows.filter((a) => a.employeeId === Number(employeeId));
  if (status) rows = rows.filter((a) => a.status === status);
  if (condition) rows = rows.filter((a) => a.condition === condition);
  if (bookable !== undefined) rows = rows.filter((a) => a.bookable === (bookable === "true"));
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.tag.toLowerCase().includes(q) ||
        (a.serialNumber ?? "").toLowerCase().includes(q) ||
        (a.location ?? "").toLowerCase().includes(q),
    );
  }

  const categories = await db.select({ id: assetCategoriesTable.id, name: assetCategoriesTable.name, warrantyPeriod: assetCategoriesTable.warrantyPeriod }).from(assetCategoriesTable);
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const departments = await db.select({ id: departmentsTable.id, name: departmentsTable.name }).from(departmentsTable);
  const deptMap = new Map(departments.map((d) => [d.id, d.name]));

  const employees = await db.select({ id: employeesTable.id, name: employeesTable.name }).from(employeesTable);
  const empMap = new Map(employees.map((e) => [e.id, e.name]));

  const result = rows.map((asset) => {
    const cat = asset.categoryId ? catMap.get(asset.categoryId) : null;
    return {
      id: asset.id,
      name: asset.name,
      tag: asset.tag,
      serialNumber: asset.serialNumber ?? null,
      categoryId: asset.categoryId ?? null,
      categoryName: cat?.name ?? null,
      departmentId: asset.departmentId ?? null,
      departmentName: asset.departmentId ? (deptMap.get(asset.departmentId) ?? null) : null,
      employeeId: asset.employeeId ?? null,
      employeeName: asset.employeeId ? (empMap.get(asset.employeeId) ?? null) : null,
      purchaseDate: asset.purchaseDate ?? null,
      purchaseCost: asset.purchaseCost !== null ? Number(asset.purchaseCost) : null,
      currentValue: asset.currentValue !== null ? Number(asset.currentValue) : null,
      vendor: asset.vendor ?? null,
      condition: asset.condition,
      status: asset.status,
      bookable: asset.bookable,
      location: asset.location ?? null,
      description: asset.description ?? null,
      currentAgeMonths: computeAgeMonths(asset.purchaseDate),
      warrantyRemainingMonths: computeWarrantyRemaining(asset.purchaseDate, cat?.warrantyPeriod ?? null),
      deletedAt: asset.deletedAt ? asset.deletedAt.toISOString() : null,
      createdAt: asset.createdAt.toISOString(),
    };
  });

  return res.json(result);
});

router.post("/assets", async (req, res) => {
  const body = req.body as {
    name: string;
    serialNumber?: string | null;
    categoryId?: number | null;
    departmentId?: number | null;
    employeeId?: number | null;
    purchaseDate?: string | null;
    purchaseCost?: number | null;
    currentValue?: number | null;
    vendor?: string | null;
    condition?: string;
    status?: string;
    bookable?: boolean;
    location?: string | null;
    description?: string | null;
  };

  if (!body.name) return res.status(400).json({ error: "name is required" });

  if (body.purchaseCost !== undefined && body.purchaseCost !== null && body.purchaseCost < 0) {
    return res.status(400).json({ error: "purchaseCost cannot be negative" });
  }
  if (body.currentValue !== undefined && body.currentValue !== null && body.purchaseCost !== undefined && body.purchaseCost !== null && body.currentValue > body.purchaseCost) {
    return res.status(400).json({ error: "currentValue cannot exceed purchaseCost" });
  }
  if (body.purchaseDate) {
    const purchaseDate = new Date(body.purchaseDate);
    if (purchaseDate > new Date()) {
      return res.status(400).json({ error: "purchaseDate cannot be in the future" });
    }
  }

  if (body.serialNumber) {
    const dup = await db.select().from(assetsTable).where(eq(assetsTable.serialNumber, body.serialNumber));
    if (dup.length > 0) return res.status(400).json({ error: "Serial number already exists" });
  }

  const tag = await generateAssetTag();

  const [asset] = await db
    .insert(assetsTable)
    .values({
      name: body.name,
      tag,
      serialNumber: body.serialNumber ?? null,
      categoryId: body.categoryId ?? null,
      departmentId: body.departmentId ?? null,
      employeeId: body.employeeId ?? null,
      purchaseDate: body.purchaseDate ?? null,
      purchaseCost: body.purchaseCost !== undefined && body.purchaseCost !== null ? String(body.purchaseCost) : null,
      currentValue: body.currentValue !== undefined && body.currentValue !== null ? String(body.currentValue) : null,
      vendor: body.vendor ?? null,
      condition: body.condition ?? "good",
      status: body.status ?? "available",
      bookable: body.bookable ?? false,
      location: body.location ?? null,
      description: body.description ?? null,
    })
    .returning();

  const cat = body.categoryId ? await db.select().from(assetCategoriesTable).where(eq(assetCategoriesTable.id, body.categoryId)).then((r) => r[0]) : null;

  return res.status(201).json(await enrichAsset(asset, cat?.warrantyPeriod ?? null));
});

router.get("/assets/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [asset] = await db.select().from(assetsTable).where(eq(assetsTable.id, id));
  if (!asset) return res.status(404).json({ error: "Asset not found" });

  const cat = asset.categoryId ? await db.select().from(assetCategoriesTable).where(eq(assetCategoriesTable.id, asset.categoryId)).then((r) => r[0]) : null;
  const dept = asset.departmentId ? await db.select().from(departmentsTable).where(eq(departmentsTable.id, asset.departmentId)).then((r) => r[0]) : null;
  const emp = asset.employeeId ? await db.select().from(employeesTable).where(eq(employeesTable.id, asset.employeeId)).then((r) => r[0]) : null;

  const enriched = await enrichAsset(asset, cat?.warrantyPeriod ?? null);
  enriched.categoryName = cat?.name ?? null;
  enriched.departmentName = dept?.name ?? null;
  enriched.employeeName = emp?.name ?? null;

  return res.json(enriched);
});

router.patch("/assets/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(assetsTable).where(eq(assetsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Asset not found" });

  const body = req.body as Partial<{
    name: string;
    serialNumber: string | null;
    categoryId: number | null;
    departmentId: number | null;
    employeeId: number | null;
    purchaseDate: string | null;
    purchaseCost: number | null;
    currentValue: number | null;
    vendor: string | null;
    condition: string;
    status: string;
    bookable: boolean;
    location: string | null;
    description: string | null;
  }>;

  const effectivePurchaseCost = body.purchaseCost !== undefined ? body.purchaseCost : (existing.purchaseCost !== null ? Number(existing.purchaseCost) : null);
  const effectiveCurrentValue = body.currentValue !== undefined ? body.currentValue : (existing.currentValue !== null ? Number(existing.currentValue) : null);

  if (body.purchaseCost !== undefined && body.purchaseCost !== null && body.purchaseCost < 0) {
    return res.status(400).json({ error: "purchaseCost cannot be negative" });
  }
  if (effectiveCurrentValue !== null && effectivePurchaseCost !== null && effectiveCurrentValue > effectivePurchaseCost) {
    return res.status(400).json({ error: "currentValue cannot exceed purchaseCost" });
  }
  if (body.purchaseDate) {
    const purchaseDate = new Date(body.purchaseDate);
    if (purchaseDate > new Date()) {
      return res.status(400).json({ error: "purchaseDate cannot be in the future" });
    }
  }

  if (body.serialNumber && body.serialNumber !== existing.serialNumber) {
    const dup = await db.select().from(assetsTable).where(eq(assetsTable.serialNumber, body.serialNumber));
    if (dup.length > 0) return res.status(400).json({ error: "Serial number already exists" });
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.serialNumber !== undefined) updates.serialNumber = body.serialNumber;
  if (body.categoryId !== undefined) updates.categoryId = body.categoryId;
  if (body.departmentId !== undefined) updates.departmentId = body.departmentId;
  if (body.employeeId !== undefined) updates.employeeId = body.employeeId;
  if (body.purchaseDate !== undefined) updates.purchaseDate = body.purchaseDate;
  if (body.purchaseCost !== undefined) updates.purchaseCost = body.purchaseCost !== null ? String(body.purchaseCost) : null;
  if (body.currentValue !== undefined) updates.currentValue = body.currentValue !== null ? String(body.currentValue) : null;
  if (body.vendor !== undefined) updates.vendor = body.vendor;
  if (body.condition !== undefined) updates.condition = body.condition;
  if (body.status !== undefined) updates.status = body.status;
  if (body.bookable !== undefined) updates.bookable = body.bookable;
  if (body.location !== undefined) updates.location = body.location;
  if (body.description !== undefined) updates.description = body.description;

  const [updated] = await db.update(assetsTable).set(updates as unknown as Partial<typeof assetsTable.$inferInsert>).where(eq(assetsTable.id, id)).returning();

  const catId = updated.categoryId ?? null;
  const cat = catId ? await db.select().from(assetCategoriesTable).where(eq(assetCategoriesTable.id, catId)).then((r) => r[0]) : null;

  return res.json(await enrichAsset(updated, cat?.warrantyPeriod ?? null));
});

router.delete("/assets/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(assetsTable).where(eq(assetsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Asset not found" });

  const [softDeleted] = await db
    .update(assetsTable)
    .set({ deletedAt: new Date(), status: "disposed" })
    .where(eq(assetsTable.id, id))
    .returning();

  const cat = softDeleted.categoryId ? await db.select().from(assetCategoriesTable).where(eq(assetCategoriesTable.id, softDeleted.categoryId)).then((r) => r[0]) : null;

  return res.json(await enrichAsset(softDeleted, cat?.warrantyPeriod ?? null));
});

export default router;
