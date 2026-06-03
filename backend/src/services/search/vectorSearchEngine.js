/**
 * F: pgvector real semantic search
 * Generates a query embedding via Gemini text-embedding-004, then calls the
 * Supabase `match_roles_by_embedding` RPC for cosine-similarity role retrieval.
 *
 * Graceful degradation:
 *  - GEMINI_API_KEY absent  → skipped (returns empty results, reason "no_key")
 *  - Embedding API error    → skipped (reason "embed_error")
 *  - RPC missing/error      → skipped (reason "rpc_error")
 */

import { getSupabaseAdmin } from "../../supabaseClient.js";

const EMBED_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent";

async function getQueryEmbedding(text) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { embedding: null, reason: "no_key" };

  try {
    const res = await fetch(`${EMBED_URL}?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text: String(text || "").slice(0, 2048) }] },
        taskType: "RETRIEVAL_QUERY"
      })
    });
    if (!res.ok) return { embedding: null, reason: `embed_http_${res.status}` };
    const data = await res.json();
    const values = data?.embedding?.values;
    if (!Array.isArray(values) || !values.length) return { embedding: null, reason: "embed_empty" };
    return { embedding: values, reason: null };
  } catch (e) {
    return { embedding: null, reason: `embed_error:${e?.message || e}` };
  }
}

export async function vectorSearchEngine(params) {
  const startedAt = Date.now();
  const query = String(params?.rawQuery || "").trim();
  const sb = getSupabaseAdmin();

  const skip = (reason) => ({
    workflowType: "vector",
    results: [],
    normalizedQuery: query,
    detectedSkills: [],
    responseTimeMs: Date.now() - startedAt,
    skipped: true,
    skipReason: reason
  });

  if (!sb || !query) return skip("no_sb_or_query");

  const { embedding, reason: embedReason } = await getQueryEmbedding(query);
  if (!embedding) return skip(embedReason || "no_embedding");

  try {
    const { data, error } = await sb.rpc("match_roles_by_embedding", {
      query_embedding: embedding,
      match_threshold: 0.62,
      match_count: Math.min(Number(params.limitCount || 10), 20),
      currency: params.currency || "INR"
    });

    if (error) return skip(`rpc_error:${error.message || error}`);

    return {
      workflowType: "vector",
      results: Array.isArray(data) ? data : [],
      normalizedQuery: query,
      detectedSkills: [],
      responseTimeMs: Date.now() - startedAt,
      skipped: false
    };
  } catch (e) {
    return skip(`rpc_throw:${e?.message || e}`);
  }
}
