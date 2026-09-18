import { db } from "../data/db.js";
import { DATA_TABLES, ENTITY_TABLES, categoryDefaults } from "../data/catalog.js";
import { FORMS } from "../data/fields.js";
import { loadSnapshot, createIndex, winnerRefs } from "./entityService.js";
import { validateRecord, auditEntry } from "./catalogService.js";
import { validateAward } from "./awardValidation.js";
import { generateId } from "../utils/helpers.js";
export async function createBackup(database = db) {
  return {
    schemaVersion: database.verno,
    appVersion: "2.0.0",
    createdAt: new Date().toISOString(),
    ...(await loadSnapshot(database)),
  };
}
export function downloadJson(data, name) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function exportDatabaseToJson() {
  const data = await createBackup();
  downloadJson(
    data,
    "kpop-gala-" + new Date().toISOString().slice(0, 10) + ".json",
  );
  return data;
}
export function prepareBackup(input, current = {}) {
  const source =
    typeof input === "string" ? JSON.parse(input) : structuredClone(input);
  if (
    !source ||
    ![1, 2].includes(source.schemaVersion) ||
    !Array.isArray(source.awardResults)
  )
    throw new Error("Unsupported or invalid backup.");
  const missing = DATA_TABLES.filter((t) => !Object.hasOwn(source, t));
  if (source.schemaVersion === 2 && missing.length)
    throw new Error("Incomplete backup: " + missing.join(", "));
  const data = {};
  for (const table of DATA_TABLES) {
    const rows = source[table] ?? current[table] ?? [];
    if (
      !Array.isArray(rows) ||
      rows.some(
        (r) =>
          !r ||
          typeof r !== "object" ||
          typeof r.id !== "string" ||
          !r.id.trim(),
      )
    )
      throw new Error("Invalid records in " + table);
    if (new Set(rows.map((r) => r.id)).size !== rows.length)
      throw new Error("Duplicate IDs in " + table);
    data[table] = structuredClone(rows);
  }
  data.categories = data.categories.map(categoryDefaults);
  data.memberships = data.memberships.map((m) => ({
    ...m,
    status:
      m.status === "currentMember"
        ? "current"
        : m.status === "formerMember"
          ? "former"
          : m.status,
  }));
  const index = createIndex(data);
  for (const nomination of data.nominations) {
    if (!nomination.entityType) {
      const matches = Object.entries(ENTITY_TABLES).filter(([, table]) => index[table].has(nomination.entityId));
      if (matches.length !== 1) throw new Error('Cannot resolve a legacy nominee unambiguously.');
      nomination.entityType = matches[0][0];
    }
  }
  for (const [type, definition] of Object.entries(FORMS)) {
    for (const row of data[definition.table])
      validateRecord(type, row, index, false);
  }
  for (const row of data.awardResults) {
    const category = index.categories.get(row.categoryId);
    if (!category || !index.seasons.has(row.seasonId))
      throw new Error("An award references a missing category or season.");
    // Older records can predate gender metadata. Verify relationships without rewriting history.
    const legacyIndex = { ...index };
    const cleanCategory = { ...category, active: true, genderRestriction: "" };
    if (["maleFemale", "userGenderSlots"].includes(category.winnerStructure)) {
      if (!row.slot) throw new Error("A slotted award is missing its slot.");
    }
    for (const ref of winnerRefs(row)) {
      const table = FORMS[ref.type]?.table;
      if (!table || !index[table]?.has(ref.id))
        throw new Error("An award references a missing winner.");
      legacyIndex[table] = new Map(legacyIndex[table]);
      legacyIndex[table].set(ref.id, {
        ...index[table].get(ref.id),
        active: true,
        archivedAt: null,
        gender: row.slot?.split("_").at(-1) || index[table].get(ref.id).gender,
      });
    }
    validateAward(row, cleanCategory, legacyIndex);
    if (
      row.winners &&
      JSON.stringify(row.winnerIds) !==
        JSON.stringify(row.winners.map((r) => r.id))
    )
      throw new Error("Winner IDs do not match winner references.");
  }
  const years = data.seasons.map((s) => s.year);
  if (new Set(years).size !== years.length)
    throw new Error("Duplicate season years.");
  return {
    data,
    missing,
    summary: DATA_TABLES.map((table) => ({
      table,
      count: data[table].length,
      previous: (current[table] || []).length,
    })),
  };
}
export async function importDatabaseFromJson(input, database = db) {
  return database.transaction(
    "rw",
    [...DATA_TABLES.map((t) => database.table(t)), database.restorePoints],
    async () => {
      const previous = await createBackup(database),
        prepared = prepareBackup(input, previous);
      const restorePoint = {
        id: generateId("restore"),
        createdAt: new Date().toISOString(),
        data: previous,
      };
      await database.restorePoints.add(restorePoint);
      for (const table of DATA_TABLES) {
        await database.table(table).clear();
        await database.table(table).bulkAdd(prepared.data[table]);
      }
      await database.auditLog.add(
        auditEntry("restore completed", "backup", restorePoint.id),
      );
      return restorePoint.id;
    },
  );
}
