import { DATA_TABLES } from "../src/data/catalog.js";
export function fixture() {
  const data = Object.fromEntries(DATA_TABLES.map((t) => [t, []]));
  data.seasons = [
    { id: "s24", year: 2024, title: "2024" },
    { id: "s26", year: 2026, title: "2026" },
    { id: "s29", year: 2029, title: "2029" },
  ];
  data.categories = [
    {
      id: "c",
      name: "Duo",
      displayName: "Duo",
      tier: "regular",
      family: "SPECIAL",
      winnerType: "idol",
      winnerStructure: "pair",
      active: true,
    },
    {
      id: "d",
      name: "Group",
      displayName: "Group",
      tier: "daesang",
      family: "DAESANG",
      winnerType: "group",
      winnerStructure: "single",
      active: true,
    },
  ];
  data.idols = [
    { id: "a", stageName: "Artist A", gender: "male" },
    { id: "b", stageName: "Artist B", gender: "female" },
  ];
  data.groups = [
    { id: "x", name: "Group X", type: "bg" },
    { id: "y", name: "Group Y", type: "gg" },
  ];
  data.memberships = [
    {
      id: "m1",
      idolId: "a",
      groupId: "x",
      startDate: "2024-01-01",
      endDate: "2026-12-31",
      status: "former",
    },
    {
      id: "m2",
      idolId: "b",
      groupId: "x",
      startDate: "2024-01-01",
      status: "current",
    },
  ];
  data.awardResults = [
    {
      id: "duo",
      seasonId: "s24",
      categoryId: "c",
      winnerType: "idol",
      winnerIds: ["a", "b"],
    },
    {
      id: "direct",
      seasonId: "s24",
      categoryId: "d",
      winnerType: "group",
      winnerIds: ["x"],
    },
    {
      id: "later",
      seasonId: "s29",
      categoryId: "c",
      winnerType: "idol",
      winnerIds: ["a"],
    },
  ];
  return data;
}
