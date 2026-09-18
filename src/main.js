import "./css/variables.css";
import "./css/global.css";
import "./css/layout.css";
import "./css/cards.css";
import "./css/forms.css";
import { db } from "./data/db.js";
import { loadSnapshot } from "./services/entityService.js";
import { renderHome } from "./views/home.js";
import { renderDirectory } from "./views/directory.js";
import { renderGala } from "./views/gala.js";
import { renderProfile } from "./views/profile.js";
import { renderRecords } from "./views/records.js";
import { renderAdmin } from "./views/admin.js";
import { page, heading, empty } from "./components/ui.js";
const app = document.querySelector("#app");
app.innerHTML =
  '<a href="#view-container" class="skip-link">Skip to content</a><header class="site-header"><a class="brand" href="#home" aria-label="KPop Gala home"><span class="brand-mark">✦</span><span>KPOP GALA<small>HALL OF FAME</small></span></a><nav aria-label="Main navigation">' +
  [
    ["home", "Home"],
    ["gala", "Gala"],
    ["artists", "Artists"],
    ["groups", "Groups"],
    ["records", "Records"],
    ["admin", "Admin"],
  ]
    .map(
      ([route, label]) =>
        '<a href="#' + route + '" data-route="' + route + '">' + label + "</a>",
    )
    .join("") +
  '</nav><span class="header-edition">EST. 2024</span></header><main id="view-container" tabindex="-1"></main><footer class="site-footer"><a class="brand" href="#home">✦ KPOP GALA</a><span>A living archive of unforgettable music.</span><span>2024 — PRESENT</span></footer><div id="toasts" aria-live="polite"></div>';
let request = 0;
document.querySelector(".skip-link").addEventListener("click", (event) => {
  event.preventDefault();
  document.querySelector("main").focus();
});
async function navigate() {
  const current = ++request,
    container = document.querySelector("main");
  container.setAttribute("aria-busy", "true");
  try {
    const [route = "home", part, id] = (location.hash.slice(1) || "home")
      .split("/")
      .map(decodeURIComponent);
    const data = await loadSnapshot();
    if (current !== request) return;
    let view;
    if (route === "home") view = renderHome(data);
    else if (route === "artists" || route === "groups")
      view = renderDirectory(route === "groups" ? "group" : "idol", data);
    else if (route === "gala") view = renderGala(data, part);
    else if (route === "profile") view = renderProfile(part, id, data);
    else if (route === "records") view = renderRecords(data);
    else if (route === "admin") view = renderAdmin(data);
    else
      view = page(
        heading("ARCHIVE", "Page not found.") +
          empty(
            "This page is not in the archive.",
            "Use the navigation to continue exploring.",
          ),
      );
    container.replaceChildren(view);
    document.querySelectorAll("[data-route]").forEach((link) => {
      if (link.dataset.route === route)
        link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    document.title =
      (route === "home"
        ? "Hall of Fame"
        : route.charAt(0).toUpperCase() + route.slice(1)) + " · KPop Gala";
  } catch (error) {
    container.replaceChildren(
      page(heading("SOMETHING WENT WRONG", "The archive could not load.")),
    );
    const detail = document.createElement("p");
    detail.className = "page";
    detail.textContent = error.message;
    container.append(detail);
  } finally {
    if (current === request) container.removeAttribute("aria-busy");
  }
}
window.addEventListener("hashchange", () => {
  navigate();
  window.scrollTo({ top: 0 });
});
window.addEventListener("catalog-changed", () => {
  const view = document.querySelector("main > .page");
  if (view?.refresh) view.refresh().catch(() => navigate());
  else navigate();
});
document.addEventListener(
  "error",
  (event) => {
    if (event.target instanceof HTMLImageElement) {
      const parent = event.target.parentElement;
      if (parent?.classList.contains("photo")) {
        const fallback = document.createElement("span");
        fallback.className = "monogram";
        fallback.textContent = (event.target.alt || "KG")
          .slice(0, 2)
          .toUpperCase();
        parent.replaceChildren(fallback);
      } else event.target.hidden = true;
    }
  },
  true,
);
db.on("versionchange", () => db.close());
db.open()
  .then(navigate)
  .catch(() => navigate());
