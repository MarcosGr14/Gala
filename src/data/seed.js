export const initialCategories = [
  { id: 'cat_daesang_soty', name: 'Song of the Year', displayName: 'Song of the Year', tier: 'daesang', winnerType: 'song', winnerStructure: 'single', family: 'DAESANG' },
  { id: 'cat_daesang_goty', name: 'Group of the Year', displayName: 'Group of the Year', tier: 'daesang', winnerType: 'group', winnerStructure: 'single', family: 'DAESANG' },
  { id: 'cat_reg_male_vocal', name: 'Best Male Vocal', displayName: 'Best Male Vocal', tier: 'regular', winnerType: 'idol', winnerStructure: 'single', family: 'VOCAL' },
  { id: 'cat_reg_best_duo', name: 'Best Duo', displayName: 'Best Duo', tier: 'regular', winnerType: 'idol', winnerStructure: 'pair', family: 'SPECIAL' }
];

export const initialSeasons = [
  { id: 'season_2024', year: 2024, title: 'KPop Gala 2024', description: 'The Beginning' },
  { id: 'season_2025', year: 2025, title: 'KPop Gala 2025', description: 'The Expansion' },
  { id: 'season_2026', year: 2026, title: 'KPop Gala 2026', description: 'Current Edition' }
];

export async function seedDatabase(db) {
  if (await db.categories.count() === 0) {
    console.log('Seeding initial categories...');
    await db.categories.bulkAdd(initialCategories);
  }
  
  if (await db.seasons.count() === 0) {
    console.log('Seeding initial seasons...');
    await db.seasons.bulkAdd(initialSeasons);
  }
}