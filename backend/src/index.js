import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { connectDb } from "./db.js";
import authRoutes from "./routes/auth.js";
import evaluateRoutes from "./routes/evaluate.js";

dotenv.config();
const app = express();

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api", evaluateRoutes);

const port = process.env.PORT || 5000;
connectDb(process.env.MONGODB_URI)
  .then(() => {
    app.listen(port, () => console.log(`Backend listening on ${port}`));
  })
  .catch((e) => {
    console.error("DB connection failed", e.message);
    process.exit(1);
  });
