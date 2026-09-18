import { db } from "../data/db.js";
import { DATA_TABLES } from "../data/catalog.js";
import { generateId } from "../utils/helpers.js";
import { loadSnapshot, createIndex, populateAward } from "./entityService.js";
import { entityStatistics } from "./statistics.js";
import { validateAward } from "./awardValidation.js";
import { auditEntry } from "./catalogService.js";
export function calculateGroupLegacyStats(
  directAwards,
  memberAwards,
  groupMemberIds,
) {
  const direct = new Set(directAwards.map((a) => a.id));
  const associated = new Set(
    memberAwards
      .filter(
        (a) =>
          a.winnerIds.some((id) => groupMemberIds.includes(id)) &&
          !direct.has(a.id),
      )
      .map((a) => a.id),
  );
  return {
    directWins: direct.size,
    associatedMemberWins: associated.size,
    totalLegacyAwards: direct.size + associated.size,
  };
}
export const getAllCategories = () => db.categories.toArray();
export const getAllSeasons = () =>
  db.seasons.orderBy("year").reverse().toArray();
export const getCategoryById = (id) => db.categories.get(id);
export const getSeasonById = (id) => db.seasons.get(id);
export async function saveAward(input, database = db) {
  return database.transaction(
    "rw",
    DATA_TABLES.map((t) => database.table(t)),
    async () => {
      const data = await loadSnapshot(database),
        index = createIndex(data);
      const before = input.id ? index.awardResults.get(input.id) : null;
      if (input.id && !before) throw new Error("Result no longer exists.");
      const category = index.categories.get(input.categoryId);
      const refs = validateAward(input, category, index);
      if (
        data.awardResults.some(
          (a) =>
            a.id !== input.id &&
            a.seasonId === input.seasonId &&
            a.categoryId === input.categoryId &&
            (a.slot || "") === (input.slot || ""),
        )
      )
        throw new Error(
          "A result already exists for this category and slot. Edit that result.",
        );
      const result = {
        ...before,
        ...input,
        id: before?.id || generateId("award_res"),
        winnerType: category.winnerType,
        winners: refs,
        winnerIds: refs.map((r) => r.id),
        createdAt: before?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await database.awardResults.put(result);
      await database.auditLog.add(
        auditEntry(
          before ? "award / winner changed" : "award created",
          "awardResult",
          result.id,
          before,
          result,
        ),
      );
      return result;
    },
  );
}
export async function registerAwardResult(
  seasonId,
  categoryId,
  winnerIds,
  winnerType,
) {
  return saveAward({ seasonId, categoryId, winnerIds, winnerType });
}
export async function getPopulatedAwardsByWinner(id) {
  const data = await loadSnapshot(),
    index = createIndex(data);
  return data.awardResults
    .filter((a) => a.winnerIds.includes(id))
    .map((a) => populateAward(a, index))
    .sort((a, b) => b.year - a.year);
}
export async function getGroupLegacyStatsData(id) {
  const data = await loadSnapshot();
  return entityStatistics("group", id, data, createIndex(data));
}
export async function getPopulatedAwardsBySeason(id) {
  const data = await loadSnapshot(),
    index = createIndex(data);
  return data.awardResults
    .filter((a) => a.seasonId === id)
    .map((a) => populateAward(a, index))
    .sort(
      (a, b) =>
        (a.tier === "daesang") - (b.tier === "daesang") ||
        (a.category.sortOrder || 0) - (b.category.sortOrder || 0),
    );
}
