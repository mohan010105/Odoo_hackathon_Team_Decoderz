import { Router } from "express";
import { db } from "@workspace/db";
import { departmentsTable, employeesTable, assetsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/departments", async (req, res) => {
  const { status } = req.query as { status?: string };

  const rows = await db.select().from(departmentsTable).orderBy(departmentsTable.name);
  const filtered = status ? rows.filter((d) => d.status === status) : rows;

  const employeeCounts = await db
    .select({ departmentId: employeesTable.departmentId, count: sql<number>`count(*)::int` })
    .from(employeesTable)
    .groupBy(employeesTable.departmentId);

  const assetCounts = await db
    .select({ departmentId: assetsTable.departmentId, count: sql<number>`count(*)::int` })
    .from(assetsTable)
    .where(sql`${assetsTable.deletedAt} IS NULL`)
    .groupBy(assetsTable.departmentId);

  const empMap = new Map(employeeCounts.map((r) => [r.departmentId, r.count]));
  const assetMap = new Map(assetCounts.map((r) => [r.departmentId, r.count]));

  const allDepts = await db.select({ id: departmentsTable.id, name: departmentsTable.name }).from(departmentsTable);
  const deptNameMap = new Map(allDepts.map((d) => [d.id, d.name]));

  const allEmployees = await db.select({ id: employeesTable.id, name: employeesTable.name }).from(employeesTable);
  const empNameMap = new Map(allEmployees.map((e) => [e.id, e.name]));

  const result = filtered.map((dept) => ({
    id: dept.id,
    name: dept.name,
    code: dept.code,
    headId: dept.headId ?? null,
    headName: dept.headId ? (empNameMap.get(dept.headId) ?? null) : null,
    parentId: dept.parentId ?? null,
    parentName: dept.parentId ? (deptNameMap.get(dept.parentId) ?? null) : null,
    description: dept.description ?? null,
    status: dept.status,
    employeeCount: empMap.get(dept.id) ?? 0,
    assetCount: assetMap.get(dept.id) ?? 0,
    createdAt: dept.createdAt.toISOString(),
  }));

  return res.json(result);
});

router.post("/departments", async (req, res) => {
  const { name, code, headId, parentId, description, status } = req.body as {
    name: string;
    code: string;
    headId?: number | null;
    parentId?: number | null;
    description?: string | null;
    status?: string;
  };

  if (!name || !code) {
    return res.status(400).json({ error: "name and code are required" });
  }

  const existing = await db.select().from(departmentsTable).where(eq(departmentsTable.code, code));
  if (existing.length > 0) {
    return res.status(400).json({ error: "Department code already exists" });
  }

  const [dept] = await db
    .insert(departmentsTable)
    .values({ name, code, headId: headId ?? null, parentId: parentId ?? null, description: description ?? null, status: status ?? "active" })
    .returning();

  return res.status(201).json({
    ...dept,
    headId: dept.headId ?? null,
    headName: null,
    parentId: dept.parentId ?? null,
    parentName: null,
    description: dept.description ?? null,
    employeeCount: 0,
    assetCount: 0,
    createdAt: dept.createdAt.toISOString(),
  });
});

router.get("/departments/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [dept] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, id));
  if (!dept) return res.status(404).json({ error: "Department not found" });

  const [empCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(employeesTable)
    .where(eq(employeesTable.departmentId, id));

  const [assetCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(assetsTable)
    .where(sql`${assetsTable.departmentId} = ${id} AND ${assetsTable.deletedAt} IS NULL`);

  const allEmployees = await db.select({ id: employeesTable.id, name: employeesTable.name }).from(employeesTable);
  const empNameMap = new Map(allEmployees.map((e) => [e.id, e.name]));

  const allDepts = await db.select({ id: departmentsTable.id, name: departmentsTable.name }).from(departmentsTable);
  const deptNameMap = new Map(allDepts.map((d) => [d.id, d.name]));

  return res.json({
    id: dept.id,
    name: dept.name,
    code: dept.code,
    headId: dept.headId ?? null,
    headName: dept.headId ? (empNameMap.get(dept.headId) ?? null) : null,
    parentId: dept.parentId ?? null,
    parentName: dept.parentId ? (deptNameMap.get(dept.parentId) ?? null) : null,
    description: dept.description ?? null,
    status: dept.status,
    employeeCount: empCount?.count ?? 0,
    assetCount: assetCount?.count ?? 0,
    createdAt: dept.createdAt.toISOString(),
  });
});

router.patch("/departments/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Department not found" });

  const { name, code, headId, parentId, description, status } = req.body as Partial<{
    name: string;
    code: string;
    headId: number | null;
    parentId: number | null;
    description: string | null;
    status: string;
  }>;

  if (code && code !== existing.code) {
    const dup = await db.select().from(departmentsTable).where(eq(departmentsTable.code, code));
    if (dup.length > 0) return res.status(400).json({ error: "Department code already exists" });
  }

  const updates: Partial<typeof existing> = {};
  if (name !== undefined) updates.name = name;
  if (code !== undefined) updates.code = code;
  if (headId !== undefined) updates.headId = headId;
  if (parentId !== undefined) updates.parentId = parentId;
  if (description !== undefined) updates.description = description;
  if (status !== undefined) updates.status = status;

  const [updated] = await db.update(departmentsTable).set(updates).where(eq(departmentsTable.id, id)).returning();

  const [empCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(employeesTable)
    .where(eq(employeesTable.departmentId, id));

  const [assetCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(assetsTable)
    .where(sql`${assetsTable.departmentId} = ${id} AND ${assetsTable.deletedAt} IS NULL`);

  return res.json({
    ...updated,
    headId: updated.headId ?? null,
    headName: null,
    parentId: updated.parentId ?? null,
    parentName: null,
    description: updated.description ?? null,
    employeeCount: empCount?.count ?? 0,
    assetCount: assetCount?.count ?? 0,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.delete("/departments/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [dept] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, id));
  if (!dept) return res.status(404).json({ error: "Department not found" });

  const [empCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(employeesTable)
    .where(eq(employeesTable.departmentId, id));

  if ((empCount?.count ?? 0) > 0) {
    return res.status(400).json({ error: "Cannot delete department with existing employees. Reassign or remove employees first." });
  }

  await db.delete(departmentsTable).where(eq(departmentsTable.id, id));
  return res.status(204).send();
});

export default router;
