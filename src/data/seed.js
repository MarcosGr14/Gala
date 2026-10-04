import { categoryDefaults } from "./catalog.js";

const specs = [
  ["Song of the Year", "song", "DAESANG", "cat_daesang_soty"],
  ["Group of the Year", "group", "DAESANG", "cat_daesang_goty"],
  ["Boy Group of the Year", "group", "DAESANG"],
  ["Girl Group of the Year", "group", "DAESANG"],
  ["Album of the Year", "album", "DAESANG"],
  ["Most Consistent Group", "group", "DAESANG"],
  ["Fan Choice", "mixedEntity", "DAESANG"],
  ["Best Fanservice", "group", "DAESANG"],
  ["Best Male Vocal", "idol", "VOCAL", "cat_reg_male_vocal"],
  ["Female Vocal", "idol", "VOCAL"],
  ["Male Rapper", "idol", "RAP"],
  ["Female Rapper", "idol", "RAP"],
  ["Female Dancer", "idol", "DANCE"],
  ["Male Dancer", "idol", "DANCE"],
  ["Best Music Video", "musicVideo", "MUSIC"],
  ["Best MV Outfit", "outfit", "FASHION"],
  ["Best Performance", "performance", "PERFORMANCE"],
  ["Best Female Soloist", "idol", "MUSIC"],
  ["Best Male Soloist", "idol", "MUSIC"],
  ["Idol Actor", "idol", "ENTERTAINMENT"],
  ["Idol Actress", "idol", "ENTERTAINMENT"],
  ["Best Choreography", "performance", "DANCE"],
  ["Best OST", "song", "MUSIC"],
  ["Female Visual", "idol", "VISUAL"],
  ["Male Visual", "idol", "VISUAL"],
  ["Idol of the Year", "idol", "SPECIAL", null, "maleFemale"],
  ["Best B-Side", "song", "MUSIC"],
  ["Best Look Change", "idol", "FASHION"],
  ["Best Visual Concept", "musicVideo", "VISUAL"],
  ["Cover of the Year", "performance", "PERFORMANCE"],
  ["Bias of the Year", "idol", "POPULARITY", null, "userGenderSlots"],
  ["Discovery of the Year", "mixedEntity", "SPECIAL"],
  ["Surprise of the Year", "mixedEntity", "SPECIAL"],
  ["Addictive Song", "song", "MUSIC"],
  ["Best Producer", "idol", "MUSIC"],
  ["Best Lyrics", "song", "MUSIC"],
  ["Best Comeback Look", "idol", "FASHION"],
  ["Best Maknae", "idol", "SPECIAL"],
  ["Best Duo", "idol", "SPECIAL", "cat_reg_best_duo", "pair"],
  ["Most Improved Idol", "idol", "SPECIAL"],
  ["Female Rookie", "group", "ROOKIE"],
  ["Male Rookie", "group", "ROOKIE"],
  ["Best Collaboration", "mixedEntity", "MUSIC", null, "multiple"],
  ["Ship of the Year", "idol", "SPECIAL", null, "pair"],
  ["Favorite Boy Group", "group", "POPULARITY"],
  ["Favorite Girl Group", "group", "POPULARITY"],
  ["Favorite Idol", "idol", "POPULARITY"],
  ["Best Documentary", "documentary", "ENTERTAINMENT"],
  ["International Group", "group", "SPECIAL", null, "multiple"],
  ["Best Concept Villain", "mixedEntity", "VISUAL"],
  ["Fashion Icon", "idol", "FASHION"],
  ["Musical Icon Idol", "idol", "MUSIC"],
  ["Influencer of the Year", "idol", "ENTERTAINMENT"],
];
export const initialCategories = specs.map(
  ([name, winnerType, family, id, winnerStructure = "single"], i) =>
    categoryDefaults(
      {
        id: id || "cat_" + name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "_"),
        name,
        displayName: name,
        winnerType,
        family,
        winnerStructure,
        tier: family === "DAESANG" ? "daesang" : "regular",
        genderRestriction: /female|girl|actress/i.test(name)
          ? "female"
          : /male|boy|actor/i.test(name)
            ? "male"
            : "",
        ...(winnerStructure === "userGenderSlots"
          ? { userSlots: ["user1", "user2"] }
          : {}),
      },
      i,
    ),
);
export const initialSeasons = [2024, 2025, 2026].map((year) => ({
  id: "season_" + year,
  year,
  title: "KPop Gala " + year,
  description: year === 2024 ? "The beginning of a legacy." : "",
  active: true,
}));
const archiveTables = [
  "seasons", "categories", "idols", "groups", "songs", "albums",
  "musicVideos", "performances", "outfits", "documentaries",
  "memberships", "awardResults", "nominations", "auditLog",
];

async function seedPublishedArchive(db) {
  if (typeof window === "undefined" || !import.meta.env?.PROD) return false;
  let archive;
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}archive-backup.json`);
    if (!response.ok) return false;
    archive = await response.json();
  } catch (error) {
    console.error("No se pudo cargar el archivo inicial publicado.", error);
    return false;
  }
  for (const table of archiveTables) {
    if (Array.isArray(archive[table]) && archive[table].length)
      await db.table(table).bulkAdd(archive[table]);
  }
  return true;
}

export async function seedDatabase(db) {
  if (await seedPublishedArchive(db)) return;
  if (!(await db.categories.count()))
    await db.categories.bulkAdd(initialCategories);
  if (!(await db.seasons.count())) await db.seasons.bulkAdd(initialSeasons);
}
