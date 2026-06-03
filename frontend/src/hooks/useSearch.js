import { useState, useCallback } from "react";
import { api } from "../api";
import { mapServerRow, enrichWithLibrary } from "../utils/searchUtils";

export function useSearch(roles) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeDept, setActiveDept] = useState("all");
  const [hasSearched, setHasSearched] = useState(false);

  const search = useCallback(
    async ({ skills = [], inputText = "", workflowType = null, currency = "INR" }) => {
      setLoading(true);
      setError(null);
      setActiveDept("all");
      setHasSearched(true);
      try {
        let finalSkills = skills;
        let finalText = inputText;

        if (workflowType === "intent" && inputText.trim()) {
          try {
            const { data: gem } = await api.post("/gemini/nl-extract", { query: inputText.trim() });
            if (!gem.skipped) {
              if (gem.skills?.length) finalSkills = [...new Set([...skills, ...gem.skills])];
              if (gem.roles?.length) finalText = gem.roles.join(", ") + " " + inputText;
            }
          } catch {
            // Gemini unavailable — fall through to plain intent search
          }
        }

        const { data } = await api.post("/search-roles-orchestrated", {
          workflow_type: workflowType,
          input_text: finalText,
          skills: finalSkills,
          currency,
          limit_count: 20
        });
        const rows = Array.isArray(data) ? data : [];
        const mapped = rows
          .map((row) => enrichWithLibrary(mapServerRow(row, finalSkills), roles))
          .filter((r) => r.title && Number(r.score) > 0);
        setResults(mapped);
      } catch (e) {
        setError(e?.response?.data?.error || "Search failed. Please try again.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [roles]
  );

  const filteredResults =
    activeDept === "all"
      ? results
      : results.filter((r) => (r.dept || "") === activeDept);

  const depts = results.length
    ? ["all", ...new Set(results.map((r) => r.dept).filter(Boolean))]
    : [];

  return {
    results,
    filteredResults,
    depts,
    loading,
    error,
    activeDept,
    setActiveDept,
    hasSearched,
    search,
    clearResults: () => { setResults([]); setHasSearched(false); setActiveDept("all"); }
  };
}
