import { pgTable, serial, text, integer, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { assetsTable } from "./assets";
import { employeesTable } from "./employees";
import { departmentsTable } from "./departments";

export const assetAllocationsTable = pgTable("asset_allocations", {
  id: serial("id").primaryKey(),
  allocationNumber: text("allocation_number").notNull().unique(),
  assetId: integer("asset_id").notNull().references(() => assetsTable.id),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id),
  departmentId: integer("department_id").notNull().references(() => departmentsTable.id),
  allocationDate: date("allocation_date").notNull(),
  expectedReturnDate: date("expected_return_date").notNull(),
  actualReturnDate: date("actual_return_date"),
  status: text("status").notNull().default("draft"), // draft, allocated, returned, cancelled
  remarks: text("remarks"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAssetAllocationSchema = createInsertSchema(assetAllocationsTable).omit({
  id: true,
  allocationNumber: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAssetAllocation = z.infer<typeof insertAssetAllocationSchema>;
export type AssetAllocation = typeof assetAllocationsTable.$inferSelect;
