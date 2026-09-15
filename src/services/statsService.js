import { db } from '../data/db.js';
import { getGroupLegacyStatsData, getAllCategories } from './awardService.js';
import { getAllIdols, getAllGroups } from './artistService.js';

export async function getLeaderboardsData() {
  const idols = await getAllIdols();
  const groups = await getAllGroups();
  const categories = await getAllCategories();
  const allAwards = await db.awardResults.toArray();

  // Mapear qué categorías son Daesangs
  const daesangCategoryIds = categories.filter(c => c.tier === 'daesang').map(c => c.id);

  // 1. MOST DIRECT WINS (IDOLS)
  let idolStats = idols.map(idol => {
    const directWins = allAwards.filter(a => a.winnerIds.includes(idol.id)).length;
    const daesangs = allAwards.filter(a => a.winnerIds.includes(idol.id) && daesangCategoryIds.includes(a.categoryId)).length;
    return { ...idol, entityType: 'idol', count: directWins, daesangs };
  });
  idolStats = idolStats.filter(i => i.count > 0).sort((a, b) => b.count - a.count).slice(0, 5);

  // 2. MOST LEGACY AWARDS (GROUPS)
  let groupStats = await Promise.all(groups.map(async group => {
    const stats = await getGroupLegacyStatsData(group.id);
    const daesangs = allAwards.filter(a => a.winnerIds.includes(group.id) && daesangCategoryIds.includes(a.categoryId)).length;
    return { ...group, entityType: 'group', count: stats.totalLegacyAwards, daesangs };
  }));
  groupStats = groupStats.filter(g => g.count > 0).sort((a, b) => b.count - a.count).slice(0, 5);

  // 3. MOST DAESANGS (COMBINED)
  // Juntamos a todos (Idols y Grupos) y los ordenamos por su cantidad de Daesangs
  const allEntities = [...idols.map(i => ({...i, entityType: 'idol'})), ...groups.map(g => ({...g, entityType: 'group'}))];
  
  let daesangStats = allEntities.map(entity => {
    const daesangsCount = allAwards.filter(a => a.winnerIds.includes(entity.id) && daesangCategoryIds.includes(a.categoryId)).length;
    return { ...entity, count: daesangsCount };
  });
  daesangStats = daesangStats.filter(e => e.count > 0).sort((a, b) => b.count - a.count).slice(0, 5);

  return { idolStats, groupStats, daesangStats };
}