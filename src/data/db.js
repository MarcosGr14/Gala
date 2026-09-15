import Dexie from 'dexie';
import { seedDatabase } from './seed.js';

export const db = new Dexie('KPopGalaDatabase');

db.version(1).stores({
  seasons: 'id, year',
  categories: 'id, tier, winnerType, family',
  idols: 'id, stageName, status',
  groups: 'id, name, status',
  memberships: 'id, idolId, groupId, status', 
  songs: 'id, title, albumId',
  albums: 'id, title',
  musicVideos: 'id, songId',
  performances: 'id, date, eventName',
  outfits: 'id, idolId, musicVideoId',
  awardResults: 'id, seasonId, categoryId, *winnerIds, winnerType',
  nominations: 'id, seasonId, categoryId, entityId',
  auditLog: 'id, timestamp, entityType, entityId'
});

db.on('populate', async () => {
  console.log('Database initialized for the first time.');
  await seedDatabase(db); 
});