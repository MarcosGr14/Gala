import Dexie from "dexie";
import { seedDatabase, initialCategories } from "./seed.js";
import { categoryDefaults } from "./catalog.js";

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

  database.on("populate", () => seedDatabase(database));

  return database;
}

export const db = createDatabase();
