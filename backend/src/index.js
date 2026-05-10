import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import fs from "fs";
import crypto from "crypto";

import authRoutes from "./routes/auth.js";
import evaluateRoutes from "./routes/evaluate.js";
import searchRolesRoutes from "./routes/searchRoles.js";

import { getSupabaseAdmin } from "./supabaseClient.js";

const app = express();
const isProduction = process.env.NODE_ENV === "production";

/** Honor X-Forwarded-For on hosts like Render for rate limiting and logs. */
app.set("trust proxy", 1);

function validateRuntimeConfig() {
  const required = ["SUPABASE_URL"];
  const hasService = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hasAnon = !!process.env.SUPABASE_ANON_KEY;
  if (!hasService && !hasAnon) required.push("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY");
  const missing = required.filter((k) => {
    if (k.includes(" or ")) return false;
    return !process.env[k];
  });
  if (!hasService && !hasAnon) missing.push("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY");
  return {
    ok: missing.length === 0,
    missing
  };
}

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const allowedOrigins = new Set([
  "http://localhost:5500",
  "http://127.0.0.1:5500",
]);

if (process.env.FRONTEND_ORIGIN) {
  allowedOrigins.add(process.env.FRONTEND_ORIGIN);
}

if (process.env.NETLIFY_ORIGIN) {
  allowedOrigins.add(process.env.NETLIFY_ORIGIN);
}

const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser clients and local file origin (origin can be null/undefined).
    if (!origin || origin === "null") {
      return callback(null, true);
    }

    if (allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use((req, res, next) => {
  const startedAt = Date.now();
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  res.setHeader("x-request-id", requestId);
  req.requestId = requestId;
  res.on("finish", () => {
    const elapsedMs = Date.now() - startedAt;
    const payload = {
      level: "info",
      event: "http_request",
      request_id: requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      elapsed_ms: elapsedMs
    };
    if (!isProduction || res.statusCode >= 400 || req.originalUrl.includes("/search-roles")) {
      console.log(JSON.stringify(payload));
    }
  });
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
  });
});

app.use("/api/auth", authRoutes);

app.use("/api", evaluateRoutes);

app.use("/api", searchRolesRoutes);

app.use((err, req, res, next) => {
  if (!err) return next();
  const isCorsError = /CORS blocked for origin:/i.test(err?.message || "");
  if (isCorsError) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "cors_blocked",
        request_id: req.requestId || null,
        origin: req.headers.origin || null,
        path: req.originalUrl
      })
    );
    return res.status(403).json({ error: "Origin not allowed", code: "CORS_ORIGIN_BLOCKED" });
  }
  console.error(
    JSON.stringify({
      level: "error",
      event: "unhandled_http_error",
      request_id: req.requestId || null,
      message: err?.message || String(err),
      path: req.originalUrl
    })
  );
  return res.status(500).json({ error: "Internal server error", code: "INTERNAL_SERVER_ERROR" });
});

const runtimeConfig = validateRuntimeConfig();
if (!runtimeConfig.ok) {
  console.error(
    JSON.stringify({
      level: "error",
      event: "runtime_config_invalid",
      missing: runtimeConfig.missing
    })
  );
  process.exit(1);
}

const sb = getSupabaseAdmin();

if (!sb) {
  console.error(
    "Startup failed: configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)."
  );

  process.exit(1);
}

const port = process.env.PORT || 5000;

process.on("uncaughtException", (err) => {
  console.error(
    JSON.stringify({
      level: "error",
      event: "uncaught_exception",
      message: err?.message || String(err),
      stack: isProduction ? undefined : err?.stack
    })
  );
});

process.on("unhandledRejection", (reason) => {
  console.error(
    JSON.stringify({
      level: "error",
      event: "unhandled_rejection",
      message: reason?.message || String(reason),
      stack: isProduction ? undefined : reason?.stack
    })
  );
});

app.listen(port, () => {
  console.log(
    JSON.stringify({
      level: "info",
      event: "backend_started",
      port: Number(port),
      node_env: process.env.NODE_ENV || "development"
    })
  );
});
