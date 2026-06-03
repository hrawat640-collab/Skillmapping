import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { api } from "../api";

export default function LoginModal({ onAuth }) {
  const [step, setStep] = useState("google"); // "google" | "profile"
  const [pendingToken, setPendingToken] = useState(null);
  const [pendingUser, setPendingUser] = useState(null);
  const [form, setForm] = useState({ name: "", profession: "", country: "" });
  const [countryOther, setCountryOther] = useState("");
  const [consent, setConsent] = useState(true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleGoogleSuccess(credentialResponse) {
    setErr("");
    try {
      const { data } = await api.post("/auth/google", {
        credential: credentialResponse.credential
      });
      if (data.user.needsProfile) {
        setPendingToken(data.token);
        setPendingUser(data.user);
        setForm((f) => ({ ...f, name: data.user.name || "" }));
        setStep("profile");
      } else {
        localStorage.setItem("sm_token", data.token);
        onAuth(data.token, data.user);
      }
    } catch (e) {
      setErr(e?.response?.data?.error || "Sign-in failed. Please try again.");
    }
  }

  async function handleProfileSave() {
    const name = form.name.trim();
    const profession = form.profession.trim();
    const country = (form.country === "Other" ? countryOther.trim() : form.country.trim());
    if (!name || !profession || !country) {
      setErr("Please fill in all fields.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      localStorage.setItem("sm_token", pendingToken);
      await api.post("/auth/google/profile", { name, profession, country });
      const updatedUser = { ...pendingUser, name, profession, country, needsProfile: false };
      onAuth(pendingToken, updatedUser);
    } catch (e) {
      setErr(e?.response?.data?.error || "Could not save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(15,14,12,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 18,
          padding: "36px 32px",
          width: "100%",
          maxWidth: 420,
          textAlign: "center",
          boxShadow: "0 24px 80px rgba(0,0,0,0.22)"
        }}
      >
        {step === "google" && (
          <>
            <h2
              style={{
                marginBottom: 6,
                fontSize: 22,
                letterSpacing: "-0.02em",
                fontFamily: "Inter, sans-serif",
                fontWeight: 800,
                color: "#0F172A"
              }}
            >
              Welcome to SkillMapper
            </h2>
            <p
              style={{
                color: "#6b6963",
                marginBottom: 24,
                fontSize: 13,
                lineHeight: 1.6,
                fontFamily: "Inter, sans-serif"
              }}
            >
              Free to use
            </p>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setErr("Google sign-in failed. Please try again.")}
                useOneTap={false}
                width="360"
              />
            </div>
            {err && (
              <p style={{ fontSize: 12, color: "#b91c1c", marginTop: 8 }}>{err}</p>
            )}
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                textAlign: "left",
                marginTop: 14,
                cursor: "pointer"
              }}
            >
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                style={{ marginTop: 3, flexShrink: 0, accentColor: "#064E3B" }}
              />
              <span style={{ fontSize: 11.5, color: "#8a8780", lineHeight: 1.5, fontFamily: "Inter, sans-serif" }}>
                Send me helpful hiring tools and insights. Unsubscribe anytime.
              </span>
            </label>
            <p style={{ fontSize: 11, color: "#bbb", marginTop: 12, fontFamily: "Inter, sans-serif" }}>
              Free · Unlimited searches
            </p>
          </>
        )}

        {step === "profile" && (
          <>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: ".05em",
                marginBottom: 14,
                fontFamily: "Inter, sans-serif",
                textAlign: "left"
              }}
            >
              Tell us a little about you
            </div>
            <div style={{ textAlign: "left" }}>
              <InputField
                placeholder="Your name"
                value={form.name}
                onChange={(v) => setForm((f) => ({ ...f, name: v }))}
              />
              <SelectField
                value={form.profession}
                onChange={(v) => setForm((f) => ({ ...f, profession: v }))}
                options={[
                  { value: "", label: "Select your profession" },
                  { value: "Fresher/Student", label: "Fresher/Student" },
                  { value: "Working Professional", label: "Working Professional" },
                  { value: "HR", label: "HR" },
                  { value: "Management/Founder", label: "Management/Founder" }
                ]}
              />
              <SelectField
                value={form.country}
                onChange={(v) => setForm((f) => ({ ...f, country: v }))}
                options={[
                  { value: "", label: "Select country" },
                  { value: "India", label: "India" },
                  { value: "United States", label: "United States" },
                  { value: "United Kingdom", label: "United Kingdom" },
                  { value: "UAE", label: "UAE" },
                  { value: "Canada", label: "Canada" },
                  { value: "Singapore", label: "Singapore" },
                  { value: "Australia", label: "Australia" },
                  { value: "Other", label: "Other (type below)" }
                ]}
              />
              {form.country === "Other" && (
                <InputField
                  placeholder="Type your country"
                  value={countryOther}
                  onChange={setCountryOther}
                />
              )}
              {err && (
                <p style={{ fontSize: 12, color: "#b91c1c", margin: "0 0 8px 0" }}>{err}</p>
              )}
              <button
                onClick={handleProfileSave}
                disabled={saving}
                style={{
                  width: "100%",
                  padding: 13,
                  background: saving ? "#94a3b8" : "#064E3B",
                  color: "#fff",
                  border: "none",
                  borderRadius: 9,
                  fontWeight: 700,
                  fontFamily: "Inter, sans-serif",
                  fontSize: 14,
                  cursor: saving ? "not-allowed" : "pointer"
                }}
              >
                {saving ? "Saving…" : "Continue →"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function InputField({ placeholder, value, onChange }) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        padding: "12px 14px",
        marginBottom: 10,
        borderRadius: 9,
        border: "1.5px solid #e4e2db",
        fontFamily: "Inter, sans-serif",
        fontSize: 14,
        outline: "none",
        boxSizing: "border-box",
        color: "#374151"
      }}
    />
  );
}

function SelectField({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        padding: "12px 14px",
        marginBottom: 10,
        borderRadius: 9,
        border: "1.5px solid #e4e2db",
        fontFamily: "Inter, sans-serif",
        fontSize: 14,
        outline: "none",
        boxSizing: "border-box",
        background: "#fff",
        color: "#374151",
        appearance: "auto"
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
