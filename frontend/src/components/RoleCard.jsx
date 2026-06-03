import { useState } from "react";
import { salLevelIsRenderable, formatSalDisplay } from "../utils/searchUtils";

const LEVEL_ORDER = ["junior", "mid", "senior", "lead"];
const LEVEL_LABELS = { junior: "Junior", mid: "Mid", senior: "Senior", lead: "Lead" };

const LI_DOMAINS = {
  india: "in.linkedin.com/in/",
  usa: "www.linkedin.com/in/",
  uk: "uk.linkedin.com/in/",
  uae: "ae.linkedin.com/in/",
  singapore: "sg.linkedin.com/in/",
  australia: "au.linkedin.com/in/",
};

function buildSearchUrl(role, userProfession, userCountry, userEmail) {
  const title = role.title || "";
  const aliases = (role.aliases || []).slice(0, 3);
  const allSkills = [...(role.required || []), ...(role.nice || [])];

  const prof = String(userProfession || "").toLowerCase();
  const isDirectSearch = prof === "fresher/student" || prof === "working professional";

  if (isDirectSearch) {
    // Build LinkedIn X-Ray Google query directly (same as TalentXRay would produce)
    const allTitles = [title, ...aliases.slice(0, 2)];
    const titlePart = allTitles.length === 1
      ? `"${allTitles[0]}"`
      : `(${allTitles.map((t) => `"${t}"`).join(" OR ")})`;
    const skillParts = allSkills.slice(0, 3).map((s) => `"${s}"`).join(" ");
    const country = String(userCountry || "").toLowerCase();
    const liDomain = LI_DOMAINS[country] || "linkedin.com/in/";
    const liNoise = "-inurl:jobs -inurl:groups -inurl:company -inurl:posts";
    const parts = ["site:" + liDomain, liNoise, titlePart, skillParts].filter(Boolean).join(" ");
    return "https://www.google.com/search?q=" + encodeURIComponent(parts) + "&num=100";
  }

  // HR / Management / Founder → TalentXRay tool
  const titleParam = encodeURIComponent(title);
  const altParam = encodeURIComponent(aliases.join(","));
  const skillsParam = encodeURIComponent(allSkills.join(","));
  const auParam = userEmail ? "&au=" + encodeURIComponent(userEmail) : "";
  return `https://talentxray.talentsradar.com/?title=${titleParam}&alt=${altParam}&skills=${skillsParam}&from=skillmapper${auParam}`;
}

function pickDefaultLevel(exp) {
  for (const lvl of LEVEL_ORDER) {
    if (salLevelIsRenderable(exp?.[lvl])) return lvl;
  }
  return "junior";
}

export default function RoleCard({ role, deptColors = {}, showScore = true, isUnlocked = false, onLockClick, currency = "INR", isHR = false, user = {} }) {
  const exp = role.exp || {};
  const renderable = LEVEL_ORDER.filter((lvl) => salLevelIsRenderable(exp[lvl]));
  const [activeLvl, setActiveLvl] = useState(() => pickDefaultLevel(exp));

  const dc = deptColors[role.dept] || { bg: "#f3f4f6", color: "#374151" };
  const matchedSet = new Set((role.matched || []).map((s) => String(s).toLowerCase()));
  const matchedReqSet = new Set((role.matchedReq || []).map((s) => String(s).toLowerCase()));

  const searchUrl = buildSearchUrl(role, user?.profession, user?.country, user?.email);

  const aboutText = role.role_summary || role.short_description || role.semantic_summary || role.desc || "";
  const hintText = role.hint || "";

  function handleLvlClick(lvl) {
    if (lvl !== "junior" && !isUnlocked) {
      onLockClick?.();
      return;
    }
    setActiveLvl(lvl);
  }

  const activeSalData = exp[activeLvl];
  const salLine = activeSalData
    ? formatSalDisplay(activeSalData[0], activeSalData[1], activeSalData[2], currency)
    : "—";

  return (
    <div className="result-card">
      <div className="rc-top">
        <div className="rc-left">
          <div className="rc-dept">
            <span
              style={{
                background: dc.bg,
                color: dc.color,
                padding: "2px 8px",
                borderRadius: 20,
                fontSize: 10,
                fontWeight: 600
              }}
            >
              {role.dept || "General"}
            </span>
          </div>
          <div className="rc-title">{role.title}</div>
          {aboutText && <p className="rc-about">{aboutText}</p>}
          {hintText && isHR && (
            <div className="rc-hint">
              <span className="rc-hint-icon">i</span>
              <span>{hintText}</span>
            </div>
          )}
        </div>

        {showScore && role.score > 0 && (
          <div className="rc-score-wrap">
            <div className="rc-score">{role.score}%</div>
            <div className="rc-score-lbl">Match</div>
          </div>
        )}
      </div>

      <div className="rc-bottom">
        {renderable.length > 0 && (
          <div>
            <div className="rc-exp-head">
              <span className="rc-sec-lbl">Experience &amp; Salary</span>
              <div className="salary-selector">
                {renderable.map((lvl) => {
                  const locked = lvl !== "junior" && !isUnlocked;
                  return (
                    <button
                      key={lvl}
                      className={`sal-btn ${lvl}${activeLvl === lvl && !locked ? " active" : ""}${locked ? " locked" : ""}`}
                      onClick={() => handleLvlClick(lvl)}
                      title={locked ? "Contribute salary to unlock" : LEVEL_LABELS[lvl]}
                    >
                      {locked ? "🔒" : null}{LEVEL_LABELS[lvl]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="sal-display">
              {activeLvl !== "junior" && !isUnlocked
                ? <span className="sal-locked-msg">Contribute salary data to unlock →</span>
                : salLine}
            </div>
          </div>
        )}

        {role.required?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <span className="rc-sec-lbl">Required</span>
            {role.required.map((s) => {
              const sl = String(s).toLowerCase();
              return (
                <span key={s} className={`skill-pill ${matchedReqSet.has(sl) ? "skill-matched" : "skill-missing"}`}>
                  {s}
                </span>
              );
            })}
          </div>
        )}

        {role.nice?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <span className="rc-sec-lbl">Nice to have</span>
            {role.nice.map((s) => {
              const sl = String(s).toLowerCase();
              const isMatch = matchedSet.has(sl) && !matchedReqSet.has(sl);
              return (
                <span key={s} className={`skill-pill ${isMatch ? "skill-matched" : "skill-missing"}`}>
                  {s}
                </span>
              );
            })}
          </div>
        )}

        {/* Search professional */}
        <div style={{ paddingTop: 10, borderTop: "1px solid var(--border)", marginTop: 2 }}>
          <a
            className="btn-search"
            href={searchUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Search professional
          </a>
        </div>
      </div>
    </div>
  );
}
