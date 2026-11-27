import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabase } from "../src/data/db.js";
import { saveRecord } from "../src/services/catalogService.js";
import { searchYouTubeVideos, youtubeVideoId } from "../src/services/metadataSearch.js";
import { saveSongWithMusicVideo } from "../src/services/songImportService.js";

let database;

beforeEach(async () => {
  database = createDatabase("song-import-test-" + crypto.randomUUID());
  await database.open();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await database.delete();
});

describe("YouTube Music song import", () => {
  it("reads shared YouTube Music URLs and enriches exact track matches", async () => {
    const fetch = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        title: 'NewJeans (뉴진스) "Super Shy" Official MV',
        author_name: "HYBE LABELS",
        thumbnail_url: "https://img.youtube.com/video.jpg",
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        recordings: [{
          id: "recording-id",
          title: "Super Shy",
          score: 100,
          "first-release-date": "2023-07-07",
          "artist-credit": [{ artist: { name: "NewJeans" } }],
          releases: [{
            status: "Official",
            "release-group": {
              id: "release-group-id",
              title: "Get Up",
              "primary-type": "EP",
            },
          }],
        }],
      })));

    const link = "https://music.youtube.com/watch?si=share-token&v=abcdefghijk";
    const [song] = await searchYouTubeVideos(link, "");

    expect(youtubeVideoId(link)).toBe("abcdefghijk");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(song).toMatchObject({
      title: "Super Shy",
      songTitle: "Super Shy",
      artistNames: ["NewJeans"],
      albumTitle: "Get Up",
      albumType: "mini",
      releaseDate: "2023-07-07",
      source: "YouTube Music · MusicBrainz",
      video: { videoUrl: "https://www.youtube.com/watch?v=abcdefghijk" },
    });
  });

  it("saves the song, new album and video together", async () => {
    const group = await saveRecord("group", { name: "NewJeans", type: "gg" }, database);
    const result = await saveSongWithMusicVideo({
      title: "Super Shy",
      artistIds: [group.id],
      releaseDate: "2023-07-07",
      coverImage: "https://images.example/cover.jpg",
    }, {
      title: "NewJeans - Super Shy",
      videoUrl: "https://www.youtube.com/watch?v=abcdefghijk",
      thumbnail: "https://images.example/video.jpg",
    }, database, {
      title: "Get Up",
      albumType: "mini",
      releaseDate: "2023-07-07",
      coverImage: "https://images.example/cover.jpg",
    });

    const album = await database.albums.get(result.albumId);
    const video = await database.musicVideos.get(result.musicVideoId);
    expect(album).toMatchObject({ title: "Get Up", artistIds: [group.id], albumType: "mini" });
    expect(video).toMatchObject({ songId: result.id, videoUrl: "https://www.youtube.com/watch?v=abcdefghijk" });
    expect(await database.songs.get(result.id)).toMatchObject({ albumId: album.id, musicVideoId: video.id });
  });

  it("saves track and album when the user opts out of adding its video", async () => {
    const result = await saveSongWithMusicVideo({ title: "Super Shy", artistIds: [] }, null, database, {
      title: "Get Up",
      albumType: "mini",
    });

    expect(await database.albums.get(result.albumId)).toMatchObject({ title: "Get Up" });
    expect(result.musicVideoId).toBeNull();
    expect(await database.musicVideos.count()).toBe(0);
  });

  it("does not allow a video already assigned to another song to be linked again", async () => {
    const firstSong = await saveSongWithMusicVideo({ title: "First song", artistIds: [] }, {
      title: "First video",
      videoUrl: "https://www.youtube.com/watch?v=abcdefghijk",
    }, database);

    await expect(saveSongWithMusicVideo({
      title: "Second song",
      artistIds: [],
      musicVideoId: firstSong.musicVideoId,
    }, null, database)).rejects.toThrow(/already linked/);
    expect(await database.songs.count()).toBe(1);
  });
});
