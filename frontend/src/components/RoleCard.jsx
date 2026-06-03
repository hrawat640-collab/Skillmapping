import { useState } from "react";
import { parseSalarySegments, buildTalentXRayUrl } from "../utils/searchUtils";
import { api } from "../api";

const LEVELS = ["junior", "mid", "senior", "lead"];
const LEVEL_LABELS = { junior: "Junior", mid: "Mid", senior: "Senior", lead: "Lead" };

function isSalUnlocked() {
  const until = Number(localStorage.getItem("sm_sal_unlocked_until") || 0);
  return Date.now() < until;
}

function getUser() {
  try { return JSON.parse(localStorage.getItem("sm_user") || "null"); } catch { return null; }
}

function isHRUser(user) {
  return String(user?.profession || "").toLowerCase() === "hr";
}

function formatSalLine(yrsMin, yrsMax, pipe) {
  const min = Number(yrsMin);
  const max = Number(yrsMax);
  const expOk = isFinite(min) && isFinite(max) && !(min === 0 && max === 0) && max >= min;
  const segs = parseSalarySegments(pipe);
  const salParts = ["INR", "USD"].map((c) => segs[c] || "").filter(Boolean);
  const salStr = salParts.join(" · ");

  if (!expOk && !salStr) return { exp: "Experience varies", sal: null };
  if (expOk && !salStr) return { exp: `${min}-${max} yrs`, sal: null };
  if (!expOk && salStr) return { exp: "Experience varies", sal: salStr };
  return { exp: `${min}-${max} yrs`, sal: salStr };
}

export default function RoleCard({ role, currency, onSalaryContribute, onLoginRequired }) {
  const [salLevel, setSalLevel] = useState("junior");
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [feedback, setFeedback] = useState(null); // "up" | "down" | null

  const user = getUser();
  const isHR = isHRUser(user);
  const salUnlocked = isSalUnlocked();

  const dept = role.dept || role.department_name || "";
  const title = role.title || role.canonical_title || "";
  const score = role.final_score ? Math.round(role.final_score * 100) : null;
  const aliases = (role.aliases || []).filter((a) => a && a.toLowerCase() !== title.toLowerCase());

  function handleCopyTitle() {
    navigator.clipboard.writeText(title).then(() => {
      setCopiedTitle(true);
      setTimeout(() => setCopiedTitle(false), 1800);
    });
  }

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

  async function handleFeedback(helpful) {
    if (feedback) return;
    setFeedback(helpful ? "up" : "down");
    try {
      await api.post("/feedback", {
        message: `Role feedback: ${helpful ? "helpful" : "not helpful"} for "${title}"`,
        type: "role_feedback",
        page: window.location.pathname
      });
    } catch {
      // silent
    }
  }

  const required = role.required || [];
  const nice = role.nice || [];
  const matched = role.matched_skills || [];

  const activeLevelData = salLevel ? role.exp?.[salLevel] : null;
  const salLine = activeLevelData
    ? formatSalLine(activeLevelData[0], activeLevelData[1], activeLevelData[2])
    : null;

  // Show "Share your salary" amber button only when user hasn't unlocked
  const showShareBtn = !salUnlocked;

  return (
    <div className="result-card" role="article">
      <div className="rc-top">
        <div className="rc-left">
          {dept && (
            <div className="rc-dept">
              <span style={{ background: "#ECFDF5", color: "#064E3B", padding: "2px 8px", borderRadius: 20, fontSize: 10 }}>
                {dept}
              </span>
            </div>
          )}
          <div className="rc-title">{title}</div>

          {(role.role_summary || role.short_description) && (
            <div className="rc-desc" style={{ marginBottom: 6 }}>
              {role.role_summary || role.short_description}
            </div>
          )}

          {isHR && role.hint && (
            <div className="rc-hint">
              <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#D97706" strokeWidth="1.5"/><path d="M8 7v4M8 5.5v.5" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round"/></svg>
              <span>{role.hint}</span>
            </div>
          )}
        </div>

        {score != null && (
          <div className="rc-score-wrap">
            <div className="rc-score">{score}</div>
            <div className="rc-score-lbl">match</div>
          </div>
        )}
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

          {/* Also Called */}
          {aliases.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "baseline", maxWidth: "100%" }}>
              <span className="rc-sec-lbl" style={{ whiteSpace: "nowrap" }}>Also called</span>
              <span className="rc-also-called-text">{aliases.slice(0, 4).join(", ")}</span>
            </div>
          )}

          {/* Actions */}
          <div className="rc-actions">
            <button
              className={`btn-copy-title${copiedTitle ? " ok" : ""}`}
              onClick={handleCopyTitle}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <rect x="5" y="5" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M3 11H2a1 1 0 01-1-1V2a1 1 0 011-1h8a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              {copiedTitle ? "Copied!" : "Copy title"}
            </button>

            <button className="btn-search" onClick={handleSearchProfessional}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {isHR ? "Search professional" : "Show skills & salary"}
            </button>

            {showShareBtn && (
              <button
                className="btn-share-salary"
                onClick={() => onSalaryContribute?.(role)}
              >
                Share your salary
              </button>
            )}
          </div>

          {/* Helpful feedback row */}
          <div className="rc-feedback" onClick={(e) => e.stopPropagation()}>
            <span className="rc-feedback-lbl">Helpful?</span>
            <button
              type="button"
              className={`rc-fb-btn${feedback === "up" ? " active" : ""}`}
              title="Yes"
              aria-label="Yes, helpful"
              onClick={() => handleFeedback(true)}
            >👍</button>
            <button
              type="button"
              className={`rc-fb-btn${feedback === "down" ? " active" : ""}`}
              title="Not really"
              aria-label="Not helpful"
              onClick={() => handleFeedback(false)}
            >👎</button>
          </div>

        </div>
      </div>
    </div>
  );
}
