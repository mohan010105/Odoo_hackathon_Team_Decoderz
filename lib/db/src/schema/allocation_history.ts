import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { assetsTable } from "./assets";
import { employeesTable } from "./employees";
import { departmentsTable } from "./departments";

export const allocationHistoryTable = pgTable("allocation_history", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(), // allocate, return, transfer, cancel
  userId: text("user_id").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  assetId: integer("asset_id").notNull().references(() => assetsTable.id),
  employeeId: integer("employee_id").references(() => employeesTable.id),
  departmentId: integer("department_id").references(() => departmentsTable.id),
  oldStatus: text("old_status"),
  newStatus: text("new_status"),
});

export const insertAllocationHistorySchema = createInsertSchema(allocationHistoryTable).omit({
  id: true,
  timestamp: true,
});

export type InsertAllocationHistory = z.infer<typeof insertAllocationHistorySchema>;
export type AllocationHistory = typeof allocationHistoryTable.$inferSelect;
