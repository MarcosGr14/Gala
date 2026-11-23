import { db } from "../data/db.js";
import { DATA_TABLES } from "../data/catalog.js";
import { generateId } from "../utils/helpers.js";
import { createIndex } from "./entityService.js";
import { auditEntry, validateRecord } from "./catalogService.js";
import { youtubeVideoId } from "./metadataSearch.js";

export async function saveSongWithMusicVideo(songInput, videoInput, database = db) {
  return database.transaction(
    "rw",
    [...DATA_TABLES.map((table) => database.table(table)), database.restorePoints],
    async () => {
      const data = Object.fromEntries(await Promise.all(
        DATA_TABLES.map(async (table) => [table, await database.table(table).toArray()]),
      ));
      const beforeSong = songInput.id ? data.songs.find((row) => row.id === songInput.id) : null;
      const beforeVideo = videoInput.id ? data.musicVideos.find((row) => row.id === videoInput.id) : null;
      if (songInput.id && !beforeSong) throw new Error("Song no longer exists.");
      if (videoInput.id && !beforeVideo) throw new Error("Music video no longer exists.");

      const songId = beforeSong?.id || generateId("song");
      const videoId = beforeVideo?.id || generateId("musicVideo");
      if (beforeVideo?.songId && beforeVideo.songId !== songId)
        throw new Error("This YouTube video is already linked to another song.");
      if (data.songs.some((row) => row.id !== songId && row.musicVideoId === videoId))
        throw new Error("This music video is already linked to another song.");

      const youtubeId = youtubeVideoId(videoInput.videoUrl);
      if (youtubeId && data.musicVideos.some((row) => row.id !== videoId && youtubeVideoId(row.videoUrl) === youtubeId))
        throw new Error("This YouTube video is already in the catalog. Choose its existing entry instead.");

      const now = new Date().toISOString();
      const previousVideo = beforeSong?.musicVideoId && beforeSong.musicVideoId !== videoId
        ? data.musicVideos.find((row) => row.id === beforeSong.musicVideoId)
        : null;
      const detachedVideo = previousVideo?.songId === songId
        ? { ...previousVideo, songId: null, updatedAt: now }
        : null;
      const song = {
        ...beforeSong,
        ...songInput,
        id: songId,
        musicVideoId: videoId,
        createdAt: beforeSong?.createdAt || now,
        updatedAt: now,
      };
      const video = {
        ...beforeVideo,
        ...videoInput,
        id: videoId,
        songId,
        createdAt: beforeVideo?.createdAt || now,
        updatedAt: now,
      };
      const nextData = {
        ...data,
        songs: [...data.songs.filter((row) => row.id !== songId), song],
        musicVideos: [...data.musicVideos.filter((row) => row.id !== videoId && row.id !== detachedVideo?.id), ...(detachedVideo ? [detachedVideo] : []), video],
      };
      const index = createIndex(nextData);
      validateRecord("song", song, index);
      validateRecord("musicVideo", video, index);

      await database.songs.put(song);
      if (detachedVideo) await database.musicVideos.put(detachedVideo);
      await database.musicVideos.put(video);
      const auditEntries = [
        auditEntry(beforeSong ? "song changed" : "song created", "song", song.id, beforeSong, song),
        auditEntry(beforeVideo ? "musicVideo changed" : "musicVideo created", "musicVideo", video.id, beforeVideo, video),
      ];
      if (detachedVideo)
        auditEntries.push(auditEntry("musicVideo changed", "musicVideo", detachedVideo.id, previousVideo, detachedVideo));
      await database.auditLog.bulkAdd(auditEntries);
      return song;
    },
  );
}
