import { page, heading, photo, entityHref, empty } from "../components/ui.js";
import { buildStats } from "../services/statsService.js";
import { rankEntities } from "../services/statistics.js";
import { escapeHtml as e } from "../utils/helpers.js";
const metrics = {
  directWins: "Wins incl. songs & albums",
  directDaesangs: "Daesangs incl. songs & albums",
  totalLegacyAwards: "Legacy awards",
  associatedMemberWins: "Associated member wins",
  associatedDaesangs: "Associated Daesangs",
  legacyDaesangs: "Legacy Daesangs",
  bestSeasonWins: "Best season",
  categoriesWon: "Categories won",
};
export function renderRecords(data) {
  const stats = buildStats(data);
  const root = page(
    heading(
      "THE ALL-TIME HONOR ROLL",
      "Records that endure.",
      "Explore direct wins, the legacy of a group, and the highest honors.",
    ) +
      `<div class="toolbar"><label class="search-label">Search records<input type="search" data-search placeholder="Find an artist or group…"></label><label>Record<select data-metric>${Object.entries(
        metrics,
      )
        .map(
          ([key, label]) =>
            '<option value="' + key + '">' + label + "</option>",
        )
        .join(
          "",
        )}</select></label><label>Artists<select data-type><option value="">All artists</option><option value="idol">Idols</option><option value="group">Groups</option></select></label><label>Order<select data-order><option value="rank">Most wins</option><option value="name">Name A–Z</option><option value="gender">Gender</option></select></label></div><p class="small" data-explainer></p><div class="leaderboard" data-rankings></div>`,
  );
  const render = () => {
    const metric = root.querySelector("[data-metric]").value,
      type = root.querySelector("[data-type]").value,
      query = root.querySelector("[data-search]").value.trim().toLocaleLowerCase(),
      order = root.querySelector("[data-order]").value;
    const groupOnly = [
      "totalLegacyAwards",
      "associatedMemberWins",
      "associatedDaesangs",
      "legacyDaesangs",
    ].includes(metric);
    const rows = rankEntities(
      stats.filter(
        (r) =>
          (!type || r.entityType === type) &&
          (!groupOnly || r.entityType === "group") &&
          `${r.name} ${r.subtitle} ${r.gender || ""} ${r.type || ""}`.toLocaleLowerCase().includes(query),
      ),
      metric,
    );
    if (order === "name") rows.sort((a, b) => a.name.localeCompare(b.name));
    if (order === "gender") rows.sort((a, b) => String(a.gender || a.type || "other").localeCompare(String(b.gender || b.type || "other")) || a.name.localeCompare(b.name));
    root.querySelector("[data-explainer]").textContent = groupOnly
      ? "Group records include eligible historical member results, counted once per award."
      : "Artist records include awards won directly and through their songs or albums. Shared results count once for each winning artist. Ties share a rank.";
    root.querySelector("[data-rankings]").innerHTML = rows.length
      ? rows
          .map(
            (row) =>
              `<a href="${entityHref(row)}" class="rank-row ${row.rank === 1 ? "rank-first" : ""}"><span class="rank-number">${String(row.rank).padStart(2, "0")}</span>${photo(row)}<div class="rank-name"><span class="eyebrow">${e(row.entityType)}</span><h3>${e(row.name)}</h3></div><div class="rank-value"><strong>${row.count}</strong><span>${metric === "bestSeasonWins" ? e(row.bestSeason) : e(metrics[metric])}</span></div><span class="rank-arrow">↗</span></a>`,
          )
          .join("")
      : empty(
          "No records in this collection.",
          "Records appear as winners are added.",
        );
  };
  root.querySelectorAll("select").forEach((el) => (el.onchange = render));
  root.querySelector("[data-search]").oninput = render;
  render();
  return root;
}
