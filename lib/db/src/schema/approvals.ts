import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const approvalsTable = pgTable("approvals", {
  id: serial("id").primaryKey(),
  approvalNumber: text("approval_number").notNull().unique(),
  approvalType: text("approval_type").notNull(), // transfer, booking, maintenance, audit
  title: text("title").notNull(),
  description: text("description"),
  requestedBy: text("requested_by").notNull(),
  assignedTo: text("assigned_to"),
  departmentId: integer("department_id"),
  assetId: integer("asset_id"),
  priority: text("priority").notNull().default("medium"), // low, medium, high, critical
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  relatedRecordId: integer("related_record_id"),
  relatedModel: text("related_model"),
  requestDate: timestamp("request_date").notNull().defaultNow(),
  responseDate: timestamp("response_date"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertApprovalSchema = createInsertSchema(approvalsTable).omit({
  id: true,
  approvalNumber: true,
  createdAt: true,
});

export type InsertApproval = z.infer<typeof insertApprovalSchema>;
export type Approval = typeof approvalsTable.$inferSelect;
