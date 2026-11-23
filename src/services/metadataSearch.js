const YOUTUBE_API = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_VIDEOS_API = "https://www.googleapis.com/youtube/v3/videos";
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
  const match = String(value || "").match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i);
  return match?.[1] || "";
}

export async function searchYouTubeVideos(query, key) {
  const videoId = youtubeVideoId(query);
  if (videoId) {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const url = new URL("https://www.youtube.com/oembed");
    url.search = new URLSearchParams({ url: videoUrl, format: "json" });
    const body = await readJson(url);
    const details = key?.trim() ? await readJson(youtubeDetailsUrl(videoId, key)) : null;
    const snippet = details?.items?.[0]?.snippet;
    return [{
      id: videoId,
      title: snippet?.title || body.title || "",
      description: snippet?.description || "",
      image: snippet?.thumbnails?.high?.url || snippet?.thumbnails?.medium?.url || body.thumbnail_url || "",
      videoUrl,
      channelTitle: snippet?.channelTitle || body.author_name || "",
      source: "YouTube",
    }];
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
