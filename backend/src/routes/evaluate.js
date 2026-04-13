import express from "express";
import multer from "multer";
import fs from "fs";
import axios from "axios";
import { authMiddleware } from "../middleware/auth.js";
import { RoleKeyword } from "../models/RoleKeyword.js";
import { fetchJobDescriptions } from "../services/jobs.js";
import { generateSuggestions } from "../services/suggestions.js";

const router = express.Router();

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"));
  }
});

router.post("/evaluate", authMiddleware, upload.single("cv"), async (req, res) => {
  const filePath = req.file?.path;
  try {
    if (!filePath) return res.status(400).json({ error: "CV file is required" });

    const {
      targetRole,
      experienceYears,
      lastDesignation,
      industry,
      location,
      education
    } = req.body;

    if (!targetRole || !experienceYears || !lastDesignation || !industry || !location || !education) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const roleKeywords = await RoleKeyword.findOne({ role: targetRole }).lean();
    if (!roleKeywords) {
      return res.status(404).json({ error: `No keyword seed found for role: ${targetRole}` });
    }

    const jds = await fetchJobDescriptions({ targetRole, experienceYears, location });
    const { data } = await axios.post(
      `${process.env.PYTHON_SERVICE_URL}/process`,
      {
        cv_path: filePath,
        role_keywords: roleKeywords,
        target_role: targetRole,
        experience_years: Number(experienceYears),
        last_designation: lastDesignation,
        education,
        jds
      },
      { timeout: 90000 }
    );

    const suggestions = await generateSuggestions({
      missingKeywords: data?.keyword_analysis?.missing_keywords || [],
      targetRole
    });

    return res.json({
      meta: {
        targetRole,
        experienceYears: Number(experienceYears),
        industry,
        location
      },
      scores: data.scores,
      extracted: data.extracted,
      keyword_analysis: data.keyword_analysis,
      per_jd_scores: data.per_jd_scores,
      suggestions
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Evaluation failed" });
  } finally {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
});

export default router;
