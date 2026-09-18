import { renderArtistList } from "./admin/artistList.js";
import { page, heading, empty, toast, modal } from "../components/ui.js";
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
export function renderAdmin(initialData) {
  let data = initialData,
    active = "awards";
  const root = page(
    heading(
      "CURATE YOUR COLLECTION",
      "Behind the archive.",
      "A little care for the stories that matter.",
    ) +
      `<div class="admin-feature"><div><p class="eyebrow">THE NEXT HISTORICAL MOMENT</p><h2>Give greatness its place.</h2><p>Choose a season, find a winner, and make it official.</p></div><button class="button" data-award>✦ Register award</button></div><div class="section-heading"><h2>Build your collection.</h2><button class="text-link" data-backup>Backup & restore ↗</button></div><div class="admin-grid">${Object.entries(
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
        )}</select></label><label class="search-label">Search<input type="search" data-search placeholder="Find an entry…"></label><label class="archive-toggle"><input type="checkbox" data-show-archived> Show archived</label></div><div class="actions artist-shortcuts"><button class="button secondary compact" data-artists="idol">Idols</button><button class="button secondary compact" data-artists="group">Groups</button></div><div data-list></div>`,
  );
  const refresh = async () => {
    data = await loadSnapshot();
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
    if (active === "nomination")
      return (
        (data.categories.find((c) => c.id === row.categoryId)?.displayName ||
          "Nomination") +
        " · " +
        row.entityId
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
    if (["idol", "group"].includes(active)) {
      root
        .querySelector("[data-list]")
        .replaceChildren(
          renderArtistList(active, data, {
            query,
            showArchived: root.querySelector("[data-show-archived]").checked,
            onEdit: (row) => handle(() => openEntityForm(active, row, refresh)),
            onChanged: refresh,
          }),
        );
      return;
    }
    const rows = (
      active === "awards" ? data.awardResults : data[FORMS[active].table]
    ).filter((row) => labelOf(row).toLowerCase().includes(query));
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
  async function handle(action) {
    try {
      await action();
    } catch (error) {
      toast(error.message, true);
    }
  }
  root.querySelector("[data-award]").onclick = () =>
    handle(() => openAwardForm(null, refresh));
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
  root.querySelector("[data-show-archived]").onchange = renderList;
  root.querySelectorAll("[data-artists]").forEach(
    (button) =>
      (button.onclick = () => {
        active = button.dataset.artists;
        root.querySelector("[data-collection]").value = active;
        renderList();
      }),
  );
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
  renderList();
  root.refresh = refresh;
  return root;
}
