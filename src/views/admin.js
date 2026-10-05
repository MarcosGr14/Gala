import { renderArtistList } from "./admin/artistList.js";
import { page, heading, empty, toast, modal, categoryHref } from "../components/ui.js";
import { FORMS } from "../data/fields.js";
import {
  createIndex,
  populateAward,
  loadSnapshot,
} from "../services/entityService.js";
import { saveRecord } from "../services/catalogService.js";
import { openEntityForm } from "./admin/entityForm.js";
import { openAwardForm } from "./admin/awardForm.js";
import { openBackupPanel } from "./admin/backupPanel.js";
import { escapeHtml as e } from "../utils/helpers.js";
import { importTwiceMembers } from "../services/twiceImportService.js";
import {
  countIncompleteProfiles,
  renderIncompleteProfiles,
} from "./admin/incompleteProfiles.js";
export function renderAdmin(initialData) {
  let data = initialData,
    active = "awards",
    incompleteFilter = "",
    awardSeasonId = "",
    awardStatusFilter = "all";
  const root = page(
    heading(
      "CURATE YOUR COLLECTION",
      "Behind the archive.",
      "A little care for the stories that matter.",
    ) +
      `<div class="admin-feature"><div><p class="eyebrow">THE NEXT HISTORICAL MOMENT</p><h2>Give greatness its place.</h2><p>Choose a season, find a winner, and make it official.</p></div><div><div class="actions"><button class="button secondary" data-twice>＋ Add TWICE members</button><button class="button" data-award>✦ Register award</button></div><p class="small">Adds missing profiles and fills blank fields for existing members.</p></div></div><div class="section-heading"><h2>Build your collection.</h2><button class="text-link" data-backup>Backup & restore ↗</button></div><div class="admin-grid">${Object.entries(
        FORMS,
      )
        .map(
          ([type, def], i) =>
            '<button class="admin-tile" data-create="' +
            type +
            '"><span class="tile-number">' +
            String(i + 1).padStart(2, "0") +
            "</span><strong>" +
            e(def.label) +
            "</strong><span>+ Add entry</span></button>",
        )
        .join(
          "",
        )}</div><div class="section-heading"><h2>Manage the archive.</h2><button class="text-link" data-audit>Activity log ↗</button></div><div class="toolbar"><label>Collection<select data-collection><option value="awards">Award results</option>${Object.entries(
        FORMS,
      )
        .map(
          ([type, def]) =>
            '<option value="' + type + '">' + e(def.label) + "</option>",
        )
        .join(
          "",
        )}<option value="incompleteProfiles">Incomplete idol profiles</option></select></label><label class="search-label">Search<input type="search" data-search placeholder="Find an entry…"></label><label>Order<select data-admin-sort><option value="name">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="gender">Gender / type</option><option value="oldest">Oldest first</option><option value="newest">Newest first</option></select></label><label class="archive-toggle"><input type="checkbox" data-show-archived> Show archived</label></div><div class="actions artist-shortcuts"><button class="button secondary compact" data-artists="idol">Idols</button><button class="button secondary compact" data-artists="group">Groups</button><button class="button secondary compact" data-incomplete>Incomplete profiles</button></div><div data-award-coverage></div><div data-list></div>`,
  );
  const updateIncompleteCount = () => {
    const { profiles } = countIncompleteProfiles(data);
    root.querySelector('[data-collection] option[value="incompleteProfiles"]').textContent =
      `Incomplete idol profiles (${profiles})`;
    root.querySelector("[data-incomplete]").textContent =
      `Incomplete profiles · ${profiles}`;
  };
  const refresh = async () => {
    data = await loadSnapshot();
    updateIncompleteCount();
    renderList();
  };
  function labelOf(row) {
    if (active === "awards") {
      const a = populateAward(row, createIndex(data));
      return (
        a.year +
        " · " +
        a.categoryName +
        " · " +
        a.winners.map((w) => w.name).join(" & ") +
        (a.slot ? " · " + a.slot : "")
      );
    }
    if (active === "membership")
      return (
        (data.idols.find((i) => i.id === row.idolId)?.stageName ||
          "Unknown idol") +
        " → " +
        (data.groups.find((g) => g.id === row.groupId)?.name ||
          "Unknown group") +
        " · " +
        row.status
      );
    return (
      row.stageName ||
      row.displayName ||
      row.name ||
      row.title ||
      row.eventName ||
      row.id
    );
  }
  function renderList() {
    const query = root.querySelector("[data-search]").value.toLowerCase();
    const coverage = root.querySelector("[data-award-coverage]");
    coverage.replaceChildren();
    if (active === "awards") renderAwardCoverage(coverage, query);
    if (active === "incompleteProfiles") {
      root.querySelector("[data-list]").replaceChildren(
        renderIncompleteProfiles(data, {
          query,
          showArchived: root.querySelector("[data-show-archived]").checked,
          filter: incompleteFilter,
          onFilter: (field) => {
            incompleteFilter = field;
            renderList();
          },
          onEdit: (row) => handle(() => openEntityForm("idol", row, refresh)),
        }),
      );
      return;
    }
    if (["idol", "group"].includes(active)) {
      root
        .querySelector("[data-list]")
        .replaceChildren(
          renderArtistList(active, data, {
            query,
            sort: root.querySelector("[data-admin-sort]").value,
            showArchived: root.querySelector("[data-show-archived]").checked,
            onEdit: (row) => handle(() => openEntityForm(active, row, refresh)),
            onChanged: refresh,
          }),
        );
      return;
    }
    const rows = (
      active === "awards" ? data.awardResults.filter((row) => row.seasonId === awardSeasonId) : data[FORMS[active].table]
    ).filter((row) => JSON.stringify(row).toLowerCase().includes(query) || labelOf(row).toLowerCase().includes(query));
    const sort = root.querySelector("[data-admin-sort]").value;
    rows.sort((a, b) => {
      if (sort === "gender") return String(a.gender || a.type || "").localeCompare(String(b.gender || b.type || "")) || labelOf(a).localeCompare(labelOf(b));
      if (sort === "oldest" || sort === "newest") {
        const field = active === "seasons" ? "year" : active === "idol" ? "birthDate" : active === "group" ? "debutDate" : "date";
        return (sort === "oldest" ? 1 : -1) * String(a[field] || "9999").localeCompare(String(b[field] || "9999")) || labelOf(a).localeCompare(labelOf(b));
      }
      return labelOf(a).localeCompare(labelOf(b)) * (sort === "name-desc" ? -1 : 1);
    });
    const list = root.querySelector("[data-list]");
    list.innerHTML = rows.length
      ? rows
          .map(
            (row, i) =>
              '<div class="manage-row"><div><strong>' +
              e(labelOf(row)) +
              '</strong><span class="small">' +
              (row.archivedAt || row.active === false ? "Archived" : "") +
              '</span></div><div class="actions"><button class="button secondary compact" data-edit="' +
              i +
              '">Edit</button>' +
              (!["awards", "membership", "nomination"].includes(active)
                ? '<button class="text-link" data-archive="' +
                  i +
                  '">' +
                  (row.archivedAt || row.active === false
                    ? "Unarchive"
                    : "Archive") +
                  "</button>"
                : "") +
              "</div></div>",
          )
          .join("")
      : empty(
          "No entries here yet.",
          "Use the collection shortcuts above to add one.",
        );
    list
      .querySelectorAll("[data-edit]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            handle(() =>
              active === "awards"
                ? openAwardForm(rows[Number(b.dataset.edit)], refresh)
                : openEntityForm(active, rows[Number(b.dataset.edit)], refresh),
            )),
      );
    list.querySelectorAll("[data-archive]").forEach(
      (b) =>
        (b.onclick = () =>
          handle(async () => {
            const row = rows[Number(b.dataset.archive)],
              archived = !!row.archivedAt || row.active === false;
            await saveRecord(active, {
              ...row,
              active: archived,
              archivedAt: archived ? null : new Date().toISOString(),
            });
            await refresh();
            toast(
              archived
                ? "Entry restored to the catalog."
                : "Entry archived. Historical results are preserved.",
            );
          })),
    );
  }
  function renderAwardCoverage(container, query) {
    const seasons = [...data.seasons].sort((a, b) => b.year - a.year);
    if (!awardSeasonId || !seasons.some((s) => s.id === awardSeasonId)) awardSeasonId = seasons[0]?.id || "";
    const season = seasons.find((s) => s.id === awardSeasonId);
    if (!season) return;
    const results = data.awardResults.filter((r) => r.seasonId === season.id);
    const slotsFor = (c) => c.winnerStructure === "maleFemale" ? ["male", "female"] : c.winnerStructure === "userGenderSlots" ? (c.userSlots || ["user1", "user2"]).flatMap((u) => [u + "_male", u + "_female"]) : [""];
    const index = createIndex(data);
    const rows = data.categories.filter((c) => (c.displayName + " " + c.family).toLowerCase().includes(query)).sort((a,b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.displayName.localeCompare(b.displayName)).map((c) => {
      const slots = slotsFor(c), records = slots.map((slot) => results.find((r) => r.categoryId === c.id && (r.slot || "") === slot));
      const filled = records.filter(Boolean).length, status = filled === slots.length ? "complete" : filled ? "partial" : "missing";
      const names = records.map((record, i) => record ? (slots[i] ? slots[i] + ": " : "") + populateAward(record, index).winners.map((w) => w.name).join(" & ") : (slots[i] ? slots[i] + ": " : "") + "missing").join(" · ");
      const buttons = records.map((record, i) => record ? '<button class="button secondary compact" data-coverage-edit="' + e(record.id) + '">Edit ' + e(slots[i] || "winner") + '</button>' : '<button class="button secondary compact" data-coverage-add="' + e(c.id) + '" data-slot="' + e(slots[i]) + '">Add ' + e(slots[i] || "winner") + '</button>').join("");
      return '<article class="coverage-card ' + status + '"><div><div class="coverage-title"><a class="coverage-link" href="' + categoryHref(c) + '"><strong>' + e(c.displayName) + '</strong></a><span class="coverage-badge ' + status + '">' + (status === "complete" ? "Complete" : status === "partial" ? "Partial · " + filled + "/" + slots.length : "Pending") + '</span></div><span class="small">' + e(c.family || "Category") + '</span><p class="coverage-winners">' + e(names) + '</p></div><div class="actions">' + buttons + '</div></article>';
    });
    const counts = {complete: 0, partial: 0, missing: 0};
    data.categories.forEach((c) => { const slots = slotsFor(c), n = slots.filter((slot) => results.some((r) => r.categoryId === c.id && (r.slot || "") === slot)).length; counts[n === slots.length ? "complete" : n ? "partial" : "missing"]++; });
    container.innerHTML = '<section class="award-coverage"><div class="coverage-header"><div><p class="eyebrow">SEASON CHECKLIST</p><h2>Winner coverage</h2><p class="small">Track filled and pending categories.</p></div><label>Season<select data-coverage-season>' + seasons.map((s) => '<option value="' + e(s.id) + '" ' + (s.id === season.id ? "selected" : "") + '>' + e(s.year + " · " + s.title) + '</option>').join("") + '</select></label></div><div class="coverage-summary"><span><b>' + counts.complete + '</b> complete</span><span><b>' + counts.partial + '</b> partial</span><span><b>' + counts.missing + '</b> pending</span></div><label>Show<select data-coverage-filter><option value="all">All categories</option><option value="missing">Pending</option><option value="partial">Partial</option><option value="complete">Complete</option></select></label><div class="coverage-list">' + rows.filter((row) => awardStatusFilter === "all" || row.includes("coverage-card " + awardStatusFilter)).join("") + '</div></section><div class="section-heading"><h2>Saved results</h2><span class="small">' + results.length + ' result(s) this season</span></div>';
    const seasonSelect = container.querySelector("[data-coverage-season]"); seasonSelect.onchange = () => { awardSeasonId = seasonSelect.value; renderList(); };
    const filter = container.querySelector("[data-coverage-filter]"); filter.value = awardStatusFilter; filter.onchange = () => { awardStatusFilter = filter.value; renderList(); };
    container.querySelectorAll("[data-coverage-add]").forEach((b) => b.onclick = () => handle(() => openAwardForm(null, refresh, {seasonId: awardSeasonId, categoryId: b.dataset.coverageAdd, slot: b.dataset.slot})));
    container.querySelectorAll("[data-coverage-edit]").forEach((b) => b.onclick = () => { const row = data.awardResults.find((r) => r.id === b.dataset.coverageEdit); if (row) handle(() => openAwardForm(row, refresh)); });
  }
  async function handle(action) {
    try {
      await action();
    } catch (error) {
      toast(error.message, true);
    }
  }
  root.querySelector("[data-award]").onclick = () =>
    handle(() => openAwardForm(null, refresh));
  root.querySelector("[data-twice]").onclick = () => handle(async () => {
    const button = root.querySelector("[data-twice]");
    button.disabled = true;
    try {
      const result = await importTwiceMembers();
      await refresh();
      toast(`TWICE ready: ${result.created} profiles added, ${result.updated} completed and ${result.linked} group links created.`);
    } finally { button.disabled = false; }
  });
  root
    .querySelectorAll("[data-create]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          handle(() => openEntityForm(b.dataset.create, null, refresh))),
    );
  root.querySelector("[data-backup]").onclick = () => handle(openBackupPanel);
  root.querySelector("[data-collection]").onchange = (event) => {
    active = event.target.value;
    renderList();
  };
  root.querySelector("[data-search]").oninput = renderList;
  root.querySelector("[data-admin-sort]").onchange = renderList;
  root.querySelector("[data-show-archived]").onchange = renderList;
  root.querySelectorAll("[data-artists]").forEach(
    (button) =>
      (button.onclick = () => {
        active = button.dataset.artists;
        root.querySelector("[data-collection]").value = active;
        renderList();
      }),
  );
  root.querySelector("[data-incomplete]").onclick = () => {
    active = "incompleteProfiles";
    root.querySelector("[data-collection]").value = active;
    renderList();
  };
  root.querySelector("[data-audit]").onclick = () => {
    const content = document.createElement("div");
    content.className = "audit-list";
    content.innerHTML =
      [...data.auditLog]
        .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
        .map(
          (row) =>
            "<p><strong>" +
            e(row.action) +
            '</strong><br><span class="small">' +
            e(row.timestamp) +
            " · " +
            e(row.entityType) +
            "</span></p>",
        )
        .join("") || "<p>No activity yet.</p>";
    modal("Activity log", content);
  };
  updateIncompleteCount();
  renderList();
  root.refresh = refresh;
  return root;
}
