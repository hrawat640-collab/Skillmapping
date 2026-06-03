import { useState } from "react";

export default function FloatingPanda({ onPrompt }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="panda-float">
      <div className="panda-bubble">
        <button className="panda-dismiss" onClick={() => setDismissed(true)} title="Dismiss">×</button>
        <p className="panda-msg">Contribute your salary to unlock all experience levels!</p>
        <button
          className="panda-cta"
          onClick={() => { setDismissed(true); onPrompt(); }}
        >
          Share salary →
        </button>
      </div>

      <div className="bot-wrap">
        <div className="bot-head">
          <div className="bot-ant" />
          <div className="bot-face">
            <div className="bot-eyes">
              <div className="bot-eye" />
              <div className="bot-eye" />
            </div>
            <div className="bot-mouth" />
          </div>
        </div>
      </div>
    </div>
  );
}
