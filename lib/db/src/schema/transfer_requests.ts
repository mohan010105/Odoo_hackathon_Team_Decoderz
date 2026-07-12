import { pgTable, serial, text, integer, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { assetsTable } from "./assets";
import { employeesTable } from "./employees";
import { departmentsTable } from "./departments";

export const transferRequestsTable = pgTable("transfer_requests", {
  id: serial("id").primaryKey(),
  transferNumber: text("transfer_number").notNull().unique(),
  assetId: integer("asset_id").notNull().references(() => assetsTable.id),
  currentHolderId: integer("current_holder_id").references(() => employeesTable.id),
  requestedEmployeeId: integer("requested_employee_id").notNull().references(() => employeesTable.id),
  requestedDepartmentId: integer("requested_department_id").notNull().references(() => departmentsTable.id),
  reason: text("reason").notNull(),
  requestDate: date("request_date").notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, rejected, completed, cancelled
  remarks: text("remarks"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTransferRequestSchema = createInsertSchema(transferRequestsTable).omit({
  id: true,
  transferNumber: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTransferRequest = z.infer<typeof insertTransferRequestSchema>;
export type TransferRequest = typeof transferRequestsTable.$inferSelect;
