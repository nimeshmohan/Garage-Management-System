import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(), // email
  password: text("password").notNull(),
  role: text("role").notNull().default("customer"), // receptionist, service_adviser, job_controller, technician, customer
  name: text("name").notNull(),
});

export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  jobCardNumber: text("job_card_number").notNull().unique(),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  vehicleNumber: text("vehicle_number").notNull(),
  vehicleModel: text("vehicle_model").notNull(),
  serviceType: text("service_type").notNull(),
  priority: text("priority").notNull(), // High, Normal, Low
  status: text("status").notNull().default("Vehicle Received"), 
  technicianId: integer("technician_id").references(() => users.id),
  findings: text("findings"),
  serviceNotes: text("service_notes"),
  workDetails: text("work_details"),
  estimatedTime: text("estimated_time"),
  
  // New fields for tracking and parts
  isWaitingForParts: boolean("is_waiting_for_parts").default(false),
  workStartedAt: timestamp("work_started_at"),
  totalWorkDuration: integer("total_work_duration").default(0), // In seconds
  isTimerRunning: boolean("is_timer_running").default(false),
  lastTimerStartedAt: text("last_timer_started_at"), 
  
  // New fields for parts tracking and reopening
  partsWaitDuration: integer("parts_wait_duration").default(0), // In seconds
  lastPartsWaitStartedAt: text("last_parts_wait_started_at"),
  partsNeeded: text("parts_needed"),
  reopenReason: text("reopen_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertVehicleSchema = createInsertSchema(vehicles).omit({ id: true, createdAt: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehicles.$inferSelect;
