import {
  page,
  heading,
  photo,
  entityCard,
  awardCard,
  metric,
  empty,
} from "../components/ui.js";
import {
  createIndex,
  resolveFromIndex,
  populateAward,
  loadSnapshot,
} from "../services/entityService.js";
import { entityStatistics } from "../services/statistics.js";
import { ENTITY_TABLES } from "../data/catalog.js";
import { FORMS } from "../data/fields.js";
import { openEntityForm } from "./admin/entityForm.js";
import { escapeHtml as e, safeUrl } from "../utils/helpers.js";
export function renderProfile(type, id, data) {
  const index = createIndex(data),
    entity = resolveFromIndex(type, id, index);
  if (entity.missing)
    return page(
      heading("ARCHIVE", "Entry not found.") +
        empty(
          "This entry is unavailable.",
          "The link may be outdated. Browse the archive to find it.",
        ),
    );
  const stats = entityStatistics(type, id, data, index);
  const memberships = data.memberships.filter((m) =>
    type === "group" ? m.groupId === id : m.idolId === id,
  );
  const relatedArtists = memberships.map((membership) => {
    const related = resolveFromIndex(
      type === "group" ? "idol" : "group",
      type === "group" ? membership.idolId : membership.groupId,
      index,
    );
    return { ...related, gender: related.gender || related.type, birthDate: related.birthDate, subtitle: [membership.role, membership.status].filter(Boolean).join(" · "), membership };
  });
  const sections = Object.entries(ENTITY_TABLES)
    .filter(([t]) => !["idol", "group"].includes(t))
    .map(([t, table]) => {
      const rows = data[table].filter(
        (r) =>
          r.id !== id &&
          ((r.artistIds || []).includes(id) ||
            (r.groupIds || []).includes(id) ||
            r.idolId === id ||
            r.albumId === id ||
            r.songId === id ||
            r.musicVideoId === id ||
            (r.songIds || []).includes(id)),
      );
      return rows.length
        ? '<div class="section-heading"><h2>' +
            e(
              {
                musicVideo: "Music videos",
                song: "Songs",
                album: "Albums",
                performance: "Performances",
                outfit: "Outfits",
                documentary: "Documentaries",
              }[t],
            ) +
            '</h2></div><div class="entity-grid">' +
            rows
              .map((r) => entityCard(resolveFromIndex(t, r.id, index)))
              .join("") +
            "</div>"
        : "";
    })
    .join("");
  const history = (rows) =>
    rows.length
      ? '<div class="card-grid">' +
        rows
          .map((a) => populateAward(a, index))
          .sort((a, b) => b.year - a.year)
          .map(awardCard)
          .join("") +
        "</div>"
      : empty("No awards yet.", "The next chapter is still being written.");
  const collaborators = [
    ...new Map(
      stats.direct
        .flatMap((a) => populateAward(a, index).winners)
        .filter((w) => w.id !== id || w.entityType !== type)
        .map((w) => [w.entityType + ":" + w.id, w]),
    ).values(),
  ];
  const root = page(`<a class="text-link" href="#${type === "group" ? "groups" : "artists"}">← Back to the archive</a><header class="profile-header">${photo(entity)}<div><p class="eyebrow">${e(entity.subtitle)} · ${e(entity.status || "ARCHIVE")}</p><h1>${e(entity.name)}</h1><button class="button secondary compact" data-edit-profile>Edit ${e(FORMS[type]?.label || type)}</button><p class="lede">${e(entity.description || entity.roles || "")}</p><p class="small">${entity.debutDate ? "DEBUT · " + e(entity.debutDate) : entity.releaseDate ? "RELEASED · " + e(entity.releaseDate) : ""}</p>${safeUrl(entity.videoUrl) ? '<a class="text-link" target="_blank" rel="noopener noreferrer" href="' + e(safeUrl(entity.videoUrl)) + '">Watch video ↗</a>' : ""}</div></header>
 <div class="metrics">${metric(type === "group" ? stats.totalLegacyAwards : stats.directWins, type === "group" ? "Legacy awards" : "Total awards")}${metric(stats.directEntityWins, "Direct wins")}${metric(stats.directDaesangs, "Daesangs incl. songs & albums")}${type === "group" ? metric(stats.associatedMemberWins, "Associated wins") + metric(stats.associatedDaesangs, "Associated Daesangs") + metric(stats.legacyDaesangs, "Legacy Daesangs") : ""}${metric(stats.winRate === null ? "—" : stats.winRate + "%", "Win rate")}${metric(stats.seasonsWon, "Seasons won")}${metric(stats.bestSeason, "Best season")}</div>
 <p class="small">Win rate is distinct categories won in the best season divided by active categories. Best season uses ${type === "group" ? "Legacy" : "direct"} awards; tied seasons show the most recent year.</p>
 <div class="section-heading"><h2>Award history.</h2></div>${history(stats.direct)}
 ${stats.directDaesangs ? '<div class="section-heading"><h2>Daesang history.</h2></div>' + history(stats.direct.filter((a) => index.categories.get(a.categoryId)?.tier === "daesang")) : ""}
 ${type === "group" ? '<div class="section-heading"><h2>Member awards.</h2></div>' + history(stats.associated) : ""}
 ${relatedArtists.length ? '<div class="section-heading member-section-heading"><h2>' + (type === "group" ? "Members." : "Groups.") + '</h2>' + (type === "group" ? '<label>Order<select data-member-sort aria-label="Order group members"><option value="name">Name A–Z</option><option value="birth-oldest">Oldest first</option><option value="birth-youngest">Youngest first</option><option value="gender">Gender</option><option value="joined">Start date</option><option value="role">Role</option></select></label>' : "") + '</div><div class="entity-grid" data-related-grid></div><details class="panel"><summary>Membership timeline</summary>' + memberships.map((m) => "<p>" + e(resolveFromIndex(type === "group" ? "idol" : "group", type === "group" ? m.idolId : m.groupId, index).name) + " · " + e(m.startDate || "Start unknown") + " → " + e(m.endDate || (["former", "formerMember"].includes(m.status) ? "End unknown" : "Present")) + " · " + e(m.role || "Member") + "</p>").join("") + "</details>" : ""}
 ${sections}${collaborators.length ? '<div class="section-heading"><h2>Collaborations.</h2></div><div class="entity-grid">' + collaborators.map(entityCard).join("") + "</div>" : ""}`);
  root.querySelector("[data-edit-profile]").onclick = async () => {
    const record = data[ENTITY_TABLES[type]]?.find((row) => row.id === id);
    if (record) await openEntityForm(type, record);
  };
  const relatedGrid = root.querySelector("[data-related-grid]");
  if (relatedGrid) {
    const sortMembers = () => {
      const sort = root.querySelector("[data-member-sort]")?.value || "name";
      const rows = [...relatedArtists].sort((a, b) => {
        if (sort === "gender") return String(a.gender || "other").localeCompare(String(b.gender || "other")) || a.name.localeCompare(b.name);
        if (sort === "role") return String(a.membership.role || "").localeCompare(String(b.membership.role || "")) || a.name.localeCompare(b.name);
        if (sort === "joined") return String(a.membership.startDate || "9999").localeCompare(String(b.membership.startDate || "9999")) || a.name.localeCompare(b.name);
        if (["birth-oldest", "birth-youngest"].includes(sort)) {
          const one = a.birthDate || "9999-99-99", two = b.birthDate || "9999-99-99";
          if (!a.birthDate) return b.birthDate ? 1 : a.name.localeCompare(b.name);
          if (!b.birthDate) return -1;
          return one.localeCompare(two) * (sort === "birth-oldest" ? 1 : -1) || a.name.localeCompare(b.name);
        }
        return a.name.localeCompare(b.name);
      });
      relatedGrid.innerHTML = rows.map(entityCard).join("");
    };
    root.querySelector("[data-member-sort]")?.addEventListener("change", sortMembers);
    sortMembers();
  }
  root.refresh = async () => {
    const updated = await loadSnapshot();
    root.replaceWith(renderProfile(type, id, updated));
  };
  return root;
}
