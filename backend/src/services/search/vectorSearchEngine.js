const GEMINI_EMBED_MODEL = "text-embedding-004";

function geminiApiKey() {
  return process.env.GEMINI_API_KEY || "";
}

async function fetchEmbedding(text) {
  const key = geminiApiKey();
  if (!key) return null; // skip path 1: no API key configured

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBED_MODEL}:embedContent?key=${key}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${GEMINI_EMBED_MODEL}`,
      content: { parts: [{ text }] }
    })
  });
  const data = await r.json();
  if (!r.ok) {
    console.warn("vectorSearchEngine: embed failed", data?.error?.message);
    return null; // skip path 2: embedding API error
  }
  return data.embedding?.values || null;
}

/**
 * Returns up to limitCount results from pgvector semantic search.
 * Has three graceful skip paths — returns [] instead of throwing:
 *   1. No GEMINI_API_KEY configured
 *   2. Embedding API returns error
 *   3. match_roles_by_embedding RPC not available / returns error
 */
export async function vectorSearchEngine({ sb, rawQuery, selectedDepartment, limitCount = 10 }) {
  if (!sb) return [];

  const embedding = await fetchEmbedding(String(rawQuery || "").slice(0, 500));
  if (!embedding || !embedding.length) return []; // skip path 2

  try {
    const { data, error } = await sb.rpc("match_roles_by_embedding", {
      query_embedding: embedding,
      match_threshold: 0.70,
      match_count: Math.min(limitCount * 2, 30),
      filter_department: selectedDepartment || null
    });

    if (error) {
      // skip path 3: RPC not available or query error
      if (process.env.NODE_ENV !== "production") {
        console.warn("vectorSearchEngine: match_roles_by_embedding error:", error.message);
      }
      return [];
    }

    return (data || []).map((r) => ({
      role_id: r.id || r.role_id,
      canonical_title: r.canonical_title || r.title || "",
      department_name: r.department_name || r.dept || "",
      level_code: r.level_code || "L2",
      level_display: r.level_display || "Mid",
      final_score: Number(r.similarity || r.score || 0),
      confidence: Number(r.similarity || 0) >= 0.85 ? "high" : Number(r.similarity || 0) >= 0.75 ? "medium" : "low",
      hint: r.hint || "",
      required_skills: r.required_skills || r.required || [],
      good_to_have: r.good_to_have || r.nice || [],
      aliases: r.aliases || [],
      matched_skills: [],
      missing_skills: [],
      matched_skill_count: 0,
      missing_skill_count: 0,
      why_matched: "Vector semantic match.",
      percentile_25: r.percentile_25 || null,
      percentile_75: r.percentile_75 || null,
      benchmark_currency: r.benchmark_currency || "INR",
      salary_display: r.salary_display || ""
    }));
  } catch {
    return []; // skip path 3
  }
}
