import { db } from "../data/db.js";
import { DATA_TABLES, ENTITY_TABLES } from "../data/catalog.js";
import { FORMS } from "../data/fields.js";
import { loadSnapshot, winnerRefs } from "./entityService.js";
import { saveRecord, auditEntry } from "./catalogService.js";

export const isArchived = (row) =>
  !!row.archivedAt || row.active === false || row.status === "archived";
const tableFor = (type) => {
  if (!["idol", "group"].includes(type))
    throw new Error("Choose an idol or group.");
  return ENTITY_TABLES[type];
};
const labels = {
  memberships: "Memberships",
  songs: "Songs",
  albums: "Albums",
  musicVideos: "Music videos",
  performances: "Performances",
  outfits: "Outfits",
  documentaries: "Documentaries",
  awardResults: "Award results",
  nominations: "Nominations",
};

// Follow media references as well as direct artist references. Archived records still count.
export function collectArtistDependencies(type, id, data) {
  const table = tableFor(type);
  const affected = Object.fromEntries(
    Object.values(ENTITY_TABLES).map((t) => [t, new Set()]),
  );
  affected[table].add(id);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [entityType, entityTable] of Object.entries(ENTITY_TABLES)) {
      if (["idol", "group"].includes(entityType)) continue;
      const relations = FORMS[entityType].fields.filter((f) => f.types);
      for (const row of data[entityTable] || []) {
        if (affected[entityTable].has(row.id)) continue;
        if (
          relations.some((field) => {
            const values = field.multiple
              ? row[field.key] || []
              : [row[field.key]];
            return values.some(
              (value) =>
                value &&
                field.types.some((t) => affected[ENTITY_TABLES[t]]?.has(value)),
            );
          })
        ) {
          affected[entityTable].add(row.id);
          changed = true;
        }
      }
    }
  }
  const idsByTable = Object.fromEntries(
    Object.entries(affected).filter(([t]) => !["idols", "groups"].includes(t)),
  );
  idsByTable.memberships = new Set(
    (data.memberships || [])
      .filter((m) => (type === "idol" ? m.idolId === id : m.groupId === id))
      .map((m) => m.id),
  );
  idsByTable.awardResults = new Set(
    (data.awardResults || [])
      .filter((a) => {
        const refs = winnerRefs(a);
        return (
          refs.some((ref) => affected[ENTITY_TABLES[ref.type]]?.has(ref.id)) ||
          (!a.winners &&
            !ENTITY_TABLES[a.winnerType] &&
            (a.winnerIds || []).some((w) =>
              Object.values(affected).some((ids) => ids.has(w)),
            ))
        );
      })
      .map((a) => a.id),
  );
  idsByTable.nominations = new Set(
    (data.nominations || [])
      .filter((n) =>
        n.entityType
          ? affected[ENTITY_TABLES[n.entityType]]?.has(n.entityId)
          : Object.values(affected).some((ids) => ids.has(n.entityId)),
      )
      .map((n) => n.id),
  );
  return Object.entries(idsByTable)
    .filter(([, ids]) => ids.size)
    .map(([table, ids]) => ({
      table,
      label: labels[table],
      count: ids.size,
      ids: [...ids],
    }));
}
export async function getArtistDependencies(type, id, database = db) {
  return collectArtistDependencies(type, id, await loadSnapshot(database));
}
export async function setArtistArchived(type, id, archived, database = db) {
  const table = tableFor(type);
  return database.transaction(
    "rw",
    database.table(table),
    database.auditLog,
    async () => {
      const before = await database.table(table).get(id);
      if (!before) throw new Error("Artist no longer exists.");
      if (isArchived(before) === archived) return before;
      const after = {
        ...before,
        active: !archived,
        archivedAt: archived ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      };
      if (!archived && before.status === "archived") after.status = "active";
      await database.table(table).put(after);
      await database.auditLog.add(
        auditEntry(
          type + (archived ? " archived" : " unarchived"),
          type,
          id,
          before,
          after,
        ),
      );
      return after;
    },
  );
}
export async function deleteArtistPermanently(type, id, database = db) {
  const table = tableFor(type);
  // Recheck inside the write transaction, after the user confirmation.
  return database.transaction(
    "rw",
    DATA_TABLES.map((t) => database.table(t)),
    async () => {
      const before = await database.table(table).get(id);
      if (!before) throw new Error("Artist no longer exists.");
      const dependencies = collectArtistDependencies(
        type,
        id,
        await loadSnapshot(database),
      );
      if (dependencies.length) {
        const error = new Error(
          "Cannot permanently delete this artist because it has historical records.",
        );
        error.dependencies = dependencies;
        throw error;
      }
      await database.table(table).delete(id);
      await database.auditLog.add(
        auditEntry(type + " deleted", type, id, before, null),
      );
    },
  );
}
export async function saveArtist(
  type,
  input,
  membershipChanges = [],
  database = db,
) {
  tableFor(type);
  return database.transaction(
    "rw",
    DATA_TABLES.map((t) => database.table(t)),
    async () => {
      const artist = await saveRecord(type, input, database);
      const owner = type === "idol" ? "idolId" : "groupId";
      const seen = new Set();
      for (const change of membershipChanges) {
        if (change.id) {
          if (seen.has(change.id))
            throw new Error("Membership was submitted twice.");
          seen.add(change.id);
          const previous = await database.memberships.get(change.id);
          if (!previous || previous[owner] !== artist.id)
            throw new Error("Membership does not belong to this artist.");
          if (
            change.idolId !== previous.idolId ||
            change.groupId !== previous.groupId
          )
            throw new Error(
              "Keep historical memberships linked to their original artists. Add another membership instead.",
            );
        }
        await saveRecord(
          "membership",
          { ...change, [owner]: artist.id },
          database,
        );
      }
      return artist;
    },
  );
}
