import { useNavigate } from "react-router-dom";

const TALENTXRAY_URL = import.meta.env.VITE_TALENTXRAY_URL || "https://talentxray.talentsradar.com";

export default function Header({ user, onLoginClick, onLogout }) {
  const navigate = useNavigate();

  return (
    <header className="topbar">
      <button className="topbar-brand" onClick={() => navigate("/")} aria-label="SkillMapper home">
        <div className="topbar-logo">
          <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 8h12M8 2l6 6-6 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="topbar-name">Skill<span>Mapper</span></span>
      </button>

      <nav className="suite-steps" aria-label="Suite navigation">
        <a className="suite-step active" href="/" aria-current="page">
          <span className="suite-step-num">①</span>
          <span>SkillMapper</span>
        </a>
        <span className="suite-arrow">›</span>
        <a
          className="suite-step"
          href={TALENTXRAY_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="suite-step-num">②</span>
          <span>TalentXRay</span>
        </a>
      </nav>

      <div className="topbar-right">
        {user ? (
          <>
            <span style={{ fontSize: 12, color: "var(--ink3)", fontWeight: 500 }}>
              {user.name || user.email}
            </span>
            <button className="btn-contact" onClick={onLogout} style={{ background: "transparent", color: "var(--ink2)", border: "1px solid var(--border)" }}>
              Sign out
            </button>
          </>
        ) : (
          <button className="btn-contact" onClick={onLoginClick}>
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}
