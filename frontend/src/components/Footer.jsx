import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="site-footer">
      <p>
        <strong>SkillMapper</strong> by <a href="https://talentsradar.com" target="_blank" rel="noopener noreferrer">Talents Radar</a>
        {" · "}
        <Link to="/privacy">Privacy &amp; Data</Link>
        {" · "}
        <a href="mailto:contactus@talentsradar.com">Contact us</a>
      </p>
      <p style={{ marginTop: 8, opacity: 0.7, fontSize: 11 }}>
        155+ roles · 1400+ skills · INR &amp; USD salary data · Free HR tool
      </p>
    </footer>
  );
}
