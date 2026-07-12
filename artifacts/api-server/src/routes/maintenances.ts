import { Router } from "express";
import { db } from "@workspace/db";
import {
  maintenancesTable,
  assetsTable,
  employeesTable,
  notificationsTable,
  activityLogsTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

async function generateMaintenanceNumber(): Promise<string> {
  const [countRow] = await db.select({ count: sql<number>`count(*)::int` }).from(maintenancesTable);
  const nextNum = (countRow?.count ?? 0) + 1;
  return `MT-${String(nextNum).padStart(6, "0")}`;
}

router.get("/maintenances", async (req, res) => {
  const { assetId, technicianId, status, priority } = req.query;

  const query = db
    .select({
      id: maintenancesTable.id,
      maintenanceNumber: maintenancesTable.maintenanceNumber,
      assetId: maintenancesTable.assetId,
      assetName: assetsTable.name,
      assetTag: assetsTable.tag,
      issueTitle: maintenancesTable.issueTitle,
      issueDescription: maintenancesTable.issueDescription,
      priority: maintenancesTable.priority,
      technicianId: maintenancesTable.technicianId,
      technicianName: employeesTable.name,
      estimatedCost: maintenancesTable.estimatedCost,
      actualCost: maintenancesTable.actualCost,
      status: maintenancesTable.status,
      resolutionNotes: maintenancesTable.resolutionNotes,
      createdDate: maintenancesTable.createdDate,
      assignedDate: maintenancesTable.assignedDate,
      completedDate: maintenancesTable.completedDate,
      createdAt: maintenancesTable.createdAt,
    })
    .from(maintenancesTable)
    .innerJoin(assetsTable, eq(maintenancesTable.assetId, assetsTable.id))
    .leftJoin(employeesTable, eq(maintenancesTable.technicianId, employeesTable.id))
    .orderBy(sql`${maintenancesTable.createdAt} DESC`);

  const conditions = [];
  if (assetId) conditions.push(eq(maintenancesTable.assetId, Number(assetId)));
  if (technicianId) conditions.push(eq(maintenancesTable.technicianId, Number(technicianId)));
  if (status) conditions.push(eq(maintenancesTable.status, String(status)));
  if (priority) conditions.push(eq(maintenancesTable.priority, String(priority)));

  if (conditions.length > 0) {
    query.where(and(...conditions));
  }

  const rows = await query;
  return res.json(rows.map(r => ({
    ...r,
    estimatedCost: Number(r.estimatedCost),
    actualCost: r.actualCost ? Number(r.actualCost) : null,
    resolutionNotes: r.resolutionNotes ?? null,
    assignedDate: r.assignedDate ?? null,
    completedDate: r.completedDate ?? null,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/maintenances", async (req, res) => {
  const { assetId, issueTitle, issueDescription, priority, estimatedCost } = req.body;

  if (!assetId || !issueTitle || !issueDescription || estimatedCost === undefined) {
    return res.status(400).json({ error: "assetId, issueTitle, issueDescription, and estimatedCost are required" });
  }

  const cost = Number(estimatedCost);
  if (cost < 0) {
    return res.status(400).json({ error: "Estimated cost cannot be negative" });
  }

  // Check Asset exists
  const [asset] = await db.select().from(assetsTable).where(eq(assetsTable.id, Number(assetId)));
  if (!asset) {
    return res.status(400).json({ error: "Asset not found" });
  }
  if (asset.status === "disposed") {
    return res.status(400).json({ error: "Cannot raise maintenance on a disposed asset" });
  }

  const maintenanceNumber = await generateMaintenanceNumber();

  const [maintenance] = await db
    .insert(maintenancesTable)
    .values({
      maintenanceNumber,
      assetId: Number(assetId),
      issueTitle,
      issueDescription,
      priority: priority || "medium",
      status: "raised",
      estimatedCost: String(cost),
      createdDate: new Date().toISOString().split("T")[0],
    })
    .returning();

  await db.insert(activityLogsTable).values({
    entityType: "maintenance",
    entityId: maintenance.id,
    action: "create",
    previousState: null,
    newState: "raised",
    userId: "Administrator",
  });

  return res.status(201).json({
    ...maintenance,
    estimatedCost: Number(maintenance.estimatedCost),
    actualCost: null,
    resolutionNotes: null,
    assignedDate: null,
    completedDate: null,
    createdAt: maintenance.createdAt.toISOString(),
  });
});

router.get("/maintenances/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db
    .select({
      id: maintenancesTable.id,
      maintenanceNumber: maintenancesTable.maintenanceNumber,
      assetId: maintenancesTable.assetId,
      assetName: assetsTable.name,
      assetTag: assetsTable.tag,
      issueTitle: maintenancesTable.issueTitle,
      issueDescription: maintenancesTable.issueDescription,
      priority: maintenancesTable.priority,
      technicianId: maintenancesTable.technicianId,
      technicianName: employeesTable.name,
      estimatedCost: maintenancesTable.estimatedCost,
      actualCost: maintenancesTable.actualCost,
      status: maintenancesTable.status,
      resolutionNotes: maintenancesTable.resolutionNotes,
      createdDate: maintenancesTable.createdDate,
      assignedDate: maintenancesTable.assignedDate,
      completedDate: maintenancesTable.completedDate,
      createdAt: maintenancesTable.createdAt,
    })
    .from(maintenancesTable)
    .innerJoin(assetsTable, eq(maintenancesTable.assetId, assetsTable.id))
    .leftJoin(employeesTable, eq(maintenancesTable.technicianId, employeesTable.id))
    .where(eq(maintenancesTable.id, id));

  if (!row) {
    return res.status(404).json({ error: "Maintenance request not found" });
  }

  return res.json({
    ...row,
    estimatedCost: Number(row.estimatedCost),
    actualCost: row.actualCost ? Number(row.actualCost) : null,
    resolutionNotes: row.resolutionNotes ?? null,
    assignedDate: row.assignedDate ?? null,
    completedDate: row.completedDate ?? null,
    createdAt: row.createdAt.toISOString(),
  });
});

router.patch("/maintenances/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body;

  const [existing] = await db.select().from(maintenancesTable).where(eq(maintenancesTable.id, id));
  if (!existing) return res.status(404).json({ error: "Maintenance request not found" });

  const updates: Partial<typeof existing> = {};
  if (body.issueTitle) updates.issueTitle = body.issueTitle;
  if (body.issueDescription) updates.issueDescription = body.issueDescription;
  if (body.priority) updates.priority = body.priority;
  if (body.estimatedCost !== undefined) {
    const cost = Number(body.estimatedCost);
    if (cost < 0) return res.status(400).json({ error: "Estimated cost cannot be negative" });
    updates.estimatedCost = String(cost);
  }
  if (body.actualCost !== undefined) {
    const cost = Number(body.actualCost);
    if (cost < 0) return res.status(400).json({ error: "Actual cost cannot be negative" });
    updates.actualCost = String(cost);
  }
  if (body.resolutionNotes !== undefined) updates.resolutionNotes = body.resolutionNotes;
  if (body.technicianId !== undefined) updates.technicianId = body.technicianId;

  const [updated] = await db
    .update(maintenancesTable)
    .set(updates)
    .where(eq(maintenancesTable.id, id))
    .returning();

  return res.json({
    ...updated,
    estimatedCost: Number(updated.estimatedCost),
    actualCost: updated.actualCost ? Number(updated.actualCost) : null,
    resolutionNotes: updated.resolutionNotes ?? null,
    assignedDate: updated.assignedDate ?? null,
    completedDate: updated.completedDate ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.post("/maintenances/:id/approve", async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(maintenancesTable).where(eq(maintenancesTable.id, id));
  if (!existing) return res.status(404).json({ error: "Maintenance request not found" });

  if (existing.status !== "raised") {
    return res.status(400).json({ error: "Only raised requests can be approved" });
  }

  const result = await db.transaction(async (tx) => {
    // Update maintenance request
    const [updated] = await tx
      .update(maintenancesTable)
      .set({ status: "approved" })
      .where(eq(maintenancesTable.id, id))
      .returning();

    // Lock Asset to 'under_maintenance'
    await tx
      .update(assetsTable)
      .set({ status: "under_maintenance", employeeId: null }) // Clear employee assignment
      .where(eq(assetsTable.id, existing.assetId));

    // Audit logs
    await tx.insert(activityLogsTable).values({
      entityType: "maintenance",
      entityId: id,
      action: "approve",
      previousState: "raised",
      newState: "approved",
      userId: "Administrator",
    });

    // Create notification
    await tx.insert(notificationsTable).values({
      title: "Maintenance Approved",
      message: `Maintenance request ${existing.maintenanceNumber} has been approved.`,
      type: "maintenance",
    });

    return updated;
  });

  return res.json({
    ...result,
    estimatedCost: Number(result.estimatedCost),
    actualCost: result.actualCost ? Number(result.actualCost) : null,
    resolutionNotes: result.resolutionNotes ?? null,
    assignedDate: result.assignedDate ?? null,
    completedDate: result.completedDate ?? null,
    createdAt: result.createdAt.toISOString(),
  });
});

router.post("/maintenances/:id/assign", async (req, res) => {
  const id = Number(req.params.id);
  const { technicianId } = req.body;

  if (!technicianId) {
    return res.status(400).json({ error: "technicianId is required" });
  }

  const [existing] = await db.select().from(maintenancesTable).where(eq(maintenancesTable.id, id));
  if (!existing) return res.status(404).json({ error: "Maintenance request not found" });

  if (existing.status !== "approved" && existing.status !== "assigned" && existing.status !== "raised") {
    return res.status(400).json({ error: "Technician can only be assigned to raised, approved or assigned requests" });
  }

  const [technician] = await db.select().from(employeesTable).where(eq(employeesTable.id, Number(technicianId)));
  if (!technician) return res.status(400).json({ error: "Technician not found" });

  const [updated] = await db
    .update(maintenancesTable)
    .set({
      technicianId: Number(technicianId),
      status: "assigned",
      assignedDate: new Date().toISOString().split("T")[0],
    })
    .where(eq(maintenancesTable.id, id))
    .returning();

  await db.insert(activityLogsTable).values({
    entityType: "maintenance",
    entityId: id,
    action: "assign",
    previousState: existing.status,
    newState: "assigned",
    userId: "Administrator",
  });

  await db.insert(notificationsTable).values({
    title: "Maintenance Assigned",
    message: `Maintenance request ${existing.maintenanceNumber} is assigned to ${technician.name}.`,
    type: "maintenance",
  });

  return res.json({
    ...updated,
    estimatedCost: Number(updated.estimatedCost),
    actualCost: updated.actualCost ? Number(updated.actualCost) : null,
    resolutionNotes: updated.resolutionNotes ?? null,
    assignedDate: updated.assignedDate ?? null,
    completedDate: updated.completedDate ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.post("/maintenances/:id/start", async (req, res) => {
  const id = Number(req.params.id);

  const [existing] = await db.select().from(maintenancesTable).where(eq(maintenancesTable.id, id));
  if (!existing) return res.status(404).json({ error: "Maintenance request not found" });

  if (existing.status !== "assigned" && existing.status !== "approved") {
    return res.status(400).json({ error: "Can only start maintenance after it is approved or assigned" });
  }

  const [updated] = await db
    .update(maintenancesTable)
    .set({ status: "in_progress" })
    .where(eq(maintenancesTable.id, id))
    .returning();

  await db.insert(activityLogsTable).values({
    entityType: "maintenance",
    entityId: id,
    action: "start",
    previousState: existing.status,
    newState: "in_progress",
    userId: "Administrator",
  });

  return res.json({
    ...updated,
    estimatedCost: Number(updated.estimatedCost),
    actualCost: updated.actualCost ? Number(updated.actualCost) : null,
    resolutionNotes: updated.resolutionNotes ?? null,
    assignedDate: updated.assignedDate ?? null,
    completedDate: updated.completedDate ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.post("/maintenances/:id/resolve", async (req, res) => {
  const id = Number(req.params.id);
  const { resolutionNotes, actualCost } = req.body;

  if (!resolutionNotes || !resolutionNotes.trim()) {
    return res.status(400).json({ error: "Resolution notes are required to resolve maintenance" });
  }

  const cost = actualCost !== undefined ? Number(actualCost) : 0;
  if (cost < 0) {
    return res.status(400).json({ error: "Actual cost cannot be negative" });
  }

  const [existing] = await db.select().from(maintenancesTable).where(eq(maintenancesTable.id, id));
  if (!existing) return res.status(404).json({ error: "Maintenance request not found" });

  if (existing.status !== "in_progress" && existing.status !== "assigned") {
    return res.status(400).json({ error: "Maintenance must be in_progress or assigned to be resolved" });
  }

  const [updated] = await db
    .update(maintenancesTable)
    .set({
      status: "resolved",
      resolutionNotes,
      actualCost: String(cost),
      completedDate: new Date().toISOString().split("T")[0],
    })
    .where(eq(maintenancesTable.id, id))
    .returning();

  await db.insert(activityLogsTable).values({
    entityType: "maintenance",
    entityId: id,
    action: "resolve",
    previousState: existing.status,
    newState: "resolved",
    userId: "Administrator",
  });

  await db.insert(notificationsTable).values({
    title: "Maintenance Completed",
    message: `Maintenance request ${existing.maintenanceNumber} is resolved.`,
    type: "maintenance",
  });

  return res.json({
    ...updated,
    estimatedCost: Number(updated.estimatedCost),
    actualCost: updated.actualCost ? Number(updated.actualCost) : null,
    resolutionNotes: updated.resolutionNotes ?? null,
    assignedDate: updated.assignedDate ?? null,
    completedDate: updated.completedDate ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.post("/maintenances/:id/close", async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(maintenancesTable).where(eq(maintenancesTable.id, id));
  if (!existing) return res.status(404).json({ error: "Maintenance request not found" });

  if (existing.status !== "resolved") {
    return res.status(400).json({ error: "Maintenance request must be resolved before closing" });
  }

  if (!existing.resolutionNotes || !existing.resolutionNotes.trim()) {
    return res.status(400).json({ error: "Maintenance cannot be closed without resolution notes" });
  }

  const result = await db.transaction(async (tx) => {
    // Close request
    const [updated] = await tx
      .update(maintenancesTable)
      .set({ status: "closed" })
      .where(eq(maintenancesTable.id, id))
      .returning();

    // Release Asset to 'available'
    await tx
      .update(assetsTable)
      .set({ status: "available" })
      .where(eq(assetsTable.id, existing.assetId));

    // Audit logs
    await tx.insert(activityLogsTable).values({
      entityType: "maintenance",
      entityId: id,
      action: "close",
      previousState: "resolved",
      newState: "closed",
      userId: "Administrator",
    });

    return updated;
  });

  return res.json({
    ...result,
    estimatedCost: Number(result.estimatedCost),
    actualCost: result.actualCost ? Number(result.actualCost) : null,
    resolutionNotes: result.resolutionNotes ?? null,
    assignedDate: result.assignedDate ?? null,
    completedDate: result.completedDate ?? null,
    createdAt: result.createdAt.toISOString(),
  });
});

export default router;
