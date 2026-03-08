import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("customer"),
  name: text("name").notNull(),
});

export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  jobCardNumber: text("job_card_number").unique(),
  customerName: text("customer_name").notNull(),
  phone: text("phone").default(""),
  vehicleNumber: text("vehicle_number").notNull(),
  vehicleModel: text("vehicle_model").notNull(),
  serviceType: text("service_type").default(""),
  serviceAdviser: text("service_adviser").default(""),
  serviceOrderType: text("service_order_type").default(""),
  entryType: text("entry_type").notNull().default("Walk-in"),
  appointmentTime: text("appointment_time"),
  ssdNo: text("ssd_no"),
  priority: text("priority").default("Normal"),
  status: text("status").notNull().default("Vehicle Received"),
  technicianId: integer("technician_id").references(() => users.id),
  findings: text("findings"),
  serviceNotes: text("service_notes"),
  workDetails: text("work_details"),
  estimatedTime: text("estimated_time"),

  isWaitingForParts: boolean("is_waiting_for_parts").default(false),
  workStartedAt: timestamp("work_started_at"),
  totalWorkDuration: integer("total_work_duration").default(0),
  isTimerRunning: boolean("is_timer_running").default(false),
  lastTimerStartedAt: text("last_timer_started_at"),

  partsWaitDuration: integer("parts_wait_duration").default(0),
  lastPartsWaitStartedAt: text("last_parts_wait_started_at"),
  partsNeeded: text("parts_needed"),
  reopenReason: text("reopen_reason"),
  complaints: text("complaints"),
  complaintAssignments: text("complaint_assignments"),

  createdAt: timestamp("created_at").defaultNow(),
  receivedAt: text("received_at"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertVehicleSchema = createInsertSchema(vehicles).omit({ id: true, createdAt: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehicles.$inferSelect;
