import { Router } from "express";
import { db } from "@workspace/db";
import {
  bookingsTable,
  assetsTable,
  employeesTable,
  departmentsTable,
  notificationsTable,
  activityLogsTable,
  maintenancesTable,
} from "@workspace/db";
import { eq, and, sql, or, ne, lt, gt } from "drizzle-orm";

const router = Router();

// Helper to auto-update booking statuses based on current time
async function autoUpdateBookingStatuses(): Promise<void> {
  const now = new Date();
  
  // 1. Mark approved bookings as active if now is within [start, end]
  const toActive = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.status, "approved"),
        lt(bookingsTable.startTime, now),
        gt(bookingsTable.endTime, now)
      )
    );
    
  for (const b of toActive) {
    await db.transaction(async (tx) => {
      await tx
        .update(bookingsTable)
        .set({ status: "active" })
        .where(eq(bookingsTable.id, b.id));

      await tx.insert(activityLogsTable).values({
        entityType: "booking",
        entityId: b.id,
        action: "auto_activate",
        previousState: "approved",
        newState: "active",
        userId: "System",
      });
    });
  }

  // 2. Mark active or approved bookings as completed if now is past end
  const toCompleted = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        or(eq(bookingsTable.status, "active"), eq(bookingsTable.status, "approved")),
        lt(bookingsTable.endTime, now)
      )
    );

  for (const b of toCompleted) {
    await db.transaction(async (tx) => {
      await tx
        .update(bookingsTable)
        .set({ status: "completed" })
        .where(eq(bookingsTable.id, b.id));

      await tx.insert(activityLogsTable).values({
        entityType: "booking",
        entityId: b.id,
        action: "auto_complete",
        previousState: b.status,
        newState: "completed",
        userId: "System",
      });
    });
  }
}

async function generateBookingNumber(): Promise<string> {
  const [countRow] = await db.select({ count: sql<number>`count(*)::int` }).from(bookingsTable);
  const nextNum = (countRow?.count ?? 0) + 1;
  return `BK-${String(nextNum).padStart(6, "0")}`;
}

