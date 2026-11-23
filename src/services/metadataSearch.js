const YOUTUBE_API = "https://www.googleapis.com/youtube/v3/search";
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_IMAGES = "https://image.tmdb.org/t/p/w500";

async function readJson(url) {
  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body.error?.message || body.status_message || "The search service is unavailable.");
  return body;
}

export async function searchYouTubeVideos(query, key) {
  const pasted = query.match(/^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#/].*)?$/i);
  if (pasted) {
    const videoUrl = `https://www.youtube.com/watch?v=${pasted[1]}`;
    const url = new URL("https://www.youtube.com/oembed");
    url.search = new URLSearchParams({ url: videoUrl, format: "json" });
    const body = await readJson(url);
    return [{
      id: pasted[1],
      title: body.title || "",
      description: "",
      image: body.thumbnail_url || "",
      videoUrl,
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
