import {
  page,
  heading,
  metric,
  awardCard,
  categoryHref,
  empty,
} from "../components/ui.js";
import {
  createIndex,
  populateAward,
  resolveFromIndex,
  winnerRefs,
} from "../services/entityService.js";
import { escapeHtml as e } from "../utils/helpers.js";

const labelFor = (category) => category.displayName || category.name || "Untitled";
const eligible = (category) =>
  category.active !== false && !category.archivedAt;

function categorySummary(category, data, index) {
  const results = data.awardResults.filter((award) => award.categoryId === category.id);
  const wins = new Map();
  for (const result of results) {
    for (const ref of winnerRefs(result)) {
      const key = `${ref.type}:${ref.id}`;
      const current = wins.get(key) || { ...ref, count: 0 };
      current.count++;
      wins.set(key, current);
    }
  }
  const leader = [...wins.values()].sort(
    (a, b) => b.count - a.count ||
      resolveFromIndex(a.type, a.id, index).name.localeCompare(resolveFromIndex(b.type, b.id, index).name),
  )[0];
  return { results, wins, leader };
}

export function renderCategories(data) {
  const index = createIndex(data);
  const categories = data.categories.filter(eligible);
  const root = page(
    heading(
      "THE AWARD ARCHIVE",
      "Categories.",
      "Explore every award, its past winners, and the records they built.",
    ) +
      '<div class="toolbar category-filters"><label class="search-label">Search categories<input data-category-search type="search" placeholder="Find a category or winner…" aria-label="Search categories"></label><label>Family<select data-family-filter><option value="">All families</option></select></label><label>Tier<select data-tier-filter><option value="">All awards</option><option value="daesang">Daesang</option><option value="regular">Regular</option></select></label><label>Sort<select data-category-sort><option value="name">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="frequency">Most results</option><option value="family">Family</option></select></label><span class="small" data-category-count></span></div><div class="category-grid" data-category-results></div>',
  );
  const familySelect = root.querySelector("[data-family-filter]");
  [...new Set(categories.map((category) => category.family).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
    .forEach((family) => {
      familySelect.add(new Option(family, family));
    });

  const render = () => {
    const query = root.querySelector("[data-category-search]").value.trim().toLocaleLowerCase();
    const family = familySelect.value;
    const tier = root.querySelector("[data-tier-filter]").value;
    const sort = root.querySelector("[data-category-sort]").value;
    const rows = categories
      .map((category) => ({ category, summary: categorySummary(category, data, index) }))
      .filter(({ category, summary }) => {
        const winnerNames = [...summary.wins.values()].map((winner) =>
          resolveFromIndex(winner.type, winner.id, index).name,
        ).join(" ");
        return (!family || category.family === family) &&
          (!tier || (tier === "daesang") === (category.tier === "daesang")) &&
          `${labelFor(category)} ${category.family || ""} ${category.description || ""} ${winnerNames}`
            .toLocaleLowerCase().includes(query);
      })
      .sort((a, b) => {
        if (sort === "frequency") return b.summary.results.length - a.summary.results.length || labelFor(a.category).localeCompare(labelFor(b.category));
        if (sort === "family") return (a.category.family || "").localeCompare(b.category.family || "") || labelFor(a.category).localeCompare(labelFor(b.category));
        return labelFor(a.category).localeCompare(labelFor(b.category)) * (sort === "name-desc" ? -1 : 1);
      });
    root.querySelector("[data-category-count]").textContent = `${rows.length} categories`;
    root.querySelector("[data-category-results]").innerHTML = rows.length
      ? rows.map(({ category, summary }) => {
          const leader = summary.leader && resolveFromIndex(summary.leader.type, summary.leader.id, index);
          return `<a class="category-card" href="${categoryHref(category)}"><div class="category-card-top"><span class="badge ${category.tier === "daesang" ? "category-daesang" : ""}">${category.tier === "daesang" ? "✦ DAESANG" : e(category.family || "AWARD")}</span><span class="category-card-count">${summary.results.length} ${summary.results.length === 1 ? "result" : "results"}</span></div><h2>${e(labelFor(category))}</h2><p>${e(category.description || `${category.winnerType || "Mixed"} · ${category.genderRestriction || "All eligible artists"}`)}</p><span class="category-card-leader">${leader ? `Most wins · ${e(leader.name)} (${summary.leader.count})` : "No winners recorded yet"}</span><span class="text-link">View category history ↗</span></a>`;
        }).join("")
      : empty("No categories found.", "Adjust the filters or search for another category or winner.");
  };
  root.querySelectorAll("[data-category-search], [data-family-filter], [data-tier-filter], [data-category-sort]")
    .forEach((control) => control.addEventListener(control.matches("input") ? "input" : "change", render));
  render();
  return root;
}

export function renderCategoryProfile(id, data) {
  const category = data.categories.find((row) => row.id === id);
  if (!category) return page(heading("AWARD ARCHIVE", "Category not found.") + empty("This category is unavailable."));
  const index = createIndex(data);
  const { results, wins, leader } = categorySummary(category, data, index);
  const seasons = new Map(data.seasons.map((season) => [season.id, season]));
  const years = [...new Set(results.map((row) => seasons.get(row.seasonId)?.year).filter(Number.isFinite))]
    .sort((a, b) => b - a);
  const ranked = [...wins.values()].map((winner) => ({
    ...resolveFromIndex(winner.type, winner.id, index),
    winCount: winner.count,
  })).sort((a, b) => b.winCount - a.winCount || a.name.localeCompare(b.name));
  const leaderName = leader ? resolveFromIndex(leader.type, leader.id, index).name : "—";
  const history = results.map((row) => populateAward(row, index))
    .sort((a, b) => (b.year || 0) - (a.year || 0) || a.categoryName.localeCompare(b.categoryName));
  const root = page(
    `<a class="text-link" href="#categories">← All categories</a><header class="category-profile-heading"><div><p class="eyebrow">${category.tier === "daesang" ? "✦ DAESANG" : e(category.family || "AWARD")} · ${e(category.winnerType || "mixed")}</p><h1>${e(labelFor(category))}</h1><p class="lede">${e(category.description || "A record of every winner and season for this award.")}</p>${category.genderRestriction ? `<span class="badge">${e(category.genderRestriction)} category</span>` : ""}</div></header><div class="metrics">${metric(results.length, "Awards given")}${metric(wins.size, "Unique winners")}${metric(years.length, "Seasons with winners")}${metric(leaderName, "Most wins")}${metric(leader?.count || 0, "Wins by leader")}</div><div class="section-heading"><div><p class="eyebrow">ALL-TIME LEADERBOARD</p><h2>Most wins.</h2></div></div>${ranked.length ? `<div class="category-leaderboard">${ranked.slice(0, 10).map((winner, position) => `<a class="rank-row" href="#profile/${e(winner.entityType)}/${encodeURIComponent(winner.id)}"><span class="rank-number">${String(position + 1).padStart(2, "0")}</span><div class="rank-name"><span class="eyebrow">${e(winner.entityType)}</span><h3>${e(winner.name)}</h3></div><div class="rank-value"><strong>${winner.winCount}</strong><span>${winner.winCount === 1 ? "win" : "wins"}</span></div><span class="rank-arrow">↗</span></a>`).join("")}</div>` : empty("No winners yet.", "Winners will appear here when results are recorded.")}<div class="section-heading"><div><p class="eyebrow">SEASON BY SEASON</p><h2>Winner history.</h2></div></div><div class="toolbar"><label class="search-label">Search history<input type="search" data-history-search placeholder="Find a winner or slot…"></label><label>Season<select data-history-year><option value="">All seasons</option>${years.map((year) => `<option value="${year}">${year}</option>`).join("")}</select></label><label>Order<select data-history-order><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="winner">Winner A–Z</option></select></label></div><div class="card-grid" data-category-history></div>`,
  );
  const renderHistory = () => {
    const query = root.querySelector("[data-history-search]").value.trim().toLocaleLowerCase();
    const year = root.querySelector("[data-history-year]").value;
    const order = root.querySelector("[data-history-order]").value;
    const visible = history.filter((award) =>
      (!year || String(award.year) === year) &&
      `${award.year || ""} ${award.slot || ""} ${award.winners.map((winner) => winner.name).join(" ")}`
        .toLocaleLowerCase().includes(query),
    ).sort((a, b) => order === "winner"
      ? (a.winners[0]?.name || "").localeCompare(b.winners[0]?.name || "") || (b.year || 0) - (a.year || 0)
      : (order === "oldest" ? 1 : -1) * ((a.year || 0) - (b.year || 0)));
    root.querySelector("[data-category-history]").innerHTML = visible.length
      ? visible.map(awardCard).join("")
      : empty("No matching results.", "Try a different year or winner name.");
  };
  root.querySelectorAll("[data-history-search], [data-history-year], [data-history-order]")
    .forEach((control) => control.addEventListener(control.matches("input") ? "input" : "change", renderHistory));
  renderHistory();
  return root;
}
