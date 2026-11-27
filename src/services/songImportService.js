import { db } from "../data/db.js";
import { DATA_TABLES } from "../data/catalog.js";
import { generateId } from "../utils/helpers.js";
import { createIndex } from "./entityService.js";
import { auditEntry, validateRecord } from "./catalogService.js";
import { youtubeVideoId } from "./metadataSearch.js";

export async function saveSongWithMusicVideo(songInput, videoInput = null, database = db, albumInput = null) {
  return database.transaction(
    "rw",
    [...DATA_TABLES.map((table) => database.table(table)), database.restorePoints],
    async () => {
      const data = Object.fromEntries(await Promise.all(
        DATA_TABLES.map(async (table) => [table, await database.table(table).toArray()]),
      ));
      const beforeSong = songInput.id ? data.songs.find((row) => row.id === songInput.id) : null;
      const beforeVideo = videoInput?.id ? data.musicVideos.find((row) => row.id === videoInput.id) : null;
      if (songInput.id && !beforeSong) throw new Error("Song no longer exists.");
      if (videoInput?.id && !beforeVideo) throw new Error("Music video no longer exists.");

      const songId = beforeSong?.id || generateId("song");
      const videoId = videoInput ? beforeVideo?.id || generateId("musicVideo") : songInput.musicVideoId || null;
      const linkedVideo = videoId && data.musicVideos.find((row) => row.id === videoId);
      if (linkedVideo?.songId && linkedVideo.songId !== songId)
        throw new Error("This YouTube video is already linked to another song.");
      if (videoId && data.songs.some((row) => row.id !== songId && row.musicVideoId === videoId))
        throw new Error("This music video is already linked to another song.");

      const youtubeId = videoInput ? youtubeVideoId(videoInput.videoUrl) : "";
      if (youtubeId && data.musicVideos.some((row) => row.id !== videoId && youtubeVideoId(row.videoUrl) === youtubeId))
        throw new Error("This YouTube video is already in the catalog. Choose its existing entry instead.");

      let effectiveSongInput = { ...songInput };
      let album = null;
      if (!effectiveSongInput.albumId && albumInput?.title) {
        const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
        const artistIds = [...new Set(effectiveSongInput.artistIds || [])].sort();
        const existingAlbum = data.albums.find((row) => normalize(row.title) === normalize(albumInput.title)
          && [...new Set(row.artistIds || [])].sort().join("|") === artistIds.join("|"));
        if (existingAlbum) effectiveSongInput.albumId = existingAlbum.id;
        else {
          album = {
            id: generateId("album"),
            title: albumInput.title,
            artistIds,
            releaseDate: albumInput.releaseDate || null,
            albumType: albumInput.albumType || "album",
            coverImage: albumInput.coverImage || effectiveSongInput.coverImage || "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          effectiveSongInput.albumId = album.id;
        }
      }

      const now = new Date().toISOString();
      const previousVideo = beforeSong?.musicVideoId && beforeSong.musicVideoId !== videoId
        ? data.musicVideos.find((row) => row.id === beforeSong.musicVideoId)
        : null;
      const detachedVideo = previousVideo?.songId === songId
        ? { ...previousVideo, songId: null, updatedAt: now }
        : null;
      const song = {
        ...beforeSong,
        ...effectiveSongInput,
        id: songId,
        musicVideoId: videoId,
        createdAt: beforeSong?.createdAt || now,
        updatedAt: now,
      };
      const video = videoInput ? {
          ...beforeVideo,
          ...videoInput,
          id: videoId,
          songId,
          createdAt: beforeVideo?.createdAt || now,
          updatedAt: now,
        } : null;
      const nextData = {
        ...data,
        albums: album ? [...data.albums, album] : data.albums,
        songs: [...data.songs.filter((row) => row.id !== songId), song],
        musicVideos: video || detachedVideo
          ? [...data.musicVideos.filter((row) => row.id !== videoId && row.id !== detachedVideo?.id), ...(detachedVideo ? [detachedVideo] : []), ...(video ? [video] : [])]
          : data.musicVideos,
      };
      const index = createIndex(nextData);
      if (album) validateRecord("album", album, index);
      validateRecord("song", song, index);
      if (video) validateRecord("musicVideo", video, index);

      if (album) await database.albums.put(album);
      await database.songs.put(song);
      if (detachedVideo) await database.musicVideos.put(detachedVideo);
      if (video) await database.musicVideos.put(video);
      const auditEntries = [
        auditEntry(beforeSong ? "song changed" : "song created", "song", song.id, beforeSong, song),
      ];
      if (album) auditEntries.push(auditEntry("album created", "album", album.id, null, album));
      if (video) {
        auditEntries.push(auditEntry(beforeVideo ? "musicVideo changed" : "musicVideo created", "musicVideo", video.id, beforeVideo, video));
      }
      if (detachedVideo)
        auditEntries.push(auditEntry("musicVideo changed", "musicVideo", detachedVideo.id, previousVideo, detachedVideo));
      await database.auditLog.bulkAdd(auditEntries);
      return song;
    },
  );
}
