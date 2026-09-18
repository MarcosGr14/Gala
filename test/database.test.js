import "fake-indexeddb/auto";
import Dexie from "dexie";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createDatabase } from "../src/data/db.js";
import { saveRecord } from "../src/services/catalogService.js";
import { saveAward } from "../src/services/awardService.js";
import {
  createBackup,
  prepareBackup,
  importDatabaseFromJson,
} from "../src/services/backupService.js";
import { DATA_TABLES } from "../src/data/catalog.js";
import { loadSnapshot } from "../src/services/entityService.js";
let database;
beforeEach(async () => {
  database = createDatabase("test-" + crypto.randomUUID());
  await database.open();
});
afterEach(async () => {
  await database.delete();
});
async function artist() {
  return saveRecord("idol", { stageName: "A", gender: "male" }, database);
}
describe("Database writes", () => {
  it("seeds all eight Daesangs and complete category metadata", async () => {
    const categories = await database.categories.toArray();
    expect(categories.filter((c) => c.tier === "daesang")).toHaveLength(8);
    expect(categories.length).toBeGreaterThan(45);
    expect(
      categories.every(
        (c) => "active" in c && "sortOrder" in c && "archivedAt" in c,
      ),
    ).toBe(true);
  });
  it("saves an award atomically with audit history and prevents duplicates", async () => {
    const idol = await artist();
    const input = {
      seasonId: "season_2024",
      categoryId: "cat_reg_male_vocal",
      winners: [{ id: idol.id, type: "idol" }],
    };
    const award = await saveAward(input, database);
    await expect(saveAward(input, database)).rejects.toThrow(/already exists/);
    await saveAward(
      { ...award, winners: [{ id: idol.id, type: "idol" }] },
      database,
    );
    expect(await database.awardResults.count()).toBe(1);
    expect((await database.auditLog.toArray()).map((a) => a.action)).toContain(
      "award / winner changed",
    );
  });
  it("serializes concurrent duplicate result attempts", async () => {
    const idol = await artist(),
      input = {
        seasonId: "season_2024",
        categoryId: "cat_reg_male_vocal",
        winners: [{ id: idol.id, type: "idol" }],
      };
    const outcomes = await Promise.allSettled([
      saveAward(input, database),
      saveAward(input, database),
    ]);
    expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await database.awardResults.count()).toBe(1);
  });
  it("rolls back results if audit writing fails", async () => {
    const idol = await artist();
    const spy = vi
      .spyOn(database.auditLog, "add")
      .mockRejectedValue(new Error("audit failed"));
    await expect(
      saveAward(
        {
          seasonId: "season_2024",
          categoryId: "cat_reg_male_vocal",
          winners: [{ id: idol.id, type: "idol" }],
        },
        database,
      ),
    ).rejects.toThrow("audit failed");
    spy.mockRestore();
    expect(await database.awardResults.count()).toBe(0);
  });
  it("archives without removing a row and can unarchive", async () => {
    const idol = await artist();
    await saveRecord(
      "idol",
      { ...idol, active: false, archivedAt: "2026-01-01" },
      database,
    );
    expect(await database.idols.count()).toBe(1);
    await saveRecord(
      "idol",
      { ...idol, active: true, archivedAt: null },
      database,
    );
    expect((await database.idols.get(idol.id)).active).toBe(true);
  });
  it("does not modify data when reading snapshots", async () => {
    const before = JSON.stringify(await createBackup(database));
    await loadSnapshot(database);
    const after = await createBackup(database);
    expect(JSON.parse(before).categories).toEqual(after.categories);
    expect(await database.auditLog.count()).toBe(0);
  });
});
describe("Backup and restoration", () => {
  it("exports every data table including media and documents", async () => {
    const backup = await createBackup(database);
    expect(DATA_TABLES.every((t) => Array.isArray(backup[t]))).toBe(true);
    expect(backup.schemaVersion).toBe(2);
  });
  it("round trips media and keeps an exact recovery point", async () => {
    const idol = await artist();
    await saveRecord(
      "documentary",
      { title: "Documentary", artistIds: [idol.id] },
      database,
    );
    const before = await createBackup(database);
    await saveRecord("album", { title: "New album" }, database);
    const changed = await createBackup(database);
    const id = await importDatabaseFromJson(before, database);
    expect(await database.albums.count()).toBe(0);
    expect(await database.documentaries.count()).toBe(1);
    const point = await database.restorePoints.get(id);
    for (const table of DATA_TABLES)
      expect(point.data[table]).toEqual(changed[table]);
    expect(
      (await database.auditLog.toArray()).some(
        (r) => r.action === "restore completed",
      ),
    ).toBe(true);
  });
  it("preserves missing legacy tables instead of clearing them", async () => {
    const doc = await saveRecord("documentary", { title: "Keep me" }, database);
    const legacy = await createBackup(database);
    legacy.schemaVersion = 1;
    delete legacy.documentaries;
    delete legacy.musicVideos;
    await importDatabaseFromJson(legacy, database);
    expect(await database.documentaries.get(doc.id)).toMatchObject({
      title: "Keep me",
    });
  });
  it.each(["duplicate", "relation", "incomplete", "future", "json"])(
    "rejects %s backup without changing the database",
    async (kind) => {
      const before = await createBackup(database),
        broken = structuredClone(before);
      if (kind === "duplicate") broken.seasons.push({ ...broken.seasons[0] });
      if (kind === "relation")
        broken.memberships.push({
          id: "m",
          idolId: "missing",
          groupId: "missing",
          status: "current",
        });
      if (kind === "incomplete") delete broken.outfits;
      if (kind === "future") broken.schemaVersion = 999;
      await expect(
        importDatabaseFromJson(kind === "json" ? "{invalid" : broken, database),
      ).rejects.toThrow();
      expect(await database.restorePoints.count()).toBe(0);
      const after = await createBackup(database);
      for (const table of DATA_TABLES)
        expect(after[table]).toEqual(before[table]);
    },
  );
  it("rolls back all replacement tables on a write failure", async () => {
    await artist();
    const original = await createBackup(database),
      replacement = structuredClone(original);
    replacement.idols = [];
    const spy = vi
      .spyOn(database.auditLog, "add")
      .mockRejectedValue(new Error("disk full"));
    await expect(importDatabaseFromJson(replacement, database)).rejects.toThrow(
      "disk full",
    );
    spy.mockRestore();
    expect(await database.idols.count()).toBe(1);
    expect(await database.restorePoints.count()).toBe(0);
  });
  it("validates a backup without modifying its input", async () => {
    const backup = await createBackup(database),
      before = JSON.stringify(backup);
    prepareBackup(backup);
    expect(JSON.stringify(backup)).toBe(before);
  });
});
describe("Version 1 upgrade", () => {
  it("preserves original IDs, awards and custom metadata", async () => {
    const name = "legacy-" + crypto.randomUUID(),
      legacy = new Dexie(name);
    legacy
      .version(1)
      .stores({
        categories: "id, tier, winnerType, family",
        memberships: "id, idolId, groupId, status",
        idols: "id, stageName, status",
        groups: "id, name, status",
        awardResults: "id, seasonId, categoryId, *winnerIds, winnerType",
        seasons: "id, year",
      });
    await legacy.open();
    await legacy.categories.add({
      id: "cat_daesang_goty",
      name: "Group of the Year",
      displayName: "My title",
      tier: "daesang",
      winnerType: "group",
      winnerStructure: "single",
      family: "DAESANG",
      custom: "preserved",
    });
    await legacy.memberships.add({
      id: "m",
      idolId: "i",
      groupId: "g",
      status: "currentMember",
    });
    await legacy.awardResults.add({
      id: "a",
      seasonId: "s",
      categoryId: "cat_daesang_goty",
      winnerType: "group",
      winnerIds: ["g"],
    });
    legacy.close();
    const upgraded = createDatabase(name);
    try {
      await upgraded.open();
      expect(await upgraded.categories.get("cat_daesang_goty")).toMatchObject({
        displayName: "My title",
        custom: "preserved",
        active: true,
      });
      expect(await upgraded.awardResults.get("a")).toMatchObject({
        winnerIds: ["g"],
      });
      expect((await upgraded.memberships.get("m")).status).toBe("current");
      expect(await upgraded.documentaries.count()).toBe(0);
    } finally {
      await upgraded.delete();
    }
  });
});

describe("Editing existing categories", () => {
  it("allows display changes without changing the rules of recorded awards", async () => {
    const idol = await artist();
    await saveAward({seasonId:"season_2024",categoryId:"cat_reg_male_vocal",winners:[{id:idol.id,type:"idol"}]},database);
    const category = await database.categories.get("cat_reg_male_vocal");
    const saved = await saveRecord("category",{...category,displayName:"Vocal Award",userSlots:["user1","user2"]},database);
    expect(saved.displayName).toBe("Vocal Award");
    await expect(saveRecord("category",{...saved,winnerStructure:"pair"},database)).rejects.toThrow(/winner rules/);
  });
  it("infers unambiguous nominee types when restoring legacy records", async () => {
    const idol = await artist();
    const backup = await createBackup(database);
    backup.schemaVersion = 1;
    backup.nominations = [{id:"old-nomination",seasonId:"season_2024",categoryId:"cat_reg_male_vocal",entityId:idol.id}];
    await importDatabaseFromJson(backup,database);
    expect((await database.nominations.get("old-nomination")).entityType).toBe("idol");
  });
});

