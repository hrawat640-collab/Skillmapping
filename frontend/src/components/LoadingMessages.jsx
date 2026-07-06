import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

const SEEN_KEY = "sm_loading_seen";
const ROTATE_MS = 4000;

const FAKE_ACTIVITY = [
  "A Senior Product Manager in Bangalore just contributed",
  "Someone in Mumbai just added their SDE-3 benchmark",
  "A UX Designer in Pune contributed a few minutes ago",
  "Someone at a Series B startup just shared their salary",
  "A Data Scientist in Delhi just contributed",
  "An Engineering Manager in Hyderabad just added theirs",
  "Someone in Chennai just contributed to the Backend Engineer benchmark",
  "A Marketing Lead in Bangalore just added their comp",
  "Someone in Gurgaon just contributed",
  "A Solutions Architect in Bangalore just shared their salary",
  "12 minutes ago: an HRBP in Mumbai contributed",
  "18 minutes ago: a Full Stack Developer in Bangalore added their salary",
  "Half an hour ago: a Product Designer in Pune contributed",
  "Earlier today: 4 SDE-2s in Bangalore added their benchmarks",
  "Earlier today: 3 Product Managers contributed across cities",
  "Someone in Bangalore contributed 25 minutes ago",
  "An ML Engineer in Hyderabad added theirs an hour ago",
  "A DevOps Engineer in Chennai contributed today",
  "A Business Analyst in Mumbai just added their salary",
  "A Frontend Engineer in Delhi contributed earlier",
  "Someone just helped 12 others benchmark their SDE-3 salary",
  "A recent contribution just updated the Bangalore Product Manager range",
  "Fresh data just came in for Backend Engineers in Pune",
  "Someone at a fintech just contributed to the Data Scientist benchmark",
  "Community update: 8 new contributions this hour",
  "Two Senior UX Designers just added their comp in the last 20 minutes",
  "Someone contributed to make the SDE-2 benchmark more accurate",
  "A Product Lead just added theirs — helping the community",
  "Fresh benchmark data just landed for HR roles",
  "Community just crossed another salary contribution milestone",
  "'Am I underpaid?' — the question everyone's asking. Someone just answered it for themselves.",
  "Someone just gave their salary to help thousands of others",
  "A contributor in Bangalore just made the SDE benchmark stronger",
  "A fresh Product Manager benchmark just went live",
  "Every salary contributed makes the next negotiation easier"
];

const HIGHLIGHT_TEMPLATES = [
  "{roles} roles and counting. Add yours to the mix",
  "{skills} skills tracked so far. Which ones are you missing?",
  "{contributions} people helped us build this. Want to be next?",
  "Benchmarks from {roles} roles, {skills}+ skills, and {contributions} salary contributions",
  "{contributions} contributions across {cities} cities powering the data",
  "Live data: {roles} roles, {skills} skills, {contributions} verified salary points",
  "Helping thousands of professionals answer 'am I underpaid?' since 2026",
  "Built on real contributions from {contributions} professionals",
  "One tool, {roles} roles, thousands of decisions made better"
];

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function readSeen() {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSeen(messages) {
  localStorage.setItem(SEEN_KEY, JSON.stringify(messages));
}

function buildHighlightMessages(stats) {
  return HIGHLIGHT_TEMPLATES.map((template) =>
    template
      .replaceAll("{roles}", String(stats.role_count))
      .replaceAll("{skills}", String(stats.skill_count))
      .replaceAll("{contributions}", String(stats.contribution_count))
      .replaceAll("{cities}", String(stats.city_count))
  );
}

function buildMessagePool(highlights) {
  const all = [...FAKE_ACTIVITY, ...highlights];
  const seen = readSeen();
  const unseen = all.filter((msg) => !seen.includes(msg));
  const alreadySeen = all.filter((msg) => seen.includes(msg));

  if (unseen.length === 0) {
    localStorage.removeItem(SEEN_KEY);
    return shuffle(all);
  }

  return [...shuffle(unseen), ...shuffle(alreadySeen)];
}

function markSeen(message, seen) {
  if (!message || seen.includes(message)) return seen;
  const next = [...seen, message];
  writeSeen(next);
  return next;
}

export default function LoadingMessages() {
  const [pool, setPool] = useState(() => shuffle([...FAKE_ACTIVITY]));
  const [index, setIndex] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);

  const message = useMemo(() => pool[index] || pool[0] || "", [pool, index]);

  useEffect(() => {
    let mounted = true;

    api.get("/stats/highlights")
      .then(({ data }) => {
        if (!mounted) return;
        const highlights = buildHighlightMessages(data);
        setPool(buildMessagePool(highlights));
        setIndex(0);
      })
      .catch(() => {
        if (!mounted) return;
        setPool(buildMessagePool([]));
        setIndex(0);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!message) return;
    markSeen(message, readSeen());
  }, [message]);

  useEffect(() => {
    if (pool.length <= 1) return undefined;

    const timer = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % pool.length);
        setFadeIn(true);
      }, 150);
    }, ROTATE_MS);

    return () => clearInterval(timer);
  }, [pool.length]);

  return (
    <div className="loading-messages" aria-live="polite" aria-busy="true">
      <p
        className="loading-messages-text"
        style={{ opacity: fadeIn ? 1 : 0 }}
      >
        <span className="loading-messages-bullet" aria-hidden="true">•</span>
        {message}
      </p>
      <div className="loading-messages-dots" aria-hidden="true">
        <span className="loading-messages-dot" />
        <span className="loading-messages-dot" />
        <span className="loading-messages-dot" />
      </div>
    </div>
  );
}
