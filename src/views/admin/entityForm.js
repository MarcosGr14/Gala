import {
  saveArtist,
  isArchived,
} from "../../services/artistManagementService.js";
import { createMembershipEditor } from "./membershipEditor.js";
import { FORMS } from "../../data/fields.js";
import { ENTITY_TABLES } from "../../data/catalog.js";
import {
  loadSnapshot,
  createIndex,
  resolveFromIndex,
} from "../../services/entityService.js";
import { saveRecord } from "../../services/catalogService.js";
import { autocomplete } from "../../components/autocomplete.js";
import { modal, toast } from "../../components/ui.js";
import { escapeHtml as e } from "../../utils/helpers.js";
import { openMetadataImporter } from "./metadataImporter.js";
import { cleanYouTubeSongTitle, youtubeVideoId } from "../../services/metadataSearch.js";
import { saveSongWithMusicVideo } from "../../services/songImportService.js";
export function pickerItems(types, data, includeArchived = false) {
  const index = createIndex(data);
  return types.flatMap((type) =>
    (data[ENTITY_TABLES[type] || FORMS[type]?.table] || [])
      .filter((row) => includeArchived || !isArchived(row))
      .map((row) =>
        ENTITY_TABLES[type]
          ? resolveFromIndex(type, row.id, index)
          : {
              ...row,
              name:
                row.displayName || row.title || row.name || String(row.year),
              entityType: type,
              subtitle: type,
              image: "",
            },
      ),
  );
}
export async function openEntityForm(type, record = null, onSaved = () => {}, defaults = {}) {
  const definition = FORMS[type],
    data = await loadSnapshot();
  const form = document.createElement("form");
  form.className = "entity-form";
  const pickers = new Map();
  let pendingYoutubeVideo = null;
  const videoOption = document.createElement("label");
  videoOption.className = "metadata-video-option";
  videoOption.hidden = type !== "song";
  videoOption.innerHTML = '<input type="checkbox" checked name="importYoutubeVideo"><span>Add the matching YouTube video and link it to this song</span>';
  const importButton = document.createElement("button");
  importButton.type = "button";
  importButton.className = "button secondary metadata-import-button";
  importButton.textContent = type === "drama" ? "Find title on TMDB" : type === "song" ? "Find song and video on YouTube" : type === "musicVideo" ? "Find on YouTube" : "Find actor on TMDB";
  importButton.hidden = !["song", "musicVideo", "drama"].includes(type) && !(type === "idol" && ["actor", "actress"].includes(record?.personType || defaults.personType));
  importButton.onclick = () => openMetadataImporter(type, (item) => {
    if (type === "song") {
      const artistNames = [...data.idols.map((row) => row.stageName), ...data.groups.map((row) => row.name)].filter(Boolean);
      const title = cleanYouTubeSongTitle(item.title, artistNames);
      const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
      const channel = normalize(String(item.channelTitle || "").replace(/\s*[-|·]?\s*topic\s*$/i, "").replace(/\s+official\s*$/i, ""));
      const catalogArtists = pickerItems(["idol", "group"], data);
      let artists = catalogArtists.filter((artist) => normalize(artist.name) === channel);
      if (!artists.length) {
        const titlePrefix = normalize(String(item.title || "").split(/\s+[|–—-]\s+|["“‘']|\s*[\[(]/)[0]);
        artists = catalogArtists.filter((artist) => {
          const name = normalize(artist.name);
          return name.length > 1 && titlePrefix.includes(name);
        });
      }
      if (artists.length === 1) pickers.get("artistIds")?.setValue(artists);
      const videoId = youtubeVideoId(item.videoUrl);
      const existingVideo = data.musicVideos.find((row) => youtubeVideoId(row.videoUrl) === videoId);
      pendingYoutubeVideo = {
        ...(existingVideo || {}),
        title: item.title,
        thumbnail: item.image,
        videoUrl: item.videoUrl,
        description: item.description,
        id: existingVideo?.id,
      };
      const linkedVideo = existingVideo && pickerItems(["musicVideo"], data, true).find((row) => row.id === existingVideo.id);
      pickers.get("musicVideoId")?.setValue(linkedVideo ? [linkedVideo] : []);
      videoOption.hidden = false;
      const titleField = form.elements.namedItem("title");
      if (titleField && title) titleField.value = title;
      for (const [key, value] of Object.entries({ coverImage: item.image, description: item.description })) {
        const field = form.elements.namedItem(key);
        if (field && value !== undefined && value !== null) field.value = value;
      }
      return;
    }
    if (type === "musicVideo") {
      const songTitle = cleanYouTubeSongTitle(item.title, [...data.idols.map((row) => row.stageName), ...data.groups.map((row) => row.name)]);
      const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
      const matchingSongs = pickerItems(["song"], data).filter((song) => normalize(song.name) === normalize(songTitle));
      if (matchingSongs.length === 1) pickers.get("songId")?.setValue(matchingSongs);
    }
    const assignments = type === "song"
      ? { title: cleanYouTubeSongTitle(item.title), coverImage: item.image, description: item.description }
      : type === "musicVideo"
        ? { title: item.title, thumbnail: item.image, videoUrl: item.videoUrl, description: item.description }
        : type === "drama"
          ? { title: item.title, image: item.image, description: item.description }
          : { stageName: item.title, photo: item.image, description: item.description, gender: item.gender };
    for (const [key, value] of Object.entries(assignments)) {
      const field = form.elements.namedItem(key);
      if (field && value !== undefined && value !== null) {
        field.value = value;
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  }, form.elements.namedItem("format")?.value || "drama");
  form.append(importButton);
  if (type === "song") form.append(videoOption);
  for (const field of definition.fields) {
    if (field.types) {
      const items = pickerItems(field.types, data),
        ids = field.multiple
          ? record?.[field.key] || []
          : [record?.[field.key]];
      const picker = autocomplete({
        label: field.label + (field.required ? " *" : ""),
        items,
        multiple: field.multiple,
        onChange: (selected) => {
          if (type === "song" && field.key === "musicVideoId" && pendingYoutubeVideo && selected[0]?.id !== pendingYoutubeVideo.id) {
            pendingYoutubeVideo = null;
            videoOption.hidden = true;
          }
        },
        value: pickerItems(field.types, data, true).filter(
          (i) =>
            ids.includes(i.id) &&
            (type !== "nomination" ||
              field.key !== "entityId" ||
              !record?.entityType ||
              i.entityType === record.entityType),
        ),
      });
      pickers.set(field.key, picker);
      form.append(picker.element);
      continue;
    }
    const label = document.createElement("label"),
      id = "field-" + crypto.randomUUID();
    label.htmlFor = id;
    label.textContent = field.label + (field.required ? " *" : "");
    const input = document.createElement(
      field.options
        ? "select"
        : field.key === "description"
          ? "textarea"
          : "input",
    );
    if (type === "category" && field.key === "family") {
      const list = document.createElement("datalist");
      list.id = "category-families";
      [...new Set(data.categories.map((category) => category.family).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b))
        .forEach((family) => list.append(new Option(family, family)));
      input.setAttribute("list", list.id);
      form.append(list);
    }
    input.id = id;
    input.name = field.key;
    input.required = !!field.required;
    if (field.type === "number") {
      input.step = 1;
      if (type === "drama" && ["seasons", "episodes"].includes(field.key)) input.min = 1;
    }
    if (field.type === "range") {
      input.min = 0;
      input.max = 100;
      input.step = 1;
      input.value = record?.[field.key] ?? 50;
      label.dataset.range = field.key;
      label.append(document.createElement("output"));
      label.querySelector("output").textContent = input.value + "%";
      input.oninput = () => {
        label.querySelector("output").textContent = input.value + "%";
        updatePhotoPreview();
      };
    }
    if (field.options) {
      const options =
        field.key === "photoFit" && type === "group"
          ? [...field.options].reverse()
          : field.options;
      input.innerHTML = options
        .map(
          (option) =>
            '<option value="' +
            e(option) +
            '">' +
            e(option || "Not specified") +
            "</option>",
        )
        .join("");
    } else if (input.tagName === "INPUT") input.type = field.type || "text";
    let value = field.key === "photoFit" ? "cover" : record?.[field.key] ?? defaults[field.key];
    const personType = defaults.personType || record?.personType;
    if (field.key === "gender" && !value && personType)
      value = personType === "actor" ? "male" : personType === "actress" ? "female" : "";
    if (field.key === "userSlots")
      value = Array.isArray(value) ? value.join(", ") : "user1, user2";
    if (value !== undefined && value !== null) {
      if (field.type === "checkbox") input.checked = !!value;
      else input.value = value;
    }
    if (field.key === "year") {
      input.min = 2024;
      input.max = 9999;
      if (!record) input.value = new Date().getFullYear();
    }
    if (field.key === "sortOrder" && !record) input.value = 0;
    label.append(input);
    form.append(label);
  }
  const personTypeInput = form.elements.namedItem("personType");
  personTypeInput?.addEventListener("change", () => {
    importButton.hidden = !["actor", "actress"].includes(personTypeInput.value);
    importButton.textContent = "Find actor on TMDB";
  });
  personTypeInput?.addEventListener("change", () => {
    const gender = form.elements.namedItem("gender");
    if (gender?.value) return;
    if (personTypeInput.value === "actor") gender.value = "male";
    if (personTypeInput.value === "actress") gender.value = "female";
  });
  function updatePhotoPreview() {
    const preview = form.querySelector("[data-photo-preview]");
    if (!preview) return;
    const image = preview.querySelector("img"),
      src = form.elements.namedItem("photo")?.value.trim(),
      x = form.elements.namedItem("photoPositionX")?.value ?? 50,
      y = form.elements.namedItem("photoPositionY")?.value ?? 50,
      fit = "cover";
    if (src) image.src = src;
    else image.removeAttribute("src");
    image.hidden = !src;
    preview.classList.toggle("fit-contain", fit === "contain");
    image.style.objectPosition = `${x}% ${y}%`;
  }
  if (["idol", "group"].includes(type)) {
    const preview = document.createElement("div");
    preview.className = "photo-adjust-preview";
    preview.dataset.photoPreview = "";
    preview.innerHTML = '<div class="photo-preview-frame"><img alt="Photo framing preview" hidden></div><p>Adjust the image position; the photo fills the frame.</p>';
    form.append(preview);
    form.elements.namedItem("photo")?.addEventListener("input", updatePhotoPreview);
    form.elements.namedItem("photoFit")?.addEventListener("change", updatePhotoPreview);
    updatePhotoPreview();
  }
  const membershipEditor =
    record && ["idol", "group"].includes(type)
      ? createMembershipEditor(type, record, data)
      : null;
  if (membershipEditor) form.append(membershipEditor.element);
  const actions = document.createElement("div");
  actions.className = "form-footer";
  actions.innerHTML =
    '<p class="form-error" role="alert"></p><button class="button" type="submit">Save ' +
    e(definition.label.toLowerCase()) +
    "</button>";
  form.append(actions);
  const dialog = modal((record ? "Edit " : "Add ") + definition.label, form);
  form.onsubmit = async (event) => {
    event.preventDefault();
    const button = actions.querySelector("button");
    button.disabled = true;
    try {
      const input = record ? { ...record } : {};
      for (const field of definition.fields) {
        if (field.types) {
          const selected = pickers.get(field.key).getValue();
          input[field.key] = field.multiple
            ? selected.map((r) => r.id)
            : selected[0]?.id || null;
          if (type === "nomination" && field.key === "entityId")
            input.entityType = selected[0]?.entityType;
        } else {
          const element = form.elements.namedItem(field.key);
          input[field.key] =
            field.type === "checkbox"
              ? element.checked
              : ["number", "range"].includes(field.type)
                ? element.value === "" && field.type === "number" ? null : Number(element.value)
                : element.value.trim();
          if (field.key === "userSlots")
            input[field.key] = input[field.key]
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
        }
      }
      const saved = type === "song" && pendingYoutubeVideo && form.elements.namedItem("importYoutubeVideo")?.checked
        ? await saveSongWithMusicVideo(input, pendingYoutubeVideo)
        : ["idol", "group"].includes(type)
        ? await saveArtist(type, input, membershipEditor?.getChanges() || [], undefined, membershipEditor?.getDeletions() || [])
        : await saveRecord(type, input);
      dialog.close();
      toast(definition.label + " saved.");
      await onSaved(saved);
      window.dispatchEvent(new Event("catalog-changed"));
    } catch (error) {
      actions.querySelector(".form-error").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
  return dialog;
}
