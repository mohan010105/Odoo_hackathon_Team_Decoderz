import { pgTable, serial, text, integer, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { assetsTable } from "./assets";
import { employeesTable } from "./employees";
import { departmentsTable } from "./departments";

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  bookingNumber: text("booking_number").notNull().unique(),
  resourceId: integer("resource_id").notNull().references(() => assetsTable.id),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id),
  departmentId: integer("department_id").notNull().references(() => departmentsTable.id),
  purpose: text("purpose").notNull(),
  bookingDate: date("booking_date").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  status: text("status").notNull().default("requested"), // requested, approved, rejected, active, completed, cancelled
  notes: text("notes"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({
  id: true,
  bookingNumber: true,
  createdAt: true,
});

export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
