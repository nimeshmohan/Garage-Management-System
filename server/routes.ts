import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import session from "express-session";
import pgSession from "connect-pg-simple";
import { pool, db } from "./db";
import { sql } from "drizzle-orm";
import { users } from "@shared/schema";

function parseJSON<T>(json: any, fallback: T): T {
  if (!json) return fallback;
  if (typeof json !== 'string') return json as T;
  try {
    return JSON.parse(json);
  } catch (e) {
    return fallback;
  }
}


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

  const PostgreSQLStore = pgSession(session);
const sessionStore = new PostgreSQLStore({
  pool,
  createTableIfMissing: false, // Disable this as it fails with ENOENT in bundled prod
});

  // Manually ensure session table exists
  try {
    console.log("[Auth] Ensuring session table exists...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      ) WITH (OIDS=FALSE);
    `);
    await db.execute(sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_pkey') THEN
          ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
        END IF;
      END $$;
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);
    console.log("[Auth] Session table verified.");
  } catch (err: any) {
    console.error("[Auth] Failed to create session table:", err);
  }

  // Use simple session based auth for MVP
  app.use(
    session({
      secret: sessionSecret,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      proxy: isProd,
      cookie: {
        secure: isProd,
        sameSite: "lax",
      },
    }),
  );

  // Health check/Diagnostic route
  app.get("/api/health", async (req, res) => {
    try {
      const result = await db.execute(sql`SELECT 1`);
      const allUsers = await db.select({ 
        username: users.username, 
        role: users.role 
      }).from(users);
      
      // Test session write
      let sessionWrite = "untested";
      try {
        (req.session as any).healthCheck = true;
        await new Promise<void>((resolve, reject) => {
          req.session.save((err) => err ? reject(err) : resolve());
        });
        sessionWrite = "ok";
      } catch (sessErr: any) {
        sessionWrite = `error: ${sessErr.message}`;
      }

      res.json({ 
        status: "ok", 
        database: "connected", 
        userCount: allUsers.length,
        usernames: allUsers.map(u => `${u.username} (${u.role})`),
        sessionWrite,
        env: process.env.NODE_ENV,
        hasSessionSecret: !!process.env.SESSION_SECRET
      });
    } catch (e: any) {
      console.error("[Health] Diagnostic check failed:", e);
      res.status(500).json({ status: "error", message: e.message });
    }
  });

  // Auth Routes
  app.post(api.auth.login.path, async (req, res) => {
    try {
      const { username, password } = api.auth.login.input.parse(req.body);
      console.log(`[Auth] Login attempt for: ${username}`);
      const user = await storage.getUserByUsername(username);
      if (!user) {
        console.log(`[Auth] User not found: ${username}`);
        return res.status(401).json({ message: "Invalid credentials" });
      }
      if (user.password !== password) {
        console.log(`[Auth] Password mismatch for: ${username}`);
        return res.status(401).json({ message: "Invalid credentials" });
      }
      (req.session as any).userId = user.id;
      req.session.save((err) => {
        if (err) {
          console.error(`[Auth] Session save error for ${username}:`, err);
          return res.status(500).json({ message: "Session save failed" });
        }
        console.log(`[Auth] Login successful for: ${username}, role: ${user.role}`);
        res.json(user);
      });
    } catch (e) {
      console.error(`[Auth] Login validation error:`, e);
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      console.log(`[Auth] Register attempt: ${input.username} as ${input.role}`);
      const existing = await storage.getUserByUsername(input.username);
      if (existing) {
        console.log(`[Auth] Registration failed: Username exists: ${input.username}`);
        return res.status(400).json({ message: "Username already exists" });
      }
      const user = await storage.createUser(input);
      (req.session as any).userId = user.id;
      req.session.save((err) => {
        if (err) {
          console.error(`[Auth] Registration session save error:`, err);
        }
        console.log(`[Auth] Registration successful: ${user.username}, id: ${user.id}`);
        res.status(201).json(user);
      });
    } catch (e) {
      console.error(`[Auth] Registration error:`, e);
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


  app.get('/api/debug-session', async (req, res) => {
    const userId = (req.session as any).userId;
    const { db } = await import("./db");
    const { users } = await import("@shared/schema");
    const allUsers = await db.select().from(users);
    
    res.json({
      sessionId: req.sessionID,
      userId,
      usernames: allUsers.map(u => u.username),
      cookie: req.session.cookie,
      env: process.env.NODE_ENV
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

      // Record deliveredAt when status becomes Delivered
      if (input.status === "Delivered") {
        const existing = await storage.getVehicle(id);
        if (existing && !existing.deliveredAt) {
          (input as any).deliveredAt = new Date();
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

  // Analytics Route for Service Head
  app.get("/api/analytics", async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'service_head') {
        return res.status(403).json({ message: "Forbidden" });
      }

      const allVehicles = await storage.getVehicles();
      const technicians = await storage.getTechnicians();

      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const stats = {
        appointed: { today: 0, monthly: 0 },
        received: { today: 0, monthly: 0 },
        serviced: { today: 0, monthly: 0 },
        pending: 0,
        jobStopped: 0,
        delivered: 0
      };

      allVehicles.forEach(v => {
        const createdDate = v.createdAt ? new Date(v.createdAt) : null;
        const receivedDate = v.receivedAt ? new Date(v.receivedAt) : null;
        const deliveredDate = v.deliveredAt ? new Date(v.deliveredAt) : null;

        // Appointed: entryType is "Today's Appointment"
        if (v.entryType === "Today's Appointment") {
          if (createdDate && createdDate >= today) stats.appointed.today++;
          if (createdDate && createdDate >= startOfMonth) stats.appointed.monthly++;
        }

        // Received: Any status EXCEPT "Today's Appointment"
        if (v.status !== "Today's Appointment") {
          const effectiveReceivedDate = receivedDate || createdDate;
          if (effectiveReceivedDate && effectiveReceivedDate >= today) stats.received.today++;
          if (effectiveReceivedDate && effectiveReceivedDate >= startOfMonth) stats.received.monthly++;
        }

        // Serviced: marked "Delivered" or "Ready for Delivery"
        if (v.status === "Delivered" || v.status === "Ready for Delivery") {
          const effectiveDeliveredDate = deliveredDate || (v.status === "Delivered" ? createdDate : null);
          if (effectiveDeliveredDate && effectiveDeliveredDate >= today) stats.serviced.today++;
          if (effectiveDeliveredDate && effectiveDeliveredDate >= startOfMonth) stats.serviced.monthly++;
        }

        // Live Stats
        if (["Waiting for Adviser", "Waiting for Job Allocation", "Work in Progress", "Inspection Completed", "Reopened"].includes(v.status)) {
          stats.pending++;
        }
        if (v.status === "Job Stopped") stats.jobStopped++;
        if (v.status === "Delivered") stats.delivered++;
      });

      // Workflow counts
      const workflow = {
        waitingAllocation: allVehicles.filter(v => v.status === "Waiting for Job Allocation" || v.status === "Inspection Completed").length,
        assigned: allVehicles.filter(v => v.status === "Work in Progress" && !v.isTimerRunning).length,
        wip: allVehicles.filter(v => v.status === "Work in Progress" && v.isTimerRunning).length,
        finalInspection: allVehicles.filter(v => v.status === "Ready for Delivery").length,
        reopened: allVehicles.filter(v => v.status === "Reopened").length,
      };

      // Technician performance
      const techPerformance = technicians.map(t => {
        const techJobs = allVehicles.filter(v => v.technicianId === t.id);
        return {
          id: t.id,
          name: t.name,
          activeJobs: techJobs.filter(v => v.status === "Work in Progress").length,
          completedToday: techJobs.filter(v => v.status === "Delivered" && v.deliveredAt && new Date(v.deliveredAt) >= today).length
        };
      });

      // Alerts: Aging > 24h
      const alerts = allVehicles
        .filter(v => v.status !== "Delivered" && v.status !== "Today's Appointment")
        .filter(v => {
          const start = v.receivedAt ? new Date(v.receivedAt) : (v.createdAt ? new Date(v.createdAt) : now);
          return (now.getTime() - start.getTime()) > 24 * 60 * 60 * 1000;
        })
        .map(v => {
          const start = v.receivedAt ? new Date(v.receivedAt) : (v.createdAt ? new Date(v.createdAt) : now);
          const hours = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60));
          return {
            vehicleNumber: v.vehicleNumber,
            status: v.status,
            aging: `${hours}h`
          };
        })
        .slice(0, 5);

      // Status Distribution
      const statusCounts: Record<string, number> = {};
      allVehicles.forEach(v => {
        statusCounts[v.status] = (statusCounts[v.status] || 0) + 1;
      });
      const statusDistribution = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

      // Advisor Performance
      const advisors = Array.from(new Set(allVehicles.map(v => v.serviceAdviser).filter(Boolean)));
      const advisorPerformance = advisors.map(name => {
        const jobs = allVehicles.filter(v => v.serviceAdviser === name);
        return {
          name: name!,
          total: jobs.length,
          pending: jobs.filter(v => v.status !== "Delivered").length,
          completed: jobs.filter(v => v.status === "Delivered").length
        };
      }).slice(0, 8);

      // Daily Activity (Last 7 days)
      const dailyActivity = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        d.setHours(0, 0, 0, 0);
        const nextD = new Date(d);
        nextD.setDate(d.getDate() + 1);

        return {
          date: d.toLocaleDateString('en-US', { weekday: 'short' }),
          received: allVehicles.filter(v => {
            const r = v.receivedAt ? new Date(v.receivedAt) : v.createdAt;
            return r && new Date(r) >= d && new Date(r) < nextD;
          }).length,
          completed: allVehicles.filter(v => {
            return v.deliveredAt && new Date(v.deliveredAt) >= d && new Date(v.deliveredAt) < nextD;
          }).length
        };
      });

      res.json({
        stats,
        workflow,
        techPerformance,
        alerts,
        statusDistribution,
        advisorPerformance,
        dailyActivity
      });
    } catch (e: any) {
      console.error("[Analytics] Error:", e);
      res.status(500).json({ message: "Internal server error" });
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
    { username: "servicehead", password: "service123", name: "Service Head",        role: "service_head" },
  ];

  for (const u of usersToCreate) {
    const existing = await storage.getUserByUsername(u.username);
    if (!existing) {
      try {
        await storage.createUser(u);
        console.log(`[Seed] Created user: ${u.username}`);
      } catch (err) {
        console.error(`[Seed] Failed to create user ${u.username}:`, err);
      }
    } else {
      console.log(`[Seed] User already exists: ${u.username}`);
    }
  }
  console.log("[Seed] Database seeding completed.");
}
