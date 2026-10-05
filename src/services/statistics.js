import { winnerRefs } from "./entityService.js";

export function wasMemberDuringSeason(membership, season) {
  const year = Number(typeof season === "object" ? season?.year : season);
  if (!Number.isInteger(year)) return false;
  // Without an end date, a former membership cannot establish historical eligibility.
  if (
    ["former", "formerMember"].includes(membership.status) &&
    !membership.endDate
  )
    return false;
  const start = membership.startDate
    ? Number(membership.startDate.slice(0, 4))
    : -Infinity;
  const end = membership.endDate
    ? Number(membership.endDate.slice(0, 4))
    : Infinity;
  return start <= year && end >= year;
}
const unique = (rows) => [
  ...new Map(rows.map((row) => [row.id, row])).values(),
];
export function entityStatistics(type, id, data, index) {
  const awards = unique(data.awardResults);
  const directEntity = awards.filter((a) =>
    winnerRefs(a).some((r) => r.id === id && r.type === type),
  );
  const mediaAwards = ["idol", "group"].includes(type)
    ? awards.filter((award) =>
        winnerRefs(award).some((ref) => {
          if (!["song", "album"].includes(ref.type)) return false;
          const media = index[ref.type === "song" ? "songs" : "albums"]?.get(ref.id);
          return (
            media &&
            [...(media.artistIds || []), ...(media.groupIds || [])].includes(id)
          );
        }),
      )
    : [];
  const direct = unique([...directEntity, ...mediaAwards]);
  const directIds = new Set(direct.map((a) => a.id));
  const memberships =
    type === "group" ? data.memberships.filter((m) => m.groupId === id) : [];
  const associated = awards.filter(
    (a) =>
      !directIds.has(a.id) &&
      memberships.some(
        (m) =>
          wasMemberDuringSeason(m, index.seasons.get(a.seasonId)) &&
          winnerRefs(a).some((r) => r.type === "idol" && r.id === m.idolId),
      ),
  );
  const legacy = unique([...direct, ...associated]);
  const daesangs = (rows) =>
    rows.filter((a) => index.categories.get(a.categoryId)?.tier === "daesang")
      .length;
  const counts = new Map();
  for (const award of legacy)
    counts.set(award.seasonId, (counts.get(award.seasonId) || 0) + 1);
  const best = [...counts].sort(
    (a, b) =>
      b[1] - a[1] ||
      (index.seasons.get(b[0])?.year || 0) -
        (index.seasons.get(a[0])?.year || 0),
  )[0];
  const bestSeasonRows = best
    ? legacy.filter((a) => a.seasonId === best[0])
    : [];
  const categoriesAvailable = data.categories.filter(
    (category) => category.active !== false && !category.archivedAt,
  ).length;
  return {
    direct,
    associated,
    legacy,
    directWins: direct.length,
    directEntityWins: directEntity.length,
    associatedMemberWins: associated.length,
    totalLegacyAwards: legacy.length,
    directDaesangs: daesangs(direct),
    associatedDaesangs: daesangs(associated),
    legacyDaesangs: daesangs(legacy),
    winRate: categoriesAvailable && best
      ? Math.round(
          (new Set(bestSeasonRows.map((a) => a.categoryId)).size /
            categoriesAvailable) *
            100,
        )
      : null,
    seasonsWon: counts.size,
    bestSeason: best ? index.seasons.get(best[0])?.year : null,
    bestSeasonWins: best?.[1] || 0,
    categoriesWon: new Set(legacy.map((a) => a.categoryId)).size,
  };
}
export function rankEntities(rows, metric) {
  return rows
    .filter((row) => row[metric] > 0)
    .sort((a, b) => b[metric] - a[metric] || a.name.localeCompare(b.name))
    .map((row, i, sorted) => ({
      ...row,
      count: row[metric],
      rank: sorted.findIndex((r) => r[metric] === row[metric]) + 1,
    }));
}
