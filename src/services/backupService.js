import { db } from '../data/db.js';

export async function exportDatabaseToJson() {
  const backupData = {
    schemaVersion: db.verno,
    appVersion: '1.0.0',
    createdAt: new Date().toISOString(),
    seasons: await db.seasons.toArray(),
    categories: await db.categories.toArray(),
    idols: await db.idols.toArray(),
    groups: await db.groups.toArray(),
    memberships: await db.memberships.toArray(),
    songs: await db.songs.toArray(),
    albums: await db.albums.toArray(),
    awardResults: await db.awardResults.toArray(),
    nominations: await db.nominations.toArray(),
    auditLog: await db.auditLog.toArray()
  };

  // Crear un archivo virtual descargable
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `kpop_gala_backup_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export async function importDatabaseFromJson(jsonString) {
  try {
    const data = JSON.parse(jsonString);

    if (!data.schemaVersion || !data.awardResults) {
      throw new Error("Invalid backup file structure.");
    }

    // Transacción atómica para reemplazar los datos con seguridad
    await db.transaction('rw', db.seasons, db.categories, db.idols, db.groups, db.memberships, db.songs, db.albums, db.awardResults, db.nominations, db.auditLog, async () => {
      // Limpiar tablas actuales
      await db.seasons.clear();
      await db.categories.clear();
      await db.idols.clear();
      await db.groups.clear();
      await db.memberships.clear();
      await db.songs.clear();
      await db.albums.clear();
      await db.awardResults.clear();
      await db.nominations.clear();
      await db.auditLog.clear();

      // Restaurar con datos nuevos
      if (data.seasons?.length) await db.seasons.bulkAdd(data.seasons);
      if (data.categories?.length) await db.categories.bulkAdd(data.categories);
      if (data.idols?.length) await db.idols.bulkAdd(data.idols);
      if (data.groups?.length) await db.groups.bulkAdd(data.groups);
      if (data.memberships?.length) await db.memberships.bulkAdd(data.memberships);
      if (data.songs?.length) await db.songs.bulkAdd(data.songs);
      if (data.albums?.length) await db.albums.bulkAdd(data.albums);
      if (data.awardResults?.length) await db.awardResults.bulkAdd(data.awardResults);
      if (data.nominations?.length) await db.nominations.bulkAdd(data.nominations);
      if (data.auditLog?.length) await db.auditLog.bulkAdd(data.auditLog);
    });

    return true;
  } catch (error) {
    console.error("Restore failed:", error);
    throw error;
  }
}