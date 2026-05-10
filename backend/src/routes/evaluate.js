import express from "express";
import multer from "multer";
import fs from "fs";
import axios from "axios";
import { authMiddleware } from "../middleware/auth.js";
import { getSupabaseAdmin } from "../supabaseClient.js";
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

    const sb = getSupabaseAdmin();
    if (!sb) {
      return res.status(503).json({
        error: "Evaluation unavailable: configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)."
      });
    }

    const { data: roleRow, error: roleErr } = await sb
      .from("roles_v2")
      .select("id, canonical_title")
      .ilike("canonical_title", targetRole)
      .limit(1)
      .maybeSingle();
    if (roleErr) {
      return res.status(500).json({ error: roleErr.message || "Role lookup failed" });
    }
    if (!roleRow?.id) {
      return res.status(404).json({ error: `No role found for: ${targetRole}` });
    }

    const [{ data: semanticRows, error: semanticErr }, { data: roleSkillRows, error: roleSkillErr }, { data: skillsRows, error: skillsErr }] =
      await Promise.all([
        sb
          .from("role_semantic_metadata")
          .select(
            "summary,keywords,tools,responsibilities,work_examples,output_types,related_roles,domains,seniority_signals,search_phrases"
          )
          .eq("role_id", roleRow.id)
          .limit(1),
        sb
          .from("role_skills")
          .select("skill_id, importance, weight")
          .eq("role_id", roleRow.id),
        sb.from("skills_v2").select("id, canonical_name")
      ]);

    if (semanticErr) return res.status(500).json({ error: semanticErr.message || "Semantic lookup failed" });
    if (roleSkillErr) return res.status(500).json({ error: roleSkillErr.message || "Role skills lookup failed" });
    if (skillsErr) return res.status(500).json({ error: skillsErr.message || "Skills lookup failed" });

    const semantic = (semanticRows && semanticRows[0]) || {};
    const skillNameById = new Map((skillsRows || []).map((s) => [s.id, s.canonical_name]));
    const roleSkills = (roleSkillRows || []).map((row) => ({
      skill: skillNameById.get(row.skill_id) || "",
      importance: row.importance || "good_to_have",
      weight: Number(row.weight || 0)
    })).filter((s) => s.skill);

    if (!roleSkills.length) {
      return res.status(404).json({ error: `No role skills found for role: ${targetRole}` });
    }

    const jds = await fetchJobDescriptions({ targetRole, experienceYears, location });
    const { data } = await axios.post(
      `${process.env.PYTHON_SERVICE_URL}/process`,
      {
        cv_path: filePath,
        role_skills: roleSkills,
        role_semantic_metadata: semantic,
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
