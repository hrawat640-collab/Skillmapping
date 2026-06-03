import { useState, useCallback } from "react";
import { api } from "../api";

export function useSearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastQuery, setLastQuery] = useState(null);
  const [aiEnhanced, setAiEnhanced] = useState(false);

  const search = useCallback(async ({
    mode,
    skills = [],
    titleIds = [],
    nlText = "",
    department = null,
    currency = "INR",
    limit = 10
  }) => {
    setLoading(true);
    setError(null);
    setAiEnhanced(false);

    try {
      let workflowType = mode;
      let rawQuery = "";
      let querySkills = skills;

      if (mode === "skills") {
        workflowType = "structured";
        querySkills = skills;
        rawQuery = skills.join(" ");
      } else if (mode === "title") {
        workflowType = "title";
        rawQuery = titleIds.join(" ");
        querySkills = [];
      } else if (mode === "nl") {
        workflowType = "intent";
        rawQuery = nlText;
        querySkills = [];

        // Enhance with Gemini NL extraction if available
        try {
          const nlRes = await api.post("/gemini/nl-extract", { text: nlText });
          if (nlRes.data?.query && nlRes.data.query !== nlText) {
            rawQuery = nlRes.data.query;
            setAiEnhanced(true);
          }
        } catch {
          // fall through with original text
        }
      }

      setLastQuery({ mode, rawQuery, skills: querySkills, department, currency });

      const res = await api.post("/search-roles-orchestrated", {
        workflow_type: workflowType,
        input_text: rawQuery,
        skills: querySkills,
        selected_department: department,
        currency,
        limit_count: limit
      });

      setResults(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResults([]);
    setError(null);
    setLastQuery(null);
    setAiEnhanced(false);
  }, []);

  return { results, loading, error, lastQuery, aiEnhanced, search, clear };
}
