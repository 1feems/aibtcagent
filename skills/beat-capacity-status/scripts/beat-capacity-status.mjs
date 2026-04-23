#!/usr/bin/env node

const CAP = 10;
const FETCH_TIMEOUT_MS = 8000;

const BEATS = [
  "bitcoin-macro",
  "quantum",
  "aibtc-network"
];

function signalDate(signal) {
  if (typeof signal.utcDate === "string" && signal.utcDate.length > 0) {
    return signal.utcDate;
  }
  if (typeof signal.timestamp === "string" && signal.timestamp.length >= 10) {
    return signal.timestamp.slice(0, 10);
  }
  return null;
}

async function fetchApprovedSignals(beat) {
  const url = `https://aibtc.news/api/signals?beat=${encodeURIComponent(beat)}&status=approved&limit=100`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch ${beat}: HTTP ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data?.signals) ? data.signals : [];
}

function summarizeBeat(beat, signals) {
  const dates = signals
    .map(signalDate)
    .filter((date) => typeof date === "string");

  const latestDate = dates.sort().at(-1) ?? null;
  const approvedCount = latestDate
    ? signals.filter((signal) => signalDate(signal) === latestDate).length
    : 0;
  const slotsOpen = Math.max(0, CAP - approvedCount);

  return {
    beat,
    latestDate,
    approvedCount,
    cap: CAP,
    slotsOpen
  };
}

function renderMarkdown(rows) {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const latestDates = [...new Set(rows.map((row) => row.latestDate).filter(Boolean))].sort();
  const cycle = latestDates.length === 1
    ? latestDates[0]
    : `per-beat latest approved day (${latestDates.join(", ") || "none"})`;

  const lines = [
    `As of ${now}, source: aibtc.news approved signal feeds; cycle: ${cycle}.`,
    "",
    "| Beat | Approved on latest approved day | Cap | Slots open |",
    "|---|---:|---:|---:|"
  ];

  for (const row of rows) {
    lines.push(`| \`${row.beat}\` | ${row.approvedCount} | ${row.cap} | ${row.slotsOpen} |`);
  }

  return lines.join("\n");
}

const rows = [];

for (const beat of BEATS) {
  const signals = await fetchApprovedSignals(beat);
  rows.push(summarizeBeat(beat, signals));
}

console.log(renderMarkdown(rows));
