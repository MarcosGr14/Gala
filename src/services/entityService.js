import { db } from "../data/db.js";
import { DATA_TABLES, ENTITY_TABLES } from "../data/catalog.js";

// One consistent, read-only snapshot per view. No per-card database queries.
export async function loadSnapshot(database = db) {
  return database.transaction(
    "r",
    DATA_TABLES.map((t) => database.table(t)),
    async () =>
      Object.fromEntries(
        await Promise.all(
          DATA_TABLES.map(async (t) => [t, await database.table(t).toArray()]),
        ),
      ),
  );
}
export function createIndex(data) {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, rows]) => Array.isArray(rows))
      .map(([table, rows]) => [
        table,
        new Map(rows.map((row) => [row.id, row])),
      ]),
  );
}
export function resolveFromIndex(type, id, index) {
  const row = index[ENTITY_TABLES[type]]?.get(id);
  if (!row)
    return {
      id,
      entityType: type,
      name: "Unavailable entry",
      image: "",
      subtitle: type,
      missing: true,
    };
  const artistIds = row.artistIds || row.groupIds || [];
  const artists = artistIds
    .map(
      (key) => index.idols?.get(key)?.stageName || index.groups?.get(key)?.name,
    )
    .filter(Boolean);
  return {
    ...row,
    entityType: type,
    name: row.stageName || row.name || row.title || row.eventName || "Untitled",
    image: row.photo || row.coverImage || row.thumbnail || row.image || "",
    subtitle: artists.join(" · ") || row.realName || row.type || type,
  };
}
export async function resolveEntity(type, id) {
  return resolveFromIndex(type, id, createIndex(await loadSnapshot()));
}
export function winnerRefs(award) {
  return (
    award.winners ||
    (award.winnerIds || []).map((id) => ({
      id,
      type: award.winnerType === "pair" ? "idol" : award.winnerType,
    }))
  );
}
export function populateAward(award, index) {
  const category = index.categories.get(award.categoryId) || {
    displayName: "Unavailable category",
    family: "SPECIAL",
    tier: "regular",
  };
  const season = index.seasons.get(award.seasonId);
  return {
    ...award,
    category,
    categoryName: category.displayName,
    tier: category.tier,
    year: season?.year,
    winners: winnerRefs(award).map((ref) =>
      resolveFromIndex(ref.type, ref.id, index),
    ),
  };
}
