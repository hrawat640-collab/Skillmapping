import { useState, useRef, useEffect, useCallback } from "react";

const SKILL_ALIASES = {
  "sde": "REST APIs", "swe": "JavaScript", "ml engineer": "Machine Learning",
  "ai engineer": "LLMs", "devops": "CI/CD", "frontend": "React", "backend": "REST APIs",
  "pm": "Product Strategy", "ux": "UX Design", "ui": "UI Design",
  "fullstack": "JavaScript", "ds": "Python", "de": "Spark"
};

function resolveAlias(raw) {
  const lower = raw.toLowerCase().trim();
  return SKILL_ALIASES[lower] || raw.trim();
}

export default function SkillInput({ skills, onChange, skillsList }) {
  const [inputVal, setInputVal] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [sugOpen, setSugOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const inputRef = useRef(null);
  const sugRef = useRef(null);

  const filterSuggestions = useCallback(
    (q) => {
      if (!q.trim() || !skillsList.length) {
        setSuggestions([]);
        setSugOpen(false);
        return;
      }
      const lower = q.toLowerCase();
      const added = new Set(skills.map((s) => s.toLowerCase()));
      const matches = skillsList
        .filter(({ s }) => {
          const sl = s.toLowerCase();
          return sl.includes(lower) && !added.has(sl);
        })
        .slice(0, 10);
      setSuggestions(matches);
      setSugOpen(matches.length > 0);
      setFocusedIdx(-1);
    },
    [skills, skillsList]
  );

  useEffect(() => {
    filterSuggestions(inputVal);
  }, [inputVal, filterSuggestions]);

  function addSkill(raw) {
    const resolved = resolveAlias(raw);
    if (!resolved) return;
    const lower = resolved.toLowerCase();
    if (!skills.some((s) => s.toLowerCase() === lower)) {
      onChange([...skills, resolved]);
    }
    setInputVal("");
    setSugOpen(false);
    setFocusedIdx(-1);
  }

  function removeSkill(i) {
    onChange(skills.filter((_, idx) => idx !== i));
  }

  function handleKeyDown(e) {
    if (e.key === "ArrowDown" && suggestions.length) {
      e.preventDefault();
      setFocusedIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setSugOpen(false);
    } else if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (focusedIdx >= 0 && suggestions[focusedIdx]) {
        addSkill(suggestions[focusedIdx].s);
      } else if (sugOpen && suggestions.length > 0) {
        addSkill(suggestions[0].s);
      } else if (inputVal.trim()) {
        addSkill(inputVal.trim());
      }
    } else if (e.key === "Backspace" && !inputVal && skills.length) {
      removeSkill(skills.length - 1);
    }
  }

  function handleBlur() {
    setTimeout(() => setSugOpen(false), 150);
  }

  return (
    <div style={{ position: "relative", marginBottom: 10 }}>
      <div
        className="bubble-wrap"
        onClick={() => inputRef.current?.focus()}
      >
        {skills.map((s, i) => (
          <span key={i} className="bubble">
            {s}
            <button
              className="bubble-x"
              onClick={(e) => { e.stopPropagation(); removeSkill(i); }}
              type="button"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="bubble-input"
          autoComplete="off"
          placeholder={
            skills.length
              ? "Add more skills…"
              : "Python, React, SQL, Figma, Salesforce, Financial Modelling…"
          }
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        />
      </div>

      {sugOpen && suggestions.length > 0 && (
        <div className="sug-drop" ref={sugRef}>
          {suggestions.map(({ s, cat }, i) => (
            <div
              key={s}
              className={`sug-item${i === focusedIdx ? " focused" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); addSkill(s); }}
            >
              <span>{s}</span>
              <span style={{ fontSize: 11, color: "var(--ink3)", marginLeft: 8 }}>{cat}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
