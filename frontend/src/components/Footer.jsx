import { Link } from "react-router-dom";

const SALARY_DISCLAIMER =
  "Salary ranges are market estimates sourced from open sources and crowdsourcing from professionals. Indicative only — verify before making offers.";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <p className="footer-line">
          SkillMapper by Talents Radar
          <span className="footer-dot"> · </span>
          Data updated Q1 2026
          <span className="footer-dot"> · </span>
          <Link to="/privacy">Privacy</Link>
          <span className="footer-dot"> · </span>
          <a href="mailto:contactus@talentsradar.com">Contact</a>
          <abbr className="footer-disclaimer-mark" title={SALARY_DISCLAIMER} aria-label={SALARY_DISCLAIMER}>
            *
          </abbr>
        </p>
      </div>
    </footer>
  );
}
