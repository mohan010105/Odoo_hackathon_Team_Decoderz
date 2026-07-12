import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const systemAlertsTable = pgTable("system_alerts", {
  id: serial("id").primaryKey(),
  alertNumber: text("alert_number").notNull().unique(),
  alertType: text("alert_type").notNull(), // overdue_return, maintenance_delay, booking_conflict, audit_pending, inactive_asset, license_expiry, warranty_expiry, asset_missing, asset_damaged, critical_maintenance
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").notNull().default("medium"), // low, medium, high, critical
  status: text("status").notNull().default("active"), // active, acknowledged, resolved
  assetId: integer("asset_id"),
  employeeId: integer("employee_id"),
  departmentId: integer("department_id"),
  relatedRecordId: integer("related_record_id"),
  relatedModel: text("related_model"),
  detectedAt: timestamp("detected_at").notNull().defaultNow(),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedAt: timestamp("resolved_at"),
  acknowledgedBy: text("acknowledged_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSystemAlertSchema = createInsertSchema(systemAlertsTable).omit({
  id: true,
  alertNumber: true,
  createdAt: true,
});

export type InsertSystemAlert = z.infer<typeof insertSystemAlertSchema>;
export type SystemAlert = typeof systemAlertsTable.$inferSelect;
