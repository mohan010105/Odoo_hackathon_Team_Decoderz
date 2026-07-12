import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const activityLogsTable = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(), // asset, allocation, transfer, booking, maintenance, audit, auth, system
  entityId: integer("entity_id").notNull(),
  action: text("action").notNull(), // create, approve, reject, status_change, assign, etc.
  previousState: text("previous_state"),
  newState: text("new_state").notNull(),
  userId: text("user_id").notNull(), // user or employee identity
  module: text("module").notNull().default("system"), // asset, allocation, transfer, booking, maintenance, audit, report, auth, system
  title: text("title").notNull().default(""),
  description: text("description"),
  priority: text("priority").notNull().default("medium"), // low, medium, high, critical
  status: text("status").notNull().default("unread"), // unread, read, archived
  departmentId: integer("department_id"),
  assetId: integer("asset_id"),
  employeeId: integer("employee_id"),
  metadata: text("metadata"), // JSON string
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogsTable).omit({
  id: true,
  timestamp: true,
});

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogsTable.$inferSelect;
