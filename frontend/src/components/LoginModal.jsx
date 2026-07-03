import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import PasswordField from "./PasswordField";

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

function mapAuthError(error, mode) {
  const message = String(error?.message || "");
  const code = String(error?.code || "");

  if (mode === "login" && (code === "invalid_credentials" || message.toLowerCase().includes("invalid login"))) {
    return "Invalid email or password.";
  }
  if (mode === "signup" && (code === "user_already_exists" || message.toLowerCase().includes("already registered"))) {
    return "An account with this email already exists. Try logging in.";
  }
  return message || "Something went wrong. Please try again.";
}

export default function LoginModal({ onClose, required = false }) {
  const { session, needsProfile, signIn, signUp, signInWithGoogle, refreshProfile } = useAuth();
  const [step, setStep] = useState("login");
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    profession: "",
    country: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (session && needsProfile) {
      setStep("profile");
    } else if (session && !needsProfile) {
      setStep("login");
    }
  }, [session, needsProfile]);

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setForm((prev) => ({ ...prev, password: "", confirmPassword: "" }));
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setError("");

    const email = form.email.trim();
    const password = form.password;

    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    if (mode === "signup") {
      if (password !== form.confirmPassword) {
        setError("Passwords don't match.");
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      const { needsProfile: profileNeeded } = await refreshProfile();
      if (profileNeeded) {
        setStep("profile");
      } else {
        onClose?.();
      }
    } catch (err) {
      setError(mapAuthError(err, mode));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(mapAuthError(err, mode));
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
      await api.patch("/me/profile", {
        name: form.name.trim(),
        profession: professionValue,
        country: form.country.trim()
      });
      await refreshProfile();
      onClose?.();
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to save profile.");
    } finally {
      setLoading(false);
    }
  }

  const isProfileStep = step === "profile" || (session && needsProfile);

  return (
    <div className="login-overlay" onClick={(e) => { if (!required && onClose && e.target === e.currentTarget) onClose(); }}>
      <div className="login-card">
        <div className="login-top">
          <h2>
            {isProfileStep
              ? "Complete your profile"
              : mode === "signup"
                ? "Create your account"
                : "Sign in to SkillMapper"}
          </h2>
          <p>
            {isProfileStep
              ? "Help us personalise your experience."
              : "Access salary benchmarks, save searches and more."}
          </p>
        </div>

        <div className="login-body">
          {!isProfileStep && (
            <>
              <form className="auth-form" onSubmit={handleAuthSubmit}>
                <div>
                  <label htmlFor="login-email">Email</label>
                  <input
                    id="login-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@company.com"
                    required
                    autoComplete="email"
                  />
                </div>

                <PasswordField
                  id="login-password"
                  label="Password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />

                {mode === "signup" && (
                  <PasswordField
                    id="login-confirm-password"
                    label="Confirm password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                  />
                )}

                {mode === "login" && (
                  <div className="auth-forgot-wrap">
                    <Link to="/forgot-password" className="auth-link">Forgot password?</Link>
                  </div>
                )}

                {error && <p className="auth-error">{error}</p>}

                <button type="submit" className="profile-submit" disabled={loading}>
                  {loading
                    ? (mode === "signup" ? "Creating account..." : "Signing in...")
                    : (mode === "signup" ? "Create account" : "Log in")}
                </button>
              </form>

              <p className="auth-toggle">
                {mode === "login" ? (
                  <>New here? <button type="button" className="auth-link-btn" onClick={() => switchMode("signup")}>Create an account</button></>
                ) : (
                  <>Have an account? <button type="button" className="auth-link-btn" onClick={() => switchMode("login")}>Log in</button></>
                )}
              </p>

              <div className="auth-divider"><span>or</span></div>

              <button
                type="button"
                className="auth-google-btn"
                onClick={handleGoogle}
                disabled={loading}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84Z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" />
                </svg>
                Continue with Google
              </button>

              <p className="auth-privacy">
                By signing in you agree to our{" "}
                <a href="/privacy" style={{ color: "var(--teal)" }} target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
              </p>
            </>
          )}

          {isProfileStep && (
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
              {error && <p className="auth-error">{error}</p>}
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
