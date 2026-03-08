import { db } from "./db";
import {
  users, vehicles,
  type User, type InsertUser,
  type Vehicle, type InsertVehicle
} from "@shared/schema";
import { eq, or, and } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getTechnicians(): Promise<User[]>;

  getVehicles(): Promise<Vehicle[]>;
  getVehicle(id: number): Promise<Vehicle | undefined>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: number, updates: Partial<InsertVehicle>): Promise<Vehicle>;
  trackVehicle(identifier: string): Promise<Vehicle | undefined>;
  bulkImportVehicles(rows: InsertVehicle[]): Promise<{ imported: number; skipped: number; skippedRows: string[] }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getTechnicians(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, 'technician'));
  }

  async getVehicles(): Promise<Vehicle[]> {
    return await db.select().from(vehicles);
  }

  async getVehicle(id: number): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
    return vehicle;
  }

  async createVehicle(insertVehicle: InsertVehicle): Promise<Vehicle> {
    const [vehicle] = await db.insert(vehicles).values(insertVehicle).returning();
    return vehicle;
  }

  async updateVehicle(id: number, updates: Partial<InsertVehicle>): Promise<Vehicle> {
    const [vehicle] = await db.update(vehicles).set(updates).where(eq(vehicles.id, id)).returning();
    return vehicle;
  }

  async trackVehicle(identifier: string): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(
      or(
        eq(vehicles.jobCardNumber, identifier),
        eq(vehicles.vehicleNumber, identifier)
      )
    );
    return vehicle;
  }

  async bulkImportVehicles(rows: InsertVehicle[]): Promise<{ imported: number; skipped: number; skippedRows: string[] }> {
    let imported = 0;
    let skipped = 0;
    const skippedRows: string[] = [];

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    for (const row of rows) {
      // Check for duplicate: same license number on same day
      const allVehicles = await db.select().from(vehicles).where(
        eq(vehicles.vehicleNumber, row.vehicleNumber)
      );

      const isDuplicate = allVehicles.some(v => {
        if (!v.createdAt) return false;
        const vDate = new Date(v.createdAt).toISOString().split('T')[0];
        return vDate === todayStr;
      });

      if (isDuplicate) {
        skipped++;
        skippedRows.push(`${row.vehicleNumber} (${row.customerName})`);
        continue;
      }

      try {
        await db.insert(vehicles).values(row);
        imported++;
      } catch (e: any) {
        // Duplicate job card number
        skipped++;
        skippedRows.push(`${row.vehicleNumber} (${row.customerName}) - ${e.message}`);
      }
    }

    return { imported, skipped, skippedRows };
  }
}

export const storage = new DatabaseStorage();