router.get("/bookings", async (req, res) => {
  await autoUpdateBookingStatuses();
  const { resourceId, employeeId, status } = req.query;

  const query = db
    .select({
      id: bookingsTable.id,
      bookingNumber: bookingsTable.bookingNumber,
      resourceId: bookingsTable.resourceId,
      resourceName: assetsTable.name,
      resourceTag: assetsTable.tag,
      employeeId: bookingsTable.employeeId,
      employeeName: employeesTable.name,
      departmentId: bookingsTable.departmentId,
      departmentName: departmentsTable.name,
      purpose: bookingsTable.purpose,
      bookingDate: bookingsTable.bookingDate,
      startTime: bookingsTable.startTime,
      endTime: bookingsTable.endTime,
      status: bookingsTable.status,
      notes: bookingsTable.notes,
      createdBy: bookingsTable.createdBy,
      createdAt: bookingsTable.createdAt,
    })
    .from(bookingsTable)
    .innerJoin(assetsTable, eq(bookingsTable.resourceId, assetsTable.id))
    .innerJoin(employeesTable, eq(bookingsTable.employeeId, employeesTable.id))
    .innerJoin(departmentsTable, eq(bookingsTable.departmentId, departmentsTable.id))
    .orderBy(sql`${bookingsTable.startTime} DESC`);

  const conditions = [];
  if (resourceId) conditions.push(eq(bookingsTable.resourceId, Number(resourceId)));
  if (employeeId) conditions.push(eq(bookingsTable.employeeId, Number(employeeId)));
  if (status) conditions.push(eq(bookingsTable.status, String(status)));

  if (conditions.length > 0) {
    query.where(and(...conditions));
  }

  const rows = await query;
  return res.json(rows.map(r => ({
    ...r,
    notes: r.notes ?? null,
    createdBy: r.createdBy ?? null,
    startTime: r.startTime.toISOString(),
    endTime: r.endTime.toISOString(),
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/bookings", async (req, res) => {
  const { resourceId, employeeId, purpose, startTime, endTime, notes } = req.body;

  if (!resourceId || !employeeId || !purpose || !startTime || !endTime) {
    return res.status(400).json({ error: "resourceId, employeeId, purpose, startTime, and endTime are required" });
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (start >= end) {
    return res.status(400).json({ error: "End time must be after start time" });
  }

  // Prevent bookings in the past
  if (end < new Date()) {
    return res.status(400).json({ error: "Booking end time cannot be in the past" });
  }

  // Validate Resource (Asset)
  const [asset] = await db.select().from(assetsTable).where(eq(assetsTable.id, Number(resourceId)));
  if (!asset) {
    return res.status(400).json({ error: "Resource not found" });
  }
  if (!asset.bookable) {
    return res.status(400).json({ error: "This asset is not marked as bookable" });
  }

  // Only Available status assets can be booked (i.e. not retired, disposed, lost, under_maintenance)
  if (asset.status !== "available" && asset.status !== "allocated") {
    // If the asset is retired, disposed, lost, under_maintenance
    return res.status(400).json({ error: `Resource status is '${asset.status}' and cannot be booked` });
  }

  // Prevent booking retired, disposed, lost, under_maintenance assets explicitly
  if (["retired", "disposed", "lost", "under_maintenance"].includes(asset.status)) {
    return res.status(400).json({ error: `Resource is ${asset.status} and cannot be booked` });
  }

  // Prevent booking if there's active maintenance
  const activeMaintenances = await db
    .select()
    .from(maintenancesTable)
    .where(
      and(
        eq(maintenancesTable.assetId, Number(resourceId)),
        ne(maintenancesTable.status, "closed"),
        ne(maintenancesTable.status, "resolved")
      )
    );
  if (activeMaintenances.length > 0) {
    return res.status(400).json({ error: "Resource is under maintenance or has active maintenance requests and cannot be booked" });
  }

  // Validate Employee
  const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, Number(employeeId)));
  if (!employee) {
    return res.status(400).json({ error: "Employee not found" });
  }
  if (employee.status !== "active") {
    return res.status(400).json({ error: "Inactive employees cannot book resources" });
  }

  // Prevent overlapping bookings
  const overlapping = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.resourceId, Number(resourceId)),
        sql`${bookingsTable.status} NOT IN ('rejected', 'cancelled')`,
        sql`${bookingsTable.startTime} < ${end}`,
        sql`${bookingsTable.endTime} > ${start}`
      )
    );

  if (overlapping.length > 0) {
    return res.status(400).json({ error: "Overlapping booking detected for this resource" });
  }

  const bookingNumber = await generateBookingNumber();

  const [booking] = await db
    .insert(bookingsTable)
    .values({
      bookingNumber,
      resourceId: Number(resourceId),
      employeeId: Number(employeeId),
      departmentId: employee.departmentId ?? 1, // fallback
      purpose,
      bookingDate: new Date().toISOString().split("T")[0],
      startTime: start,
      endTime: end,
      status: "requested",
      notes: notes || null,
      createdBy: "Administrator", // default for api-server
    })
    .returning();

  // Activity Log
  await db.insert(activityLogsTable).values({
    entityType: "booking",
    entityId: booking.id,
    action: "create",
    previousState: null,
    newState: "requested",
    userId: "Administrator",
  });

  return res.status(201).json({
    ...booking,
    notes: booking.notes ?? null,
    createdBy: booking.createdBy ?? null,
    startTime: booking.startTime.toISOString(),
    endTime: booking.endTime.toISOString(),
    createdAt: booking.createdAt.toISOString(),
  });
});

router.get("/bookings/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db
    .select({
      id: bookingsTable.id,
      bookingNumber: bookingsTable.bookingNumber,
      resourceId: bookingsTable.resourceId,
      resourceName: assetsTable.name,
      resourceTag: assetsTable.tag,
      employeeId: bookingsTable.employeeId,
      employeeName: employeesTable.name,
      departmentId: bookingsTable.departmentId,
      departmentName: departmentsTable.name,
      purpose: bookingsTable.purpose,
      bookingDate: bookingsTable.bookingDate,
      startTime: bookingsTable.startTime,
      endTime: bookingsTable.endTime,
      status: bookingsTable.status,
      notes: bookingsTable.notes,
      createdBy: bookingsTable.createdBy,
      createdAt: bookingsTable.createdAt,
    })
    .from(bookingsTable)
    .innerJoin(assetsTable, eq(bookingsTable.resourceId, assetsTable.id))
    .innerJoin(employeesTable, eq(bookingsTable.employeeId, employeesTable.id))
    .innerJoin(departmentsTable, eq(bookingsTable.departmentId, departmentsTable.id))
    .where(eq(bookingsTable.id, id));

  if (!row) {
    return res.status(404).json({ error: "Booking not found" });
  }

  return res.json({
    ...row,
    notes: row.notes ?? null,
    createdBy: row.createdBy ?? null,
    startTime: row.startTime.toISOString(),
    endTime: row.endTime.toISOString(),
    createdAt: row.createdAt.toISOString(),
  });
});

