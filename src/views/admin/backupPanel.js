import { db } from "../../data/db.js";
import {
  createBackup,
  prepareBackup,
  downloadJson,
  exportDatabaseToJson,
  importDatabaseFromJson,
} from "../../services/backupService.js";
import { modal, toast, confirmModal } from "../../components/ui.js";
import { escapeHtml as e } from "../../utils/helpers.js";
export async function openBackupPanel() {
  const content = document.createElement("div");
  content.innerHTML =
    '<p>Keep a copy of your complete archive: artists, media, results and audit history.</p><div class="actions"><button class="button" data-export>Export complete backup</button><label class="button secondary">Choose backup<input class="visually-hidden" type="file" accept=".json,application/json" data-import></label></div><div data-preview></div><h3>Recovery points</h3><p class="small">A recovery point is saved in this browser before each restore. Download one to recover an earlier archive.</p><div data-points></div>';
  modal("Backup & restore", content);
  content.querySelector("[data-export]").onclick = async () => {
    try {
      await exportDatabaseToJson();
      toast("Backup downloaded.");
    } catch (error) {
      toast(error.message, true);
    }
  };
  async function points() {
    const rows = await db.restorePoints
      .orderBy("createdAt")
      .reverse()
      .toArray();
    const root = content.querySelector("[data-points]");
    root.innerHTML = rows.length
      ? rows
          .map(
            (row, i) =>
              '<button class="recovery-row" data-index="' +
              i +
              '">Download archive from ' +
              e(new Date(row.createdAt).toLocaleString()) +
              " ↗</button>",
          )
          .join("")
      : '<p class="small">No restores have been performed.</p>';
    root
      .querySelectorAll("button")
      .forEach(
        (b) =>
          (b.onclick = () =>
            downloadJson(
              rows[Number(b.dataset.index)].data,
              "kpop-gala-recovery.json",
            )),
      );
  }
  content.querySelector("[data-import]").onchange = async (event) => {
    const file = event.target.files[0],
      root = content.querySelector("[data-preview]");
    root.innerHTML = "";
    if (!file) return;
    try {
      if (file.size > 50 * 1024 * 1024)
        throw new Error("Backup is too large (maximum 50 MB).");
      const raw = await file.text(),
        prepared = prepareBackup(raw, await createBackup());
      root.innerHTML =
        "<h3>Restore preview</h3><p>This replaces the tables shown below. Your current archive will be saved as a recovery point.</p>" +
        (prepared.missing.length
          ? '<p class="notice">Legacy backup: missing tables are preserved from this browser: ' +
            e(prepared.missing.join(", ")) +
            "</p>"
          : "") +
        '<div class="table-wrap"><table><thead><tr><th>Collection</th><th>Current</th><th>After restore</th></tr></thead><tbody>' +
        prepared.summary
          .map(
            (s) =>
              "<tr><td>" +
              e(s.table) +
              "</td><td>" +
              s.previous +
              "</td><td>" +
              s.count +
              "</td></tr>",
          )
          .join("") +
        '</tbody></table></div><button class="button" data-restore>Restore this backup</button>';
      root.querySelector("[data-restore]").onclick = async () => {
        if (
          !(await confirmModal(
            "Replace the current archive?",
            "The backup has been validated. A recovery point will be saved before replacement.",
            "Restore archive",
          ))
        )
          return;
        const button = root.querySelector("[data-restore]");
        button.disabled = true;
        try {
          await importDatabaseFromJson(raw);
          toast("Archive restored. Recovery point saved.");
          root.innerHTML = "";
          await points();
          window.dispatchEvent(new Event("catalog-changed"));
        } catch (error) {
          toast(error.message, true);
          button.disabled = false;
        }
      };
    } catch (error) {
      root.textContent = error.message;
      toast(error.message, true);
    }
  };
  await points();
}
