import {
  photo,
  entityHref,
  modal,
  toast,
  confirmModal,
} from "../../components/ui.js";
import { createIndex, resolveFromIndex } from "../../services/entityService.js";
import {
  isArchived,
  getArtistDependencies,
  setArtistArchived,
  deleteArtistPermanently,
} from "../../services/artistManagementService.js";
import { escapeHtml as e } from "../../utils/helpers.js";

function dependencyMessage(content, dependencies) {
  content.innerHTML =
    '<p class="notice">Cannot permanently delete this artist because it has historical records.</p><ul class="dependency-list">' +
    dependencies
      .map(
        (d) => "<li>" + e(d.label) + ": <strong>" + d.count + "</strong></li>",
      )
      .join("") +
    '</ul><p class="small">Archiving keeps the profile, memberships and all historical results.</p>';
}
async function openRemoval(type, artist, onChanged) {
  const dependencies = await getArtistDependencies(type, artist.id);
  const content = document.createElement("div");
  content.innerHTML =
    "<p>" +
    e(artist.stageName || artist.name) +
    '</p><div data-dependencies></div><div class="actions"><button class="button" data-archive>' +
    (isArchived(artist) ? "Unarchive" : "Archive artist") +
    '</button><button class="button secondary danger" data-delete>Delete permanently</button></div><p class="form-error" role="alert"></p>';
  const report = content.querySelector("[data-dependencies]"),
    remove = content.querySelector("[data-delete]");
  if (dependencies.length) {
    dependencyMessage(report, dependencies);
    remove.disabled = true;
  } else
    report.innerHTML =
      "<p>No relationships or historical records were found. You can archive this artist or permanently delete it.</p>";
  const dialog = modal("Archive / Delete", content);
  content.querySelector("[data-archive]").onclick = async () => {
    const button = content.querySelector("[data-archive]");
    button.disabled = true;
    try {
      const archived = !isArchived(artist);
      await setArtistArchived(type, artist.id, archived);
      dialog.close();
      await onChanged();
      toast(
        archived
          ? "Artist archived. Historical records are preserved."
          : "Artist unarchived.",
      );
    } catch (error) {
      content.querySelector(".form-error").textContent = error.message;
      button.disabled = false;
    }
  };
  remove.onclick = async () => {
    if (
      !(await confirmModal(
        "Delete permanently?",
        "Permanently delete " +
          (artist.stageName || artist.name) +
          "? This action cannot be undone.",
        "Delete permanently",
      ))
    )
      return;
    remove.disabled = true;
    try {
      await deleteArtistPermanently(type, artist.id);
      dialog.close();
      await onChanged();
      toast("Artist permanently deleted.");
    } catch (error) {
      if (error.dependencies) dependencyMessage(report, error.dependencies);
      else remove.disabled = false;
      content.querySelector(".form-error").textContent = error.message;
    }
  };
}
export function renderArtistList(
  type,
  data,
  { query = "", sort = "name", showArchived = false, onEdit, onChanged },
) {
  const index = createIndex(data),
    root = document.createElement("div");
  root.className = "admin-artists";
  const rows = data[type === "idol" ? "idols" : "groups"]
    .map((row) => {
      const entity = resolveFromIndex(type, row.id, index);
      const groups =
        type === "idol"
          ? data.memberships
              .filter(
                (m) =>
                  m.idolId === row.id &&
                  ["current", "currentMember", "temporary", "subunit"].includes(
                    m.status,
                  ) &&
                  (!m.endDate ||
                    m.endDate >= new Date().toISOString().slice(0, 10)),
              )
              .map((m) => index.groups.get(m.groupId)?.name)
              .filter(Boolean)
          : [];
      const subtitle =
        type === "group"
          ? {
              bg: "Boy group",
              gg: "Girl group",
              mixed: "Mixed group",
              band: "Band",
              subunit: "Subunit",
            }[row.type] ||
            row.type ||
            "Group"
          : [...new Set(groups)].join(" · ") || "No current group";
      return { row, entity, subtitle };
    })
    .filter(
      ({ row, entity, subtitle }) =>
        (showArchived || !isArchived(row)) &&
        `${entity.name} ${row.realName || ""} ${row.nationality || ""} ${row.description || ""} ${row.birthDate || ""} ${row.debutDate || ""} ${row.gender || ""} ${row.type || ""} ${subtitle}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    ).sort((a, b) => {
      if (sort === "gender") return String(a.row.gender || a.row.type || "").localeCompare(String(b.row.gender || b.row.type || "")) || a.entity.name.localeCompare(b.entity.name);
      if (sort === "oldest" || sort === "newest") {
        const field = type === "idol" ? "birthDate" : "debutDate";
        const direction = sort === "oldest" ? 1 : -1;
        const av = a.row[field], bv = b.row[field];
        if (!av || !bv) return av ? -1 : bv ? 1 : a.entity.name.localeCompare(b.entity.name);
        return direction * String(av).localeCompare(String(bv)) || a.entity.name.localeCompare(b.entity.name);
      }
      return a.entity.name.localeCompare(b.entity.name) * (sort === "name-desc" ? -1 : 1);
    });
  root.innerHTML = rows.length
    ? rows
        .map(
          ({ row, entity, subtitle }, i) =>
            '<article class="admin-artist"><a href="' +
            entityHref(entity) +
            '" class="admin-artist-photo">' +
            photo(entity) +
            '</a><div class="admin-artist-info"><a href="' +
            entityHref(entity) +
            '"><h3>' +
            e(entity.name) +
            "</h3></a><p>" +
            e(subtitle) +
            '</p><span class="artist-status ' +
            (isArchived(row) ? "archived" : "") +
            '">' +
            e(isArchived(row) ? "Archived" : row.status || "Active") +
            '</span></div><div class="actions"><button class="button secondary compact" data-edit="' +
            i +
            '">Edit</button><button class="text-link" data-remove="' +
            i +
            '">' +
            (isArchived(row) ? "Unarchive / Delete" : "Archive / Delete") +
            "</button></div></article>",
        )
        .join("")
    : '<p class="empty">No matching artists. Try another name or enable Show archived.</p>';
  root
    .querySelectorAll("[data-edit]")
    .forEach(
      (button) =>
        (button.onclick = () => onEdit(rows[Number(button.dataset.edit)].row)),
    );
  root
    .querySelectorAll("[data-remove]")
    .forEach(
      (button) =>
        (button.onclick = () =>
          openRemoval(
            type,
            rows[Number(button.dataset.remove)].row,
            onChanged,
          ).catch((error) => toast(error.message, true))),
    );
  return root;
}
