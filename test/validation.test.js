import { describe, it, expect } from "vitest";
import { fixture } from "./fixtures.js";
import { createIndex } from "../src/services/entityService.js";
import { validateAward } from "../src/services/awardValidation.js";
import { validateRecord } from "../src/services/catalogService.js";
import { escapeHtml, safeUrl } from "../src/utils/helpers.js";
const result = (winners, slot = "") => ({
  seasonId: "s24",
  categoryId: "c",
  winners,
  slot,
});
const a = { id: "a", type: "idol" },
  b = { id: "b", type: "idol" };
describe("Winner structures", () => {
  it.each([
    ["single", [a], ""],
    ["pair", [a, b], ""],
    ["multiple", [a, b], ""],
    ["maleFemale", [a], "male"],
    ["maleFemale", [b], "female"],
    ["userGenderSlots", [a], "user1_male"],
  ])("accepts %s", (structure, winners, slot) => {
    const data = fixture();
    expect(
      validateAward(
        result(winners, slot),
        { ...data.categories[0], winnerStructure: structure },
        createIndex(data),
      ),
    ).toEqual(winners);
  });
  it.each([
    ["single", [a, b], ""],
    ["pair", [a], ""],
    ["pair", [a, a], ""],
    ["multiple", [], ""],
    ["maleFemale", [b], "male"],
    ["maleFemale", [a], ""],
    ["userGenderSlots", [a], "unknown_male"],
    ["single", [a], "male"],
  ])("rejects invalid %s", (structure, winners, slot) => {
    const data = fixture();
    expect(() =>
      validateAward(
        result(winners, slot),
        { ...data.categories[0], winnerStructure: structure },
        createIndex(data),
      ),
    ).toThrow();
  });
  it("accepts a mixed result with explicitly typed entities", () => {
    const data = fixture();
    expect(
      validateAward(
        result([a, { id: "x", type: "group" }]),
        { ...data.categories[0], winnerType: "mixedEntity" },
        createIndex(data),
      ),
    ).toHaveLength(2);
  });
  it("rejects incompatible types and missing IDs", () => {
    const data = fixture();
    for (const refs of [
      [a, { id: "missing", type: "idol" }],
      [a, { id: "x", type: "group" }],
    ])
      expect(() =>
        validateAward(result(refs), data.categories[0], createIndex(data)),
      ).toThrow();
  });
  it("validates a category gender restriction", () => {
    const data = fixture();
    expect(() =>
      validateAward(
        result([a]),
        {
          ...data.categories[0],
          winnerStructure: "single",
          genderRestriction: "female",
        },
        createIndex(data),
      ),
    ).toThrow(/gender/);
  });
});
describe("Catalog validation and safe rendering", () => {
  it.each(["javascript:alert(1)", "data:text/html,test", "//evil.example/"])(
    "rejects unsafe URL %s",
    (url) => expect(safeUrl(url)).toBe(""),
  );
  it("escapes markup from user content", () =>
    expect(escapeHtml('<img onerror="bad">')).toBe(
      "&lt;img onerror=&quot;bad&quot;&gt;",
    ));
  it("validates dates and former member end dates", () => {
    const index = createIndex(fixture());
    expect(() =>
      validateRecord(
        "membership",
        { idolId: "a", groupId: "x", status: "former" },
        index,
      ),
    ).toThrow(/end date/);
    expect(() =>
      validateRecord(
        "membership",
        {
          idolId: "a",
          groupId: "x",
          status: "current",
          startDate: "2024-02-30",
        },
        index,
      ),
    ).toThrow(/Invalid/);
    expect(() =>
      validateRecord(
        "membership",
        {
          idolId: "a",
          groupId: "x",
          status: "former",
          startDate: "2026-01-01",
          endDate: "2024-01-01",
        },
        index,
      ),
    ).toThrow(/End date/);
    expect(() =>
      validateRecord(
        "membership",
        {
          idolId: "a",
          groupId: "x",
          status: "current",
          startDate: "2024-01-01",
        },
        index,
      ),
    ).not.toThrow();
  });
  it("validates musical relations", () =>
    expect(() =>
      validateRecord(
        "song",
        { title: "Song", artistIds: ["missing"] },
        createIndex(fixture()),
      ),
    ).toThrow(/missing/));
});
