import { escapeHtml as e, safeUrl } from "../utils/helpers.js";
export function page(html, className = "") {
  const el = document.createElement("section");
  el.className = "page " + className;
  el.innerHTML = html;
  return el;
}
export function heading(kicker, title, description = "") {
  return `<header class="page-heading"><p class="eyebrow">${e(kicker)}</p><h1>${e(title)}</h1>${description ? '<p class="lede">' + e(description) + "</p>" : ""}</header>`;
}
export function empty(
  title = "The story starts here.",
  detail = "Add your first entry in Admin to bring this archive to life.",
) {
  return `<div class="empty"><span class="empty-star" aria-hidden="true">✦</span><h3>${e(title)}</h3><p>${e(detail)}</p><a class="text-link" href="#admin">Open Admin ↗</a></div>`;
}
export function photo(entity, className = "") {
  const src = safeUrl(entity.image);
  return `<div class="photo ${className}">${src ? '<img src="' + e(src) + '" alt="' + e(entity.name) + '" loading="lazy" decoding="async">' : '<span class="monogram" aria-hidden="true">' + e(entity.name?.slice(0, 2).toUpperCase() || "KG") + "</span>"}</div>`;
}
export function entityHref(entity) {
  return (
    "#profile/" +
    encodeURIComponent(entity.entityType) +
    "/" +
    encodeURIComponent(entity.id)
  );
}
export function entityCard(entity) {
  return `<a class="entity-card" href="${entityHref(entity)}">${photo(entity)}<div class="card-copy"><span class="eyebrow">${e(entity.subtitle)}</span><h3>${e(entity.name)}</h3><span class="text-link">Explore archive ↗</span></div></a>`;
}
export function awardCard(award) {
  const isDaesang = award.tier === "daesang";
  return `<article class="award-card ${isDaesang ? "daesang" : ""}"><div class="award-images">${award.winners.map((w) => '<a href="' + entityHref(w) + '">' + photo(w) + "</a>").join("")}</div><div class="card-copy"><div class="split"><span class="badge">${isDaesang ? "✦ DAESANG" : e(award.category.family)}</span><span class="small">${e(award.year)}</span></div><h3>${e(award.categoryName)}</h3><p>${award.winners.map((w) => '<a href="' + entityHref(w) + '">' + e(w.name) + "</a>").join(" & ")}</p>${award.slot ? '<span class="small">' + e(award.slot) + "</span>" : ""}</div></article>`;
}
export function metric(value, label) {
  return `<div class="metric"><strong>${e(value ?? "—")}</strong><span>${e(label)}</span></div>`;
}
export function toast(message, error = false) {
  let region = document.querySelector("#toasts");
  if (!region) {
    region = document.createElement("div");
    region.id = "toasts";
    region.setAttribute("aria-live", "polite");
    document.body.append(region);
  }
  const el = document.createElement("div");
  el.className = "toast" + (error ? " error" : "");
  el.textContent = message;
  region.append(el);
  setTimeout(() => el.remove(), 6000);
}
export function modal(title, content) {
  const previous = document.activeElement,
    dialog = document.createElement("dialog");
  dialog.className = "modal";
  dialog.innerHTML =
    '<div class="modal-top"><h2 id="modal-' +
    crypto.randomUUID() +
    '">' +
    e(title) +
    '</h2><button class="icon-button" aria-label="Close dialog">×</button></div><div class="modal-content"></div>';
  dialog.setAttribute("aria-labelledby", dialog.querySelector("h2").id);
  dialog.querySelector(".modal-content").append(content);
  document.body.append(dialog);
  dialog.querySelector(".icon-button").onclick = () => dialog.close();
  dialog.addEventListener(
    "close",
    () => {
      dialog.remove();
      previous?.focus();
    },
    { once: true },
  );
  dialog.showModal();
  return dialog;
}
export async function confirmModal(title, body, action = "Confirm") {
  return new Promise((resolve) => {
    const content = document.createElement("div");
    content.innerHTML =
      "<p>" +
      e(body) +
      '</p><div class="actions"><button class="button secondary" data-cancel>Cancel</button><button class="button" data-confirm>' +
      e(action) +
      "</button></div>";
    const dialog = modal(title, content);
    let confirmed = false;
    content.querySelector("[data-cancel]").onclick = () => dialog.close();
    content.querySelector("[data-confirm]").onclick = () => {
      confirmed = true;
      dialog.close();
    };
    dialog.addEventListener("close", () => resolve(confirmed), { once: true });
  });
}
