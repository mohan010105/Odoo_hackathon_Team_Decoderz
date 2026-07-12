import { Router } from "express";
import { db } from "@workspace/db";
import {
  transferRequestsTable,
  assetsTable,
  employeesTable,
  departmentsTable,
  assetAllocationsTable,
  allocationHistoryTable,
} from "@workspace/db";
import { eq, and, sql, ne } from "drizzle-orm";

const router = Router();

router.get("/transfers", async (req, res) => {
  const { assetId, requestedEmployeeId, status } = req.query;

  const currentHolderAlias = sql`current_holder`;
  const requestedEmployeeAlias = sql`requested_employee`;

  const query = db
    .select({
      id: transferRequestsTable.id,
      transferNumber: transferRequestsTable.transferNumber,
      assetId: transferRequestsTable.assetId,
      assetName: assetsTable.name,
      assetTag: assetsTable.tag,
      currentHolderId: transferRequestsTable.currentHolderId,
      requestedEmployeeId: transferRequestsTable.requestedEmployeeId,
      requestedDepartmentId: transferRequestsTable.requestedDepartmentId,
      requestedDepartmentName: departmentsTable.name,
      reason: transferRequestsTable.reason,
      requestDate: transferRequestsTable.requestDate,
      status: transferRequestsTable.status,
      remarks: transferRequestsTable.remarks,
      createdAt: transferRequestsTable.createdAt,
    })
    .from(transferRequestsTable)
    .innerJoin(assetsTable, eq(transferRequestsTable.assetId, assetsTable.id))
    .innerJoin(departmentsTable, eq(transferRequestsTable.requestedDepartmentId, departmentsTable.id));

  const conditions = [];
  if (assetId) conditions.push(eq(transferRequestsTable.assetId, Number(assetId)));
  if (requestedEmployeeId) conditions.push(eq(transferRequestsTable.requestedEmployeeId, Number(requestedEmployeeId)));
  if (status) conditions.push(eq(transferRequestsTable.status, String(status)));

  if (conditions.length > 0) {
    query.where(and(...conditions));
  }

  const rows = await query;

  // Resolve Employee Names manually to avoid multiple joins on same table in Drizzle without aliases complexity
  const allEmployees = await db.select({ id: employeesTable.id, name: employeesTable.name }).from(employeesTable);
  const empNameMap = new Map(allEmployees.map((e) => [e.id, e.name]));

  const result = rows.map((r) => ({
    ...r,
    currentHolderName: r.currentHolderId ? (empNameMap.get(r.currentHolderId) ?? null) : null,
    requestedEmployeeName: empNameMap.get(r.requestedEmployeeId) ?? null,
    remarks: r.remarks ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  return res.json(result);
});

router.post("/transfers", async (req, res) => {
  const { assetId, requestedEmployeeId, requestedDepartmentId, reason, remarks } = req.body;

  if (!assetId || !requestedEmployeeId || !reason) {
    return res.status(400).json({ error: "assetId, requestedEmployeeId, and reason are required" });
  }

  // Validate Asset exists and is allocated
  const [asset] = await db.select().from(assetsTable).where(eq(assetsTable.id, Number(assetId)));
  if (!asset) {
    return res.status(400).json({ error: "Asset not found" });
  }
  if (asset.status !== "allocated") {
    return res.status(400).json({ error: "Only allocated assets can be transferred" });
  }

  // Validate Target Employee exists and is active
  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, Number(requestedEmployeeId)));
  if (!employee) {
    return res.status(400).json({ error: "Requested employee not found" });
  }
  if (employee.status !== "active") {
    return res.status(400).json({ error: "Cannot transfer to an inactive employee" });
  }

  // Current holder validation
  const currentHolderId = asset.employeeId;
  if (currentHolderId === Number(requestedEmployeeId)) {
    return res.status(400).json({ error: "Source and destination employee cannot be the same" });
  }

  const resolvedDeptId = requestedDepartmentId || employee.departmentId;
  if (!resolvedDeptId) {
    return res.status(400).json({ error: "Requested department ID is required" });
  }

  const result = await db.transaction(async (tx) => {
    // Generate transfer number (format: TR-XXXXXX)
    const [countRow] = await tx.select({ count: sql<number>`count(*)::int` }).from(transferRequestsTable);
    const sequenceNum = (countRow?.count || 0) + 1;
    const transferNumber = `TR-${sequenceNum.toString().padStart(6, "0")}`;

    const [transfer] = await tx
      .insert(transferRequestsTable)
      .values({
        transferNumber,
        assetId: Number(assetId),
        currentHolderId,
        requestedEmployeeId: Number(requestedEmployeeId),
        requestedDepartmentId: Number(resolvedDeptId),
        reason,
        remarks: remarks || null,
        requestDate: new Date().toISOString().split("T")[0],
        status: "pending",
      })
      .returning();

    return transfer;
  });

  return res.status(201).json({
    ...result,
    assetName: asset.name,
    assetTag: asset.tag,
    currentHolderName: currentHolderId ? (employee.name) : null, // client handles or resolves
    requestedEmployeeName: employee.name,
    requestedDepartmentName: null,
    remarks: result.remarks ?? null,
    createdAt: result.createdAt.toISOString(),
  });
});

router.get("/transfers/:id", async (req, res) => {
  const id = Number(req.params.id);

  const [transfer] = await db
    .select({
      id: transferRequestsTable.id,
      transferNumber: transferRequestsTable.transferNumber,
      assetId: transferRequestsTable.assetId,
      assetName: assetsTable.name,
      assetTag: assetsTable.tag,
      currentHolderId: transferRequestsTable.currentHolderId,
      requestedEmployeeId: transferRequestsTable.requestedEmployeeId,
      requestedDepartmentId: transferRequestsTable.requestedDepartmentId,
      requestedDepartmentName: departmentsTable.name,
      reason: transferRequestsTable.reason,
      requestDate: transferRequestsTable.requestDate,
      status: transferRequestsTable.status,
      remarks: transferRequestsTable.remarks,
      createdAt: transferRequestsTable.createdAt,
    })
    .from(transferRequestsTable)
    .innerJoin(assetsTable, eq(transferRequestsTable.assetId, assetsTable.id))
    .innerJoin(departmentsTable, eq(transferRequestsTable.requestedDepartmentId, departmentsTable.id))
    .where(eq(transferRequestsTable.id, id));

  if (!transfer) {
    return res.status(404).json({ error: "Transfer request not found" });
  }

  const allEmployees = await db.select({ id: employeesTable.id, name: employeesTable.name }).from(employeesTable);
  const empNameMap = new Map(allEmployees.map((e) => [e.id, e.name]));

  return res.json({
    ...transfer,
    currentHolderName: transfer.currentHolderId ? (empNameMap.get(transfer.currentHolderId) ?? null) : null,
    requestedEmployeeName: empNameMap.get(transfer.requestedEmployeeId) ?? null,
    remarks: transfer.remarks ?? null,
    createdAt: transfer.createdAt.toISOString(),
  });
});

router.patch("/transfers/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { status, remarks } = req.body;

  const [existing] = await db.select().from(transferRequestsTable).where(eq(transferRequestsTable.id, id));
  if (!existing) {
    return res.status(404).json({ error: "Transfer request not found" });
  }

  const updates: Partial<typeof existing> = {};
  if (status !== undefined) updates.status = status;
  if (remarks !== undefined) updates.remarks = remarks;

  const [updated] = await db
    .update(transferRequestsTable)
    .set(updates)
    .where(eq(transferRequestsTable.id, id))
    .returning();

  return res.json({
    ...updated,
    remarks: updated.remarks ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.post("/transfers/:id/approve", async (req, res) => {
  const id = Number(req.params.id);
  const { remarks } = req.body;

  const [transfer] = await db.select().from(transferRequestsTable).where(eq(transferRequestsTable.id, id));
  if (!transfer) return res.status(404).json({ error: "Transfer request not found" });

  const [updated] = await db
    .update(transferRequestsTable)
    .set({ status: "approved", remarks: remarks || transfer.remarks })
    .where(eq(transferRequestsTable.id, id))
    .returning();

  return res.json({
    ...updated,
    remarks: updated.remarks ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.post("/transfers/:id/reject", async (req, res) => {
  const id = Number(req.params.id);
  const { remarks } = req.body;

  const [transfer] = await db.select().from(transferRequestsTable).where(eq(transferRequestsTable.id, id));
  if (!transfer) return res.status(404).json({ error: "Transfer request not found" });

  const [updated] = await db
    .update(transferRequestsTable)
    .set({ status: "rejected", remarks: remarks || transfer.remarks })
    .where(eq(transferRequestsTable.id, id))
    .returning();

  return res.json({
    ...updated,
    remarks: updated.remarks ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.post("/transfers/:id/complete", async (req, res) => {
  const id = Number(req.params.id);
  const { remarks } = req.body;

  const [transfer] = await db.select().from(transferRequestsTable).where(eq(transferRequestsTable.id, id));
  if (!transfer) return res.status(404).json({ error: "Transfer request not found" });

  if (transfer.status !== "approved" && transfer.status !== "pending") {
    return res.status(400).json({ error: "Transfer request must be approved or pending to be completed" });
  }

  // Validate active asset allocation exists
  const [asset] = await db.select().from(assetsTable).where(eq(assetsTable.id, transfer.assetId));
  if (!asset) return res.status(400).json({ error: "Asset not found" });

  // Target Employee must be active
  const [targetEmp] = await db.select().from(employeesTable).where(eq(employeesTable.id, transfer.requestedEmployeeId));
  if (!targetEmp || targetEmp.status !== "active") {
    return res.status(400).json({ error: "Target employee must be active" });
  }

  const result = await db.transaction(async (tx) => {
    // 1. Complete transfer request
    const [completedTransfer] = await tx
      .update(transferRequestsTable)
      .set({ status: "completed", remarks: remarks || transfer.remarks })
      .where(eq(transferRequestsTable.id, id))
      .returning();

    // 2. Mark existing active allocations as returned
    await tx
      .update(assetAllocationsTable)
      .set({
        status: "returned",
        actualReturnDate: new Date().toISOString().split("T")[0],
      })
      .where(and(eq(assetAllocationsTable.assetId, transfer.assetId), eq(assetAllocationsTable.status, "allocated")));

    // 3. Create a new active allocation for target employee
    const [countRow] = await tx.select({ count: sql<number>`count(*)::int` }).from(assetAllocationsTable);
    const sequenceNum = (countRow?.count || 0) + 1;
    const allocationNumber = `AL-${sequenceNum.toString().padStart(6, "0")}`;

    await tx.insert(assetAllocationsTable).values({
      allocationNumber,
      assetId: transfer.assetId,
      employeeId: transfer.requestedEmployeeId,
      departmentId: transfer.requestedDepartmentId,
      allocationDate: new Date().toISOString().split("T")[0],
      expectedReturnDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // Default 1 year
      status: "allocated",
      createdBy: "Administrator",
    });

    // 4. Update Asset details
    await tx
      .update(assetsTable)
      .set({
        employeeId: transfer.requestedEmployeeId,
        departmentId: transfer.requestedDepartmentId,
        status: "allocated",
      })
      .where(eq(assetsTable.id, transfer.assetId));

    // 5. Audit History
    await tx.insert(allocationHistoryTable).values({
      action: "transfer",
      userId: "Administrator",
      assetId: transfer.assetId,
      employeeId: transfer.requestedEmployeeId,
      departmentId: transfer.requestedDepartmentId,
      oldStatus: "allocated",
      newStatus: "allocated",
    });

    return completedTransfer;
  });

  return res.json({
    ...result,
    remarks: result.remarks ?? null,
    createdAt: result.createdAt.toISOString(),
  });
});

router.post("/transfers/:id/cancel", async (req, res) => {
  const id = Number(req.params.id);
  const { remarks } = req.body;

  const [transfer] = await db.select().from(transferRequestsTable).where(eq(transferRequestsTable.id, id));
  if (!transfer) return res.status(404).json({ error: "Transfer request not found" });

  const [updated] = await db
    .update(transferRequestsTable)
    .set({ status: "cancelled", remarks: remarks || transfer.remarks })
    .where(eq(transferRequestsTable.id, id))
    .returning();

  return res.json({
    ...updated,
    remarks: updated.remarks ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
});

export default router;
