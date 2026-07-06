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
import LoadingMessages from "./components/LoadingMessages";
import CornerSpinner from "./components/CornerSpinner";
import ActivityToast from "./components/ActivityToast";
import { useAuth } from "./context/AuthContext";

const STANDALONE_AUTH_PATHS = new Set(["/forgot-password", "/reset-password"]);

export default function App() {
  const location = useLocation();
  const {
    profile,
    session,
    authUser,
    needsProfile,
    loading,
    profileLoading,
    pageReady,
    showOverlayOnLoad,
    setShowOverlayOnLoad,
    signOut
  } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  const isStandaloneAuthPage = STANDALONE_AUTH_PATHS.has(location.pathname);
  const isAuthenticated = Boolean(session && profile && !needsProfile);
  const authLoading = loading || profileLoading;
  const showOverlay = Boolean(
    !isStandaloneAuthPage && (authLoading || (Boolean(authUser) && !pageReady))
  );
  const wantsFullscreenOverlay = showOverlay && showOverlayOnLoad;
  const wantsCornerSpinner = showOverlay && !showOverlayOnLoad;
  const showActivityToast = isAuthenticated && location.pathname === "/";
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);

  useEffect(() => {
    if (!wantsFullscreenOverlay) {
      setShowLoadingOverlay(false);
      return undefined;
    }

    const timer = setTimeout(() => {
      setShowLoadingOverlay(true);
    }, 800);

    return () => {
      clearTimeout(timer);
    };
  }, [wantsFullscreenOverlay]);

  useEffect(() => {
    if (!wantsFullscreenOverlay && showOverlayOnLoad) {
      setShowOverlayOnLoad(false);
    }
  }, [wantsFullscreenOverlay, showOverlayOnLoad, setShowOverlayOnLoad]);

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
      {showLoadingOverlay && <LoadingMessages />}
      <CornerSpinner visible={wantsCornerSpinner} />
      {showActivityToast && <ActivityToast />}

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
