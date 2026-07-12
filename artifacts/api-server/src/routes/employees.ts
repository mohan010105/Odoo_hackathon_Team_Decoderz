import { Router } from "express";
import { db } from "@workspace/db";
import { employeesTable, departmentsTable, assetsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

function generateEmployeeId(id: number): string {
  return `EMP-${String(id).padStart(5, "0")}`;
}

router.get("/employees", async (req, res) => {
  const { departmentId, status, role } = req.query as {
    departmentId?: string;
    status?: string;
    role?: string;
  };

  let rows = await db.select().from(employeesTable).orderBy(employeesTable.name);

  if (departmentId) rows = rows.filter((e) => e.departmentId === Number(departmentId));
  if (status) rows = rows.filter((e) => e.status === status);
  if (role) rows = rows.filter((e) => e.role === role);

  const departments = await db.select({ id: departmentsTable.id, name: departmentsTable.name }).from(departmentsTable);
  const deptMap = new Map(departments.map((d) => [d.id, d.name]));

  const assetCounts = await db
    .select({ employeeId: assetsTable.employeeId, count: sql<number>`count(*)::int` })
    .from(assetsTable)
    .where(sql`${assetsTable.deletedAt} IS NULL AND ${assetsTable.employeeId} IS NOT NULL`)
    .groupBy(assetsTable.employeeId);
  const assetCountMap = new Map(assetCounts.map((r) => [r.employeeId, r.count]));

  return res.json(
    rows.map((emp) => ({
      id: emp.id,
      employeeId: emp.employeeId,
      name: emp.name,
      email: emp.email,
      phone: emp.phone ?? null,
      departmentId: emp.departmentId ?? null,
      departmentName: emp.departmentId ? (deptMap.get(emp.departmentId) ?? null) : null,
      role: emp.role,
      status: emp.status,
      joiningDate: emp.joiningDate ?? null,
      notes: emp.notes ?? null,
      allocatedAssetCount: assetCountMap.get(emp.id) ?? 0,
      createdAt: emp.createdAt.toISOString(),
    })),
  );
});

router.post("/employees", async (req, res) => {
  const { name, email, phone, departmentId, role, status, joiningDate, notes } = req.body as {
    name: string;
    email: string;
    phone?: string | null;
    departmentId?: number | null;
    role?: string;
    status?: string;
    joiningDate?: string | null;
    notes?: string | null;
  };

  if (!name || !email) return res.status(400).json({ error: "name and email are required" });

  const dup = await db.select().from(employeesTable).where(eq(employeesTable.email, email));
  if (dup.length > 0) return res.status(400).json({ error: "Email already exists" });

  if (departmentId) {
    const [dept] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, departmentId));
    if (!dept || dept.status !== "active") {
      return res.status(400).json({ error: "Employee must belong to an active department" });
    }
  }

  // Temporarily insert with placeholder employeeId, then update with real one
  const [emp] = await db
    .insert(employeesTable)
    .values({
      employeeId: "TMP",
      name,
      email,
      phone: phone ?? null,
      departmentId: departmentId ?? null,
      role: role ?? "employee",
      status: status ?? "active",
      joiningDate: joiningDate ?? null,
      notes: notes ?? null,
    })
    .returning();

  const realEmployeeId = generateEmployeeId(emp.id);
  const [updated] = await db
    .update(employeesTable)
    .set({ employeeId: realEmployeeId })
    .where(eq(employeesTable.id, emp.id))
    .returning();

  return res.status(201).json({
    id: updated.id,
    employeeId: updated.employeeId,
    name: updated.name,
    email: updated.email,
    phone: updated.phone ?? null,
    departmentId: updated.departmentId ?? null,
    departmentName: null,
    role: updated.role,
    status: updated.status,
    joiningDate: updated.joiningDate ?? null,
    notes: updated.notes ?? null,
    allocatedAssetCount: 0,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.get("/employees/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!emp) return res.status(404).json({ error: "Employee not found" });

  const departments = await db.select({ id: departmentsTable.id, name: departmentsTable.name }).from(departmentsTable);
  const deptMap = new Map(departments.map((d) => [d.id, d.name]));

  const [assetCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(assetsTable)
    .where(sql`${assetsTable.employeeId} = ${id} AND ${assetsTable.deletedAt} IS NULL`);

  return res.json({
    id: emp.id,
    employeeId: emp.employeeId,
    name: emp.name,
    email: emp.email,
    phone: emp.phone ?? null,
    departmentId: emp.departmentId ?? null,
    departmentName: emp.departmentId ? (deptMap.get(emp.departmentId) ?? null) : null,
    role: emp.role,
    status: emp.status,
    joiningDate: emp.joiningDate ?? null,
    notes: emp.notes ?? null,
    allocatedAssetCount: assetCount?.count ?? 0,
    createdAt: emp.createdAt.toISOString(),
  });
});

router.patch("/employees/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!existing) return res.status(404).json({ error: "Employee not found" });

  const { name, email, phone, departmentId, role, status, joiningDate, notes } = req.body as Partial<{
    name: string;
    email: string;
    phone: string | null;
    departmentId: number | null;
    role: string;
    status: string;
    joiningDate: string | null;
    notes: string | null;
  }>;

  if (email && email !== existing.email) {
    const dup = await db.select().from(employeesTable).where(eq(employeesTable.email, email));
    if (dup.length > 0) return res.status(400).json({ error: "Email already exists" });
  }

  if (departmentId !== undefined && departmentId !== null) {
    const [dept] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, departmentId));
    if (!dept || dept.status !== "active") {
      return res.status(400).json({ error: "Employee must belong to an active department" });
    }
  }

  const updates: Partial<typeof existing> = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (phone !== undefined) updates.phone = phone;
  if (departmentId !== undefined) updates.departmentId = departmentId;
  if (role !== undefined) updates.role = role;
  if (status !== undefined) updates.status = status;
  if (joiningDate !== undefined) updates.joiningDate = joiningDate;
  if (notes !== undefined) updates.notes = notes;

  const [updated] = await db.update(employeesTable).set(updates).where(eq(employeesTable.id, id)).returning();

  return res.json({
    id: updated.id,
    employeeId: updated.employeeId,
    name: updated.name,
    email: updated.email,
    phone: updated.phone ?? null,
    departmentId: updated.departmentId ?? null,
    departmentName: null,
    role: updated.role,
    status: updated.status,
    joiningDate: updated.joiningDate ?? null,
    notes: updated.notes ?? null,
    allocatedAssetCount: 0,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.delete("/employees/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!emp) return res.status(404).json({ error: "Employee not found" });

  await db.delete(employeesTable).where(eq(employeesTable.id, id));
  return res.status(204).send();
});

export default router;
