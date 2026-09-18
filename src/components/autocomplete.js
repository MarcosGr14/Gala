import { photo } from "./ui.js";
import { escapeHtml as e } from "../utils/helpers.js";
export function autocomplete({
  label,
  items = [],
  multiple = false,
  value = [],
  onChange = () => {},
}) {
  const root = document.createElement("div"),
    id = "search-" + crypto.randomUUID();
  root.className = "autocomplete";
  root.innerHTML = `<label for="${id}">${e(label)}</label><div class="selected-chips"></div><input id="${id}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-list" autocomplete="off" placeholder="Search by name…"><div id="${id}-list" class="suggestions" role="listbox" hidden></div>`;
  const input = root.querySelector("input"),
    list = root.querySelector(".suggestions"),
    chips = root.querySelector(".selected-chips");
  let selected = [...value],
    matches = [],
    active = -1;
  const key = (item) => item.entityType + ":" + item.id;
  function close() {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }
  function renderChips() {
    chips.innerHTML = selected
      .map(
        (item, i) =>
          `<button type="button" class="chip" data-index="${i}" aria-label="Remove ${e(item.name)}">${e(item.name)} <span>×</span></button>`,
      )
      .join("");
    chips.querySelectorAll("button").forEach(
      (b) =>
        (b.onclick = () => {
          selected.splice(Number(b.dataset.index), 1);
          renderChips();
          onChange([...selected]);
          input.focus();
        }),
    );
  }
  function choose(item) {
    selected = multiple ? [...selected, item] : [item];
    renderChips();
    input.value = "";
    close();
    onChange([...selected]);
    input.focus();
  }
  function render() {
    matches = items
      .filter(
        (item) =>
          !selected.some((s) => key(s) === key(item)) &&
          (item.name + " " + item.subtitle)
            .toLowerCase()
            .includes(input.value.toLowerCase()),
      )
      .sort((a, b) => {
        const query = input.value.trim().toLowerCase();
        return Number(b.name.toLowerCase() === query) - Number(a.name.toLowerCase() === query)
          || a.name.localeCompare(b.name);
      })
      .slice(0, 30);
    active = -1;
    list.innerHTML = matches.length
      ? matches
          .map(
            (item, i) =>
              `<div id="${id}-option-${i}" class="suggestion" role="option" aria-selected="false" data-index="${i}">${photo(item)}<span><strong>${e(item.name)}</strong><small>${e(item.subtitle)} · ${e(item.entityType)}</small></span></div>`,
          )
          .join("")
      : '<p class="small">No matches. Add the entry in Admin or use a creation shortcut below.</p>';
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    input.removeAttribute("aria-activedescendant");
    list.querySelectorAll("[data-index]").forEach(
      (option) =>
        (option.onmousedown = (event) => {
          event.preventDefault();
          choose(matches[Number(option.dataset.index)]);
        }),
    );
  }
  input.oninput = render;
  input.onfocus = render;
  input.onblur = () => setTimeout(close, 150);
  input.onkeydown = (event) => {
    if (event.key === "Escape") {
      close();
      event.stopPropagation();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (list.hidden) render();
      if (!matches.length) return;
      active = active < 0 ? (event.key === 'ArrowDown' ? 0 : matches.length - 1)
        : (active + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length;
      list
        .querySelectorAll("[role=option]")
        .forEach((el, i) =>
          el.setAttribute("aria-selected", String(i === active)),
        );
      input.setAttribute("aria-activedescendant", id + "-option-" + active);
      list.children[active]?.scrollIntoView({ block: "nearest" });
    }
    if (event.key === "Enter" && !list.hidden && active >= 0) {
      event.preventDefault();
      choose(matches[active]);
    }
  };
  renderChips();
  return {
    element: root,
    getValue: () => [...selected],
    setItems: (next) => {
      items = next;
    },
    setValue: (next) => {
      selected = next;
      renderChips();
    },
  };
}
