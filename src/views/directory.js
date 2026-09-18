import { page, heading, entityCard, empty } from "../components/ui.js";
import { createIndex, resolveFromIndex } from "../services/entityService.js";
export function renderDirectory(type, data) {
  const index = createIndex(data),
    table = type === "group" ? "groups" : "idols";
  const entities = data[table]
    .filter((r) => !r.archivedAt && r.active !== false)
    .map((r) => resolveFromIndex(type, r.id, index))
    .sort((a, b) => a.name.localeCompare(b.name));
  const root = page(
    heading(
      "THE PEOPLE BEHIND THE MUSIC",
      type === "group" ? "Groups." : "Artists.",
      "Explore the names and stories that make this archive.",
    ) +
      '<div class="toolbar"><label class="search-label">Search the archive<input type="search" placeholder="Find a name…" aria-label="Search artists"></label><span class="small" data-count></span></div><div class="entity-grid" data-results></div>',
  );
  function render(query = "") {
    const rows = entities.filter((r) =>
      (r.name + " " + r.subtitle).toLowerCase().includes(query.toLowerCase()),
    );
    root.querySelector("[data-count]").textContent = rows.length + " entries";
    root.querySelector("[data-results]").innerHTML = rows.length
      ? rows.map(entityCard).join("")
      : empty(
          "No artists found.",
          "Try another name or add an artist in Admin.",
        );
  }
  root.querySelector("input").oninput = (event) => render(event.target.value);
  render();
  return root;
}
