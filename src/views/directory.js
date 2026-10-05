import { page, heading, entityCard, empty } from "../components/ui.js";
import { createIndex, resolveFromIndex } from "../services/entityService.js";

export function renderDirectory(type, data) {
  const index = createIndex(data),
    table = type === "group" ? "groups" : "idols";
  const entities = data[table]
    .filter((row) => !row.archivedAt && row.active !== false)
    .map((row) => resolveFromIndex(type, row.id, index));
  const root = page(
    heading(
      "THE PEOPLE BEHIND THE MUSIC",
      type === "group" ? "Groups." : "Artists.",
      "Explore the names and stories that make this archive.",
    ) +
      `<div class="toolbar directory-filters"><label class="search-label">Search the archive<input data-search type="search" placeholder="Find a name, group, or detail…" aria-label="Search ${type === "group" ? "groups" : "artists"}"></label><label>${type === "group" ? "Group type" : "Gender"}<select data-kind-filter><option value="">All</option>${type === "group" ? '<option value="bg">Boy group</option><option value="gg">Girl group</option><option value="mixed">Mixed group</option><option value="band">Band</option><option value="subunit">Subunit</option>' : '<option value="female">Female</option><option value="male">Male</option><option value="other">Other / unspecified</option>'}</select></label><label>Sort<select data-sort><option value="name">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="gender">Gender, then name</option><option value="oldest">Oldest debut</option><option value="newest">Newest debut</option>${type === "group" ? '<option value="type">Group type</option>' : '<option value="birth-oldest">Oldest first</option><option value="birth-youngest">Youngest first</option>'}</select></label><span class="small" data-count></span></div><div class="entity-grid" data-results></div>`,
  );
  const records = new Map(data[table].map((row) => [row.id, row]));
  const normalized = (value) => String(value || "").toLocaleLowerCase();
  function render() {
    const query = normalized(root.querySelector("[data-search]").value.trim());
    const kind = root.querySelector("[data-kind-filter]").value;
    const sort = root.querySelector("[data-sort]").value;
    const rows = entities
      .filter((entity) => {
        const record = records.get(entity.id);
        const filterValue = type === "group" ? record?.type : record?.gender || "other";
        const searchable = [
          entity.name,
          entity.subtitle,
          record?.realName,
          record?.nationality,
          record?.description,
          record?.roles,
          record?.type,
          record?.gender,
          record?.birthDate,
          record?.debutDate,
        ].map(normalized).join(" ");
        return (!kind || kind === filterValue) && searchable.includes(query);
      })
      .sort((a, b) => {
        const first = records.get(a.id), second = records.get(b.id);
        if (sort === "name-desc") return b.name.localeCompare(a.name);
        if (sort === "gender") return normalized(first?.gender || "other").localeCompare(normalized(second?.gender || "other")) || a.name.localeCompare(b.name);
        if (sort === "type") return normalized(first?.type).localeCompare(normalized(second?.type)) || a.name.localeCompare(b.name);
        if (["oldest", "newest", "birth-oldest", "birth-youngest"].includes(sort)) {
          const birth = sort.startsWith("birth-");
          const direction = sort.endsWith("youngest") || sort === "newest" ? -1 : 1;
          const aDate = birth ? first?.birthDate : first?.debutDate;
          const bDate = birth ? second?.birthDate : second?.debutDate;
          if (!aDate) return bDate ? 1 : a.name.localeCompare(b.name);
          if (!bDate) return -1;
          return aDate.localeCompare(bDate) * direction || a.name.localeCompare(b.name);
        }
        return a.name.localeCompare(b.name);
      });
    root.querySelector("[data-count]").textContent = `${rows.length} entries`;
    root.querySelector("[data-results]").innerHTML = rows.length
      ? rows.map(entityCard).join("")
      : empty(
          type === "group" ? "No groups found." : "No artists found.",
          "Adjust the filters or add an entry in Admin.",
        );
  }
  root.querySelectorAll("[data-search], [data-kind-filter], [data-sort]").forEach((control) =>
    control.addEventListener(control.matches("input") ? "input" : "change", render),
  );
  render();
  return root;
}
