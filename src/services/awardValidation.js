import { ENTITY_TABLES, STRUCTURES, WINNER_TYPES } from "../data/catalog.js";
export function validateAward(award, category, index) {
  if (!index.seasons.has(award.seasonId))
    throw new Error("Choose an existing season.");
  if (!category || category.active === false)
    throw new Error("Choose an active category.");
  if (
    !STRUCTURES.includes(category.winnerStructure) ||
    !WINNER_TYPES.includes(category.winnerType)
  )
    throw new Error("Unsupported category configuration.");
  const refs =
    award.winners ||
    award.winnerIds?.map((id) => ({
      id,
      type: award.winnerType === "pair" ? "idol" : award.winnerType,
    }));
  if (!Array.isArray(refs) || !refs.length)
    throw new Error("Choose at least one winner.");
  if (new Set(refs.map((r) => r.type + ":" + r.id)).size !== refs.length)
    throw new Error("A winner cannot appear twice in the same result.");
  if (category.winnerStructure === "pair" && refs.length !== 2)
    throw new Error("Choose exactly two different winners.");
  if (
    !["pair", "multiple"].includes(category.winnerStructure) &&
    refs.length !== 1
  )
    throw new Error("This result requires one winner.");
  if (
    category.winnerStructure === "maleFemale" &&
    !["male", "female"].includes(award.slot)
  )
    throw new Error("Choose a male or female slot.");
  if (
    category.winnerStructure === "userGenderSlots" &&
    !(category.userSlots || ["user1", "user2"]).some((user) =>
      ["male", "female"].some((g) => award.slot === user + "_" + g),
    )
  )
    throw new Error("Choose a valid user and gender slot.");
  if (
    !["maleFemale", "userGenderSlots"].includes(category.winnerStructure) &&
    award.slot
  )
    throw new Error("This category does not use slots.");
  const gender = ["maleFemale", "userGenderSlots"].includes(
    category.winnerStructure,
  )
    ? award.slot.split("_").at(-1)
    : category.genderRestriction;
  for (const ref of refs) {
    if (
      !ENTITY_TABLES[ref.type] ||
      !index[ENTITY_TABLES[ref.type]]?.has(ref.id)
    )
      throw new Error("A selected winner no longer exists.");
    const requiredType =
      category.winnerType === "pair" ? "idol" : category.winnerType;
    if (requiredType !== "mixedEntity" && ref.type !== requiredType)
      throw new Error("Winner type does not match the category.");
    const row = index[ENTITY_TABLES[ref.type]].get(ref.id);
    const rowGender =
      row.gender ||
      (row.type === "bg" ? "male" : row.type === "gg" ? "female" : "");
    if (gender && rowGender !== gender)
      throw new Error(
        "Set the matching gender on the selected artist before awarding this category.",
      );
    if (row.archivedAt || row.active === false)
      throw new Error("Choose an active winner.");
  }
  return refs;
}
