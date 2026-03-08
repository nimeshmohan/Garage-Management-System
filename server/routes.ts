import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import session from "express-session";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Use simple session based auth for MVP
  app.use(session({
    secret: process.env.SESSION_SECRET || 'super-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using https
  }));

  // Auth Routes
  app.post(api.auth.login.path, async (req, res) => {
    try {
      const { username, password } = api.auth.login.input.parse(req.body);
      const user = await storage.getUserByUsername(username);
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      (req.session as any).userId = user.id;
      res.json(user);
    } catch (e) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      const existing = await storage.getUserByUsername(input.username);
      if (existing) {
        return res.status(400).json({ message: "Username already exists" });
      }
      const user = await storage.createUser(input);
      (req.session as any).userId = user.id;
      res.status(201).json(user);
    } catch (e) {
      if (e instanceof z.ZodError) {
        res.status(400).json({ message: e.errors[0].message });
      } else {
        res.status(400).json({ message: "Invalid input" });
      }
    }
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
    });
  });

  app.get(api.auth.me.path, async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    res.json(user);
  });

  // Users Routes
  app.get(api.users.listTechnicians.path, async (req, res) => {
    const technicians = await storage.getTechnicians();
    res.json(technicians);
  });

  // Vehicles Routes
  app.get(api.vehicles.list.path, async (req, res) => {
    const vehiclesList = await storage.getVehicles();
    res.json(vehiclesList);
  });

  app.get(api.vehicles.get.path, async (req, res) => {
    const id = parseInt(req.params.id);
    const vehicle = await storage.getVehicle(id);
    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }
    res.json(vehicle);
  });

  app.post(api.vehicles.create.path, async (req, res) => {
    try {
      const input = api.vehicles.create.input.parse(req.body);
      const vehicle = await storage.createVehicle(input);
      res.status(201).json(vehicle);
    } catch (e) {
      if (e instanceof z.ZodError) {
        res.status(400).json({ message: e.errors[0].message });
      } else {
        res.status(400).json({ message: "Invalid input" });
      }
    }
  });

  app.put(api.vehicles.update.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const input = api.vehicles.update.input.parse(req.body);

      // Duplicate job card number check
      if (input.jobCardNumber) {
        const all = await storage.getVehicles();
        const duplicate = all.find(v => v.jobCardNumber === input.jobCardNumber && v.id !== id);
        if (duplicate) {
          return res.status(400).json({ message: `Job card number "${input.jobCardNumber}" is already assigned to another vehicle (${duplicate.vehicleNumber}).` });
        }
      }

      const vehicle = await storage.updateVehicle(id, input);
      res.json(vehicle);
    } catch (e) {
      if (e instanceof z.ZodError) {
        res.status(400).json({ message: e.errors[0].message });
      } else {
        res.status(404).json({ message: "Not found or invalid" });
      }
    }
  });

  app.get(api.vehicles.track.path, async (req, res) => {
    const identifier = req.params.identifier;
    const vehicle = await storage.trackVehicle(identifier);
    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }
    res.json(vehicle);
  });

  app.post('/api/vehicles/bulk-import', async (req, res) => {
    try {
      const rows = req.body;
      if (!Array.isArray(rows)) {
        return res.status(400).json({ message: "Expected array of vehicle rows" });
      }
      const result = await storage.bulkImportVehicles(rows);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Import failed" });
    }
  });

  // Seed DB with mock users
  seedDatabase().catch(console.error);

  return httpServer;
}

async function seedDatabase() {
  const existing = await storage.getUserByUsername("reception");
  if (existing) return;

  const usersToCreate = [
    { username: "reception",  password: "service123", name: "Receptionist",          role: "receptionist" },
    { username: "nasiya",     password: "service123", name: "NASIYA NAUSHAD",         role: "service_adviser" },
    { username: "anjali",     password: "service123", name: "ANJALI PT",              role: "service_adviser" },
    { username: "jithin",     password: "service123", name: "JITHIN G NAIR",          role: "service_adviser" },
    { username: "hafiz",      password: "service123", name: "MUHAMMAD HAFIZ",         role: "service_adviser" },
    { username: "manu",       password: "service123", name: "MANU JOSEPH MARTIN",     role: "service_adviser" },
    { username: "midhun",     password: "service123", name: "MIDHUN SATYA",           role: "service_adviser" },
    { username: "minhaj",     password: "service123", name: "MINHAJ BIN JABIR M V",   role: "service_adviser" },
    { username: "sudhin",     password: "service123", name: "SUDHIN K",               role: "service_adviser" },
    { username: "yadhu",      password: "service123", name: "YADHU KRISHNA",          role: "service_adviser" },
    { username: "controller", password: "service123", name: "Job Controller",         role: "job_controller" },
    { username: "tech1",      password: "service123", name: "Technician 1",           role: "technician" },
    { username: "tech2",      password: "service123", name: "Technician 2",           role: "technician" },
  ];

  for (const u of usersToCreate) {
    await storage.createUser(u);
  }
}
