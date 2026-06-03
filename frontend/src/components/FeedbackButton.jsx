import { useState } from "react";
import { api } from "../api";

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    try {
      await api.post("/feedback", {
        message: message.trim(),
        type: "general",
        page: window.location.pathname
      });
      setSent(true);
      setMessage("");
      setTimeout(() => { setSent(false); setOpen(false); }, 2000);
    } catch {
      // still close on error
      setOpen(false);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button id="feedbackBtn" onClick={() => setOpen((o) => !o)} aria-label="Give feedback">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M14 10a2 2 0 01-2 2H4l-3 3V4a2 2 0 012-2h9a2 2 0 012 2v6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
        Feedback
      </button>

      {open && (
        <div className="feedback-overlay" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="feedback-modal">
            <h3>Share feedback</h3>
            {sent ? (
              <p style={{ fontSize: 13, color: "var(--green)", fontWeight: 600 }}>Thank you! 🙌</p>
            ) : (
              <>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What's working well? What could be better?"
                  autoFocus
                />
                <button
                  className="feedback-send"
                  onClick={handleSend}
                  disabled={sending || !message.trim()}
                >
                  {sending ? "Sending…" : "Send feedback"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
