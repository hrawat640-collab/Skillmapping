import { useState } from "react";
import { api } from "../api";

const DEPT_SUBS = {
  Engineering: ["Backend", "Frontend", "Full Stack", "Mobile (iOS)", "Mobile (Android)", "DevOps / Platform", "QA / Testing", "Embedded", "Security", "Site Reliability", "ML Platform", "Data Engineering"],
  Data: ["Data Science", "Data Engineering", "Analytics", "Business Intelligence", "ML / AI", "NLP", "Computer Vision", "MLOps"],
  Design: ["Product Design", "UX Research", "UI Design", "Brand / Visual", "Motion Design", "Content Design"],
  Product: ["Product Management", "Growth Product", "Platform Product", "Technical PM", "Program Management"],
  Marketing: ["Growth / Organic", "Performance Marketing", "Content", "SEO", "Social Media", "Email Marketing", "Brand", "Product Marketing"],
  Sales: ["Account Executive", "SDR / BDR", "Enterprise Sales", "Channel Sales", "Customer Success", "Pre-Sales / Solutions"],
  HR: ["Talent Acquisition", "HR Business Partner", "People Operations", "Compensation & Benefits", "L&D", "HR Analytics", "DEI"],
  Finance: ["FP&A", "Accounting", "Investor Relations", "Corporate Finance", "Tax", "Treasury"],
  Operations: ["Business Operations", "Supply Chain", "Program Management", "Strategy & Operations", "Chief of Staff"],
  Legal: ["General Counsel", "Corporate Legal", "Compliance", "IP / Patents", "Data Privacy"],
  Gaming: ["Game Design", "Game Engineering", "Art / Animation", "Production", "QA", "Audio", "Community"]
};

