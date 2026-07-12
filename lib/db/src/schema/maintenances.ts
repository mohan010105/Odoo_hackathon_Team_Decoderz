import { pgTable, serial, text, integer, timestamp, date, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { assetsTable } from "./assets";
import { employeesTable } from "./employees";

export const maintenancesTable = pgTable("maintenances", {
  id: serial("id").primaryKey(),
  maintenanceNumber: text("maintenance_number").notNull().unique(),
  assetId: integer("asset_id").notNull().references(() => assetsTable.id),
  issueTitle: text("issue_title").notNull(),
  issueDescription: text("issue_description").notNull(),
  priority: text("priority").notNull().default("medium"), // low, medium, high, critical
  technicianId: integer("technician_id").references(() => employeesTable.id),
  estimatedCost: numeric("estimated_cost", { precision: 12, scale: 2 }).notNull(),
  actualCost: numeric("actual_cost", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("raised"), // raised, approved, assigned, in_progress, resolved, closed
  resolutionNotes: text("resolution_notes"),
  createdDate: date("created_date").notNull(),
  assignedDate: date("assigned_date"),
  completedDate: date("completed_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMaintenanceSchema = createInsertSchema(maintenancesTable).omit({
  id: true,
  maintenanceNumber: true,
  createdAt: true,
});

export type InsertMaintenance = z.infer<typeof insertMaintenanceSchema>;
export type Maintenance = typeof maintenancesTable.$inferSelect;
export type MaintenanceSelect = typeof maintenancesTable.$inferSelect;
