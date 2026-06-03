import { useState, useRef, useEffect } from "react";

export default function SkillInput({ skills, onChange, allSkills = [] }) {
  const [inputVal, setInputVal] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const inputRef = useRef(null);
  const dropRef = useRef(null);

  function getSuggestions(query) {
    if (!query.trim() || query.length < 1) return [];
    const q = query.toLowerCase();
    const exact = [];
    const starts = [];
    const contains = [];
    for (const s of allSkills) {
      const name = (s.name || "").toLowerCase();
      if (skills.some((sel) => sel.toLowerCase() === name)) continue;
      if (name === q) exact.push(s);
      else if (name.startsWith(q)) starts.push(s);
      else if (name.includes(q)) contains.push(s);
    }
    return [...exact, ...starts, ...contains].slice(0, 20);
  }

  function handleInput(e) {
    const val = e.target.value;
    setInputVal(val);
    setFocusedIdx(-1);
    setSuggestions(getSuggestions(val));
  }

  function addSkill(name) {
    const trimmed = name.trim();
    if (!trimmed || skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) return;
    onChange([...skills, trimmed]);
    setInputVal("");
    setSuggestions([]);
    setFocusedIdx(-1);
    inputRef.current?.focus();
  }

  function removeSkill(s) {
    onChange(skills.filter((x) => x !== s));
  }

  function handleKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusedIdx >= 0 && suggestions[focusedIdx]) {
        addSkill(suggestions[focusedIdx].name);
      } else if (inputVal.trim()) {
        addSkill(inputVal);
      }
    } else if (e.key === "Backspace" && !inputVal && skills.length) {
      onChange(skills.slice(0, -1));
    } else if (e.key === "Escape") {
      setSuggestions([]);
      setFocusedIdx(-1);
    } else if (e.key === ",") {
      e.preventDefault();
      if (inputVal.trim()) addSkill(inputVal);
    }
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setSuggestions([]);
        setFocusedIdx(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div style={{ position: "relative" }} ref={dropRef}>
      <div className="bubble-wrap" onClick={() => inputRef.current?.focus()}>
        {skills.map((s) => (
          <span className="bubble" key={s}>
            {s}
            <button className="bubble-x" type="button" onClick={() => removeSkill(s)} aria-label={`Remove ${s}`}>×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="bubble-input"
          value={inputVal}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={skills.length ? "" : "Type a skill, e.g. React, Python…"}
          autoComplete="off"
          spellCheck="false"
        />
      </div>

      {suggestions.length > 0 && (
        <div className="sug-drop open">
          {suggestions.map((s, i) => (
            <div
              key={s.id || s.name}
              className={`sug-item${i === focusedIdx ? " focused" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); addSkill(s.name); }}
            >
              <span dangerouslySetInnerHTML={{
                __html: s.name.replace(
                  new RegExp(`(${inputVal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i"),
                  "<em>$1</em>"
                )
              }} />
              {s.category && <span className="sug-cat">{s.category}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
