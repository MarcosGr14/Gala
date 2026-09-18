import { page, heading, awardCard, empty, metric } from "../components/ui.js";
import { createIndex, populateAward } from "../services/entityService.js";
import { escapeHtml as e, safeUrl } from "../utils/helpers.js";
import { startPresentation } from "./presentation.js";
export function renderGala(data, seasonId) {
  const index = createIndex(data),
    seasons = [...data.seasons].sort((a, b) => b.year - a.year);
  const season = seasons.find((s) => s.id === seasonId) || seasons[0];
  if (!season)
    return page(
      heading("THE ANNUAL CELEBRATION", "Gala.") +
        empty("Create your first season."),
    );
  const awards = data.awardResults
    .filter((a) => a.seasonId === season.id)
    .map((a) => populateAward(a, index))
    .sort((a, b) => (a.category.sortOrder || 0) - (b.category.sortOrder || 0));
  const daesangs = awards.filter((a) => a.tier === "daesang"),
    regular = awards.filter((a) => a.tier !== "daesang");
  const families = [...new Set(regular.map((a) => a.category.family))];
  const root = page(
    heading("THE ANNUAL CELEBRATION", "Every year. A new legacy.") +
      `<div class="toolbar"><label>Season<select id="season-select">${seasons.map((s) => '<option value="' + e(s.id) + '" ' + (s.id === season.id ? "selected" : "") + ">" + s.year + " · " + e(s.title) + "</option>").join("")}</select></label><button class="button secondary" data-present ${awards.length ? "" : "disabled"}>▶ Present this Gala</button></div>
 <div class="season-banner">${safeUrl(season.image) ? '<img class="season-background" alt="" src="' + e(safeUrl(season.image)) + '">' : ""}<div><p class="eyebrow">EDITION ${season.year - 2023}</p><h2>${e(season.title)}</h2><p>${e(season.description || "A celebration of the unforgettable.")}</p></div><span class="season-year">${season.year}</span></div>
 <div class="metrics">${metric(awards.length, "Awards distributed")}${metric(daesangs.length, "Daesangs")}${metric(new Set(awards.flatMap((a) => a.winners.map((w) => w.entityType + ":" + w.id))).size, "Winners")}${metric(new Set(awards.map((a) => a.categoryId)).size, "Categories")}</div>
 <div class="section-heading"><div><p class="eyebrow">THE HIGHEST HONOR</p><h2>Daesangs.</h2></div><span class="gold-star">✦</span></div>${daesangs.length ? '<div class="two-columns">' + daesangs.map(awardCard).join("") + "</div>" : empty("The highest honors are still to come.", "Daesang results for this season will appear here.")}
 <div class="section-heading"><div><p class="eyebrow">EXCELLENCE IN EVERY FORM</p><h2>Regular awards.</h2></div></div>${
   regular.length
     ? families
         .map(
           (f) =>
             '<h3 class="family-heading">' +
             e(f) +
             '</h3><div class="card-grid">' +
             regular
               .filter((a) => a.category.family === f)
               .map(awardCard)
               .join("") +
             "</div>",
         )
         .join("")
     : empty(
         "No regular awards yet.",
         "Register a winner to begin the collection.",
       )
 }`,
  );
  root.querySelector("#season-select").onchange = (event) => {
    location.hash = "gala/" + encodeURIComponent(event.target.value);
  };
  root.querySelector("[data-present]").onclick = () =>
    startPresentation([...regular, ...daesangs]);
  return root;
}
