import { page, heading, entityCard, empty } from "../components/ui.js";
import { createIndex, resolveFromIndex } from "../services/entityService.js";

export function renderDirectory(type, data) {
  const stateKey = `gala-directory-${type}`;
  let saved = {};
  try { saved = JSON.parse(sessionStorage.getItem(stateKey) || "{}"); } catch {}
  const index = createIndex(data),
    table = type === "group" ? "groups" : type === "drama" ? "dramas" : "idols";
  const entities = data[table]
    .filter((row) => !row.archivedAt && row.active !== false && (type !== "actors" || ["actor", "actress"].includes(row.personType)) && (type !== "idol" || !["actor", "actress"].includes(row.personType)))
    .map((row) => resolveFromIndex(type === "actors" ? "idol" : type, row.id, index));
  const root = page(
    heading(
      "THE PEOPLE BEHIND THE MUSIC",
      type === "group" ? "Groups." : type === "drama" ? "Dramas & series." : type === "actors" ? "Actors." : "Artists.",
      "Explore the names and stories that make this archive.",
    ) +
      `<div class="toolbar directory-filters"><label class="search-label">Search the archive<input data-search type="search" placeholder="Find a name, group, or detail…" aria-label="Search ${type === "group" ? "groups" : type === "drama" ? "dramas" : type === "actors" ? "actors" : "artists"}"></label><label>${type === "group" ? "Group type" : type === "drama" ? "Format" : type === "actors" ? "Role" : "Gender"}<select data-kind-filter><option value="">All</option>${type === "group" ? '<option value="bg">Boy group</option><option value="gg">Girl group</option><option value="mixed">Mixed group</option><option value="band">Band</option><option value="subunit">Subunit</option>' : type === "drama" ? '<option value="drama">Drama</option><option value="series">Series</option><option value="film">Film</option><option value="variety">Variety</option><option value="web series">Web series</option>' : type === "actors" ? '<option value="actor">Actor</option><option value="actress">Actress</option>' : '<option value="female">Female</option><option value="male">Male</option><option value="other">Other / unspecified</option>'}</select></label><label>Sort<select data-sort><option value="name">Name A–Z</option><option value="name-desc">Name Z–A</option>${type === "group" ? '<option value="gender">Gender, then name</option><option value="oldest">Oldest debut</option><option value="newest">Newest debut</option><option value="type">Group type</option>' : type === "actors" || type === "idol" ? '<option value="birth-oldest">Oldest first</option><option value="birth-youngest">Youngest first</option>' : type === "drama" ? '<option value="oldest">Earliest release</option><option value="newest">Latest release</option>' : '<option value="gender">Gender</option><option value="oldest">Oldest debut</option><option value="newest">Newest debut</option>'}</select></label><span class="small" data-count></span></div><div class="entity-grid" data-results></div>`,
  );
  root.dataset.directoryType = type;
  root.querySelector("[data-search]").value = saved.query || "";
  root.querySelector("[data-kind-filter]").value = saved.kind || "";
  root.querySelector("[data-sort]").value = saved.sort || "name";
  const records = new Map(data[table].map((row) => [row.id, row]));
  const normalized = (value) => String(value || "").toLocaleLowerCase();
  function render() {
    const query = normalized(root.querySelector("[data-search]").value.trim());
    const kind = root.querySelector("[data-kind-filter]").value;
    const sort = root.querySelector("[data-sort]").value;
    try { sessionStorage.setItem(stateKey, JSON.stringify({ ...saved, query: root.querySelector("[data-search]").value, kind, sort })); } catch {}
    const rows = entities
      .filter((entity) => {
        const record = records.get(entity.id);
        const filterValue = type === "group" ? record?.type : type === "drama" ? record?.format : type === "actors" ? record?.personType : record?.gender || "other";
        const searchable = [
          entity.name,
          entity.subtitle,
          record?.realName,
          record?.nationality,
          record?.description,
          record?.roles,
          record?.type,
          record?.format,
          record?.originalTitle,
          record?.genre,
          record?.network,
          record?.personType,
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
          const aDate = birth ? first?.birthDate : type === "drama" ? first?.releaseDate : first?.debutDate;
          const bDate = birth ? second?.birthDate : type === "drama" ? second?.releaseDate : second?.debutDate;
          if (!aDate) return bDate ? 1 : a.name.localeCompare(b.name);
          if (!bDate) return -1;
          return aDate.localeCompare(bDate) * direction || a.name.localeCompare(b.name);
        }
        return a.name.localeCompare(b.name);
      });
    root.querySelector("[data-count]").textContent = `${rows.length} entries`;
    root.querySelector("[data-results]").innerHTML = rows.length
      ? rows.map((entity, position) => entityCard(entity, { eager: position < 6, priority: position === 0 })).join("")
      : empty(
          type === "group" ? "No groups found." : type === "drama" ? "No dramas found." : type === "actors" ? "No actors found." : "No artists found.",
          "Adjust the filters or add an entry in Admin.",
        );
  }
  root.querySelectorAll("[data-search], [data-kind-filter], [data-sort]").forEach((control) =>
    control.addEventListener(control.matches("input") ? "input" : "change", render),
  );
  render();
  let scrollTimer;
  const stateController = new AbortController();
  window.addEventListener("scroll", () => {
    if (!root.isConnected) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      try { sessionStorage.setItem(stateKey, JSON.stringify({ query: root.querySelector("[data-search]").value, kind: root.querySelector("[data-kind-filter]").value, sort: root.querySelector("[data-sort]").value, scrollY: window.scrollY })); } catch {}
    }, 100);
  }, { passive: true, signal: stateController.signal });
  root.cleanup = () => {
    try { sessionStorage.setItem(stateKey, JSON.stringify({ query: root.querySelector("[data-search]").value, kind: root.querySelector("[data-kind-filter]").value, sort: root.querySelector("[data-sort]").value, scrollY: window.scrollY })); } catch {}
    stateController.abort();
    clearTimeout(scrollTimer);
  };
  root.restoreState = () => requestAnimationFrame(() => window.scrollTo(0, Number(saved.scrollY) || 0));
  return root;
}
