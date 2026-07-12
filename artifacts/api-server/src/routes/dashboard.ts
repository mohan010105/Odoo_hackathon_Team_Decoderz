import { Router } from "express";
import { db } from "@workspace/db";
import { 
  assetsTable, 
  departmentsTable, 
  employeesTable, 
  assetCategoriesTable, 
  assetAllocationsTable, 
  transferRequestsTable,
  bookingsTable,
  maintenancesTable
} from "@workspace/db";
import { sql, eq, and, ne, gte } from "drizzle-orm";

const router = Router();

router.get("/dashboard", async (req, res) => {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  const [totalAssets] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(assetsTable)
    .where(sql`${assetsTable.deletedAt} IS NULL`);

  const [availableAssets] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(assetsTable)
    .where(sql`${assetsTable.deletedAt} IS NULL AND ${assetsTable.status} = 'available'`);

  const [allocatedAssets] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(assetsTable)
    .where(sql`${assetsTable.deletedAt} IS NULL AND ${assetsTable.status} = 'allocated'`);

  const [maintenanceAssets] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(assetsTable)
    .where(sql`${assetsTable.deletedAt} IS NULL AND ${assetsTable.status} = 'under_maintenance'`);

  const [totalDepartments] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(departmentsTable);

  const [totalEmployees] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(employeesTable);

  const [totalCategories] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(assetCategoriesTable);

  const [returnedAssets] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(assetAllocationsTable)
    .where(eq(assetAllocationsTable.status, "returned"));

  const [pendingTransfers] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transferRequestsTable)
    .where(eq(transferRequestsTable.status, "pending"));

  const assetsByStatus = await db
    .select({ status: assetsTable.status, count: sql<number>`count(*)::int` })
    .from(assetsTable)
    .where(sql`${assetsTable.deletedAt} IS NULL`)
    .groupBy(assetsTable.status);

  const assetsByCondition = await db
    .select({ condition: assetsTable.condition, count: sql<number>`count(*)::int` })
    .from(assetsTable)
    .where(sql`${assetsTable.deletedAt} IS NULL`)
    .groupBy(assetsTable.condition);

  const assetsByCategoryRaw = await db
    .select({
      categoryId: assetsTable.categoryId,
      count: sql<number>`count(*)::int`,
    })
    .from(assetsTable)
    .where(sql`${assetsTable.deletedAt} IS NULL`)
    .groupBy(assetsTable.categoryId);

  const categories = await db.select({ id: assetCategoriesTable.id, name: assetCategoriesTable.name }).from(assetCategoriesTable);
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  const assetsByCategory = assetsByCategoryRaw.map((r) => ({
    categoryName: r.categoryId ? (catMap.get(r.categoryId) ?? "Uncategorized") : "Uncategorized",
    count: r.count,
  }));

  // --- BOOKING METRICS ---
  const bookings = await db.select().from(bookingsTable);
  
  const todayBookings = bookings.filter(b => {
    const bDate = b.bookingDate;
    const isToday = bDate === todayStr;
    const isActiveTime = b.startTime <= now && b.endTime >= now;
    return (isToday || isActiveTime) && b.status !== "cancelled" && b.status !== "rejected";
  });

  const upcomingBookings = bookings.filter(b => b.startTime > now && (b.status === "approved" || b.status === "requested"));
  const cancelledBookings = bookings.filter(b => b.status === "cancelled");
  const completedBookings = bookings.filter(b => b.status === "completed");
  const currentlyReservedBookings = bookings.filter(b => b.status === "active");

  // --- MAINTENANCE METRICS ---
  const maintenances = await db.select().from(maintenancesTable);
  const employees = await db.select({ id: employeesTable.id, name: employeesTable.name }).from(employeesTable);
  const empMap = new Map(employees.map(e => [e.id, e.name]));

  const totalMaintenances = maintenances.filter(m => m.status !== "closed");
  const criticalMaintenances = totalMaintenances.filter(m => m.priority === "critical");
  const inProgressMaintenances = totalMaintenances.filter(m => m.status === "in_progress");
  
  const resolvedTodayMaintenances = maintenances.filter(m => {
    return (m.status === "resolved" || m.status === "closed") && m.completedDate === todayStr;
  });

  // Calculate Average Resolution Time (in days)
  const completedIssues = maintenances.filter(m => m.completedDate && (m.status === "resolved" || m.status === "closed"));
  let totalDays = 0;
  completedIssues.forEach(m => {
    if (m.completedDate) {
      const created = new Date(m.createdDate);
      const completed = new Date(m.completedDate);
      const diffMs = completed.getTime() - created.getTime();
      totalDays += Math.max(0, diffMs / (1000 * 60 * 60 * 24));
    }
  });
  const avgResolutionTimeDays = completedIssues.length > 0 ? Number((totalDays / completedIssues.length).toFixed(1)) : 0;

  // Priority Distribution
  const prioMap: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  maintenances.forEach(m => {
    if (prioMap[m.priority] !== undefined) {
      prioMap[m.priority]++;
    }
  });
  const priorityDistribution = Object.entries(prioMap).map(([priority, count]) => ({ priority, count }));

  // Technician Workload
  const workloadMap = new Map<number, number>();
  totalMaintenances.forEach(m => {
    if (m.technicianId) {
      workloadMap.set(m.technicianId, (workloadMap.get(m.technicianId) ?? 0) + 1);
    }
  });
  const technicianWorkload = Array.from(workloadMap.entries()).map(([techId, count]) => ({
    technicianName: empMap.get(techId) ?? "Unknown",
    count,
  }));

  // Maintenance Trend (last 7 days)
  const trendMap = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dStr = d.toISOString().split("T")[0];
    trendMap.set(dStr, 0);
  }
  maintenances.forEach(m => {
    if (trendMap.has(m.createdDate)) {
      trendMap.set(m.createdDate, (trendMap.get(m.createdDate) ?? 0) + 1);
    }
  });
  const maintenanceTrend = Array.from(trendMap.entries()).map(([date, count]) => ({ date, count }));

  return res.json({
    totalAssets: totalAssets?.count ?? 0,
    availableAssets: availableAssets?.count ?? 0,
    allocatedAssets: allocatedAssets?.count ?? 0,
    maintenanceAssets: maintenanceAssets?.count ?? 0,
    totalDepartments: totalDepartments?.count ?? 0,
    totalEmployees: totalEmployees?.count ?? 0,
    totalCategories: totalCategories?.count ?? 0,
    returnedAssets: returnedAssets?.count ?? 0,
    pendingTransfers: pendingTransfers?.count ?? 0,
    assetsByStatus: assetsByStatus.map((r) => ({ status: r.status, count: r.count })),
    assetsByCategory,
    assetsByCondition: assetsByCondition.map((r) => ({ condition: r.condition, count: r.count })),
    
    bookings: {
      todayCount: todayBookings.length,
      upcomingCount: upcomingBookings.length,
      cancelledCount: cancelledBookings.length,
      completedCount: completedBookings.length,
      currentlyReservedCount: currentlyReservedBookings.length,
    },
    maintenance: {
      totalRequests: totalMaintenances.length,
      criticalCount: criticalMaintenances.length,
      inProgressCount: inProgressMaintenances.length,
      resolvedTodayCount: resolvedTodayMaintenances.length,
      avgResolutionTimeDays,
      priorityDistribution,
      technicianWorkload,
      maintenanceTrend,
    }
  });
});

export default router;

