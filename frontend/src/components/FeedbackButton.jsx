import { useState } from "react";
import { api } from "../api";

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [err, setErr] = useState("");

  function openModal() {
    setSubject("");
    setMessage("");
    setErr("");
    setSuccess(false);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
  }

  async function submit() {
    if (!message.trim()) {
      setErr("Please enter a message.");
      return;
    }
    setErr("");
    setLoading(true);
    try {
      const user = (() => {
        try { return JSON.parse(localStorage.getItem("sm_user") || "{}"); } catch { return {}; }
      })();
      await api.post("/feedback", {
        email: user.email || "anonymous",
        name: user.name || "",
        subject: subject.trim(),
        message: message.trim(),
      });
      setSuccess(true);
      setTimeout(() => setOpen(false), 1800);
    } catch {
      setErr("Could not save. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Fixed button */}
      <button className="feedback-fab" onClick={openModal}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M2 2h12v9H9l-3 3v-3H2V2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        Feedback
      </button>

      {/* Modal */}
      {open && (
        <div className="feedback-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="feedback-modal">
            <div className="feedback-modal-header">
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>Share your feedback</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>We read every message</div>
            </div>
            <div className="feedback-modal-body">
              <div className="feedback-field">
                <label className="feedback-label">Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Missing role, Bug, Suggestion"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="feedback-input"
                />
              </div>
              <div className="feedback-field">
                <label className="feedback-label">Message</label>
                <textarea
                  placeholder="Tell us what's on your mind..."
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="feedback-textarea"
                />
              </div>
              {err && <div className="feedback-err">{err}</div>}
              {success && <div className="feedback-success">Thank you! We got your message ✓</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="feedback-send-btn" onClick={submit} disabled={loading}>
                  {loading ? "Sending…" : "Send feedback"}
                </button>
                <button className="feedback-cancel-btn" onClick={closeModal}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
