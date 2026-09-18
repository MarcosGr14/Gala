import { FAMILIES, WINNER_TYPES, STRUCTURES } from "./catalog.js";
const text = (key, label, required = false) => ({ key, label, required });
const select = (key, label, options) => ({ key, label, options });
const date = (key, label) => ({ key, label, type: "date" });
const url = (key, label) => ({ key, label, type: "url" });
const ref = (key, label, types, multiple = false, required = false) => ({
  key,
  label,
  types,
  multiple,
  required,
});
const artists = () => ref("artistIds", "Artists", ["idol", "group"], true);
const media = [url("image", "Image URL"), text("description", "Description")];
export const FORMS = {
  idol: {
    label: "Idol",
    table: "idols",
    fields: [
      text("stageName", "Stage name", true),
      text("realName", "Real name"),
      text("nationality", "Nationality"),
      date("birthDate", "Birth date"),
      select("gender", "Gender", ["", "female", "male", "other"]),
      url("photo", "Photo URL"),
      date("debutDate", "Debut"),
      select("status", "Status", ["active", "inactive", "retired"]),
      text("roles", "Roles"),
      text("description", "Biography"),
    ],
  },
  group: {
    label: "Group",
    table: "groups",
    fields: [
      text("name", "Name", true),
      select("type", "Type", ["gg", "bg", "mixed", "band", "subunit"]),
      url("photo", "Photo URL"),
      date("debutDate", "Debut"),
      select("status", "Status", ["active", "hiatus", "disbanded"]),
      text("description", "Biography"),
    ],
  },
  song: {
    label: "Song",
    table: "songs",
    fields: [
      text("title", "Title", true),
      artists(),
      ref("albumId", "Album", ["album"]),
      date("releaseDate", "Release date"),
      url("coverImage", "Cover URL"),
      ref("musicVideoId", "Music video", ["musicVideo"]),
      { key: "isBside", label: "B-side", type: "checkbox" },
      { key: "isOST", label: "OST", type: "checkbox" },
    ],
  },
  album: {
    label: "Album",
    table: "albums",
    fields: [
      text("title", "Title", true),
      artists(),
      date("releaseDate", "Release date"),
      url("coverImage", "Cover URL"),
      select("albumType", "Album type", [
        "album",
        "mini",
        "single",
        "compilation",
        "live",
      ]),
    ],
  },
  musicVideo: {
    label: "Music video",
    table: "musicVideos",
    fields: [
      text("title", "Title", true),
      ref("songId", "Song", ["song"]),
      date("releaseDate", "Release date"),
      url("thumbnail", "Thumbnail URL"),
      url("videoUrl", "Video URL"),
      text("concept", "Concept"),
    ],
  },
  performance: {
    label: "Performance",
    table: "performances",
    fields: [
      text("eventName", "Event name", true),
      text("eventType", "Event type"),
      artists(),
      ref("groupIds", "Groups", ["group"], true),
      date("date", "Date"),
      ref("songIds", "Songs", ["song"], true),
      url("videoUrl", "Video URL"),
      ...media,
    ],
  },
  outfit: {
    label: "Outfit",
    table: "outfits",
    fields: [
      text("title", "Title", true),
      ref("idolId", "Idol", ["idol"], false, true),
      ref("musicVideoId", "Music video", ["musicVideo"]),
      ref("songId", "Song", ["song"]),
      ...media,
    ],
  },
  documentary: {
    label: "Documentary",
    table: "documentaries",
    fields: [
      text("title", "Title", true),
      text("type", "Type"),
      artists(),
      ref("groupIds", "Groups", ["group"], true),
      date("releaseDate", "Release date"),
      ...media,
    ],
  },
  membership: {
    label: "Membership",
    table: "memberships",
    fields: [
      ref("idolId", "Idol", ["idol"], false, true),
      ref("groupId", "Group", ["group"], false, true),
      text("role", "Role"),
      date("startDate", "From"),
      date("endDate", "Until"),
      select("status", "Status", ["current", "former", "temporary", "subunit"]),
    ],
  },
  category: {
    label: "Category",
    table: "categories",
    fields: [
      text("name", "Name", true),
      text("displayName", "Display name", true),
      text("description", "Description"),
      select("tier", "Tier", ["regular", "daesang"]),
      select("family", "Family", FAMILIES),
      select("winnerType", "Winner type", WINNER_TYPES),
      select("winnerStructure", "Winner structure", STRUCTURES),
      select("genderRestriction", "Gender restriction", ["", "male", "female"]),
      { key: "sortOrder", label: "Display order", type: "number" },
      text("userSlots", "User slots (comma separated)"),
    ],
  },
  season: {
    label: "Season",
    table: "seasons",
    fields: [
      { key: "year", label: "Year", type: "number", required: true },
      text("title", "Title", true),
      text("description", "Description"),
      url("image", "Banner URL"),
    ],
  },
  nomination: {
    label: "Nomination",
    table: "nominations",
    fields: [
      ref("seasonId", "Season", ["season"], false, true),
      ref("categoryId", "Category", ["category"], false, true),
      ref(
        "entityId",
        "Nominee",
        [
          "idol",
          "group",
          "song",
          "album",
          "musicVideo",
          "performance",
          "outfit",
          "documentary",
        ],
        false,
        true,
      ),
      text("slot", "Slot (if applicable)"),
    ],
  },
};
