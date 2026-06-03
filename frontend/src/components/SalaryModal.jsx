import { useState } from "react";
import { api } from "../api";

const EXP_RANGES = ["0-2 yrs", "2-5 yrs", "5-8 yrs", "8-12 yrs", "12-15 yrs", "15+ yrs"];

const DEPT_SUBS = {
  "Engineering": ["Frontend", "Backend", "Full Stack", "Mobile", "DevOps/Cloud", "Data Engineering", "QA/Testing", "Security", "Architecture", "Other"],
  "Product": ["Product Management", "UX/Design", "Business Analysis", "Program Management", "Other"],
  "Sales": ["Inside Sales", "Field Sales", "Pre-Sales", "Sales Ops", "Enterprise Sales", "Other"],
  "Marketing": ["Digital Marketing", "Content Marketing", "Brand", "Performance Marketing", "Product Marketing", "Growth", "Other"],
  "Finance": ["Accounting", "FP&A", "Tax", "Treasury", "Audit", "Corporate Finance", "Other"],
  "HR": ["Talent Acquisition", "HR Business Partner", "L&D", "Total Rewards", "HR Ops", "Other"],
  "Operations": ["Supply Chain", "Procurement", "Logistics", "Business Ops", "Customer Success", "Support", "Other"],
  "Data & AI": ["Data Science", "Data Analytics", "ML Engineering", "BI/Reporting", "AI Research", "Other"],
  "Consulting": ["Strategy", "IT Consulting", "Management Consulting", "Domain/Functional", "Other"],
  "Legal": ["Corporate Legal", "Compliance", "IP/Patents", "Other"],
};

const COUNTRIES = ["India", "USA", "UK", "Canada", "Australia", "Singapore", "UAE", "Germany", "Netherlands", "Other"];

export default function SalaryModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    dept: "", sub_dept: "", designation: "", experience_range: "",
    ctc: "", currency: "INR", country: "India",
    company: "", role_desc: "", notify_salary: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  const subOpts = DEPT_SUBS[form.dept] || [];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.ctc.trim() || !form.company.trim()) {
      setError("Compensation and company are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.post("/salary/contribute", {
        ...form,
        notify_salary: form.notify_salary ? "yes" : "no",
      });
      onSuccess();
    } catch (err) {
      const msg = err?.response?.data?.error
        || (err?.code === "ERR_NETWORK" ? "Could not reach server — is the backend running?" : null)
        || "Could not save. Please try again.";
      setError(msg);
      setLoading(false);
    }
  }

  return (
    <div className="sal-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sal-modal-card">
        <div className="sal-modal-header">
          <div>
            <div className="sal-modal-title">Contribute your salary</div>
            <div className="sal-modal-sub">Anonymous · helps the community unlock salary data</div>
          </div>
          <button className="sal-modal-close" onClick={onClose}>×</button>
        </div>

        <form className="sal-modal-form" onSubmit={handleSubmit}>
          <div className="sal-form-row">
            <label className="sal-form-label">Department</label>
            <select className="sal-form-select" value={form.dept}
              onChange={e => { set("dept", e.target.value); set("sub_dept", ""); }}>
              <option value="">Select dept</option>
              {Object.keys(DEPT_SUBS).map(d => <option key={d} value={d}>{d}</option>)}
              <option value="Other">Other</option>
            </select>
          </div>

          {subOpts.length > 0 && (
            <div className="sal-form-row">
              <label className="sal-form-label">Sub-department</label>
              <select className="sal-form-select" value={form.sub_dept} onChange={e => set("sub_dept", e.target.value)}>
                <option value="">Select sub-dept</option>
                {subOpts.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          <div className="sal-form-row">
            <label className="sal-form-label">Designation / Title</label>
            <input className="sal-form-input" type="text"
              placeholder="e.g. Senior Software Engineer"
              value={form.designation} onChange={e => set("designation", e.target.value)} />
          </div>

          <div className="sal-form-row2">
            <div>
              <label className="sal-form-label">Experience</label>
              <select className="sal-form-select" value={form.experience_range} onChange={e => set("experience_range", e.target.value)}>
                <option value="">Select range</option>
                {EXP_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="sal-form-label">Currency</label>
              <select className="sal-form-select" value={form.currency} onChange={e => set("currency", e.target.value)}>
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
                <option value="EUR">EUR (€)</option>
                <option value="SGD">SGD</option>
                <option value="AED">AED</option>
              </select>
            </div>
          </div>

          <div className="sal-form-row">
            <label className="sal-form-label">Annual CTC <span className="sal-form-req">*</span></label>
            <input className="sal-form-input" type="text"
              placeholder={form.currency === "INR" ? "e.g. 18 LPA or 1800000" : "e.g. 90000"}
              value={form.ctc} onChange={e => set("ctc", e.target.value)} required />
          </div>

          <div className="sal-form-row">
            <label className="sal-form-label">Company <span className="sal-form-req">*</span></label>
            <input className="sal-form-input" type="text"
              placeholder="Company name"
              value={form.company} onChange={e => set("company", e.target.value)} required />
          </div>

          <div className="sal-form-row">
            <label className="sal-form-label">Country</label>
            <select className="sal-form-select" value={form.country} onChange={e => set("country", e.target.value)}>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="sal-form-row">
            <label className="sal-form-label">Role description <span className="sal-form-opt">(optional)</span></label>
            <textarea className="sal-form-textarea" rows={2}
              placeholder="Briefly describe your role…"
              value={form.role_desc} onChange={e => set("role_desc", e.target.value)} />
          </div>

          <label className="sal-notify-row">
            <input type="checkbox" checked={form.notify_salary}
              onChange={e => set("notify_salary", e.target.checked)}
              style={{ accentColor: "var(--accent)" }} />
            <span>Notify me when more salary data is added for my role</span>
          </label>

          {error && <div className="sal-form-error">{error}</div>}

          <button className="btn-find sal-submit-btn" type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
            {loading ? "Submitting…" : "Submit anonymously 🔒"}
          </button>
        </form>
      </div>
    </div>
  );
}
