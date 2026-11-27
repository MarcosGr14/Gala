const YOUTUBE_API = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_VIDEOS_API = "https://www.googleapis.com/youtube/v3/videos";
const MUSICBRAINZ_API = "https://musicbrainz.org/ws/2/recording/";
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_IMAGES = "https://image.tmdb.org/t/p/w500";

async function readJson(url) {
  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body.error?.message || body.status_message || "The search service is unavailable.");
  return body;
}

function youtubeDetailsUrl(videoId, key) {
  const url = new URL(YOUTUBE_VIDEOS_API);
  url.search = new URLSearchParams({ part: "snippet", id: videoId, key: key.trim() });
  return url;
}

export function cleanYouTubeSongTitle(title, artistNames = []) {
  const quoted = title.match(/["“‘']([^"”’']{1,100})["”’']/);
  let clean = quoted?.[1] || title;
  clean = clean
    .replace(/\s*[[(（][^\])）]*(?:official|music\s*video|performance\s*video|dance\s*practice|teaser|mv|m\/v)[^\])）]*[\])）]/gi, " ")
    .replace(/\s*(?:official\s*)?(?:music\s*video|performance\s*video|dance\s*practice|mv|m\/v|official\s*audio|lyric\s*video)\s*$/i, "")
    .replace(/\s*#(?:shorts|mv|musicvideo)\s*$/i, "")
    .trim();
  if (!quoted) {
    const parts = clean.split(/\s+[|–—-]\s+/).map((part) => part.trim()).filter(Boolean);
    if (parts.length > 1) {
      const names = artistNames.map((name) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")).filter((name) => name.length > 1);
      const first = parts[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
      if (names.some((name) => first === name || first.includes(name))) clean = parts.slice(1).join(" - ");
    }
  }
  return clean.replace(/\s+/g, " ").trim();
}

export function youtubeVideoId(value) {
  try {
    const url = new URL(String(value || ""));
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(host)) return "";
    const id = host === "youtu.be"
      ? url.pathname.split("/").filter(Boolean)[0]
      : url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
    return /^[A-Za-z0-9_-]{11}$/.test(id || "") ? id : "";
  } catch {
    return "";
  }
}

export function isYouTubeMusicUrl(value) {
  try {
    return new URL(String(value || "")).hostname.toLowerCase() === "music.youtube.com";
  } catch {
    return false;
  }
}

function normalizeMusicTitle(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

async function searchMusicBrainz(title) {
  const url = new URL(MUSICBRAINZ_API);
  url.search = new URLSearchParams({ query: `recording:"${title}"`, fmt: "json", limit: "5", inc: "releases" });
  const body = await readJson(url);
  return (body.recordings || []).map((recording) => {
    const release = (recording.releases || []).find((entry) => entry.status === "Official" && entry["release-group"]?.id)
      || (recording.releases || []).find((entry) => entry["release-group"]?.id);
    const releaseGroup = release?.["release-group"];
    const artistNames = (recording["artist-credit"] || [])
      .filter((credit) => typeof credit === "object" && credit.artist)
      .map((credit) => credit.artist.name || credit.name)
      .filter(Boolean);
    const releaseDate = recording["first-release-date"] || "";
    const cover = releaseGroup?.id ? `https://coverartarchive.org/release-group/${encodeURIComponent(releaseGroup.id)}/front-250` : "";
    const albumType = ({ Album: "album", EP: "mini", Single: "single" })[releaseGroup?.["primary-type"]] || "compilation";
    return {
      id: recording.id,
      title: recording.title || title,
      songTitle: recording.title || title,
      artistNames,
      albumTitle: releaseGroup?.title || "",
      releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(releaseDate) ? releaseDate : "",
      albumType,
      image: cover,
      source: "MusicBrainz",
      score: Number(recording.score) || 0,
    };
  }).filter((item) => normalizeMusicTitle(item.title) === normalizeMusicTitle(title));
}

export async function searchYouTubeVideos(query, key) {
  const videoId = youtubeVideoId(query);
  if (videoId) {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const url = new URL("https://www.youtube.com/oembed");
    url.search = new URLSearchParams({ url: videoUrl, format: "json" });
    const body = await readJson(url);
    let details = null;
    if (key?.trim()) {
      try {
        details = await readJson(youtubeDetailsUrl(videoId, key));
      } catch {
        // oEmbed still provides the title and thumbnail when the optional API key fails.
      }
    }
    const snippet = details?.items?.[0]?.snippet;
    const video = {
      id: videoId,
      title: snippet?.title || body.title || "",
      description: snippet?.description || "",
      image: snippet?.thumbnails?.high?.url || snippet?.thumbnails?.medium?.url || body.thumbnail_url || "",
      videoUrl,
      channelTitle: snippet?.channelTitle || body.author_name || "",
      source: "YouTube",
    };
    if (!isYouTubeMusicUrl(query)) return [video];

    const songTitle = cleanYouTubeSongTitle(video.title);
    try {
      const matches = await searchMusicBrainz(songTitle);
      if (matches.length) return matches.map((match) => ({
        ...match,
        description: video.description,
        video,
        source: "YouTube Music · MusicBrainz",
      }));
    } catch {
      // Keep the YouTube result available if the music catalog cannot be reached.
    }
    return [video];
  }
  if (!key?.trim()) throw new Error("Paste a YouTube link or enter a YouTube Data API key to search by name.");
  const url = new URL(YOUTUBE_API);
  url.search = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "10",
    videoEmbeddable: "true",
    q: query,
    key: key.trim(),
  });
  const body = await readJson(url);
  return (body.items || []).map((item) => ({
    id: item.id?.videoId,
    title: item.snippet?.title || "",
    description: item.snippet?.description || "",
    image: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || "",
    videoUrl: item.id?.videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(item.id.videoId)}` : "",
    channelTitle: item.snippet?.channelTitle || "",
    source: "YouTube",
  })).filter((item) => item.id);
}

async function tmdbRequest(path, key, params = {}) {
  if (!key?.trim()) throw new Error("Enter a TMDB API key to search.");
  const url = new URL(`${TMDB_API}${path}`);
  url.search = new URLSearchParams({ api_key: key.trim(), language: "ko-KR", ...params });
  return readJson(url);
}

export async function searchTmdb(query, kind, key, format = "drama") {
  const route = kind === "person" ? "/search/person" : format === "film" ? "/search/movie" : "/search/tv";
  const body = await tmdbRequest(route, key, { query, include_adult: "false" });
  return (body.results || []).map((item) => ({
    id: item.id,
    title: item.name || item.title || "",
    description: kind === "person" ? (item.known_for || []).map((work) => work.name || work.title).filter(Boolean).join(", ") : item.overview || "",
    image: item.profile_path || item.poster_path ? `${TMDB_IMAGES}${item.profile_path || item.poster_path}` : "",
    source: "TMDB",
  }));
}

export async function getTmdbPerson(id, key) {
  const person = await tmdbRequest(`/person/${encodeURIComponent(id)}`, key);
  return {
    id: person.id,
    title: person.name || "",
    description: person.biography || "",
    image: person.profile_path ? `${TMDB_IMAGES}${person.profile_path}` : "",
    gender: person.gender === 1 ? "female" : person.gender === 2 ? "male" : "",
    source: "TMDB",
  };
}
