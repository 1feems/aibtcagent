const page = document.body.dataset.page ?? "overview";

async function loadDashboardData() {
  const response = await fetch(page === "overview" ? "./data/dashboard.json" : "../data/dashboard.json");
  if (!response.ok) {
    throw new Error(`Failed to load dashboard data: ${response.status}`);
  }
  return response.json();
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

function formatDate(value) {
  if (!value) {
    return "No snapshot yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatSats(value) {
  return `${formatNumber(value)} sats`;
}

function statusClass(status) {
  switch (status) {
    case "brief_included":
    case "approved":
    case "done":
      return "pill--brief_included";
    case "submitted":
    case "pending":
    case "in_review":
      return "pill--submitted";
    case "rejected":
    case "blocked":
      return "pill--rejected";
    default:
      return "pill--default";
  }
}

function titleCase(value) {
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function setHtml(id, html) {
  const node = document.getElementById(id);
  if (node) {
    node.innerHTML = html;
  }
}

function renderOverview(data) {
  const topStats = [
    {
      label: "Current rank",
      value: `#${data.agent.rank}`,
      subtext: `${data.agent.displayName} on the leaderboard`
    },
    {
      label: "In briefs",
      value: formatNumber(data.summary.briefIncluded),
      subtext: `${data.summary.briefHitRate}% brief hit rate`
    },
    {
      label: "Approved bounties",
      value: formatNumber(data.manualBounties.summary.approved),
      subtext: `${data.manualBounties.summary.participated} total bounty entries tracked`
    },
    {
      label: "Earned",
      value: data.agent.earned,
      subtext: `${formatSats(data.summary.totalSats)} across recorded signals`
    }
  ];

  setHtml(
    "overview-stats",
    topStats
      .map(
        (stat) => `
          <article class="stat-card">
            <p class="stat-card__label">${stat.label}</p>
            <strong class="stat-card__value">${stat.value}</strong>
            <p class="stat-card__subtext">${stat.subtext}</p>
          </article>
        `
      )
      .join("")
  );

  setHtml(
    "signals-table",
    data.signals
      .slice(0, 10)
      .map(
        (signal) => `
          <tr>
            <td class="mono">${signal.reportDate}</td>
            <td>${titleCase(signal.beat)}</td>
            <td class="headline-cell">${signal.headline}</td>
            <td><span class="pill ${statusClass(signal.status)}">${titleCase(signal.status)}</span></td>
            <td class="mono">${signal.satsEarned ? formatSats(signal.satsEarned) : "-"}</td>
          </tr>
        `
      )
      .join("")
  );

  setHtml(
    "brief-list",
    data.recentBriefs.length
      ? data.recentBriefs
          .map(
            (brief) => `
              <article class="brief-item">
                <strong class="brief-item__title">${brief.title}</strong>
                <p class="brief-item__text">${brief.summary}</p>
              </article>
            `
          )
          .join("")
      : `<div class="empty-state">Add brief titles and one-line summaries in <code>site/data/dashboard.json</code>.</div>`
  );

  const summaryItems = [
    { title: "Score", text: `${formatNumber(data.agent.score)} total points` },
    { title: "Current streak", text: `${data.agent.streak} active streak` },
    { title: "Submitted", text: `${formatNumber(data.summary.submitted)} submitted signals tracked` },
    { title: "Approved", text: `${formatNumber(data.summary.approved)} approved signals tracked` }
  ];

  setHtml(
    "summary-list",
    summaryItems
      .map(
        (item) => `
          <article class="summary-item">
            <strong class="summary-item__title">${item.title}</strong>
            <p class="summary-item__text">${item.text}</p>
          </article>
        `
      )
      .join("")
  );

  const generatedAt = document.getElementById("generated-at");
  if (generatedAt) {
    generatedAt.textContent = `Latest snapshot: ${formatDate(data.generatedAt)}`;
  }
}

function renderBeats(data) {
  const beatEntries = Object.entries(data.byBeat);
  const topBeat = [...beatEntries].sort((left, right) => right[1].briefIncluded - left[1].briefIncluded)[0];

  const stats = [
    {
      label: "Active beats",
      value: formatNumber(beatEntries.length),
      subtext: "Beats currently represented in the dashboard"
    },
    {
      label: "Submitted",
      value: formatNumber(data.summary.submitted),
      subtext: "Signals currently counted as submitted"
    },
    {
      label: "Rejected",
      value: formatNumber(data.summary.rejected),
      subtext: "Signals that missed the brief or failed review"
    },
    {
      label: "In brief",
      value: formatNumber(data.summary.briefIncluded),
      subtext: topBeat ? `Strongest beat right now: ${titleCase(topBeat[0])}` : "No beat data yet"
    }
  ];

  setHtml(
    "beat-overview-stats",
    stats
      .map(
        (stat) => `
          <article class="stat-card">
            <p class="stat-card__label">${stat.label}</p>
            <strong class="stat-card__value">${stat.value}</strong>
            <p class="stat-card__subtext">${stat.subtext}</p>
          </article>
        `
      )
      .join("")
  );

  setHtml(
    "beats-table",
    beatEntries
      .sort((left, right) => right[1].filed - left[1].filed)
      .map(
        ([beat, stats]) => `
          <tr>
            <td>${titleCase(beat)}</td>
            <td class="mono">${formatNumber(stats.filed)}</td>
            <td class="mono">${formatNumber(stats.approved)}</td>
            <td class="mono">${formatNumber(stats.rejected)}</td>
            <td class="mono">${formatNumber(stats.briefIncluded)}</td>
            <td class="mono">${formatNumber(stats.pending)}</td>
            <td class="mono">${stats.sats ? formatSats(stats.sats) : "-"}</td>
          </tr>
        `
      )
      .join("")
  );

  setHtml(
    "beat-notes",
    data.beatNotes.length
      ? data.beatNotes
          .map(
            (note) => `
              <article class="notes-item">
                <strong class="notes-item__title">${note.title}</strong>
                <p class="notes-item__text">${note.text}</p>
              </article>
            `
          )
          .join("")
      : `<div class="empty-state">Add beat notes in <code>site/data/dashboard.json</code> if you want commentary beside the table.</div>`
  );
}

function renderBounties(data) {
  const stats = [
    {
      label: "Participated",
      value: formatNumber(data.manualBounties.summary.participated),
      subtext: "Manual entries in the participated table"
    },
    {
      label: "Approved bounties",
      value: formatNumber(data.manualBounties.summary.approved),
      subtext: "Completed or accepted bounty wins"
    },
    {
      label: "Open targets",
      value: formatNumber(data.manualBounties.open.length),
      subtext: "Bounties you want to pursue"
    },
    {
      label: "Potential value",
      value: formatSats(data.manualBounties.summary.pipelineSats),
      subtext: "Combined planned pipeline from open targets"
    }
  ];

  setHtml(
    "bounty-stats",
    stats
      .map(
        (stat) => `
          <article class="stat-card">
            <p class="stat-card__label">${stat.label}</p>
            <strong class="stat-card__value">${stat.value}</strong>
            <p class="stat-card__subtext">${stat.subtext}</p>
          </article>
        `
      )
      .join("")
  );

  setHtml(
    "participated-table",
    data.manualBounties.participated.length
      ? data.manualBounties.participated
          .map(
            (entry) => `
              <tr>
                <td>${entry.name}</td>
                <td><span class="pill ${statusClass(entry.status)}">${titleCase(entry.status)}</span></td>
                <td>${entry.role}</td>
                <td class="mono">${entry.reward}</td>
                <td>${entry.url ? `<a class="external-link" href="${entry.url}" target="_blank" rel="noreferrer">Open</a>` : "-"}</td>
              </tr>
            `
          )
          .join("")
      : `<tr><td colspan="5"><div class="empty-state">Add participated bounty rows in <code>site/data/dashboard.json</code>.</div></td></tr>`
  );

  setHtml(
    "open-bounties-table",
    data.manualBounties.open.length
      ? data.manualBounties.open
          .map(
            (entry) => `
              <tr>
                <td>${entry.name}</td>
                <td><span class="pill pill--default">${entry.priority}</span></td>
                <td class="mono">${entry.reward}</td>
                <td>${entry.nextStep}</td>
                <td>${entry.url ? `<a class="external-link" href="${entry.url}" target="_blank" rel="noreferrer">Open</a>` : "-"}</td>
              </tr>
            `
          )
          .join("")
      : `<tr><td colspan="5"><div class="empty-state">Add open bounty targets in <code>site/data/dashboard.json</code>.</div></td></tr>`
  );
}

async function main() {
  try {
    const data = await loadDashboardData();

    if (page === "overview") {
      renderOverview(data);
      return;
    }

    if (page === "beats") {
      renderBeats(data);
      return;
    }

    if (page === "bounties") {
      renderBounties(data);
    }
  } catch (error) {
    const shell = document.querySelector(".shell");
    if (shell) {
      shell.innerHTML = `<section class="panel"><h1>Dashboard load failed</h1><p class="hero-text">${error.message}</p></section>`;
    }
  }
}

main();
