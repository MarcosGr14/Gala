import {
  loadSnapshot,
  createIndex,
  resolveFromIndex,
} from "./entityService.js";
import { entityStatistics, rankEntities } from "./statistics.js";
export function buildStats(data, index = createIndex(data)) {
  return ["idol", "group"].flatMap((type) =>
    data[type === "idol" ? "idols" : "groups"].map((row) => ({
      ...resolveFromIndex(type, row.id, index),
      ...entityStatistics(type, row.id, data, index),
    })),
  );
}
export async function getLeaderboardsData() {
  const data = await loadSnapshot(),
    rows = buildStats(data);
  return {
    idolStats: rankEntities(
      rows.filter((r) => r.entityType === "idol"),
      "directWins",
    ),
    groupStats: rankEntities(
      rows.filter((r) => r.entityType === "group"),
      "totalLegacyAwards",
    ),
    daesangStats: rankEntities(rows, "directDaesangs"),
  };
}
