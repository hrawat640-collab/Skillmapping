const FADE_MS = 300;

export default function CornerSpinner({ visible }) {
  return (
    <div
      className={`corner-spinner${visible ? " visible" : ""}`}
      style={{ transition: `opacity ${FADE_MS}ms` }}
      aria-live="polite"
      aria-busy={visible}
    >
      <span className="corner-spinner-circle" aria-hidden="true" />
      Loading...
    </div>
  );
}
