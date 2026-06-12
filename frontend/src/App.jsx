import { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import SearchPage from "./components/SearchPage";
import PrivacyPage from "./components/PrivacyPage";
import LoginModal from "./components/LoginModal";
import Footer from "./components/Footer";
import FeedbackButton from "./components/FeedbackButton";
import Header from "./components/Header";

function loadStoredUser() {
  try {
    const raw = localStorage.getItem("sm_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const storedUser = loadStoredUser();
  const storedToken = localStorage.getItem("sm_token");
  const validSession = storedUser && storedToken;

  const [user, setUser] = useState(validSession ? storedUser : null);
  const [showLogin, setShowLogin] = useState(!validSession);

  // Keep login modal open whenever user is null
  useEffect(() => {
    if (!user) setShowLogin(true);
  }, [user]);

  function handleLogin(userData, token) {
    localStorage.setItem("sm_token", token);
    localStorage.setItem("sm_user", JSON.stringify(userData));
    setUser(userData);
    setShowLogin(false);
  }

  function handleLogout() {
    localStorage.removeItem("sm_token");
    localStorage.removeItem("sm_user");
    localStorage.removeItem("sm_sal_unlocked_until");
    setUser(null);
  }

  return (
    <div className="app-shell">
      <Header user={user} onLoginClick={() => setShowLogin(true)} onLogout={handleLogout} />

      <main>
        <Routes>
          <Route
            path="/"
            element={
              user ? (
                <SearchPage
                  user={user}
                  onLoginRequired={() => setShowLogin(true)}
                />
              ) : null
            }
          />
          <Route path="/privacy" element={<PrivacyPage />} />
        </Routes>
      </main>

      <Footer />
      <FeedbackButton />

      {showLogin && (
        <LoginModal
          onLogin={handleLogin}
          onClose={user ? () => setShowLogin(false) : null}
          required={!user}
        />
      )}
    </div>
  );
}
