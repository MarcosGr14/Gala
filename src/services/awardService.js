import { db } from '../data/db.js';
import { generateId } from '../utils/helpers.js';

// 1. Funciones matemáticas (Deduplicación)
export function calculateGroupLegacyStats(directAwards, memberAwards, groupMemberIds) {
  const directWins = directAwards.length;
  
  const uniqueMemberAwardIds = new Set();
  memberAwards.forEach(award => {
    const hasMember = award.winnerIds.some(id => groupMemberIds.includes(id));
    if (hasMember) {
      uniqueMemberAwardIds.add(award.id);
    }
  });

  const associatedMemberWins = uniqueMemberAwardIds.size;
  return {
    directWins,
    associatedMemberWins,
    totalLegacyAwards: directWins + associatedMemberWins
  };
}

// 2. Funciones de consulta básicas
export async function getAllCategories() {
  return await db.categories.toArray();
}

export async function getAllSeasons() {
  return await db.seasons.orderBy('year').reverse().toArray();
}

export async function getCategoryById(id) {
  return await db.categories.get(id);
}

export async function getSeasonById(id) {
  return await db.seasons.get(id);
}

// 3. Registro de Premios
export async function registerAwardResult(seasonId, categoryId, winnerIds, winnerType) {
  const awardResult = {
    id: generateId('award_res'),
    seasonId,
    categoryId,
    winnerIds, 
    winnerType,
    createdAt: new Date().toISOString()
  };
  
  await db.awardResults.add(awardResult);
  return awardResult;
}

// 4. Lectura de Premios para Perfiles
export async function getPopulatedAwardsByWinner(winnerId) {
  const rawAwards = await db.awardResults.where('winnerIds').equals(winnerId).toArray();
  
  const populated = await Promise.all(rawAwards.map(async (award) => {
    const category = await getCategoryById(award.categoryId);
    const season = await getSeasonById(award.seasonId);
    return {
      ...award,
      categoryName: category ? category.displayName : 'Unknown Category',
      tier: category ? category.tier : 'regular',
      year: season ? season.year : 'Unknown Year'
    };
  }));

  return populated.sort((a, b) => b.year - a.year);
}

// 5. Cálculo Dinámico de Legacy de Grupo (¡Lo nuevo!)
export async function getGroupLegacyStatsData(groupId) {
  // Premios directos
  const directAwards = await db.awardResults.where('winnerIds').equals(groupId).toArray();

  // Buscar a los miembros usando .equals() por seguridad
  const memberships = await db.memberships.where('groupId').equals(groupId).toArray();
  const groupMemberIds = memberships.map(m => m.idolId);

  // Premios de los miembros
  const memberAwardsArrays = await Promise.all(
    groupMemberIds.map(id => db.awardResults.where('winnerIds').equals(id).toArray())
  );
  
  // Aplanar y deduplicar
  const uniqueMemberAwardsMap = new Map();
  memberAwardsArrays.flat().forEach(award => uniqueMemberAwardsMap.set(award.id, award));
  const memberAwards = Array.from(uniqueMemberAwardsMap.values());

  return calculateGroupLegacyStats(directAwards, memberAwards, groupMemberIds);
}

// Asegúrate de tener esta importación arriba:
// import { getIdolById, getGroupById } from './artistService.js';

// ... (todo tu código existente) ...

export async function getPopulatedAwardsBySeason(seasonId) {
  // Traemos todos los premios de esta temporada
  const rawAwards = await db.awardResults.where('seasonId').equals(seasonId).toArray();
  
  // Importamos dinámicamente para evitar dependencias circulares complejas
  const { getIdolById, getGroupById } = await import('./artistService.js');

  const populated = await Promise.all(rawAwards.map(async (award) => {
    const category = await getCategoryById(award.categoryId);
    
    // Buscar la información real de los ganadores (Foto, Nombre)
    const winners = await Promise.all(award.winnerIds.map(async (id) => {
      return award.winnerType === 'idol' ? await getIdolById(id) : await getGroupById(id);
    }));

    return { ...award, category, winners };
  }));

  // ORDENAR: Premios regulares primero, Daesangs al final para el suspenso
  return populated.sort((a, b) => {
    if (a.category.tier === 'daesang' && b.category.tier !== 'daesang') return 1;
    if (a.category.tier !== 'daesang' && b.category.tier === 'daesang') return -1;
    return 0;
  });
}