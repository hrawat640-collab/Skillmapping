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
  const [user, setUser] = useState(loadStoredUser);
  const [showLogin, setShowLogin] = useState(() => !loadStoredUser());

  useEffect(() => {
    const token = localStorage.getItem("sm_token");
    if (!token && user) {
      setUser(null);
    }
  }, []);

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
