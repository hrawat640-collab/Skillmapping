import { useEffect, useRef, useState } from "react";
import { api } from "../api";

const SEEN_KEY = "sm_toast_seen";
const INTERVAL_MS = 20 * 1000;
const VISIBLE_MS = 5000;
const FADE_MS = 300;

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

const LOC_MAP = {
  IN: "India",
  US: "the US",
  UK: "the UK",
  UAE: "the UAE",
  SG: "Singapore",
  AU: "Australia",
  CA: "Canada",
  DE: "Germany"
};

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

function writeSeen(keys) {
  localStorage.setItem(SEEN_KEY, JSON.stringify(keys));
}

function formatLocation(loc) {
  const value = String(loc || "").trim();
  if (!value) return "your area";
  const mapped = LOC_MAP[value.toUpperCase()];
  return mapped || value;
}

function formatTimeAgo(createdAt) {
  const created = new Date(createdAt);
  const ts = created.getTime();
  if (Number.isNaN(ts)) return null;

  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 0) return null;
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  }

  const hours = Math.floor(seconds / 3600);
  if (hours < 24) {
    return hours === 1 ? "an hour ago" : `${hours} hours ago`;
  }

  const days = Math.floor(seconds / 86400);
  if (days < 7) {
    return days === 1 ? "yesterday" : `${days} days ago`;
  }
  if (days < 30) return "a few days ago";
  return "a while ago";
}

function formatContributionMessage(row) {
  const designation = String(row.designation || "Someone").trim() || "Someone";
  const city = formatLocation(row.loc_detected);
  const suffix = formatTimeAgo(row.created_at);
  const base = `A ${designation} in ${city} contributed`;
  if (!suffix) return base;
  if (suffix === "just now") return `A ${designation} in ${city} contributed just now`;
  return `${base} ${suffix}`;
}

function buildFakeEntry(text) {
  return {
    seenKey: text,
    getText: () => text
  };
}

function buildRealEntry(row) {
  const createdAt = String(row.created_at || "").trim();
  return {
    seenKey: `real:${createdAt}`,
    getText: () => formatContributionMessage(row)
  };
}

function buildMessagePool(recentRows) {
  const fakeEntries = FAKE_ACTIVITY.map(buildFakeEntry);
  const realEntries = (recentRows || [])
    .filter((row) => row?.created_at)
    .map(buildRealEntry);

  const all = [...fakeEntries, ...realEntries];
  const seen = readSeen();
  const unseen = all.filter((entry) => !seen.includes(entry.seenKey));
  const alreadySeen = all.filter((entry) => seen.includes(entry.seenKey));

  if (unseen.length === 0) {
    localStorage.removeItem(SEEN_KEY);
    return shuffle(all);
  }

  return [...shuffle(unseen), ...shuffle(alreadySeen)];
}

function markSeenKey(seenKey) {
  if (!seenKey) return;
  const seen = readSeen();
  if (seen.includes(seenKey)) return;
  writeSeen([...seen, seenKey]);
}

function pickEntry(pool, cursorRef) {
  if (!pool.length) return null;
  const idx = cursorRef.current % pool.length;
  cursorRef.current += 1;
  const entry = pool[idx];
  markSeenKey(entry.seenKey);
  return entry;
}

export default function ActivityToast() {
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
  const poolRef = useRef([]);
  const cursorRef = useRef(0);

  useEffect(() => {
    let mounted = true;

    api.get("/stats/recent-activity")
      .then(({ data }) => {
        if (!mounted) return;
        poolRef.current = buildMessagePool(data?.recent || []);
        cursorRef.current = 0;
      })
      .catch(() => {
        if (!mounted) return;
        poolRef.current = buildMessagePool([]);
        cursorRef.current = 0;
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let hideTimer;

    function showNext() {
      const pool = poolRef.current;
      if (!pool.length) return;

      const entry = pickEntry(pool, cursorRef);
      if (!entry) return;

      setMessage(entry.getText());
      setVisible(true);

      if (hideTimer) clearTimeout(hideTimer);

      hideTimer = setTimeout(() => {
        setVisible(false);
      }, VISIBLE_MS);
    }

    const interval = setInterval(showNext, INTERVAL_MS);

    return () => {
      clearInterval(interval);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  if (!message) return null;

  return (
    <div
      className={`activity-toast${visible ? " visible" : ""}`}
      style={{ transition: `opacity ${FADE_MS}ms` }}
      aria-live="polite"
    >
      {message}
    </div>
  );
}
