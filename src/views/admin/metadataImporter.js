import { modal } from "../../components/ui.js";
import { escapeHtml as e } from "../../utils/helpers.js";
import { getTmdbPerson, searchTmdb, searchYouTubeVideos } from "../../services/metadataSearch.js";

const keys = { youtube: "gala.youtubeApiKey", tmdb: "gala.tmdbApiKey" };

export function openMetadataImporter(type, onSelect, format = "drama") {
  const isYoutube = ["song", "musicVideo"].includes(type);
  const provider = isYoutube ? "youtube" : "tmdb";
  const apiKey = sessionStorage.getItem(keys[provider]) || "";
  const keyLabel = provider === "youtube" ? "YouTube API key" : "TMDB API key";
  const content = document.createElement("div");
  content.className = "metadata-importer";
  content.innerHTML = `<p class="small">Choose a match to fill the form, then review it before saving.</p>
    <form class="metadata-search-form"><label>${isYoutube ? "YouTube API key (optional for a video link)" : keyLabel}<input name="apiKey" type="password" autocomplete="off" ${isYoutube ? "" : "required"}></label>
    <label>Search<input name="query" type="search" required placeholder="${isYoutube ? "Song, artist or YouTube link" : type === "drama" ? "Drama or series title" : "Actor name"}"></label>
    <button class="button" type="submit">Search</button><span class="small" data-import-status role="status"></span></form>
    <div class="metadata-results" data-import-results></div>
    <p class="small metadata-key-note">The key is kept in this browser tab only. It is not added to backups.</p>`;
  const form = content.querySelector("form");
  form.elements.apiKey.value = apiKey;
  const dialog = modal(provider === "youtube" ? "Find on YouTube" : "Find on TMDB", content);
  form.onsubmit = async (event) => {
    event.preventDefault();
    const query = form.elements.query.value.trim();
    const key = form.elements.apiKey.value.trim();
    if (!query || (!key && !isYoutube)) return;
    if (key) sessionStorage.setItem(keys[provider], key);
    const searchButton = form.querySelector("button[type=submit]");
    const status = content.querySelector("[data-import-status]");
    const results = content.querySelector("[data-import-results]");
    searchButton.disabled = true;
    status.textContent = "Searching…";
    results.replaceChildren();
    try {
      const personType = type === "idol";
      const items = isYoutube
        ? await searchYouTubeVideos(query, key)
        : await searchTmdb(query, personType ? "person" : "media", key, format);
      status.textContent = items.length ? `${items.length} results` : "No matches found.";
      for (const item of items) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "metadata-result";
        if (item.image) {
          const image = document.createElement("img");
          image.src = item.image;
          image.alt = "";
          image.loading = "lazy";
          button.append(image);
        } else {
          const placeholder = document.createElement("span");
          placeholder.className = "metadata-result-placeholder";
          placeholder.textContent = "No poster";
          button.append(placeholder);
        }
        const copy = document.createElement("span");
        copy.className = "metadata-result-copy";
        copy.innerHTML = `<strong>${e(item.title)}</strong><span>${e(item.description || "No description")}</span><small>${e(item.source)}</small>`;
        button.append(copy);
        button.onclick = async () => {
          button.disabled = true;
          try {
            const selected = personType ? await getTmdbPerson(item.id, key) : item;
            onSelect(selected);
            dialog.close();
          } catch (error) {
            status.textContent = error.message;
            button.disabled = false;
          }
        };
        results.append(button);
      }
    } catch (error) {
      status.textContent = error.message;
    } finally {
      searchButton.disabled = false;
    }
  };
  return dialog;
}
