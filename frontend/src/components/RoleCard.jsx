import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { parseSalarySegments, buildTalentXRayUrl } from "../utils/searchUtils";

const SHOW_ROLE_HINT = false; // Phase 2: gate on company_admin viewer

const LEVELS = ["junior", "mid", "senior", "lead"];
const LEVEL_LABELS = { junior: "Junior", mid: "Mid", senior: "Senior", lead: "Lead" };

function getUser() {
  try { return JSON.parse(localStorage.getItem("sm_user") || "null"); } catch { return null; }
}

function isHROrFounder(user) {
  const p = String(user?.profession || "").toLowerCase();
  return p === "hr" || p === "founder" || p === "professional";
}

function isStrictHR(user) {
  return String(user?.profession || "").toLowerCase() === "hr";
}

function formatSalLine(yrsMin, yrsMax, pipe, currency = "INR") {
  const min = Number(yrsMin);
  const max = Number(yrsMax);
  const expOk = isFinite(min) && isFinite(max) && !(min === 0 && max === 0) && max >= min;
  const segs = parseSalarySegments(pipe);
  const salStr = segs[currency] || "";

  if (!expOk && !salStr) return { exp: "Experience varies", sal: null };
  if (expOk && !salStr) return { exp: `${min}-${max} yrs`, sal: null };
  if (!expOk && salStr) return { exp: "Experience varies", sal: salStr };
  return { exp: `${min}-${max} yrs`, sal: salStr };
}

export default function RoleCard({ role, currency = "INR", onSalaryContribute, onLoginRequired }) {
  const [salLevel, setSalLevel] = useState("junior");
  const { salaryUnlocked } = useAuth();

  const user = getUser();
  const isHR = isHROrFounder(user);
  const isHROnly = isStrictHR(user);
  const salUnlocked = salaryUnlocked;

  const dept = role.dept || role.department_name || "";
  const title = role.title || role.canonical_title || "";
  const score = role.final_score ? Math.round(role.final_score * 100) : null;
  // Filter out corrupted aliases where the first char was stripped during seeding
  // (detected by: first word starts with lowercase and has no natural lowercase-start like "ml", "ios", "api")
  const aliases = (role.aliases || []).filter((a) => {
    if (!a || a.toLowerCase() === title.toLowerCase()) return false;
    const firstWord = a.trim().split(/\s+/)[0];
    const naturallyLower = /^(ml|ai|ios|api|ui|ux|bi|it|qa|hr|vp|cto|cfo|coo|ceo|devops|erp|crm|sap|nlp)$/i.test(firstWord);
    if (!naturallyLower && firstWord === firstWord.toLowerCase() && firstWord.length > 1) return false;
    return true;
  });

  function handleSearchProfessional() {
    if (!user) { onLoginRequired?.(); return; }
    const url = buildTalentXRayUrl(role, user);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleSalaryClick(level) {
    // Junior is always free; Mid/Senior/Lead require unlock
    if (level !== "junior" && !salUnlocked) {
      onSalaryContribute?.(role);
      return;
    }
    setSalLevel((prev) => prev === level ? null : level);
  }

  const required = role.required || [];
  const nice = role.nice || [];
  const matched = role.matched_skills || [];

  const activeLevelData = salLevel ? role.exp?.[salLevel] : null;
  const salLine = activeLevelData
    ? formatSalLine(activeLevelData[0], activeLevelData[1], activeLevelData[2], currency)
    : null;

  return (
    <div className="result-card" role="article">
      <div className="rc-top">
        <div className="rc-left">
          {dept && (
            <div className="rc-dept">
              <span style={{ background: "#F6F3FD", color: "#6E56F0", padding: "2px 8px", borderRadius: 20, fontSize: 10 }}>
                {dept}
              </span>
            </div>
          )}
          <div className="rc-title">{title}</div>

          {(role.role_summary || role.short_description || role.desc || role.description) && (
            <div className="rc-desc rc-role-summary">
              {role.role_summary || role.short_description || role.desc || role.description}
            </div>
          )}

          {SHOW_ROLE_HINT && isHROnly && role.hint && (
            <div className="rc-hint">
              <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#D97706" strokeWidth="1.5"/><path d="M8 7v4M8 5.5v.5" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round"/></svg>
              <span>{role.hint}</span>
            </div>
          )}
        </div>

      </div>

      <div className="rc-bottom">
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Experience & Salary */}
          {LEVELS.some((l) => role.exp?.[l]) && (
            <div>
              <div className="rc-exp-head">
                <span className="rc-sec-lbl">Experience &amp; Salary</span>
                <div className="salary-selector">
                  {LEVELS.map((level) => {
                    if (!role.exp?.[level]) return null;
                    const needsUnlock = level !== "junior" && !salUnlocked;
                    return (
                      <button
                        key={level}
                        className={`sal-btn ${level}${salLevel === level ? " active" : ""}`}
                        onClick={() => handleSalaryClick(level)}
                        title={needsUnlock ? "Contribute salary to unlock" : `Show ${level} salary`}
                      >
                        {needsUnlock ? `🔒 ${LEVEL_LABELS[level]}` : LEVEL_LABELS[level]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="sal-display">
                {salLine ? (
                  salLine.sal ? (
                    <>
                      <strong className="rc-yrs-mono">{salLine.exp}</strong>
                      <span className="rc-sal-sep"> &bull; </span>
                      <strong>{salLine.sal}</strong>
                    </>
                  ) : (
                    <>
                      <strong className="rc-yrs-mono">{salLine.exp}</strong>
                      <span className="rc-sal-sep"> &bull; </span>
                      <span className="rc-sal-muted">Salary benchmark not available — contributions help everyone.</span>
                    </>
                  )
                ) : (
                  <span className="rc-sal-muted">Select a level above to view salary</span>
                )}
              </div>
            </div>
          )}

          {/* Required Skills */}
          {required.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <span className="rc-sec-lbl">Required skills</span>
              {required.slice(0, 8).map((s) => (
                <span
                  key={s}
                  className={`skill-pill ${matched.includes(s) ? "skill-matched" : "skill-missing"}`}
                >{s}</span>
              ))}
            </div>
          )}

          {/* Nice to Have */}
          {nice.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <span className="rc-sec-lbl">Nice to have</span>
              {nice.slice(0, 4).map((s) => (
                <span key={s} className="skill-pill skill-nice">{s}</span>
              ))}
            </div>
          )}


          {/* Actions */}
          {isHR && (
            <div className="rc-actions">
              <button className="btn-search" onClick={handleSearchProfessional}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Search professional
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
