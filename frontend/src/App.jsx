import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";
import { api } from "./api";

const industries = ["Technology", "Finance", "Healthcare", "Retail", "Consulting", "Other"];

function AuthCard({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const { data } = await api.post(endpoint, form);
      localStorage.setItem("token", data.token);
      onAuth(data.user);
    } catch (err) {
      alert(err.response?.data?.error || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-md bg-white shadow-xl rounded-xl p-6 space-y-4">
        <h1 className="text-2xl font-bold">CV Evaluator SaaS</h1>
        {mode === "register" && (
          <input className="w-full border rounded-lg p-2" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        )}
        <input className="w-full border rounded-lg p-2" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="w-full border rounded-lg p-2" type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button disabled={loading} className="w-full bg-slate-900 text-white rounded-lg p-2">
          {loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
        </button>
        <p className="text-sm">
          {mode === "login" ? "New here?" : "Already registered?"}{" "}
          <button type="button" className="underline" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Create account" : "Login"}
          </button>
        </p>
      </form>
    </div>
  );
}

function Progress({ label, value, color = "bg-emerald-500" }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1"><span>{label}</span><span>{value}/100</span></div>
      <div className="h-3 bg-slate-200 rounded-full overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${value}%` }} /></div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(localStorage.getItem("token") ? { email: "Logged user" } : null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [form, setForm] = useState({
    targetRole: "Software Engineer",
    experienceYears: 3,
    lastDesignation: "Software Developer",
    industry: "Technology",
    location: "Bengaluru",
    education: "B.Tech Computer Science"
  });
  const [file, setFile] = useState(null);

  const chartData = useMemo(
    () =>
      (report?.per_jd_scores || []).map((x) => ({
        jd: x.title.slice(0, 18),
        score: x.overall_score
      })),
    [report]
  );

  const evaluate = async (e) => {
    e.preventDefault();
    if (!file) return alert("Please upload a PDF CV");
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
    fd.append("cv", file);
    setLoading(true);
    try {
      const { data } = await api.post("/evaluate", fd);
      setReport(data);
    } catch (err) {
      alert(err.response?.data?.error || "Evaluation failed");
    } finally {
      setLoading(false);
    }
  };

  const exportPdf = () => {
    if (!report) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("CV Evaluation Report", 14, 18);
    doc.setFontSize(12);
    doc.text(`Overall Score: ${report.scores.overall}/100`, 14, 30);
    doc.text(`Keywords: ${report.scores.keywords}/100`, 14, 38);
    doc.text(`Experience: ${report.scores.experience}/100`, 14, 46);
    doc.text(`Education Fit: ${report.scores.education_fit}/100`, 14, 54);
    doc.text(`Missing Keywords: ${(report.keyword_analysis.missing_keywords || []).join(", ")}`, 14, 66, { maxWidth: 180 });
    doc.save("cv-evaluation-report.pdf");
  };

  if (!user) return <AuthCard onAuth={setUser} />;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold">CV Evaluation Dashboard</h1>
          <button onClick={() => { localStorage.removeItem("token"); setUser(null); }} className="text-sm underline">Logout</button>
        </div>

        <form onSubmit={evaluate} className="bg-white rounded-xl shadow p-5 grid md:grid-cols-2 gap-4">
          <input className="border rounded-lg p-2" placeholder="Target role" value={form.targetRole} onChange={(e) => setForm({ ...form, targetRole: e.target.value })} />
          <input className="border rounded-lg p-2" type="number" placeholder="Experience years" value={form.experienceYears} onChange={(e) => setForm({ ...form, experienceYears: e.target.value })} />
          <input className="border rounded-lg p-2" placeholder="Last designation" value={form.lastDesignation} onChange={(e) => setForm({ ...form, lastDesignation: e.target.value })} />
          <select className="border rounded-lg p-2" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}>
            {industries.map((i) => <option key={i}>{i}</option>)}
          </select>
          <input className="border rounded-lg p-2" placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <input className="border rounded-lg p-2" placeholder="Education" value={form.education} onChange={(e) => setForm({ ...form, education: e.target.value })} />
          <input className="border rounded-lg p-2 md:col-span-2" type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button disabled={loading} className="md:col-span-2 bg-slate-900 text-white rounded-lg p-3">
            {loading ? "Evaluating..." : "Evaluate CV"}
          </button>
        </form>

        {loading && <div className="bg-white rounded-xl shadow p-6 animate-pulse">Processing CV and fetching JDs...</div>}

        {report && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow p-5 grid md:grid-cols-4 gap-4 items-center">
              <div className="col-span-1">
                <div className={`text-4xl font-bold ${report.scores.overall >= 75 ? "text-emerald-600" : "text-amber-600"}`}>{report.scores.overall}/100</div>
                <div className="text-sm text-slate-500">Overall Match</div>
              </div>
              <div className="md:col-span-3 space-y-3">
                <Progress label="Skills Fit" value={report.scores.keywords} color="bg-emerald-500" />
                <Progress label="Experience Fit" value={report.scores.experience} color="bg-blue-500" />
                <Progress label="Education Fit" value={report.scores.education_fit} color="bg-violet-500" />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl shadow p-5">
                <h3 className="font-semibold mb-3">Matched Keywords ({report.keyword_analysis.matched_keywords.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {report.keyword_analysis.matched_keywords.map((k) => <span key={k} className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm">{k}</span>)}
                </div>
              </div>
              <div className="bg-white rounded-xl shadow p-5">
                <h3 className="font-semibold mb-3">Missing Keywords ({report.keyword_analysis.missing_keywords.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {report.keyword_analysis.missing_keywords.map((k) => <span key={k} className="px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-sm">{k}</span>)}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow p-5">
              <h3 className="font-semibold mb-3">Per-JD Score Comparison</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="jd" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="score" fill="#0f172a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow p-5">
              <h3 className="font-semibold mb-3">AI Suggestions</h3>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                {report.suggestions.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>

            <button onClick={exportPdf} className="bg-emerald-600 text-white rounded-lg px-4 py-2">Export PDF</button>
          </div>
        )}
      </div>
    </div>
  );
}
