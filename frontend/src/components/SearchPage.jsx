import { useState, useRef } from "react";
import SkillInput from "./SkillInput";
import DeptFilter from "./DeptFilter";
import RoleCard from "./RoleCard";
import SalaryModal from "./SalaryModal";
import FloatingPanda from "./FloatingPanda";
import { useAppData } from "../hooks/useAppData";
import { useSearch } from "../hooks/useSearch";

const SAL_UNLOCK_KEY = "sm_sal_unlocked_until";

function isSalaryUnlocked() {
  const ts = localStorage.getItem(SAL_UNLOCK_KEY);
  return ts && Number(ts) > Date.now();
}

function unlockSalary() {
  const now = new Date();
  const until = new Date(now.getFullYear(), 5, 30).getTime(); // June 30 of current year
  localStorage.setItem(SAL_UNLOCK_KEY, String(until));
}

const NL_EXAMPLES = [
  "manage our Salesforce and automate sales workflows",
  "need a backend developer to build APIs for our app",
  "handle accounts, GST and financial reporting",
  "grow our product on social media and run paid ads"
];

export default function SearchPage({ user = {} }) {
  const isHR = String(user?.profession || "").toLowerCase() === "hr";

  const { roles, skillsList, departments, loading: dataLoading } = useAppData();
  const {
    filteredResults, depts, results, loading, error,
    activeDept, setActiveDept, hasSearched, search, clearResults
  } = useSearch(roles);

  const [mode, setMode] = useState("skills");
  const [skills, setSkills] = useState([]);
  const [titleInput, setTitleInput] = useState("");
  const [titleDropOpen, setTitleDropOpen] = useState(false);
  const [nlInput, setNlInput] = useState("");
  const [currency, setCurrency] = useState("INR");
  const lastSearchRef = useRef(null);

  // Salary unlock state — derived from localStorage, re-checked on every render
  const [unlocked, setUnlocked] = useState(() => isSalaryUnlocked());
  const [showSalModal, setShowSalModal] = useState(false);
  const [pandaDismissed, setPandaDismissed] = useState(false);

  const showPanda = hasSearched && results.length > 0 && !unlocked && !pandaDismissed;

  const deptColors = {};
  departments.forEach((d) => {
    deptColors[d.name] = { bg: d.bg_color || "#f3f4f6", color: d.text_color || "#374151" };
  });

  function switchMode(m) {
    setMode(m);
    clearResults();
    setSkills([]);
    setTitleInput("");
    setTitleDropOpen(false);
    setNlInput("");
    lastSearchRef.current = null;
  }

  function runSearch(params) {
    lastSearchRef.current = params;
    search(params);
  }

  function handleSkillsSearch() {
    if (!skills.length) return;
    runSearch({ skills, inputText: skills.join(", "), workflowType: "structured", currency });
  }

  function handleTitleSearch() {
    if (!titleInput.trim()) return;
    setTitleDropOpen(false);
    runSearch({ inputText: titleInput.trim(), workflowType: "title", currency });
  }

  function handleNlSearch() {
    if (!nlInput.trim()) return;
    runSearch({ inputText: nlInput.trim(), workflowType: "intent", currency });
  }

  function handleCurrencyChange(cur) {
    // Currency is display-only — salary data already contains both ₹ and $ segments.
    // Just update local state; RoleCard re-renders instantly with the correct segment.
    setCurrency(cur);
    // Still update lastSearchRef so the *next* fresh search uses the new preference.
    if (lastSearchRef.current) {
      lastSearchRef.current = { ...lastSearchRef.current, currency: cur };
    }
  }

  function openSalModal() { setShowSalModal(true); }

  function handleSalarySuccess() {
    unlockSalary();
    setUnlocked(true);
    setShowSalModal(false);
  }

  const showEmpty = !loading && !hasSearched;
  const showNoResults = !loading && hasSearched && filteredResults.length === 0;

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px 100px" }}>

      {/* Input card */}
      <div className="input-card">
        <div className="mode-tabs">
          {(isHR ? ["skills", "title", "nl"] : ["skills", "title"]).map((m) => (
            <button
              key={m}
              className={`mode-tab${mode === m ? " active" : ""}`}
              onClick={() => switchMode(m)}
            >
              {m === "skills" ? "Add skills" : m === "title" ? "Browse by title" : "Describe what you need"}
            </button>
          ))}
        </div>

        {/* Skills pane */}
        <div className={`mode-pane${mode === "skills" ? " active" : ""}`}>
          {skills.length > 0 && (
            <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 8 }}>
              {skills.length} skill{skills.length !== 1 ? "s" : ""} added
            </div>
          )}
          <SkillInput skills={skills} onChange={setSkills} skillsList={skillsList} />
          <button
            className="btn-find"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={handleSkillsSearch}
            disabled={loading || !skills.length}
          >
            <SearchIcon />
            {loading ? "Searching…" : "Find matching roles"}
          </button>
        </div>

        {/* Title pane */}
        <div className={`mode-pane${mode === "title" ? " active" : ""}`}>
          <div style={{ position: "relative" }}>
            <input
              className="title-search-input"
              placeholder="Type a job title — e.g. Data Engineer, SAP Consultant, Product Manager…"
              value={titleInput}
              onChange={(e) => { setTitleInput(e.target.value); setTitleDropOpen(true); }}
              onKeyDown={(e) => e.key === "Enter" && handleTitleSearch()}
              onFocus={() => titleInput.trim() && setTitleDropOpen(true)}
              onBlur={() => setTimeout(() => setTitleDropOpen(false), 150)}
              autoComplete="off"
            />
            {titleInput && (
              <button
                onClick={() => { setTitleInput(""); setTitleDropOpen(false); clearResults(); }}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--ink3)", fontSize: 18 }}
              >
                ×
              </button>
            )}
            {titleInput.trim() && !loading && titleDropOpen && (
              <TitleSuggestions
                query={titleInput}
                roles={roles}
                onSelect={(title) => {
                  setTitleInput(title);
                  setTitleDropOpen(false);
                  runSearch({ inputText: title, workflowType: "title", currency });
                }}
              />
            )}
          </div>
          <button
            className="btn-find"
            style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
            onClick={handleTitleSearch}
            disabled={loading || !titleInput.trim()}
          >
            <ArrowIcon />
            {loading ? "Searching…" : "Show skills & salary"}
          </button>
        </div>

        {/* NL pane — HR only */}
        {isHR && <div className={`mode-pane${mode === "nl" ? " active" : ""}`}>
          <textarea
            className="nl-textarea"
            placeholder="Describe the responsibilities, tools, or outcomes you need."
            rows={3}
            value={nlInput}
            onChange={(e) => setNlInput(e.target.value)}
          />
          <button
            className="btn-find"
            style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
            onClick={handleNlSearch}
            disabled={loading || !nlInput.trim()}
          >
            <ArrowIcon />
            {loading ? "Searching…" : "Find matching roles"}
          </button>
          {!hasSearched && (
            <div className="nl-examples">
              {NL_EXAMPLES.map((ex) => (
                <button key={ex} className="nl-example" onClick={() => setNlInput(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="result-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ background: "#fff", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
              <div style={{ padding: "18px 20px 14px" }}>
                <div style={{ height: 10, width: "35%", background: "#e2e8f0", borderRadius: 6, marginBottom: 14 }} className="animate-pulse" />
                <div style={{ height: 12, width: "70%", background: "#e2e8f0", borderRadius: 6, marginBottom: 10 }} className="animate-pulse" />
                <div style={{ height: 10, width: "90%", background: "#e2e8f0", borderRadius: 6, marginBottom: 8 }} className="animate-pulse" />
                <div style={{ height: 10, width: "55%", background: "#e2e8f0", borderRadius: 6 }} className="animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && hasSearched && results.length > 0 && (
        <>
          <div className="results-header">
            <div className="results-title">{results.length} matching role{results.length !== 1 ? "s" : ""}</div>
            <button
              onClick={() => { clearResults(); setSkills([]); setTitleInput(""); setNlInput(""); lastSearchRef.current = null; }}
              style={{ padding: "4px 10px", background: "transparent", border: "1.5px solid var(--border)", borderRadius: 20, fontSize: 11.5, fontWeight: 600, color: "var(--ink3)", cursor: "pointer", fontFamily: "var(--sans)" }}
            >
              ↩ New search
            </button>
          </div>

          <div className="currency-row">
            <span>Salary in:</span>
            {["INR", "USD"].map((cur) => (
              <button
                key={cur}
                className={`currency-btn${currency === cur ? " active" : ""}`}
                onClick={() => handleCurrencyChange(cur)}
              >
                {cur}
              </button>
            ))}
          </div>

          <DeptFilter
            depts={depts}
            results={results}
            activeDept={activeDept}
            onSelect={setActiveDept}
          />

          {activeDept !== "all" && filteredResults.length < results.length && (
            <div style={{ padding: "8px 12px", background: "var(--accent-lt)", borderRadius: 8, fontSize: 13, color: "var(--accent)", marginBottom: 10 }}>
              Showing <strong>{activeDept}</strong> roles only ·{" "}
              <button
                onClick={() => setActiveDept("all")}
                style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0 }}
              >
                Show all {results.length} →
              </button>
            </div>
          )}

          <div className="result-grid">
            {filteredResults.map((role, i) => (
              <RoleCard
                key={role.id || i}
                role={role}
                deptColors={deptColors}
                showScore={mode !== "title"}
                isUnlocked={unlocked}
                onLockClick={openSalModal}
                currency={currency}
                isHR={isHR}
                user={user}
              />
            ))}
          </div>
        </>
      )}

      {/* No results */}
      {showNoResults && (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <div className="empty-title">No matching roles found</div>
          <div className="empty-sub">Try different skills or describe your need differently.</div>
        </div>
      )}

      {/* Initial empty */}
      {showEmpty && !dataLoading && (
        <div className="empty-state">
          <div className="empty-icon">🎯</div>
          <div className="empty-title">Start above to see role matches</div>
          <div className="empty-sub">Type skills, search by title, or describe what you need — results appear instantly.</div>
        </div>
      )}

      {/* Floating panda */}
      {showPanda && (
        <FloatingPanda
          onPrompt={() => { setPandaDismissed(true); openSalModal(); }}
        />
      )}

      {/* Salary modal */}
      {showSalModal && (
        <SalaryModal
          onClose={() => setShowSalModal(false)}
          onSuccess={handleSalarySuccess}
        />
      )}
    </main>
  );
}

function TitleSuggestions({ query, roles, onSelect }) {
  const lower = query.toLowerCase();

  // Collect matches: each entry is { role, matchedAlias } where matchedAlias is set
  // if we matched via an alias rather than the canonical title.
  const MAX = 30;
  const seen = new Set();
  const entries = [];

  for (const r of roles) {
    if (entries.length >= MAX) break;
    const titleMatch = r.title.toLowerCase().includes(lower);
    const aliasMatch = !titleMatch && (r.aliases || []).find(
      (a) => a.toLowerCase().includes(lower)
    );
    if (titleMatch || aliasMatch) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        entries.push({ role: r, matchedAlias: aliasMatch || null });
      }
    }
  }

  if (!entries.length) return null;

  // Group by department
  const groups = {};
  const deptOrder = [];
  for (const entry of entries) {
    const dept = entry.role.dept || "Other";
    if (!groups[dept]) { groups[dept] = []; deptOrder.push(dept); }
    groups[dept].push(entry);
  }

  return (
    <div className="title-dropdown">
      {deptOrder.map((dept) => (
        <div key={dept}>
          <div className="title-dept-header">{dept}</div>
          {groups[dept].map(({ role, matchedAlias }) => (
            <div
              key={role.id}
              className="title-item"
              onMouseDown={(e) => { e.preventDefault(); onSelect(role.title); }}
            >
              {matchedAlias ? (
                <>
                  <div className="title-item-alias">— {matchedAlias}</div>
                  <div className="title-item-title" style={{ fontSize: 12, fontWeight: 500, color: "var(--ink3)" }}>
                    {role.title}
                  </div>
                </>
              ) : (
                <div className="title-item-title">{role.title}</div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width={16} height={16}>
      <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width={16} height={16}>
      <path d="M13 8H3M8 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
