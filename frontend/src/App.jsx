import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginModal from "./components/LoginModal";
import Header from "./components/Header";
import SearchPage from "./components/SearchPage";
import Footer from "./components/Footer";
import PrivacyPage from "./components/PrivacyPage";
import FeedbackButton from "./components/FeedbackButton";

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("sm_token");
    const raw = localStorage.getItem("sm_user");
    if (token && raw) {
      try {
        setUser(JSON.parse(raw));
      } catch {
        localStorage.removeItem("sm_token");
        localStorage.removeItem("sm_user");
      }
    }
    setReady(true);
  }, []);

  function handleAuth(token, userData) {
    localStorage.setItem("sm_token", token);
    localStorage.setItem("sm_user", JSON.stringify(userData));
    setUser(userData);
  }

  function handleSignOut() {
    localStorage.removeItem("sm_token");
    localStorage.removeItem("sm_user");
    setUser(null);
  }

  if (!ready) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#F8FAFC" }}>
        <div style={{ fontSize: 13, color: "#94a3b8" }}>Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <LoginModal onAuth={handleAuth} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <Header user={user} onSignOut={handleSignOut} />
      <div style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<SearchPage user={user} />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <Footer />
      <FeedbackButton />
    </div>
  );
}
