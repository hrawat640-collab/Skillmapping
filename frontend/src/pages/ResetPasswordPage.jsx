import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import PasswordField from "../components/PasswordField";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session));
      setChecking(false);
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      navigate("/", { replace: true });
    } catch (err) {
      setError(err?.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return <div className="auth-page" />;
  }

  if (!hasSession) {
    return (
      <div className="auth-page">
        <div className="login-card auth-page-card">
          <div className="login-top">
            <h2>Link expired</h2>
            <p>Reset link expired. Request a new one.</p>
          </div>
          <div className="login-body">
            <p className="auth-toggle">
              <Link to="/forgot-password" className="auth-link">Request a new reset link</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="login-card auth-page-card">
        <div className="login-top">
          <h2>Set a new password</h2>
          <p>Choose a strong password for your account.</p>
        </div>
        <div className="login-body">
          <form className="auth-form" onSubmit={handleSubmit}>
            <PasswordField
              id="reset-password"
              label="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
            />
            <PasswordField
              id="reset-confirm-password"
              label="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              autoComplete="new-password"
            />
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="profile-submit" disabled={loading}>
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
