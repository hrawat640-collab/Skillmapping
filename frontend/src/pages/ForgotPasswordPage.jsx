import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email.trim().includes("@")) {
      setError("Please enter a valid email.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err?.message || "Failed to send reset link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="login-card auth-page-card">
        <div className="login-top">
          <h2>Reset your password</h2>
          <p>Enter your email and we&apos;ll send you a reset link.</p>
        </div>
        <div className="login-body">
          {sent ? (
            <p className="auth-success">Check your email for a reset link.</p>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="forgot-email">Email</label>
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  autoComplete="email"
                />
              </div>
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" className="profile-submit" disabled={loading}>
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>
          )}
          <p className="auth-toggle">
            <Link to="/" className="auth-link">Back to login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