router.patch("/bookings/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { startTime, endTime, purpose, notes } = req.body;

  const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id));
  if (!existing) {
    return res.status(404).json({ error: "Booking not found" });
  }

  const start = startTime ? new Date(startTime) : existing.startTime;
  const end = endTime ? new Date(endTime) : existing.endTime;

  if (start >= end) {
    return res.status(400).json({ error: "End time must be after start time" });
  }

  if (end < new Date()) {
    return res.status(400).json({ error: "Booking end time cannot be in the past" });
  }

  // Prevent overlapping bookings
  if (startTime || endTime) {
    const overlapping = await db
      .select()
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.resourceId, existing.resourceId),
          ne(bookingsTable.id, id),
          sql`${bookingsTable.status} NOT IN ('rejected', 'cancelled')`,
          sql`${bookingsTable.startTime} < ${end}`,
          sql`${bookingsTable.endTime} > ${start}`
        )
      );

    if (overlapping.length > 0) {
      return res.status(400).json({ error: "Overlapping booking detected for this resource" });
    }
  }

  const updates: Partial<typeof existing> = {};
  if (startTime) updates.startTime = start;
  if (endTime) updates.endTime = end;
  if (purpose) updates.purpose = purpose;
  if (notes !== undefined) updates.notes = notes;

  const [updated] = await db
    .update(bookingsTable)
    .set(updates)
    .where(eq(bookingsTable.id, id))
    .returning();

  await db.insert(activityLogsTable).values({
    entityType: "booking",
    entityId: id,
    action: "reschedule",
    previousState: existing.status,
    newState: existing.status, // status did not change, reschedule
    userId: "Administrator",
  });

  return res.json({
    ...updated,
    notes: updated.notes ?? null,
    createdBy: updated.createdBy ?? null,
    startTime: updated.startTime.toISOString(),
    endTime: updated.endTime.toISOString(),
    createdAt: updated.createdAt.toISOString(),
  });
});

router.post("/bookings/:id/approve", async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Booking not found" });

  if (existing.status !== "requested") {
    return res.status(400).json({ error: "Only requested bookings can be approved" });
  }

  const [updated] = await db
    .update(bookingsTable)
    .set({ status: "approved" })
    .where(eq(bookingsTable.id, id))
    .returning();

  await db.insert(activityLogsTable).values({
    entityType: "booking",
    entityId: id,
    action: "approve",
    previousState: "requested",
    newState: "approved",
    userId: "Administrator",
  });

  await db.insert(notificationsTable).values({
    title: "Booking Approved",
    message: `Booking ${existing.bookingNumber} has been approved by the manager.`,
    type: "booking",
  });

  return res.json({
    ...updated,
    notes: updated.notes ?? null,
    createdBy: updated.createdBy ?? null,
    startTime: updated.startTime.toISOString(),
    endTime: updated.endTime.toISOString(),
    createdAt: updated.createdAt.toISOString(),
  });
});

router.post("/bookings/:id/reject", async (req, res) => {
  const id = Number(req.params.id);
  const { notes } = req.body;
  const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Booking not found" });

  if (existing.status !== "requested") {
    return res.status(400).json({ error: "Only requested bookings can be rejected" });
  }

  const [updated] = await db
    .update(bookingsTable)
    .set({ status: "rejected", notes: notes || existing.notes })
    .where(eq(bookingsTable.id, id))
    .returning();

  await db.insert(activityLogsTable).values({
    entityType: "booking",
    entityId: id,
    action: "reject",
    previousState: "requested",
    newState: "rejected",
    userId: "Administrator",
  });

  await db.insert(notificationsTable).values({
    title: "Booking Rejected",
    message: `Booking ${existing.bookingNumber} was rejected. Reason: ${notes || "No notes provided"}`,
    type: "booking",
  });

  return res.json({
    ...updated,
    notes: updated.notes ?? null,
    createdBy: updated.createdBy ?? null,
    startTime: updated.startTime.toISOString(),
    endTime: updated.endTime.toISOString(),
    createdAt: updated.createdAt.toISOString(),
  });
});

router.post("/bookings/:id/cancel", async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Booking not found" });

  if (existing.status === "cancelled" || existing.status === "completed" || existing.status === "rejected") {
    return res.status(400).json({ error: `Cannot cancel a booking that is already ${existing.status}` });
  }

  const [updated] = await db
    .update(bookingsTable)
    .set({ status: "cancelled" })
    .where(eq(bookingsTable.id, id))
    .returning();

  await db.insert(activityLogsTable).values({
    entityType: "booking",
    entityId: id,
    action: "cancel",
    previousState: existing.status,
    newState: "cancelled",
    userId: "Administrator",
  });

  await db.insert(notificationsTable).values({
    title: "Booking Cancelled",
    message: `Booking ${existing.bookingNumber} was cancelled.`,
    type: "booking",
  });

  return res.json({
    ...updated,
    notes: updated.notes ?? null,
    createdBy: updated.createdBy ?? null,
    startTime: updated.startTime.toISOString(),
    endTime: updated.endTime.toISOString(),
    createdAt: updated.createdAt.toISOString(),
  });
});

export default router;
