import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

const SEEN_KEY = "sm_loading_seen";
const ROTATE_MS = 5000;
const FADE_MS = 300;

const MOTIVATIONAL = [
  "Building your personalized salary insights...",
  "Finding your role benchmarks...",
  "Almost there — pulling market data...",
  "Preparing your dashboard...",
  "One moment — verifying your access..."
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
  const all = [...MOTIVATIONAL, ...highlights];
  const seen = readSeen();
  const unseen = all.filter((msg) => !seen.includes(msg));
  const alreadySeen = all.filter((msg) => seen.includes(msg));

  if (unseen.length === 0) {
    localStorage.removeItem(SEEN_KEY);
    return shuffle(all);
  }

  return [...shuffle(unseen), ...shuffle(alreadySeen)];
}

function markSeen(message) {
  if (!message) return;
  const seen = readSeen();
  if (seen.includes(message)) return;
  writeSeen([...seen, message]);
}

export default function LoadingMessages() {
  const [pool, setPool] = useState(() => shuffle([...MOTIVATIONAL]));
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
    markSeen(message);
  }, [message]);

  useEffect(() => {
    if (pool.length <= 1) return undefined;

    const timer = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % pool.length);
        setFadeIn(true);
      }, FADE_MS);
    }, ROTATE_MS);

    return () => clearInterval(timer);
  }, [pool.length]);

  return (
    <div className="loading-messages" aria-live="polite" aria-busy="true">
      <p
        className={`loading-messages-text${fadeIn ? " is-visible" : " is-hidden"}`}
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
