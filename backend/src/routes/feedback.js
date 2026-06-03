import express from "express";
import { getSupabaseAdmin } from "../supabaseClient.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { email, name, subject, message } = req.body;
  if (!message?.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  const sb = getSupabaseAdmin();
  if (!sb) return res.status(503).json({ error: "Database unavailable" });

  // Try inserting with all columns first, then fall back gracefully if a column
  // doesn't exist in the target table.
  const base = {
    email: email || "anonymous",
    name: name || null,
    subject: subject || null,
    message: message.trim(),
    created_at: new Date().toISOString(),
  };

  const { error: e1 } = await sb.from("feedback").insert(base);
  if (!e1) return res.json({ ok: true });

  // Fallback: drop optional columns if the schema is narrower
  const minimal = { email: base.email, message: base.message };
  const { error: e2 } = await sb.from("feedback").insert(minimal);
  if (!e2) return res.json({ ok: true });

  console.error("feedback insert failed:", e2.message);
  return res.status(500).json({ error: "Could not save feedback" });
});

export default router;
