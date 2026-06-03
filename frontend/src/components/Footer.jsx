import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <p className="footer-brand">
          <strong>SkillMapper</strong>
          <span className="footer-dot"> · </span>
          <a href="https://www.talentsradar.com" target="_blank" rel="noopener noreferrer" className="footer-link-teal">
            www.talentsradar.com
          </a>
          <span className="footer-dot"> · </span>
          <span>Data updated Q1 2026</span>
        </p>
        <p className="footer-disclaimer">
          Salary ranges are market estimates sourced from open sources and crowdsourcing from professionals. Indicative only — verify before making offers.
        </p>
        <p className="footer-copy">© 2026 Talents Radar</p>
        <p className="footer-links">
          <a href="https://www.talentsradar.com" target="_blank" rel="noopener noreferrer">www.talentsradar.com</a>
          <span className="footer-dot"> · </span>
          <Link to="/privacy">Privacy &amp; Data</Link>
          <span className="footer-dot"> · </span>
          <a href="mailto:contactus@talentsradar.com">contactus@talentsradar.com</a>
        </p>
      </div>
    </footer>
  );
}
