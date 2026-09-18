import {
  page,
  photo,
  entityHref,
  awardCard,
  entityCard,
  empty,
  metric,
} from "../components/ui.js";
import { createIndex, populateAward } from "../services/entityService.js";
import { buildStats } from "../services/statsService.js";
import { rankEntities } from "../services/statistics.js";
import { escapeHtml as e } from "../utils/helpers.js";
export function renderHome(data) {
  const index = createIndex(data),
    stats = buildStats(data, index);
  const awards = data.awardResults
    .map((a) => populateAward(a, index))
    .sort(
      (a, b) =>
        b.year - a.year ||
        String(b.createdAt).localeCompare(String(a.createdAt)),
    );
  const latest = [...data.seasons].sort((a, b) => b.year - a.year)[0];
  const spotlight = awards.find((a) => a.tier === "daesang") || awards[0];
  const leader = rankEntities(stats, "directWins")[0],
    daesang = rankEntities(stats, "directDaesangs")[0];
  const feature = (item, label, key) =>
    item
      ? `<a href="${entityHref(item)}" class="feature">${photo(item)}<div><p class="eyebrow">${label}</p><h3>${e(item.name)}</h3><span>${item[key]} ${key === "directWins" ? "direct wins" : "Daesangs"}</span></div><span>↗</span></a>`
      : `<div class="feature"><span class="feature-star">✦</span><div><p class="eyebrow">${label}</p><h3>A legacy in the making</h3><span>Every award has a story.</span></div></div>`;
  return page(
    `<div class="hero"><div class="hero-copy"><p class="eyebrow"><span class="pink-dot"></span> THE OFFICIAL ARCHIVE · 2024 — PRESENT</p><h1>KPOP GALA<span>Hall of <em>Fame.</em></span></h1><p class="lede">The artists. The moments. The legacy.<br>A home for the music that stays with us.</p><div class="actions"><a class="button" href="#gala">Explore the Gala ↗</a><a class="text-link" href="#artists">Meet the artists →</a></div><div class="hero-caption">A personal celebration of extraordinary music.</div></div><div class="hero-art ${spotlight ? "has-photo" : ""}">${spotlight ? photo(spotlight.winners[0]) : '<div class="archive-art"><span class="art-year">EST. 2024</span><span class="art-star">✦</span><span class="art-title">THE<br>GALA<br>ARCHIVE</span><span class="art-footer">MUSIC WORTH REMEMBERING</span></div>'}<div class="hero-art-label"><span class="badge">✦ ${spotlight ? "IN THE SPOTLIGHT" : "HALL OF FAME"}</span><strong>${spotlight ? e(spotlight.winners.map((w) => w.name).join(" & ")) : "Where moments become history."}</strong><small>${spotlight ? e(spotlight.categoryName) + " · " + e(spotlight.year) : "Your artists. Your awards. Your archive."}</small></div></div></div>
 <div class="home-totals">${metric(new Set(data.awardResults.map((a) => a.id)).size, "Awards distributed")}${metric(data.seasons.length, "Seasons")}${metric(data.idols.length + data.groups.length, "Artists & groups")}<div class="archive-note">Made for the moments<br>that deserve an encore. <span>✦</span></div></div>
 <div class="section-heading"><div><p class="eyebrow">THE HONOR ROLL</p><h2>Making history.</h2></div><a class="text-link" href="#records">All records ↗</a></div><div class="two-columns">${feature(leader, "ALL-TIME LEADER", "directWins")}${feature(daesang, "MOST DAESANGS", "directDaesangs")}</div>
 <a href="#gala/${encodeURIComponent(latest?.id || "")}" class="season-banner"><div><p class="eyebrow">LATEST GALA · EDITION ${latest ? latest.year - 2023 : "—"}</p><h2>${e(latest?.title || "Your next chapter")}</h2><p>${e(latest?.description || "Discover the winners. Relive the moments.")}</p></div><span class="season-year">${e(latest?.year || "✦")}</span><span class="round-arrow">↗</span></a>
 <div class="section-heading"><div><p class="eyebrow">RECENT WINNERS</p><h2>The latest chapter.</h2></div><a class="text-link" href="#gala">View seasons ↗</a></div>${awards.length ? '<div class="card-grid">' + awards.slice(0, 3).map(awardCard).join("") + "</div>" : empty("An archive waiting for its first winner.", "Start with an artist, then register a result. Your history will appear here.")}
 ${["group", "idol"]
   .map((type) => {
     const rows = rankEntities(
       stats.filter((s) => s.entityType === type),
       type === "group" ? "totalLegacyAwards" : "directWins",
     ).slice(0, 4);
     return rows.length
       ? '<div class="section-heading"><h2>Top ' +
           (type === "group" ? "groups" : "idols") +
           '</h2></div><div class="entity-grid">' +
           rows.map(entityCard).join("") +
           "</div>"
       : "";
   })
   .join("")}
 ${
   awards.some((a) => a.tier === "daesang")
     ? '<div class="section-heading"><div><p class="eyebrow">LEGENDARY MOMENTS</p><h2>The highest honor.</h2></div></div><div class="two-columns">' +
       awards
         .filter((a) => a.tier === "daesang")
         .slice(0, 2)
         .map(awardCard)
         .join("") +
       "</div>"
     : ""
 }`,
    "home",
  );
}
