const normalize = (value) => String(value || "").trim().toLocaleLowerCase();

export async function mergePublishedCatalogAdditions(database) {
  const base = import.meta.env?.BASE_URL || "/";
  const response = await fetch(`${base}catalog-additions.json`);
  if (!response.ok) throw new Error(`Could not load catalog additions (${response.status}).`);
  const additions = await response.json();

  await database.transaction(
    "rw",
    database.groups,
    database.idols,
    database.memberships,
    async () => {
      const existingGroups = await database.groups.toArray();
      const existingIdols = await database.idols.toArray();
      const groupIds = new Map();
      const idolIds = new Map();
      const now = new Date().toISOString();

      for (const entry of additions.groups || []) {
        const current = existingGroups.find((row) => normalize(row.name) === normalize(entry.name));
        if (current) {
          groupIds.set(entry.id, current.id);
          const patch = Object.fromEntries(
            Object.entries(entry).filter(([key, value]) =>
              key !== "id" && value && (current[key] === undefined || current[key] === null || current[key] === ""),
            ),
          );
          if (Object.keys(patch).length) await database.groups.update(current.id, patch);
          continue;
        }
        const { members: _members, ...record } = entry;
        await database.groups.add({ ...record, createdAt: now, updatedAt: now });
        existingGroups.push(record);
        groupIds.set(entry.id, entry.id);
      }

      for (const entry of additions.idols || []) {
        const aliases = [entry.stageName, entry.realName, ...(entry.matchNames || [])].map(normalize).filter(Boolean);
        const current = existingIdols.find((row) =>
          [row.stageName, row.realName].map(normalize).some((name) => aliases.includes(name)),
        );
        if (current) {
          idolIds.set(entry.id, current.id);
          const fields = { ...entry };
          delete fields.id;
          delete fields.matchNames;
          if (entry.stageName === "EVAN") fields.stageName = "EVAN";
          const patch = Object.fromEntries(
            Object.entries(fields).filter(([key, value]) =>
              value && (key === "stageName" && entry.stageName === "EVAN"
                ? current[key] !== value
                : current[key] === undefined || current[key] === null || current[key] === ""),
            ),
          );
          if (Object.keys(patch).length) {
            patch.updatedAt = now;
            await database.idols.update(current.id, patch);
            Object.assign(current, patch);
          }
          continue;
        }
        const { matchNames: _matchNames, ...record } = entry;
        await database.idols.add({ ...record, createdAt: now, updatedAt: now });
        existingIdols.push(record);
        idolIds.set(entry.id, entry.id);
      }

      const existingMemberships = await database.memberships.toArray();
      for (const membership of additions.memberships || []) {
        const idolId = idolIds.get(membership.idolId) || membership.idolId;
        const groupId = groupIds.get(membership.groupId) || membership.groupId;
        const duplicate = existingMemberships.some((row) => row.idolId === idolId && row.groupId === groupId);
        if (duplicate) continue;
        const record = { ...membership, idolId, groupId, createdAt: now, updatedAt: now };
        await database.memberships.add(record);
        existingMemberships.push(record);
      }
    },
  );
}
