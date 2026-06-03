import { useState, useRef, useEffect } from "react";
import { useAppData } from "../hooks/useAppData";
import { useSearch } from "../hooks/useSearch";
import { enrichWithLibrary } from "../utils/searchUtils";
import SkillInput from "./SkillInput";
import DeptFilter from "./DeptFilter";
import RoleCard from "./RoleCard";
import SalaryModal from "./SalaryModal";
import FloatingPanda from "./FloatingPanda";

const NL_EXAMPLES = [
  "Someone who builds REST APIs and integrates third-party services",
  "Hire a person who can analyse dashboards and create reports",
  "Looking for someone to design mobile app screens in Figma"
];

function isHRUser(user) {
  return String(user?.profession || "").toLowerCase() === "hr";
}

export default function SearchPage({ user, onLoginRequired }) {
  const { roles, skills, departments } = useAppData();

  const [mode, setMode] = useState("skills");
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [selectedTitles, setSelectedTitles] = useState([]); // array of title strings
  const [titleQuery, setTitleQuery] = useState("");
  const [titleDropOpen, setTitleDropOpen] = useState(false);
  const [nlText, setNlText] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [department, setDepartment] = useState(null);
  const [salaryRole, setSalaryRole] = useState(null);

  const { results, loading, error, aiEnhanced, lastQuery, search, clear } = useSearch();
  const enriched = enrichWithLibrary(results, roles);

  // Count results per department for filter pills
  const deptCounts = enriched.reduce((acc, r) => {
    const d = r.dept || r.department_name;
    if (d) acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});

  const isHR = isHRUser(user);
  const titleInputRef = useRef(null);
  const titleDropRef = useRef(null);

  // Title dropdown filtered list
  const titleOptions = roles.filter((r) => {
    const q = titleQuery.toLowerCase().trim();
    if (!q) return true;
    const t = (r.title || "").toLowerCase();
    const aliases = (r.aliases || []).map((a) => a.toLowerCase());
    return t.includes(q) || aliases.some((a) => a.includes(q));
  });

  const titlesByDept = titleOptions.reduce((acc, r) => {
    const d = r.dept || "Other";
    if (!acc[d]) acc[d] = [];
    acc[d].push(r);
    return acc;
  }, {});

  function handleTitleSelect(title) {
    if (!selectedTitles.includes(title)) {
      setSelectedTitles([...selectedTitles, title]);
    } else {
      setSelectedTitles(selectedTitles.filter((t) => t !== title));
    }
    setTitleQuery("");
    setTitleDropOpen(false);
    titleInputRef.current?.focus();
  }

  function handleSearch() {
    if (mode === "skills" && !selectedSkills.length) return;
    if (mode === "title" && !selectedTitles.length) return;
    if (mode === "nl" && !nlText.trim()) return;

    search({ mode, skills: selectedSkills, titleIds: selectedTitles, nlText, department, currency });
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleSearch();
  }

  // Close title dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (titleDropRef.current && !titleDropRef.current.contains(e.target)) {
        setTitleDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="main">
      {/* Search card */}
      <div className="input-card">
        <div className="mode-tabs">
          <button
            className={`mode-tab${mode === "skills" ? " active" : ""}`}
            onClick={() => { if (mode !== "skills") { setMode("skills"); clear(); } }}
          >
            Add skills
          </button>
          <button
            className={`mode-tab${mode === "title" ? " active" : ""}`}
            onClick={() => { if (mode !== "title") { setMode("title"); clear(); } }}
          >
            Browse by title
          </button>
          {isHR && (
            <button
              className={`mode-tab${mode === "nl" ? " active" : ""}`}
              onClick={() => { if (mode !== "nl") { setMode("nl"); clear(); } }}
            >
              Describe what you need
            </button>
          )}
        </div>

        {/* Skills mode */}
        {mode === "skills" && (
          <div className="mode-pane">
            {selectedSkills.length > 0 && (
              <div className="ic-label" style={{ justifyContent: "flex-end" }}>
                <span>{selectedSkills.length} selected</span>
              </div>
            )}
            <SkillInput
              skills={selectedSkills}
              onChange={setSelectedSkills}
              allSkills={skills}
            />
            <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
              <button
                className="btn-find"
                style={{ width: "100%" }}
                onClick={handleSearch}
                disabled={loading || !selectedSkills.length}
              >
                {loading ? (
                  <>
                    <span className="loading-dot" style={{ width: 6, height: 6, background: "#fff" }} />
                    Searching…
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/><path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    Show skills &amp; salary
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Title mode */}
        {mode === "title" && (
          <div className="mode-pane">
            {selectedTitles.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div className="selected-titles">
                  {selectedTitles.map((t) => (
                    <span className="title-chip" key={t}>
                      {t}
                      <button className="title-chip-x" onClick={() => setSelectedTitles(selectedTitles.filter((x) => x !== t))}>×</button>
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTitles([])}
                  style={{ background: "none", border: "none", fontSize: 12, color: "var(--ink3)", cursor: "pointer", padding: "4px 0", fontFamily: "var(--sans)" }}
                >
                  ↺ Clear selection
                </button>
              </div>
            )}

            <div className="title-search-wrap" ref={titleDropRef}>
              <input
                ref={titleInputRef}
                className="title-search-input"
                placeholder="Search role titles…"
                value={titleQuery}
                onChange={(e) => { setTitleQuery(e.target.value); setTitleDropOpen(true); }}
                onFocus={() => setTitleDropOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setTitleDropOpen(false);
                  if (e.key === "Enter") { setTitleDropOpen(false); handleSearch(); }
                }}
              />

              {titleDropOpen && titleOptions.length > 0 && (
                <div className="title-dropdown open">
                  {Object.entries(titlesByDept).map(([dept, dRoles]) => (
                    <div key={dept}>
                      <div className="td-dept">{dept}</div>
                      {dRoles.map((r) => (
                        <div
                          key={r.id}
                          className={`td-item${selectedTitles.includes(r.title) ? " selected" : ""}`}
                          onMouseDown={(e) => { e.preventDefault(); handleTitleSelect(r.title); }}
                        >
                          {r.title}
                          <span className="td-check">✓</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
              <button
                className="btn-find"
                style={{ width: "100%" }}
                onClick={handleSearch}
                disabled={loading || !selectedTitles.length}
              >
                {loading ? (
                  <>
                    <span className="loading-dot" style={{ width: 6, height: 6, background: "#fff" }} />
                    Searching…
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/><path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    Show skills &amp; salary
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* NL / describe mode (HR only) */}
        {mode === "nl" && (
          <div className="mode-pane">
            <textarea
              className="nl-textarea"
              placeholder="e.g. Someone who builds REST APIs and integrates third-party services…"
              value={nlText}
              onChange={(e) => setNlText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) handleSearch(); }}
              rows={3}
            />
            <div className="nl-examples">
              {NL_EXAMPLES.map((ex) => (
                <button key={ex} className="nl-example" onClick={() => setNlText(ex)}>
                  {ex}
                </button>
              ))}
            </div>

            {aiEnhanced && (
              <div className="ai-banner" style={{ marginTop: 12 }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                AI-enhanced query was used to improve your search results.
              </div>
            )}

            <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
              <button
                className="btn-find"
                style={{ width: "100%" }}
                onClick={handleSearch}
                disabled={loading || !nlText.trim()}
              >
                {loading ? (
                  <>
                    <span className="loading-dot" style={{ width: 6, height: 6, background: "#fff" }} />
                    Searching…
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 16 16" fill="none"><path d="M13 8H3M8 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Show skills &amp; salary
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Currency toggle */}
      {enriched.length > 0 && (
        <div id="currencyBar">
          <span>Salary in</span>
          {["INR", "USD"].map((c) => (
            <button
              key={c}
              className={`cur-chip${currency === c ? " active" : ""}`}
              onClick={() => setCurrency(c)}
            >
              {c === "INR" ? "₹ INR" : "$ USD"}
            </button>
          ))}
        </div>
      )}

      {/* Dept filter */}
      {departments.length > 0 && enriched.length > 0 && (
        <DeptFilter departments={departments} active={department} onChange={setDepartment} counts={deptCounts} />
      )}

      {/* Results */}
      {loading && (
        <div className="loading-state">
          <div className="loading-dots">
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span className="loading-dot" />
          </div>
          <div className="loading-text"><strong>Searching</strong> across 155+ roles…</div>
        </div>
      )}

      {!loading && !error && lastQuery === null && enriched.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon" style={{ fontSize: 36, marginBottom: 10 }}>🎯</div>
          <div className="empty-title">Start above to see role matches</div>
          <div className="empty-sub">Type skills, search by title, or describe what you need — results appear instantly.</div>
        </div>
      )}

      {!loading && error && (
        <div className="empty-state">
          <div className="empty-title">Search error</div>
          <div className="empty-sub">{error}</div>
        </div>
      )}

      {!loading && !error && enriched.length > 0 && (
        <>
          <div className="results-header">
            <div className="results-title">
              {mode === "skills" && selectedSkills.length > 0
                ? `${selectedSkills.length} skill${selectedSkills.length !== 1 ? "s" : ""} entered`
                : mode === "title" && selectedTitles.length > 0
                ? `${selectedTitles.length} title${selectedTitles.length !== 1 ? "s" : ""} selected`
                : "Matching roles"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="results-count">{enriched.length} found</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedSkills([]);
                  setSelectedTitles([]);
                  setNlText("");
                  setDepartment(null);
                }}
                style={{ padding: "4px 10px", background: "transparent", border: "1.5px solid var(--border)", borderRadius: 20, fontSize: 11.5, fontWeight: 600, color: "var(--ink3)", cursor: "pointer", fontFamily: "var(--sans)" }}
              >
                ↩ New search
              </button>
            </div>
          </div>
          <div className="result-grid">
            {enriched
              .filter((r) => !department || (r.dept || r.department_name) === department)
              .map((role, i) => (
                <RoleCard
                  key={role.id || role.role_id || i}
                  role={role}
                  currency={currency}
                  onSalaryContribute={(r) => {
                    if (!user) { onLoginRequired?.(); return; }
                    setSalaryRole(r);
                  }}
                  onLoginRequired={onLoginRequired}
                />
              ))}
          </div>
        </>
      )}

      {salaryRole && (
        <SalaryModal
          role={salaryRole}
          onClose={() => setSalaryRole(null)}
          onSuccess={() => setSalaryRole(null)}
        />
      )}

      <FloatingPanda
        hasResults={enriched.length > 0}
        onContribute={() => {
          if (!user) { onLoginRequired?.(); return; }
          setSalaryRole(enriched[0] || null);
        }}
      />
    </div>
  );
}
