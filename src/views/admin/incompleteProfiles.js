import { entityHref, photo } from "../../components/ui.js";
import { escapeHtml as e } from "../../utils/helpers.js";
import { createIndex, resolveFromIndex } from "../../services/entityService.js";
import { isArchived } from "../../services/artistManagementService.js";

const fields = [
  ["photo", "Photo"],
  ["realName", "Real name"],
  ["birthDate", "Birth date"],
  ["nationality", "Nationality"],
  ["membership", "Group link"],
];

function missingFields(idol, memberships) {
  return fields
    .filter(([key]) =>
      key === "membership"
        ? !memberships.length
        : !String(idol[key] || "").trim(),
    )
    .map(([key, label]) => ({ key, label }));
}

export function countIncompleteProfiles(data) {
  const links = new Map();
  for (const membership of data.memberships || []) {
    const list = links.get(membership.idolId) || [];
    list.push(membership);
    links.set(membership.idolId, list);
  }
  const counts = Object.fromEntries(fields.map(([key]) => [key, 0]));
  let profiles = 0;
  for (const idol of data.idols || []) {
    const missing = missingFields(idol, links.get(idol.id) || []);
    if (missing.length) profiles++;
    for (const field of missing) counts[field.key]++;
  }
  return { profiles, counts, total: data.idols?.length || 0 };
}

export function renderIncompleteProfiles(
  data,
  { query = "", showArchived = false, filter = "", onFilter = () => {}, onEdit = () => {} } = {},
) {
  const index = createIndex(data),
    root = document.createElement("section");
  root.className = "incomplete-profiles";

  const memberships = new Map();
  for (const membership of data.memberships || []) {
    const list = memberships.get(membership.idolId) || [];
    list.push(membership);
    memberships.set(membership.idolId, list);
  }
  const summary = countIncompleteProfiles(data);
  const rows = (data.idols || [])
    .map((row) => {
      const links = memberships.get(row.id) || [],
        missing = missingFields(row, links),
        groups = [...new Set(links.map((m) => index.groups.get(m.groupId)?.name).filter(Boolean))],
        entity = resolveFromIndex("idol", row.id, index);
      return { row, missing, groups, entity };
    })
    .filter(({ row, missing, groups, entity }) =>
      missing.length &&
      (!filter || missing.some((item) => item.key === filter)) &&
      (showArchived || !isArchived(row)) &&
      `${entity.name} ${row.realName || ""} ${groups.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort((a, b) => b.missing.length - a.missing.length || a.entity.name.localeCompare(b.entity.name));

  root.innerHTML =
    '<div class="incomplete-heading"><div><p class="eyebrow">PROFILE CHECK</p><h2>Incomplete idol profiles</h2><p>Find missing details and open a profile to fill them in.</p></div><div class="incomplete-total"><strong>' +
    summary.profiles +
    '</strong><span>of ' +
    summary.total +
    ' profiles need attention</span></div></div><div class="incomplete-filters" role="group" aria-label="Filter missing profile fields">' +
    '<button type="button" class="incomplete-filter ' +
    (!filter ? "selected" : "") +
    '" aria-pressed="' +
    (!filter) +
    '" data-field="">All · ' +
    summary.profiles +
    '</button>' +
    fields
      .map(
        ([key, label]) =>
          '<button type="button" class="incomplete-filter ' +
          (filter === key ? "selected" : "") +
          '" aria-pressed="' +
          (filter === key) +
          '" data-field="' +
          e(key) +
          '">' +
          e(label) +
          " · " +
          summary.counts[key] +
          "</button>",
      )
      .join("") +
    '</div><p class="small incomplete-count" aria-live="polite">Showing ' +
    rows.length +
    ' incomplete profiles</p><div class="admin-artists">' +
    (rows.length
      ? rows
          .map(
            ({ row, missing, groups, entity }, position) =>
              '<article class="admin-artist incomplete-artist">' +
              '<a href="' +
              entityHref(entity) +
              '" class="admin-artist-photo">' +
              photo(entity) +
              '</a><div class="admin-artist-info"><a href="' +
              entityHref(entity) +
              '"><h3>' +
              e(entity.name) +
              '</h3></a><p>' +
              e(groups.join(" · ") || "No group linked") +
              '</p><div class="missing-tags">' +
              missing
                .map(
                  (item) =>
                    '<span class="missing-tag">Missing ' +
                    e(item.label.toLowerCase()) +
                    "</span>",
                )
                .join("") +
              '</div></div><button type="button" class="button secondary compact" data-edit="' +
              position +
              '">Complete profile</button></article>',
          )
          .join("")
      : '<div class="empty"><span class="empty-star">✦</span><h3>All caught up.</h3><p>No profiles match these filters.</p></div>') +
    "</div>";

  root.querySelectorAll("[data-field]").forEach((button) => {
    button.onclick = () => onFilter(button.dataset.field);
  });
  root.querySelectorAll("[data-edit]").forEach((button) => {
    button.onclick = () => onEdit(rows[Number(button.dataset.edit)].row);
  });
  return root;
}
