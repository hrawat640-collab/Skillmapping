import { useState, useRef, useEffect } from "react";

export default function Header({ user, onSignOut }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="topbar" style={{ position: "sticky", top: 0, zIndex: 100 }}>
      <button className="topbar-brand" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", border: "none", background: "transparent", padding: 0, fontFamily: "var(--sans)" }}>
        <div style={{ width: 30, height: 30, background: "var(--teal)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="#fff" strokeWidth="1.6" />
            <path d="M10 10L14 14" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
        <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em", color: "var(--ink)" }}>
          Skill<span style={{ color: "var(--teal-btn)" }}>Mapper</span>
        </span>
      </button>

      {/* Suite nav — centred absolutely so it doesn't shift either side */}
      <div className="suite-steps">
        <span className="suite-step active">
          <span className="suite-step-num">1</span>SkillMapper
        </span>
        <span className="suite-arrow">›</span>
        <a
          className="suite-step"
          href="https://talentxray.talentsradar.com/"
          target="_blank"
          rel="noopener noreferrer"
          id="suiteNavTxr"
        >
          <span className="suite-step-num">2</span>TalentXRay
        </a>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }} ref={menuRef}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            borderRadius: 8,
            border: "1.5px solid var(--border)",
            background: menuOpen ? "#f8fafc" : "#fff",
            cursor: "pointer",
            fontFamily: "var(--sans)",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--ink2)"
          }}
        >
          {user.picture ? (
            <img
              src={user.picture}
              alt=""
              style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover" }}
            />
          ) : (
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>
                {(user.name || user.email || "?")[0].toUpperCase()}
              </span>
            </div>
          )}
          <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user.name || user.email}
          </span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {menuOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              background: "#fff",
              border: "1px solid var(--border)",
              borderRadius: 12,
              boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
              minWidth: 220,
              zIndex: 200,
              overflow: "hidden"
            }}
          >
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", wordBreak: "break-all" }}>
                {user.email}
              </div>
              {user.name && (
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{user.name}</div>
              )}
              {user.profession && (
                <div style={{ fontSize: 12, color: "#6b7280" }}>{user.profession}</div>
              )}
            </div>
            <button
              onClick={() => { setMenuOpen(false); onSignOut(); }}
              style={{
                width: "100%",
                padding: "11px 16px",
                textAlign: "left",
                background: "none",
                border: "none",
                fontSize: 13,
                color: "#6b7280",
                cursor: "pointer",
                fontFamily: "var(--sans)"
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#f9fafb")}
              onMouseOut={(e) => (e.currentTarget.style.background = "none")}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
