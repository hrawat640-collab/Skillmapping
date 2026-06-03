import { useState } from "react";
import { api } from "../api";

export default function PrivacyPage() {
  const [form, setForm] = useState({ email: "", type: "access" });
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.email.includes("@")) { setErr("Please enter a valid email."); return; }
    try {
      await api.post("/feedback", {
        message: `Privacy request: ${form.type} for ${form.email}`,
        type: "privacy",
        page: "privacy"
      });
      setSent(true);
      setErr("");
    } catch {
      setErr("Failed to submit. Please email us directly.");
    }
  }

  return (
    <div className="privacy-page">
      <div className="privacy-hero">
        <h1>Privacy &amp; Data</h1>
        <p>
          SkillMapper by Talents Radar — we take your privacy seriously.
          Email us at{" "}
          <a href="mailto:contactus@talentsradar.com" style={{ color: "#fff", fontWeight: 700 }}>
            contactus@talentsradar.com
          </a>
          {" "}— we respond within 14 days.
        </p>
      </div>

      <div className="privacy-section">
        <h2>What we collect</h2>
        <ul>
          <li>Account info from Google Sign-In (email, name, profile picture)</li>
          <li>Profession and country you provide during onboarding</li>
          <li>Salary contributions you submit (stored anonymously)</li>
          <li>Search queries and feedback for product improvement</li>
        </ul>
      </div>

      <div className="privacy-section">
        <h2>How we use it</h2>
        <ul>
          <li>To personalise your SkillMapper experience (e.g. HR-only features)</li>
          <li>To improve search accuracy and role recommendations</li>
          <li>To build anonymised salary benchmarks for the community</li>
          <li>We do not sell your data to third parties</li>
        </ul>
      </div>

      <div className="privacy-section">
        <h2>Your rights</h2>
        <p>You can request access to, correction, or deletion of your personal data at any time using the form below.</p>
      </div>

      <div className="privacy-section">
        <h2>Submit a data request</h2>
        {sent ? (
          <p className="privacy-sent show">Request received. We will respond within 14 days.</p>
        ) : (
          <form className="privacy-form" onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="Your email address"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="access">Access my data</option>
              <option value="delete">Delete my data</option>
              <option value="correct">Correct my data</option>
              <option value="other">Other enquiry</option>
            </select>
            {err && <p style={{ fontSize: 12.5, color: "var(--red)" }}>{err}</p>}
            <button className="privacy-submit" type="submit">Submit request</button>
          </form>
        )}
      </div>
    </div>
  );
}
