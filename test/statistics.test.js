import { describe, it, expect } from "vitest";
import { fixture } from "./fixtures.js";
import {
  createIndex,
  resolveFromIndex,
} from "../src/services/entityService.js";
import {
  entityStatistics,
  wasMemberDuringSeason,
  rankEntities,
} from "../src/services/statistics.js";
import { buildStats } from "../src/services/statsService.js";
import { ENTITY_TABLES } from "../src/data/catalog.js";
describe("Historical memberships", () => {
  it.each([
    [2023, false],
    [2024, true],
    [2026, true],
    [2029, false],
  ])("tests membership in %i", (year, expected) =>
    expect(wasMemberDuringSeason(fixture().memberships[0], year)).toBe(
      expected,
    ),
  );
  it("does not infer former membership without an end date", () =>
    expect(wasMemberDuringSeason({ status: "former" }, 2024)).toBe(false));
  it("supports undated current legacy membership", () =>
    expect(wasMemberDuringSeason({ status: "currentMember" }, 2024)).toBe(
      true,
    ));
  it("rejects unknown season", () =>
    expect(wasMemberDuringSeason({ status: "current" }, undefined)).toBe(
      false,
    ));
});
describe("Award result accounting", () => {
  it("deduplicates a same-group duo and excludes the former member in 2029", () => {
    const data = fixture(),
      s = entityStatistics("group", "x", data, createIndex(data));
    expect(s).toMatchObject({
      directWins: 1,
      associatedMemberWins: 1,
      totalLegacyAwards: 2,
      directDaesangs: 1,
      associatedDaesangs: 0,
      legacyDaesangs: 1,
      seasonsWon: 1,
      bestSeason: 2024,
    });
    expect(
      entityStatistics("idol", "a", data, createIndex(data)).directWins,
    ).toBe(2);
    expect(
      entityStatistics("idol", "b", data, createIndex(data)).directWins,
    ).toBe(1);
    expect(data.awardResults).toHaveLength(3);
  });
  it("credits two different groups once each for a shared duo", () => {
    const data = fixture();
    data.memberships[1].groupId = "y";
    const index = createIndex(data);
    expect(
      entityStatistics("group", "x", data, index).associatedMemberWins,
    ).toBe(1);
    expect(
      entityStatistics("group", "y", data, index).associatedMemberWins,
    ).toBe(1);
  });
  it("deduplicates repeated membership periods and duplicate result reads", () => {
    const data = fixture();
    data.memberships.push({ ...data.memberships[0], id: "m3" });
    data.awardResults.push({ ...data.awardResults[0] });
    expect(
      entityStatistics("group", "x", data, createIndex(data)).totalLegacyAwards,
    ).toBe(2);
  });
  it("separates associated Daesangs and deduplicates a mixed group/member win", () => {
    const data = fixture();
    data.categories[0].tier = "daesang";
    data.awardResults[1].winners = [
      { id: "x", type: "group" },
      { id: "b", type: "idol" },
    ];
    data.awardResults[1].winnerIds = ["x", "b"];
    const s = entityStatistics("group", "x", data, createIndex(data));
    expect(s).toMatchObject({
      directDaesangs: 1,
      associatedDaesangs: 1,
      legacyDaesangs: 2,
      totalLegacyAwards: 2,
    });
  });
  it("uses typed winners when IDs collide across tables", () => {
    const data = fixture();
    data.groups.push({ id: "a", name: "Another artist" });
    expect(
      entityStatistics("group", "a", data, createIndex(data)).directWins,
    ).toBe(0);
  });
  it("matches nominations by slot and avoids win rates over 100%", () => {
    const data = fixture();
    data.nominations = [
      {
        id: "n",
        seasonId: "s24",
        categoryId: "c",
        entityId: "a",
        entityType: "idol",
      },
      {
        id: "n2",
        seasonId: "s24",
        categoryId: "c",
        entityId: "a",
        entityType: "idol",
      },
    ];
    expect(
      entityStatistics("idol", "a", data, createIndex(data)),
    ).toMatchObject({ nominations: 1, winRate: 100 });
    data.nominations[0].slot = "male";
    data.nominations[1].slot = "male";
    expect(entityStatistics("idol", "a", data, createIndex(data)).winRate).toBe(
      0,
    );
  });
  it("returns unknown win rate without nominations", () => {
    const data = fixture();
    expect(
      entityStatistics("idol", "a", data, createIndex(data)).winRate,
    ).toBeNull();
  });
  it("ranks ties equally and does not change persistent data", () => {
    const data = fixture(),
      before = JSON.stringify(data);
    buildStats(data);
    expect(
      rankEntities(
        [
          { name: "B", n: 3 },
          { name: "A", n: 3 },
          { name: "C", n: 1 },
        ],
        "n",
      ).map((r) => [r.name, r.rank]),
    ).toEqual([
      ["A", 1],
      ["B", 1],
      ["C", 3],
    ]);
    expect(JSON.stringify(data)).toBe(before);
  });
});
describe("Generic entity resolver", () => {
  it.each(Object.entries(ENTITY_TABLES))("resolves %s", (type, table) => {
    const data = fixture();
    data[table] = [
      {
        id: "target",
        title: "Title",
        name: "Name",
        stageName: type === "idol" ? "Stage" : undefined,
        photo: "https://example.com/photo.jpg",
        artistIds: ["a"],
      },
    ];
    const result = resolveFromIndex(type, "target", createIndex(data));
    expect(result).toMatchObject({
      id: "target",
      entityType: type,
      image: "https://example.com/photo.jpg",
    });
    expect(result.name).toBe(type === "idol" ? "Stage" : "Name");
  });
  it("keeps missing references visible as unavailable", () =>
    expect(
      resolveFromIndex("song", "missing", createIndex(fixture())).missing,
    ).toBe(true));
});
