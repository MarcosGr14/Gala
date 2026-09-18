export const ENTITY_TABLES = {
  idol: "idols",
  group: "groups",
  song: "songs",
  album: "albums",
  musicVideo: "musicVideos",
  performance: "performances",
  outfit: "outfits",
  documentary: "documentaries",
};
export const DATA_TABLES = [
  "seasons",
  "categories",
  ...Object.values(ENTITY_TABLES),
  "memberships",
  "awardResults",
  "nominations",
  "auditLog",
];
export const FAMILIES = [
  "DAESANG",
  "VOCAL",
  "RAP",
  "DANCE",
  "VISUAL",
  "FASHION",
  "PERFORMANCE",
  "MUSIC",
  "POPULARITY",
  "ROOKIE",
  "ENTERTAINMENT",
  "SPECIAL",
];
export const STRUCTURES = [
  "single",
  "pair",
  "maleFemale",
  "multiple",
  "userGenderSlots",
];
export const WINNER_TYPES = [
  ...Object.keys(ENTITY_TABLES),
  "pair",
  "mixedEntity",
];
export function categoryDefaults(category, index = 0) {
  return {
    description: "",
    genderRestriction: "",
    sortOrder: index,
    active: true,
    createdAt: null,
    archivedAt: null,
    ...category,
  };
}
