import { Router } from "express";
import { db } from "@workspace/db";
import { allocationHistoryTable, assetsTable, employeesTable, departmentsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

router.get("/allocation-history", async (req, res) => {
  const { assetId, employeeId } = req.query;

  const query = db
    .select({
      id: allocationHistoryTable.id,
      action: allocationHistoryTable.action,
      userId: allocationHistoryTable.userId,
      timestamp: allocationHistoryTable.timestamp,
      assetId: allocationHistoryTable.assetId,
      assetName: assetsTable.name,
      assetTag: assetsTable.tag,
      employeeId: allocationHistoryTable.employeeId,
      employeeName: employeesTable.name,
      departmentId: allocationHistoryTable.departmentId,
      departmentName: departmentsTable.name,
      oldStatus: allocationHistoryTable.oldStatus,
      newStatus: allocationHistoryTable.newStatus,
    })
    .from(allocationHistoryTable)
    .innerJoin(assetsTable, eq(allocationHistoryTable.assetId, assetsTable.id))
    .leftJoin(employeesTable, eq(allocationHistoryTable.employeeId, employeesTable.id))
    .leftJoin(departmentsTable, eq(allocationHistoryTable.departmentId, departmentsTable.id));

  const conditions = [];
  if (assetId) conditions.push(eq(allocationHistoryTable.assetId, Number(assetId)));
  if (employeeId) conditions.push(eq(allocationHistoryTable.employeeId, Number(employeeId)));

  if (conditions.length > 0) {
    query.where(and(...conditions));
  }

  const rows = await query;

  const result = rows.map((r) => ({
    id: r.id,
    action: r.action,
    userId: r.userId,
    timestamp: r.timestamp.toISOString(),
    assetId: r.assetId,
    assetName: r.assetName ?? null,
    assetTag: r.assetTag ?? null,
    employeeId: r.employeeId ?? null,
    employeeName: r.employeeName ?? null,
    departmentId: r.departmentId ?? null,
    departmentName: r.departmentName ?? null,
    oldStatus: r.oldStatus ?? null,
    newStatus: r.newStatus ?? null,
  }));

  return res.json(result);
});

export default router;
