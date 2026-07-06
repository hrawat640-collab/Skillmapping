import { useState, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import SearchPage from "./components/SearchPage";
import PrivacyPage from "./components/PrivacyPage";
import LoginModal from "./components/LoginModal";
import Footer from "./components/Footer";
import FeedbackButton from "./components/FeedbackButton";
import Header from "./components/Header";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import { useAuth } from "./context/AuthContext";

const STANDALONE_AUTH_PATHS = new Set(["/forgot-password", "/reset-password"]);

export default function App() {
  const location = useLocation();
  const { profile, session, needsProfile, loading, signOut } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  const isStandaloneAuthPage = STANDALONE_AUTH_PATHS.has(location.pathname);
  const isAuthenticated = Boolean(session && profile && !needsProfile);

  useEffect(() => {
    if (loading || isStandaloneAuthPage) return;
    if (!session || needsProfile) {
      setShowLogin(true);
    }
  }, [loading, session, needsProfile, isStandaloneAuthPage]);

  function handleLogout() {
    signOut();
    setShowLogin(true);
  }

  if (isStandaloneAuthPage) {
    return (
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Routes>
    );
  }

  return (
    <div className="app-shell">
      <Header
        user={isAuthenticated ? profile : null}
        onLoginClick={() => setShowLogin(true)}
        onLogout={handleLogout}
      />

      <main>
        {!loading && (
          <Routes>
            <Route
              path="/"
              element={
                isAuthenticated ? (
                  <SearchPage
                    user={profile}
                    onLoginRequired={() => setShowLogin(true)}
                  />
                ) : null
              }
            />
            <Route path="/privacy" element={<PrivacyPage />} />
          </Routes>
        )}
      </main>

      <Footer />
      <FeedbackButton />

      {!loading && showLogin && (!isAuthenticated || needsProfile) && (
        <LoginModal
          onClose={isAuthenticated ? () => setShowLogin(false) : null}
          required={!isAuthenticated || needsProfile}
        />
      )}
    </div>
  );
}
