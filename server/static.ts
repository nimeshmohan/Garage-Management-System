import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(
    express.static(distPath, {
      index: false,
    }),
  );

  // SPA fallback: only for real page navigations (not /api, not assets, not files)
  app.get("/{*path}", (req, res, next) => {
    if (req.method !== "GET") return next();
    if (req.path.startsWith("/api")) return next();
    if (req.path.startsWith("/assets")) return next();
    if (path.extname(req.path)) return next();

    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
