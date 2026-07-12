import { Router } from "express";
import { db } from "@workspace/db";
import { assetAllocationsTable, assetsTable, employeesTable, departmentsTable, allocationHistoryTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

router.get("/allocations", async (req, res) => {
  const { assetId, employeeId, departmentId, status } = req.query;

  const query = db
    .select({
      id: assetAllocationsTable.id,
      allocationNumber: assetAllocationsTable.allocationNumber,
      assetId: assetAllocationsTable.assetId,
      assetName: assetsTable.name,
      assetTag: assetsTable.tag,
      employeeId: assetAllocationsTable.employeeId,
      employeeName: employeesTable.name,
      departmentId: assetAllocationsTable.departmentId,
      departmentName: departmentsTable.name,
      allocationDate: assetAllocationsTable.allocationDate,
      expectedReturnDate: assetAllocationsTable.expectedReturnDate,
      actualReturnDate: assetAllocationsTable.actualReturnDate,
      status: assetAllocationsTable.status,
      remarks: assetAllocationsTable.remarks,
      createdBy: assetAllocationsTable.createdBy,
      createdAt: assetAllocationsTable.createdAt,
      updatedAt: assetAllocationsTable.updatedAt,
    })
    .from(assetAllocationsTable)
    .innerJoin(assetsTable, eq(assetAllocationsTable.assetId, assetsTable.id))
    .innerJoin(employeesTable, eq(assetAllocationsTable.employeeId, employeesTable.id))
    .innerJoin(departmentsTable, eq(assetAllocationsTable.departmentId, departmentsTable.id));

  const conditions = [];
  if (assetId) conditions.push(eq(assetAllocationsTable.assetId, Number(assetId)));
  if (employeeId) conditions.push(eq(assetAllocationsTable.employeeId, Number(employeeId)));
  if (departmentId) conditions.push(eq(assetAllocationsTable.departmentId, Number(departmentId)));
  if (status) conditions.push(eq(assetAllocationsTable.status, String(status)));

  if (conditions.length > 0) {
    query.where(and(...conditions));
  }

  const rows = await query;
  const result = rows.map((r) => ({
    ...r,
    remarks: r.remarks ?? null,
    createdBy: r.createdBy ?? null,
    actualReturnDate: r.actualReturnDate ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return res.json(result);
});

router.post("/allocations", async (req, res) => {
  const { assetId, employeeId, departmentId, allocationDate, expectedReturnDate, remarks } = req.body;

  if (!assetId || !employeeId || !expectedReturnDate) {
    return res.status(400).json({ error: "assetId, employeeId, and expectedReturnDate are required" });
  }

  // Validate Asset exists and is available
  const [asset] = await db.select().from(assetsTable).where(eq(assetsTable.id, Number(assetId)));
  if (!asset) {
    return res.status(400).json({ error: "Asset not found" });
  }
  if (asset.status !== "available") {
    return res.status(400).json({ error: "Only available assets can be allocated" });
  }

  // Validate Employee exists and is active
  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, Number(employeeId)));
  if (!employee) {
    return res.status(400).json({ error: "Employee not found" });
  }
  if (employee.status !== "active") {
    return res.status(400).json({ error: "Cannot allocate to an inactive employee" });
  }

  const allocDate = allocationDate ? new Date(allocationDate) : new Date();
  const expRetDate = new Date(expectedReturnDate);

  if (expRetDate <= allocDate) {
    return res.status(400).json({ error: "Expected return date must be in the future relative to allocation date" });
  }

  // Auto-resolve departmentId if not provided
  const resolvedDeptId = departmentId || employee.departmentId;
  if (!resolvedDeptId) {
    return res.status(400).json({ error: "Department ID must be specified or employee must belong to a department" });
  }

  const result = await db.transaction(async (tx) => {
    // Generate allocation number (format: AL-XXXXXX)
    const [countRow] = await tx.select({ count: sql<number>`count(*)::int` }).from(assetAllocationsTable);
    const sequenceNum = (countRow?.count || 0) + 1;
    const allocationNumber = `AL-${sequenceNum.toString().padStart(6, "0")}`;

    // Create allocation
    const [alloc] = await tx
      .insert(assetAllocationsTable)
      .values({
        allocationNumber,
        assetId: Number(assetId),
        employeeId: Number(employeeId),
        departmentId: Number(resolvedDeptId),
        allocationDate: allocDate.toISOString().split("T")[0],
        expectedReturnDate: expRetDate.toISOString().split("T")[0],
        status: "allocated",
        remarks: remarks || null,
        createdBy: "Administrator",
      })
      .returning();

    // Update Asset
    await tx
      .update(assetsTable)
      .set({
        status: "allocated",
        employeeId: Number(employeeId),
        departmentId: Number(resolvedDeptId),
      })
      .where(eq(assetsTable.id, Number(assetId)));

    // Insert History
    await tx.insert(allocationHistoryTable).values({
      action: "allocate",
      userId: "Administrator",
      assetId: Number(assetId),
      employeeId: Number(employeeId),
      departmentId: Number(resolvedDeptId),
      oldStatus: "available",
      newStatus: "allocated",
    });

    return alloc;
  });

  return res.status(201).json({
    ...result,
    assetName: asset.name,
    assetTag: asset.tag,
    employeeName: employee.name,
    departmentName: null, // client will fetch or handle
    remarks: result.remarks ?? null,
    createdBy: result.createdBy ?? null,
    actualReturnDate: result.actualReturnDate ?? null,
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
  });
});

router.get("/allocations/:id", async (req, res) => {
  const id = Number(req.params.id);

  const [alloc] = await db
    .select({
      id: assetAllocationsTable.id,
      allocationNumber: assetAllocationsTable.allocationNumber,
      assetId: assetAllocationsTable.assetId,
      assetName: assetsTable.name,
      assetTag: assetsTable.tag,
      employeeId: assetAllocationsTable.employeeId,
      employeeName: employeesTable.name,
      departmentId: assetAllocationsTable.departmentId,
      departmentName: departmentsTable.name,
      allocationDate: assetAllocationsTable.allocationDate,
      expectedReturnDate: assetAllocationsTable.expectedReturnDate,
      actualReturnDate: assetAllocationsTable.actualReturnDate,
      status: assetAllocationsTable.status,
      remarks: assetAllocationsTable.remarks,
      createdBy: assetAllocationsTable.createdBy,
      createdAt: assetAllocationsTable.createdAt,
      updatedAt: assetAllocationsTable.updatedAt,
    })
    .from(assetAllocationsTable)
    .innerJoin(assetsTable, eq(assetAllocationsTable.assetId, assetsTable.id))
    .innerJoin(employeesTable, eq(assetAllocationsTable.employeeId, employeesTable.id))
    .innerJoin(departmentsTable, eq(assetAllocationsTable.departmentId, departmentsTable.id))
    .where(eq(assetAllocationsTable.id, id));

  if (!alloc) {
    return res.status(404).json({ error: "Allocation not found" });
  }

  return res.json({
    ...alloc,
    remarks: alloc.remarks ?? null,
    createdBy: alloc.createdBy ?? null,
    actualReturnDate: alloc.actualReturnDate ?? null,
    createdAt: alloc.createdAt.toISOString(),
    updatedAt: alloc.updatedAt.toISOString(),
  });
});

router.patch("/allocations/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { expectedReturnDate, remarks, status } = req.body;

  const [existing] = await db.select().from(assetAllocationsTable).where(eq(assetAllocationsTable.id, id));
  if (!existing) {
    return res.status(404).json({ error: "Allocation not found" });
  }

  const updates: Partial<typeof existing> = {};
  if (expectedReturnDate !== undefined) updates.expectedReturnDate = expectedReturnDate;
  if (remarks !== undefined) updates.remarks = remarks;
  if (status !== undefined) updates.status = status;

  const [updated] = await db
    .update(assetAllocationsTable)
    .set(updates)
    .where(eq(assetAllocationsTable.id, id))
    .returning();

  return res.json({
    ...updated,
    remarks: updated.remarks ?? null,
    createdBy: updated.createdBy ?? null,
    actualReturnDate: updated.actualReturnDate ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

router.post("/allocations/:id/return", async (req, res) => {
  const id = Number(req.params.id);
  const { remarks } = req.body;

  const [alloc] = await db.select().from(assetAllocationsTable).where(eq(assetAllocationsTable.id, id));
  if (!alloc) {
    return res.status(404).json({ error: "Allocation not found" });
  }
  if (alloc.status !== "allocated") {
    return res.status(400).json({ error: "Only active allocations can be returned" });
  }

  const result = await db.transaction(async (tx) => {
    // Update allocation
    const [updatedAlloc] = await tx
      .update(assetAllocationsTable)
      .set({
        status: "returned",
        actualReturnDate: new Date().toISOString().split("T")[0],
        remarks: remarks || alloc.remarks,
      })
      .where(eq(assetAllocationsTable.id, id))
      .returning();

    // Update Asset
    await tx
      .update(assetsTable)
      .set({
        status: "available",
        employeeId: null,
      })
      .where(eq(assetsTable.id, alloc.assetId));

    // Insert History
    await tx.insert(allocationHistoryTable).values({
      action: "return",
      userId: "Administrator",
      assetId: alloc.assetId,
      employeeId: alloc.employeeId,
      departmentId: alloc.departmentId,
      oldStatus: "allocated",
      newStatus: "available",
    });

    return updatedAlloc;
  });

  return res.json({
    ...result,
    remarks: result.remarks ?? null,
    createdBy: result.createdBy ?? null,
    actualReturnDate: result.actualReturnDate ?? null,
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
  });
});

export default router;
