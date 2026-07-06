import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const TALENTXRAY_URL = import.meta.env.VITE_TALENTXRAY_URL || "https://talentxray.talentsradar.com";

function ProfileDropdown({ user, onLogout, onClose }) {
  const dropRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const { salaryUnlocked } = useAuth();
  const notifyChecked = !!localStorage.getItem("sm_notify_salary");

  const professionLabel = {
    hr: "HR",
    fresher: "Fresher / Student",
    professional: "Working Professional",
    founder: "Founder / Entrepreneur",
  }[user?.profession?.toLowerCase()] || user?.profession || "—";

  return (
    <div className="profile-dropdown" ref={dropRef}>
      <div className="pd-email">{user?.email || "—"}</div>
      <div className="pd-divider" />
      <div className="pd-row"><span className="pd-label">Name</span><span className="pd-value">{user?.name || "—"}</span></div>
      <div className="pd-row"><span className="pd-label">Profession</span><span className="pd-value">{professionLabel}</span></div>
      <div className="pd-row"><span className="pd-label">Country</span><span className="pd-value">{user?.country || "—"}</span></div>
      <div className="pd-row"><span className="pd-label">Salary details</span><span className="pd-value">{salaryUnlocked ? "Filled" : "Not filled"}</span></div>
      <div className="pd-row"><span className="pd-label">Salary alerts</span><span className="pd-value">{notifyChecked ? "Enabled" : "Disabled"}</span></div>
      <div className="pd-divider" />
      <button className="pd-signout" onClick={onLogout}>Sign out</button>
    </div>
  );
}

export default function Header({ user, onLoginClick, onLogout }) {
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);

  const initials = user?.name
    ? user.name.trim().split(/\s+/).map((w) => w[0].toUpperCase()).slice(0, 2).join("")
    : user?.email?.[0]?.toUpperCase() || "?";

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
        <a className="suite-step" href={TALENTXRAY_URL} target="_blank" rel="noopener noreferrer">
          <span className="suite-step-num">②</span>
          <span>TalentXRay</span>
        </a>
      </nav>

      <div className="topbar-right" style={{ position: "relative" }}>
        {user ? (
          <>
            <button
              className="avatar-btn"
              onClick={() => setShowProfile((v) => !v)}
              aria-label="Account"
            >
              {initials}
            </button>
            {showProfile && (
              <ProfileDropdown
                user={user}
                onLogout={() => { setShowProfile(false); onLogout(); }}
                onClose={() => setShowProfile(false)}
              />
            )}
          </>
        ) : (
          <button className="btn-contact" onClick={onLoginClick}>Sign in</button>
        )}
      </div>
    </header>
  );
}
