import { db } from "../data/db.js";
import { FORMS } from "../data/fields.js";
import {
  DATA_TABLES,
  ENTITY_TABLES,
  categoryDefaults,
} from "../data/catalog.js";
import { createIndex, loadSnapshot } from "./entityService.js";
import { generateId, safeUrl } from "../utils/helpers.js";
export function auditEntry(action, type, id, before = null, after = null) {
  return {
    id: generateId("audit"),
    timestamp: new Date().toISOString(),
    action,
    entityType: type,
    entityId: id,
    before,
    after,
    previousValue: before,
    newValue: after,
  };
}
export function validateRecord(type, record, index, strict = true) {
  const definition = FORMS[type];
  if (!definition) throw new Error("Unknown entry type.");
  for (const field of definition.fields) {
    const value = record[field.key];
    if (
      strict &&
      field.required &&
      (value === undefined ||
        value === null ||
        value === "" ||
        (Array.isArray(value) && !value.length))
    )
      throw new Error(field.label + " is required.");
    if (value === undefined || value === null || value === "") continue;
    if (
      !field.types &&
      field.key !== "userSlots" &&
      !["number", "range", "checkbox"].includes(field.type) &&
      typeof value !== "string"
    )
      throw new Error(field.label + " must be text.");
    if (field.type === "checkbox" && typeof value !== "boolean")
      throw new Error(field.label + " must be true or false.");
    if (
      field.type === "range" &&
      (!Number.isFinite(value) || value < 0 || value > 100)
    )
      throw new Error(field.label + " must be between 0 and 100.");
    if (field.type === "url" && !safeUrl(value))
      throw new Error(field.label + " must be an http(s) URL or local path.");
    if (
      field.type === "date" &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        Number.isNaN(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value)
    )
      throw new Error("Invalid " + field.label + ".");
    if (field.options && !field.options.includes(value))
      throw new Error("Invalid " + field.label + ".");
    if (field.types) {
      if (field.multiple && !Array.isArray(value))
        throw new Error(field.label + " must be a list.");
      for (const id of field.multiple ? value : [value]) {
        if (
          !field.types.some((t) =>
            index[ENTITY_TABLES[t] || FORMS[t]?.table]?.has(id),
          )
        )
          throw new Error(field.label + " references a missing entry.");
      }
    }
  }
  if (
    type === "season" &&
    (!Number.isInteger(record.year) || record.year < 2024 || record.year > 9999)
  )
    throw new Error("Season year must be 2024 or later.");
  if (type === "membership") {
    if (record.startDate && record.endDate && record.endDate < record.startDate)
      throw new Error("End date must be on or after the start date.");
    if (strict && record.status === "former" && !record.endDate)
      throw new Error("Former memberships require an end date.");
  }
  if (type === "category") {
    if (!Number.isFinite(Number(record.sortOrder || 0)))
      throw new Error("Display order must be a number.");
    if (
      record.winnerStructure === "userGenderSlots" &&
      (!Array.isArray(record.userSlots) ||
        !record.userSlots.length ||
        record.userSlots.some((s) => !/^[a-zA-Z0-9-]+$/.test(s)) ||
        new Set(record.userSlots).size !== record.userSlots.length)
    )
      throw new Error(
        "Use unique user slots with letters, numbers or hyphens.",
      );
  }
  if (
    type === "nomination" &&
    (!ENTITY_TABLES[record.entityType] ||
      !index[ENTITY_TABLES[record.entityType]].has(record.entityId))
  )
    throw new Error("Choose a valid nominee type.");
  if (type === "nomination") {
    const category = index.categories.get(record.categoryId);
    const expected =
      category?.winnerType === "pair" ? "idol" : category?.winnerType;
    if (
      !category ||
      (expected !== "mixedEntity" && expected !== record.entityType)
    )
      throw new Error("Nominee type does not match the category.");
    const slots =
      category.winnerStructure === "maleFemale"
        ? ["male", "female"]
        : category.winnerStructure === "userGenderSlots"
          ? (category.userSlots || ["user1", "user2"]).flatMap((user) => [
              user + "_male",
              user + "_female",
            ])
          : [""];
    if (!slots.includes(record.slot || ""))
      throw new Error("Choose a valid nomination slot.");
  }
}
export async function saveRecord(type, input, database = db) {
  const definition = FORMS[type];
  if (!definition) throw new Error("Unknown entry type.");
  return database.transaction(
    "rw",
    DATA_TABLES.map((t) => database.table(t)),
    async () => {
      const data = await loadSnapshot(database),
        index = createIndex(data);
      const before = input.id ? index[definition.table].get(input.id) : null;
      if (input.id && !before) throw new Error("Entry no longer exists.");
      let record = {
        ...before,
        ...input,
        id: before?.id || generateId(type),
        createdAt: before?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (type === "category") record = categoryDefaults(record);
      validateRecord(type, record, index);
      if (
        type === "season" &&
        data.seasons.some((s) => s.year === record.year && s.id !== record.id)
      )
        throw new Error("That season already exists.");
      if (
        type === "category" &&
        before &&
        data.awardResults.some((a) => a.categoryId === before.id) &&
        [
          "winnerType",
          "winnerStructure",
          "genderRestriction",
          "userSlots",
        ].some(
          (k) =>
            (k !== "userSlots" ||
              before.winnerStructure === "userGenderSlots") &&
            JSON.stringify(record[k]) !== JSON.stringify(before[k]),
        )
      )
        throw new Error(
          "This category has results. Create a new category to change its winner rules.",
        );
      if (
        type === "nomination" &&
        data.nominations.some(
          (n) =>
            n.id !== record.id &&
            n.seasonId === record.seasonId &&
            n.categoryId === record.categoryId &&
            n.entityId === record.entityId &&
            n.entityType === record.entityType &&
            (n.slot || "") === (record.slot || ""),
        )
      )
        throw new Error("That nomination already exists.");
      await database.table(definition.table).put(record);
      await database.auditLog.add(
        auditEntry(
          type === "membership"
            ? "membership changed"
            : type +
                (before
                  ? ["idol", "group"].includes(type)
                    ? " updated"
                    : " changed"
                  : " created"),
          type,
          record.id,
          before,
          record,
        ),
      );
      return record;
    },
  );
}
