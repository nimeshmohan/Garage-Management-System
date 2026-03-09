import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import session from "express-session";
import pgSession from "connect-pg-simple";
import { pool } from "./db";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Render (and most PaaS) terminates TLS at a proxy/load balancer.
  // Trust the first proxy so `secure` cookies work as expected in production.
  app.set("trust proxy", 1);

  const isProd = process.env.NODE_ENV === "production";
  const sessionSecret = process.env.SESSION_SECRET || (isProd ? "" : "dev-secret");
  if (isProd && !sessionSecret) {
    throw new Error("SESSION_SECRET must be set in production");
  }

  const PgSession = pgSession(session);

  // Use simple session based auth for MVP
  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      proxy: isProd,
      ...(isProd
        ? {
            store: new PgSession({
              pool,
              createTableIfMissing: true,
            }),
          }
        : {}),
      cookie: {
        secure: isProd,
        sameSite: "lax",
      },
    }),
  );

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
    const userId = (req.session as any).userId;
    const sessionUser = userId ? await storage.getUser(userId) : null;
    let vehiclesList = await storage.getVehicles();
    if (sessionUser?.role === 'service_adviser') {
      vehiclesList = vehiclesList.filter(v =>
        v.serviceAdviser === sessionUser.name &&
        v.status !== "Today's Appointment"
      );
    }
    // service_head sees everything, similar to receptionist/controller
    res.json(vehiclesList);
  });

  app.get('/api/analytics', async (req, res) => {
    const userId = (req.session as any).userId;
    const sessionUser = userId ? await storage.getUser(userId) : null;
    
    if (!sessionUser || sessionUser.role !== 'service_head') {
      return res.status(403).json({ message: "Forbidden" });
    }

    const vehicles = await storage.getVehicles();
    const technicians = await storage.getTechnicians();
    
    // Status Distribution
    const statusDistribution = vehicles.reduce((acc: any, v) => {
      acc[v.status] = (acc[v.status] || 0) + 1;
      return acc;
    }, {});

    // Advisor Performance
    const advisorPerformance = vehicles.reduce((acc: any, v) => {
      const adv = v.serviceAdviser || "Unassigned";
      if (!acc[adv]) acc[adv] = { name: adv, total: 0, pending: 0, completed: 0 };
      acc[adv].total++;
      if (v.status === "Delivered" || v.status === "Job Completed") {
        acc[adv].completed++;
      } else {
        acc[adv].pending++;
      }
      return acc;
    }, {});

    // Technician Workload
    const techWorkload = technicians.map(t => {
      const assigned = vehicles.filter(v => v.technicianId === t.id).length;
      const active = vehicles.filter(v => v.technicianId === t.id && (v.status === "Work in Progress" || v.isTimerRunning)).length;
      return { name: t.name, assigned, active };
    });

    // Daily Activity (last 14 days)
    const dailyActivity: any = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dailyActivity[dateStr] = { date: dateStr, received: 0, completed: 0 };
    }

    vehicles.forEach(v => {
      if (v.createdAt) {
        const dateStr = new Date(v.createdAt).toISOString().split('T')[0];
        if (dailyActivity[dateStr]) dailyActivity[dateStr].received++;
      }
      // Assuming completedAt is handled by some logic, but since we don't have it explicitly, 
      // we'll look at history or status. For now, let's use a placeholder logic or status "Delivered"
      if (v.status === "Delivered" && v.jobHistory) {
         // This is complex without a dedicated completedAt field, simplify for now
      }
    });

    // Pending Distribution
    const pendingDist = {
      advisers: vehicles.filter(v => ["Vehicle Received", "Inspection Ongoing", "Inspection Completed"].includes(v.status)).length,
      technicians: vehicles.filter(v => ["Assigned to Technician", "Work in Progress", "Job Stopped"].includes(v.status)).length,
      controller: vehicles.filter(v => v.status === "Waiting for Job Allocation").length
    };

    res.json({
      statusDistribution: Object.entries(statusDistribution).map(([name, value]) => ({ name, value })),
      advisorPerformance: Object.values(advisorPerformance),
      techWorkload,
      dailyActivity: Object.values(dailyActivity),
      pendingDist: [
        { name: "Service Advisers", value: pendingDist.advisers },
        { name: "Technicians", value: pendingDist.technicians },
        { name: "Job Controller", value: pendingDist.controller }
      ]
    });
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

      // Auto-record receivedAt when vehicle is first received
      if (input.status === "Waiting for Adviser") {
        const existing = await storage.getVehicle(id);
        if (existing && !existing.receivedAt) {
          (input as any).receivedAt = new Date().toISOString();
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
    { username: "service_head", password: "service123", name: "Service Head",         role: "service_head" },
    { username: "tech1",      password: "service123", name: "Technician 1",           role: "technician" },
    { username: "tech2",      password: "service123", name: "Technician 2",           role: "technician" },
  ];

  for (const u of usersToCreate) {
    const existing = await storage.getUserByUsername(u.username);
    if (!existing) {
      await storage.createUser(u);
    }
  }
}
