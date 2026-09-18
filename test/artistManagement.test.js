import "fake-indexeddb/auto";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { createDatabase } from "../src/data/db.js";
import { saveRecord } from "../src/services/catalogService.js";
import { saveAward } from "../src/services/awardService.js";
import {
  loadSnapshot,
  createIndex,
  populateAward,
} from "../src/services/entityService.js";
import { entityStatistics } from "../src/services/statistics.js";
import { pickerItems } from "../src/views/admin/entityForm.js";
import {
  saveArtist,
  setArtistArchived,
  deleteArtistPermanently,
  getArtistDependencies,
} from "../src/services/artistManagementService.js";

let database, idol, group;
beforeEach(async () => {
  database = createDatabase("artist-management-test-" + crypto.randomUUID());
  await database.open();
  idol = await saveRecord(
    "idol",
    {
      stageName: "Same name",
      realName: "Original",
      gender: "male",
      status: "active",
    },
    database,
  );
  group = await saveRecord(
    "group",
    { name: "Same name", type: "bg", status: "active" },
    database,
  );
});
afterEach(async () => {
  await database.delete();
});
const memberships = () =>
  saveRecord(
    "membership",
    {
      idolId: idol.id,
      groupId: group.id,
      status: "current",
      startDate: "2024-01-01",
      role: "Vocal",
    },
    database,
  );
const award = () =>
  saveAward(
    {
      seasonId: "season_2024",
      categoryId: "cat_reg_male_vocal",
      winners: [{ id: idol.id, type: "idol" }],
    },
    database,
  );
