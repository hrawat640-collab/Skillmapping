import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export default function FloatingPanda({ onContribute, hasResults }) {
  const { salaryUnlocked } = useAuth();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!hasResults || dismissed || salaryUnlocked) return;
    const t = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(t);
  }, [hasResults, dismissed, salaryUnlocked]);

  useEffect(() => {
    if (salaryUnlocked) setVisible(false);
  }, [salaryUnlocked]);

  if (!visible) return null;

  return (
    <div id="floatingPanda" className="show">
      <div className="panda-bubble">
        <strong>Unlock salary data 🔓</strong>
        <br />
        Share your salary anonymously to see ₹ / $ benchmarks for every role.
        <div className="panda-actions">
          <button className="panda-cta" onClick={() => { onContribute?.(); setDismissed(true); setVisible(false); }}>
            Share salary
          </button>
          <button className="panda-dismiss" onClick={() => { setDismissed(true); setVisible(false); }}>
            Not now
          </button>
        </div>
      </div>
      <div
        className="salary-initials-badge"
        title="Share salary to unlock"
        onClick={() => { onContribute?.(); setDismissed(true); setVisible(false); }}
        style={{ cursor: "pointer" }}
      >
        💰
      </div>
    </div>
  );
}