export default function SalaryModal({ role, onClose, onSuccess }) {
  const [form, setForm] = useState({
    dept: "",
    subDept: "",
    customDept: "",
    subOther: "",
    yourRole: "",
    yearsWorking: "",
    compensation: "",
    currency: "INR",
    country: "",
    company: "",
    companyStage: "",
    notifyChange: false
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const title = role?.title || role?.canonical_title || "this role";

  const subDeptOptions = DEPT_SUBS[form.dept] || [];
  const showSubOther = form.dept === "Other" || form.subDept === "Other...";

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleDeptChange(val) {
    setForm((f) => ({ ...f, dept: val, subDept: "", customDept: "", subOther: "" }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.company.trim()) { setError("Please enter where you work."); return; }
    if (!form.compensation.trim()) { setError("Please enter your annual compensation."); return; }

    setSubmitting(true);
    setError("");
    try {
      await api.post("/salary/contribute", {
        role_id: role?.id || role?.role_id || "",
        dept: form.dept || null,
        sub_dept: form.subDept || form.subOther || null,
        your_role: form.yourRole || null,
        years_working: form.yearsWorking || null,
        compensation: form.compensation,
        currency: form.currency,
        country: form.country || null,
        company: form.company,
        company_stage: form.companyStage || null
      });

      localStorage.setItem("sm_sal_unlocked_until", String(Date.now() + 7 * 24 * 60 * 60 * 1000));
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || "Could not save. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="sal-modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sal-modal-card">
        <button className="sal-modal-close" onClick={onClose} aria-label="Close">×</button>

        <div className="sal-modal-head">
          <div className="sal-modal-head-text">
            <div className="sal-modal-title">Help make salary benchmarks more accurate</div>
            <p className="sal-modal-sub">Your anonymous contribution helps professionals compare compensation more confidently.</p>
            <p className="sal-modal-hint">Takes ~30 seconds</p>
          </div>
        </div>

        <div className="sal-modal-scroll">
          <div className="sal-modal-body">
            <form onSubmit={handleSubmit}>

              {/* Your role & team */}
              <div className="sal-form-block">
                <h3 className="sal-form-section-h">Your role &amp; team</h3>
                <div className="sal-field-grid">
                  <div className="sal-field">
                    <label>Team / department</label>
                    <select value={form.dept} onChange={(e) => handleDeptChange(e.target.value)}>
                      <option value="">Pick one</option>
                      {["Engineering","Data","Design","Product","Marketing","Sales","HR","Finance","Operations","Legal","Gaming","Other"].map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sal-field">
                    <label>Focus area</label>
                    <select
                      value={form.subDept}
                      onChange={(e) => set("subDept", e.target.value)}
                      disabled={!form.dept || form.dept === "Other"}
                    >
                      <option value="">{form.dept && form.dept !== "Other" ? "Pick a focus area" : "Pick your department first"}</option>
                      {subDeptOptions.map((s) => <option key={s}>{s}</option>)}
                      {subDeptOptions.length > 0 && <option value="Other...">Other...</option>}
                    </select>
                  </div>

                  {showSubOther && (
                    <>
                      <div className="sal-field">
                        <label>Your department</label>
                        <input
                          type="text"
                          placeholder="e.g. Customer Success"
                          value={form.customDept}
                          onChange={(e) => set("customDept", e.target.value)}
                        />
                      </div>
                      <div className="sal-field">
                        <label>Focus area</label>
                        <input
                          type="text"
                          placeholder="e.g. Onboarding"
                          value={form.subOther}
                          onChange={(e) => set("subOther", e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  <div className="sal-field" style={{ gridColumn: "1/-1" }}>
                    <label>Your role</label>
                    <input
                      type="text"
                      placeholder="e.g. Senior PM, Staff Engineer, L5"
                      value={form.yourRole}
                      onChange={(e) => set("yourRole", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Compensation */}
              <div className="sal-form-block">
                <h3 className="sal-form-section-h">Compensation</h3>
                <div className="sal-field-grid">
                  <div className="sal-field">
                    <label>Years you've been working</label>
                    <select value={form.yearsWorking} onChange={(e) => set("yearsWorking", e.target.value)}>
                      <option value="">Pick one</option>
                      <option value="0-2">0–2 years</option>
                      <option value="2-4">2–4 years</option>
                      <option value="4-6">4–6 years</option>
                      <option value="6-9">6–9 years</option>
                      <option value="9-12">9–12 years</option>
                      <option value="12+">12+ years</option>
                    </select>
                  </div>

                  <div className="sal-field">
                    <label>Your annual compensation <span style={{ color: "var(--teal)", fontWeight: 700 }}>*</span></label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 18L, 45K"
                      value={form.compensation}
                      onChange={(e) => set("compensation", e.target.value)}
                    />
                  </div>

                  <div className="sal-field">
                    <label>Paid in</label>
                    <select value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="AED">AED</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="SGD">SGD</option>
                      <option value="CAD">CAD</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="sal-field">
                    <label>Based in</label>
                    <select value={form.country} onChange={(e) => set("country", e.target.value)}>
                      <option value="">Pick one</option>
                      <option value="India">India</option>
                      <option value="USA">United States</option>
                      <option value="UAE">UAE</option>
                      <option value="UK">United Kingdom</option>
                      <option value="Germany">Germany</option>
                      <option value="Canada">Canada</option>
                      <option value="Singapore">Singapore</option>
                      <option value="Australia">Australia</option>
                      <option value="Remote/Global">Remote / Global</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Your employer */}
              <div className="sal-form-block">
                <h3 className="sal-form-section-h">Your employer</h3>
                <div className="sal-field-grid">
                  <div className="sal-field" style={{ gridColumn: "1/-1" }}>
                    <label>Where you work <span style={{ color: "var(--teal)", fontWeight: 700 }}>*</span></label>
                    <input
                      type="text"
                      placeholder="Company name (stays anonymous)"
                      value={form.company}
                      onChange={(e) => set("company", e.target.value)}
                    />
                  </div>

                  <div className="sal-field" style={{ gridColumn: "1/-1" }}>
                    <label>Kind of company <span style={{ color: "var(--ink3)", fontWeight: 400 }}>(optional)</span></label>
                    <select value={form.companyStage} onChange={(e) => set("companyStage", e.target.value)}>
                      <option value="">Pick one</option>
                      <option value="Early-stage / Seed">Early-stage / Seed</option>
                      <option value="Series A–B">Series A–B</option>
                      <option value="Growth / Mid-market">Growth / Mid-market</option>
                      <option value="Enterprise">Enterprise</option>
                      <option value="Agency / Consulting">Agency / Consulting</option>
                      <option value="Public / Listed">Public / Listed</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <label className="sal-check-row" style={{ gridColumn: "1/-1" }}>
                    <input
                      type="checkbox"
                      checked={form.notifyChange}
                      onChange={(e) => set("notifyChange", e.target.checked)}
                    />
                    <span>Let me know if benchmarks shift for roles like mine.</span>
                  </label>
                </div>
              </div>

              {error && (
                <p style={{ fontSize: 12, color: "var(--red)", margin: "0 0 14px", fontFamily: "var(--sans)" }}>{error}</p>
              )}

              <div className="sal-form-foot">
                <button className="sal-btn-primary" type="submit" disabled={submitting}>
                  {submitting ? "Submitting…" : "Contribute anonymously"}
                </button>
                <button className="sal-btn-skip" type="button" onClick={onClose}>
                  Skip for now
                </button>
              </div>

            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
