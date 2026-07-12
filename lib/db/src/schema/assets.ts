import { pgTable, serial, text, integer, timestamp, date, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const assetsTable = pgTable("assets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  tag: text("tag").notNull().unique(),
  serialNumber: text("serial_number").unique(),
  categoryId: integer("category_id"),
  departmentId: integer("department_id"),
  employeeId: integer("employee_id"),
  purchaseDate: date("purchase_date"),
  purchaseCost: numeric("purchase_cost", { precision: 12, scale: 2 }),
  currentValue: numeric("current_value", { precision: 12, scale: 2 }),
  vendor: text("vendor"),
  condition: text("condition").notNull().default("good"),
  status: text("status").notNull().default("available"),
  bookable: boolean("bookable").notNull().default(false),
  location: text("location"),
  description: text("description"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAssetSchema = createInsertSchema(assetsTable).omit({
  id: true,
  tag: true,
  deletedAt: true,
  createdAt: true,
});

export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assetsTable.$inferSelect;
