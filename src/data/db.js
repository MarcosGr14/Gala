import Dexie from "dexie";
import { seedDatabase, initialCategories } from "./seed.js";
import { categoryDefaults } from "./catalog.js";
import { mergePublishedCatalogAdditions } from "../services/publishedCatalogAdditions.js";

const schemaV1 = {
  seasons: "id, year",
  categories: "id, tier, winnerType, family",
  idols: "id, stageName, status",
  groups: "id, name, status",
  memberships: "id, idolId, groupId, status",
  songs: "id, title, albumId",
  albums: "id, title",
  musicVideos: "id, songId",
  performances: "id, date, eventName",
  outfits: "id, idolId, musicVideoId",
  awardResults: "id, seasonId, categoryId, *winnerIds, winnerType",
  nominations: "id, seasonId, categoryId, entityId",
  auditLog: "id, timestamp, entityType, entityId",
};

export function createDatabase(name = "KPopGalaDatabase") {
  const database = new Dexie(name);

  // Versión inicial
  database.version(1).stores(schemaV1);

  // Migración v2
  database
    .version(2)
    .stores({
      ...schemaV1,
      documentaries: "id, title",
      restorePoints: "id, createdAt",
      awardResults:
        "id, seasonId, categoryId, *winnerIds, winnerType, [seasonId+categoryId]",
    })
    .upgrade(async (tx) => {
      await tx
        .table("categories")
        .toCollection()
        .modify((c) => Object.assign(c, categoryDefaults(c)));

      await tx
        .table("memberships")
        .toCollection()
        .modify((m) => {
          if (m.status === "currentMember") m.status = "current";
          if (m.status === "formerMember") m.status = "former";
        });

      const existing = await tx.table("categories").toArray();
      const ids = new Set(existing.map((c) => c.id));
      const names = new Set(existing.map((c) => c.name.toLowerCase()));

      await tx.table("categories").bulkAdd(
        initialCategories.filter(
          (c) =>
            !ids.has(c.id) &&
            !names.has(c.name.toLowerCase()),
        ),
      );
    });

  // Migración v3
  // Corrige Female Rookie y Male Rookie para que acepten grupos
  database
    .version(3)
    .stores({
      ...schemaV1,
      documentaries: "id, title",
      restorePoints: "id, createdAt",
      awardResults:
        "id, seasonId, categoryId, *winnerIds, winnerType, [seasonId+categoryId]",
    })
    .upgrade(async (tx) => {
      await tx
        .table("categories")
        .toCollection()
        .modify((category) => {
          if (
            category.name === "Female Rookie" ||
            category.name === "Male Rookie"
          ) {
            category.winnerType = "group";
          }
        });
    });

  // Correct winner types for the two artist-level categories.
  database
    .version(4)
    .stores({
      ...schemaV1,
      documentaries: "id, title",
      restorePoints: "id, createdAt",
      awardResults:
        "id, seasonId, categoryId, *winnerIds, winnerType, [seasonId+categoryId]",
    })
    .upgrade(async (tx) => {
      await tx
        .table("categories")
        .toCollection()
        .modify((category) => {
          if (category.id === "cat_best_fanservice" || category.name === "Best Fanservice")
            category.winnerType = "group";
          if (category.id === "cat_best_look_change" || category.name === "Best Look Change")
            category.winnerType = "idol";
        });
    });

  // Best Comeback Look is awarded to idols, not outfit entries.
  database
    .version(5)
    .stores({
      ...schemaV1,
      documentaries: "id, title",
      restorePoints: "id, createdAt",
      awardResults:
        "id, seasonId, categoryId, *winnerIds, winnerType, [seasonId+categoryId]",
    })
    .upgrade(async (tx) => {
      await tx
        .table("categories")
        .toCollection()
        .modify((category) => {
          if (
            category.id === "cat_best_comeback_look" ||
            category.name === "Best Comeback Look"
          )
            category.winnerType = "idol";
        });
    });

  database.version(6).stores({
    ...schemaV1,
    documentaries: "id, title",
    agencies: "id, name, type",
    restorePoints: "id, createdAt",
    awardResults: "id, seasonId, categoryId, *winnerIds, winnerType, [seasonId+categoryId]",
  });

  database.version(7).stores({
    ...schemaV1,
    documentaries: "id, title",
    agencies: "id, name, type",
    dramas: "id, title, format, releaseDate",
    restorePoints: "id, createdAt",
    awardResults: "id, seasonId, categoryId, *winnerIds, winnerType, [seasonId+categoryId]",
  }).upgrade(async (tx) => {
    await tx.table("categories").toCollection().modify((category) => {
      if (category.winnerType !== "idol") return;
      if (/actress/i.test(category.name)) category.winnerPersonType = "actress";
      else if (/actor/i.test(category.name)) category.winnerPersonType = "actor";
      else if (/director/i.test(category.name)) category.winnerPersonType = "director";
      else if (/screenplay/i.test(category.name)) category.winnerPersonType = "writer";
    });
    const existing = await tx.table("categories").toArray();
    const ids = new Set(existing.map((category) => category.id));
    const names = new Set(existing.map((category) => category.name.toLocaleLowerCase()));
    await tx.table("categories").bulkAdd(initialCategories.filter((category) =>
      ["cat_drama_of_the_year", "cat_series_of_the_year", "cat_best_actor", "cat_best_actress", "cat_best_supporting_actor", "cat_best_supporting_actress", "cat_best_drama_ost", "cat_best_drama_director", "cat_best_drama_screenplay"].includes(category.id) &&
      !ids.has(category.id) && !names.has(category.name.toLocaleLowerCase()),
    ));
  });

  // Never make database startup wait on a network request. GitHub Pages may
  // take time to serve the additions file; the app must render with its local
  // archive while that optional merge happens in the background.
  database.on("ready", () => {
    if (typeof window !== "undefined") setTimeout(() => {
      mergePublishedCatalogAdditions(database)
        .then(() => globalThis.window?.dispatchEvent(new Event("catalog-changed")))
        .catch((error) => {
          console.warn("Could not merge published catalog additions.", error);
        });
    }, 0);
  });

  // Complete first-run seeding before callers can read the archive. Dexie
  // resolves its ready hook before IndexedDB transactions can be started, so
  // seeding from that hook can deadlock. Wrapping open keeps the guarantee
  // without introducing nested or fire-and-forget transactions.
  const openDatabase = database.open.bind(database);
  database.open = function () {
    return openDatabase().then(async () => {
      await seedDatabase(database);
      return database;
    });
  };

  return database;
}

export const db = createDatabase();