describe("Artist editing and archival", () => {
  it("edits every idol field without changing the ID, awards or nominations", async () => {
    const result = await award();
    const nomination = await saveRecord(
      "nomination",
      {
        seasonId: "season_2024",
        categoryId: "cat_reg_male_vocal",
        entityId: idol.id,
        entityType: "idol",
      },
      database,
    );
    const edited = await saveArtist(
      "idol",
      {
        ...idol,
        stageName: "Renamed",
        realName: "New real name",
        photo: "https://example.com/idol.jpg",
        gender: "male",
        nationality: "Korean",
        birthDate: "2000-01-01",
        debutDate: "2020-01-01",
        status: "inactive",
        roles: "Vocal, dancer",
      },
      [],
      database,
    );
    expect(edited).toMatchObject({
      id: idol.id,
      stageName: "Renamed",
      nationality: "Korean",
      birthDate: "2000-01-01",
      roles: "Vocal, dancer",
    });
    expect(await database.awardResults.get(result.id)).toEqual(result);
    expect(await database.nominations.get(nomination.id)).toEqual(nomination);
    const log = (await database.auditLog.toArray()).find(
      (a) => a.action === "idol updated",
    );
    expect(log.previousValue.stageName).toBe("Same name");
    expect(log.newValue.stageName).toBe("Renamed");
  });
  it("edits a group while retaining its member links and ID", async () => {
    const membership = await memberships();
    const edited = await saveArtist(
      "group",
      {
        ...group,
        name: "New group",
        type: "band",
        photo: "https://example.com/group.jpg",
        debutDate: "2021-01-01",
        status: "hiatus",
      },
      [],
      database,
    );
    expect(edited.id).toBe(group.id);
    expect(await database.memberships.get(membership.id)).toEqual(membership);
    expect(
      (await database.auditLog.toArray()).some(
        (a) =>
          a.action === "group updated" &&
          a.previousValue.name === "Same name" &&
          a.newValue.name === "New group",
      ),
    ).toBe(true);
  });
  it.each(["idol", "group"])(
    "archives and unarchives %s while preserving all history",
    async (type) => {
      await memberships();
      const result = await award();
      const row = type === "idol" ? idol : group;
      const before = await loadSnapshot(database);
      const oldStats = entityStatistics(
        type,
        row.id,
        before,
        createIndex(before),
      );
      await setArtistArchived(type, row.id, true, database);
      const after = await loadSnapshot(database);
      expect(pickerItems([type], after).some((r) => r.id === row.id)).toBe(
        false,
      );
      expect(
        pickerItems([type], after, true).some((r) => r.id === row.id),
      ).toBe(true);
      expect(after.memberships).toEqual(before.memberships);
      expect(populateAward(result, createIndex(after)).winners[0].id).toBe(
        idol.id,
      );
      expect(
        entityStatistics(type, row.id, after, createIndex(after))
          .totalLegacyAwards,
      ).toBe(oldStats.totalLegacyAwards);
      const log = after.auditLog.find((a) => a.action === type + " archived");
      expect(log.previousValue.id).toBe(row.id);
      expect(log.newValue.active).toBe(false);
      await setArtistArchived(type, row.id, false, database);
      expect(
        pickerItems([type], await loadSnapshot(database)).some(
          (r) => r.id === row.id,
        ),
      ).toBe(true);
    },
  );
  it("preserves historical memberships and commits membership edits with the idol", async () => {
    const old = await saveRecord(
      "membership",
      {
        idolId: idol.id,
        groupId: group.id,
        status: "former",
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      },
      database,
    );
    const second = await saveRecord(
      "group",
      { name: "Second group", type: "bg" },
      database,
    );
    await saveArtist(
      "idol",
      { ...idol, stageName: "New name" },
      [
        {
          idolId: idol.id,
          groupId: second.id,
          status: "temporary",
          startDate: "2025-01-01",
        },
      ],
      database,
    );
    expect(await database.memberships.get(old.id)).toEqual(old);
    expect(await database.memberships.count()).toBe(2);
    await saveArtist(
      "idol",
      { ...idol, stageName: "New name" },
      [{ ...old, endDate: "2024-11-01" }],
      database,
    );
    expect((await database.memberships.get(old.id)).id).toBe(old.id);
    expect(
      (await database.auditLog.toArray()).some(
        (a) =>
          a.action === "membership changed" &&
          a.previousValue?.id === old.id &&
          a.newValue.endDate === "2024-11-01",
      ),
    ).toBe(true);
  });
  it("supports adding and ending a member from the group editor", async () => {
    await saveArtist(
      "group",
      group,
      [
        {
          idolId: idol.id,
          groupId: group.id,
          status: "subunit",
          startDate: "2024-01-01",
        },
      ],
      database,
    );
    const member = (await database.memberships.toArray())[0];
    await saveArtist(
      "group",
      group,
      [{ ...member, status: "former", endDate: "2025-12-31" }],
      database,
    );
    expect(await database.memberships.get(member.id)).toMatchObject({
      status: "former",
      endDate: "2025-12-31",
    });
  });
  it("rolls back artist and memberships if a membership is invalid", async () => {
    const old = await memberships();
    await expect(
      saveArtist(
        "idol",
        { ...idol, stageName: "Must not save" },
        [{ ...old, status: "former", endDate: "" }],
        database,
      ),
    ).rejects.toThrow(/end date/);
    expect((await database.idols.get(idol.id)).stageName).toBe(idol.stageName);
    expect(await database.memberships.get(old.id)).toEqual(old);
  });
  it("prevents retargeting a historical membership to different artists", async () => {
    const old = await memberships();
    const second = await saveRecord("group", { name: "Other group" }, database);
    await expect(
      saveArtist("idol", idol, [{ ...old, groupId: second.id }], database),
    ).rejects.toThrow(/historical memberships/);
    await expect(saveArtist("group", second, [old], database)).rejects.toThrow(
      /does not belong/,
    );
    expect(await database.memberships.get(old.id)).toEqual(old);
  });
});
describe("Permanent deletion protection", () => {
  it.each(["idol", "group"])(
    "deletes an unrelated %s and records its previous value",
    async (type) => {
      const row = type === "idol" ? idol : group,
        table = type === "idol" ? "idols" : "groups";
      await deleteArtistPermanently(type, row.id, database);
      expect(await database.table(table).get(row.id)).toBeUndefined();
      const log = (await database.auditLog.toArray()).find(
        (a) => a.action === type + " deleted",
      );
      expect(log.previousValue).toEqual(row);
      expect(log.newValue).toBeNull();
    },
  );
  it.each([
    [
      "memberships",
      () => ({
        idolId: idol.id,
        groupId: group.id,
        status: "former",
        endDate: "2025-01-01",
      }),
    ],
    ["songs", () => ({ title: "Song", artistIds: [idol.id] })],
    ["albums", () => ({ title: "Album", artistIds: [idol.id] })],
    ["performances", () => ({ eventName: "Stage", artistIds: [idol.id] })],
    ["documentaries", () => ({ title: "Film", artistIds: [idol.id] })],
    ["outfits", () => ({ title: "Look", idolId: idol.id })],
    [
      "nominations",
      () => ({
        seasonId: "season_2024",
        categoryId: "cat_reg_male_vocal",
        entityId: idol.id,
        entityType: "idol",
      }),
    ],
    [
      "awardResults",
      () => ({
        seasonId: "season_2024",
        categoryId: "cat_reg_male_vocal",
        winnerType: "idol",
        winnerIds: [idol.id],
      }),
    ],
  ])(
    "blocks deletion for %s, including archived relations",
    async (table, make) => {
      await database
        .table(table)
        .add({ id: "related", archivedAt: "2025-01-01", ...make() });
      const deps = await getArtistDependencies("idol", idol.id, database);
      expect(deps.some((d) => d.table === table && d.count === 1)).toBe(true);
      await expect(
        deleteArtistPermanently("idol", idol.id, database),
      ).rejects.toThrow(
        "Cannot permanently delete this artist because it has historical records.",
      );
      expect(await database.idols.get(idol.id)).toEqual(idol);
    },
  );
  it("reports indirect MV and award dependencies through an artist's song", async () => {
    await database.songs.add({
      id: "song",
      title: "Song",
      artistIds: [group.id],
    });
    await database.musicVideos.add({ id: "mv", songId: "song", title: "MV" });
    await database.awardResults.add({
      id: "result",
      seasonId: "season_2024",
      categoryId: "cat_daesang_soty",
      winnerType: "song",
      winnerIds: ["song"],
    });
    const deps = await getArtistDependencies("group", group.id, database);
    expect(deps.map((d) => d.table)).toEqual(
      expect.arrayContaining(["songs", "musicVideos", "awardResults"]),
    );
    await expect(
      deleteArtistPermanently("group", group.id, database),
    ).rejects.toThrow(/historical records/);
  });
  it("rechecks dependencies added after the initial preview", async () => {
    expect(await getArtistDependencies("idol", idol.id, database)).toEqual([]);
    await award();
    await expect(
      deleteArtistPermanently("idol", idol.id, database),
    ).rejects.toThrow(/historical records/);
  });
  it("rolls back deletion if audit storage fails", async () => {
    const spy = vi
      .spyOn(database.auditLog, "add")
      .mockRejectedValue(new Error("Storage failure"));
    await expect(
      deleteArtistPermanently("idol", idol.id, database),
    ).rejects.toThrow("Storage failure");
    spy.mockRestore();
    expect(await database.idols.get(idol.id)).toEqual(idol);
  });
  it("does not confuse identical names or typed winner IDs", async () => {
    await award();
    expect(await getArtistDependencies("group", group.id, database)).toEqual(
      [],
    );
    await deleteArtistPermanently("group", group.id, database);
    expect(await database.idols.get(idol.id)).toBeDefined();
  });
});
