import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { api } from "../api";

const PROFESSIONS = [
  "HR / Talent Acquisition",
  "Fresher / Student",
  "Working Professional",
  "Recruiter",
  "Manager / Lead",
  "Founder / Entrepreneur",
  "Other"
];

const PROFESSION_VALUES = {
  "HR / Talent Acquisition": "hr",
  "Fresher / Student": "fresher",
  "Working Professional": "professional",
  "Recruiter": "hr",
  "Manager / Lead": "professional",
  "Founder / Entrepreneur": "professional",
  "Other": "professional"
};

export default function LoginModal({ onLogin, onClose, required = false }) {
  const [step, setStep] = useState("google"); // "google" | "profile"
  const [pendingToken, setPendingToken] = useState(null);
  const [pendingUser, setPendingUser] = useState(null);
  const [form, setForm] = useState({ name: "", profession: "", country: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogleSuccess(credential) {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/google", { credential: credential.credential });
      if (!data.user?.needsProfile) {
        onLogin(data.user, data.token);
        return;
      }
      setPendingToken(data.token);
      setPendingUser(data.user);
      setForm({ name: data.user?.name || "", profession: "", country: "" });
      setStep("profile");
    } catch (e) {
      setError(e?.response?.data?.error || "Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleProfileSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.profession || !form.country.trim()) {
      setError("All fields are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const professionValue = PROFESSION_VALUES[form.profession] || "professional";
      await api.post(
        "/auth/google/profile",
        { name: form.name.trim(), profession: professionValue, country: form.country.trim() },
        { headers: { Authorization: `Bearer ${pendingToken}` } }
      );
      onLogin(
        { ...pendingUser, name: form.name.trim(), profession: professionValue, country: form.country.trim(), needsProfile: false },
        pendingToken
      );
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to save profile.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-overlay" onClick={(e) => { if (!required && onClose && e.target === e.currentTarget) onClose(); }}>
      <div className="login-card">
        <div className="login-top">
          <h2>
            {step === "google"
              ? "Sign in to SkillMapper"
              : "Complete your profile"}
          </h2>
          <p>
            {step === "google"
              ? "Access salary benchmarks, save searches and more."
              : "Help us personalise your experience."}
          </p>
        </div>

        <div className="login-body">
          {step === "google" && (
            <>
              <div className="google-btn-wrap">
                {loading ? (
                  <div style={{ fontSize: 13, color: "var(--ink3)" }}>Signing in...</div>
                ) : (
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError("Google sign-in failed.")}
                    useOneTap={false}
                    shape="rectangular"
                    theme="outline"
                    size="large"
                    text="signin_with"
                  />
                )}
              </div>
              {error && (
                <p style={{ fontSize: 12.5, color: "var(--red)", marginTop: 8, textAlign: "center" }}>{error}</p>
              )}
              <p style={{ fontSize: 11.5, color: "var(--ink3)", textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>
                By signing in you agree to our{" "}
                <a href="/privacy" style={{ color: "var(--teal)" }} target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
              </p>
            </>
          )}

          {step === "profile" && (
            <form className="profile-form" onSubmit={handleProfileSubmit}>
              <div>
                <label>Your name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Full name"
                  required
                />
              </div>
              <div>
                <label>Your profession</label>
                <select
                  value={form.profession}
                  onChange={(e) => setForm({ ...form, profession: e.target.value })}
                  required
                >
                  <option value="">Select profession</option>
                  {PROFESSIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Country</label>
                <input
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  placeholder="e.g. India, USA"
                  required
                />
              </div>
              {error && (
                <p style={{ fontSize: 12.5, color: "var(--red)" }}>{error}</p>
              )}
              <button className="profile-submit" disabled={loading}>
                {loading ? "Saving..." : "Continue"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
