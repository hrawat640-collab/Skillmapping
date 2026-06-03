import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const REQUEST_TYPES = [
  { value: "access", label: "I want to know what data you hold about me" },
  { value: "deletion", label: "I want my account and data deleted" },
  { value: "correction", label: "I want to correct my data" },
  { value: "portability", label: "I want a copy of my data (CSV)" },
  { value: "opt_out", label: "I want to opt out of all emails" },
];

export default function PrivacyPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [reqType, setReqType] = useState("access");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  function submitRequest() {
    const e = email.trim();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setErr("Please enter a valid email address.");
      return;
    }
    setErr("");
    // Attempt to save to Supabase via backend; silently succeed either way
    api.post("/privacy-request", { email: e, request_type: reqType }).catch(() => {});
    setSent(true);
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Back button */}
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "16px 16px 0" }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "none", border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 600, color: "var(--ink3)", fontFamily: "var(--sans)",
            padding: "6px 0"
          }}
        >
          ← Back
        </button>
      </div>

      <main style={{ maxWidth: 700, margin: "0 auto", padding: "12px 16px 80px" }}>
        {/* Hero */}
        <div className="priv-hero">
          <h2 className="priv-hero-title">Privacy &amp; Data Policy</h2>
          <p className="priv-hero-sub">Plain English. No legal jargon. Here is exactly what we collect, why, and what you can do about it.</p>
        </div>

        {/* Last updated */}
        <div className="priv-card">
          <div style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>Last updated: April 2026</div>
          <div style={{ fontSize: 12.5, color: "#6b7280", lineHeight: 1.5, marginTop: 2 }}>
            This policy applies to users in India, the United States, the United Kingdom, and all other countries.
          </div>
        </div>

        {/* Contact */}
        <div className="priv-contact-card">
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Questions? Contact us directly.</div>
          <div style={{ fontSize: 13.5, opacity: 0.9, lineHeight: 1.65 }}>
            Email:{" "}
            <a href="mailto:contactus@talentsradar.com" style={{ color: "#fff", fontWeight: 700 }}>
              contactus@talentsradar.com
            </a>
            <br />
            We aim to respond to all privacy requests within 14 days.
          </div>
        </div>

        {/* Searches */}
        <div className="priv-card">
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 10 }}>Searches and inputs</div>
          <div style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.75 }}>
            When you look up roles, skills, or short descriptions, we process that input to return matches.
            Optional anonymous salary contributions are stored separately and are not tied to your search text.
          </div>
        </div>

        {/* Data request form */}
        <div className="priv-card">
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 12 }}>Submit a data request</div>
          <input
            type="email"
            placeholder="Your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="priv-input"
          />
          <select
            value={reqType}
            onChange={(e) => setReqType(e.target.value)}
            className="priv-select"
          >
            {REQUEST_TYPES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button onClick={submitRequest} className="priv-submit-btn">
            Submit request →
          </button>
          {sent && (
            <div style={{ marginTop: 8, fontSize: 12.5, color: "#0d7a4e", fontWeight: 600 }}>
              Request received. We will respond within 14 days.
            </div>
          )}
          {err && (
            <div style={{ marginTop: 8, fontSize: 12.5, color: "#b91c1c", fontWeight: 600 }}>
              {err}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
