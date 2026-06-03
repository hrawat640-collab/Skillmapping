import { useNavigate } from "react-router-dom";

export default function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="site-footer">
      <div className="site-footer-main">
        <strong>SkillMapper</strong>
        {" · "}
        <a href="https://www.talentsradar.com/" target="_blank" rel="noopener">
          Talents Radar
        </a>
        {" · "}
        <a href="https://www.talentsradar.com/" target="_blank" rel="noopener" className="site-footer-teal">
          www.talentsradar.com
        </a>
        {" · "}
        Data updated Q1 2026
      </div>
      <div className="site-footer-note">
        Salary ranges are market estimates sourced from open sources and crowdsourcing from professionals.
        Indicative only — verify before making offers.
      </div>
      <div className="site-footer-copy">© 2026 Talents Radar</div>
      <div className="site-footer-links">
        <a href="https://www.talentsradar.com/" target="_blank" rel="noopener">www.talentsradar.com</a>
        <span className="site-footer-dot">·</span>
        <button onClick={() => navigate("/privacy")} className="site-footer-link-btn">
          Privacy &amp; Data
        </button>
        <span className="site-footer-dot">·</span>
        <a href="mailto:contactus@talentsradar.com">contactus@talentsradar.com</a>
      </div>
    </footer>
  );
}
