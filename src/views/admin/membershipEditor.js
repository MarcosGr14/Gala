import { autocomplete } from "../../components/autocomplete.js";
import { createIndex, resolveFromIndex } from "../../services/entityService.js";
import { isArchived } from "../../services/artistManagementService.js";
import { escapeHtml as e } from "../../utils/helpers.js";

export function createMembershipEditor(type, artist, data) {
  const owner = type === "idol" ? "idolId" : "groupId",
    partnerType = type === "idol" ? "group" : "idol";
  const partnerKey = partnerType === "group" ? "groupId" : "idolId",
    table = partnerType === "group" ? "groups" : "idols";
  const index = createIndex(data),
    drafts = [];
  const element = document.createElement("section");
  element.className = "membership-editor";
  element.innerHTML =
    '<div class="split"><h3>' +
    (type === "idol" ? "Memberships" : "Members") +
    '</h3><button type="button" class="button secondary compact" data-add>+ Add ' +
    (type === "idol" ? "membership" : "member") +
    '</button></div><p class="small">Changes are saved with the artist. Keep past memberships and mark departures as former with an end date.</p><div data-memberships></div>';
  const list = element.querySelector("[data-memberships]");
  function add(previous = null) {
    const row = document.createElement("details");
    row.className = "membership-row";
    row.open = !previous;
    const partner = previous
      ? resolveFromIndex(partnerType, previous[partnerKey], index)
      : null;
    row.innerHTML =
      "<summary>" +
      e(partner?.name || "New membership") +
      '</summary><div class="membership-fields"><div data-partner></div></div>';
    const fields = row.querySelector(".membership-fields");
    let picker;
    if (previous)
      row.querySelector("[data-partner]").innerHTML =
        "<p><strong>" +
        e(partner.name) +
        '</strong><br><span class="small">Historical link preserved</span></p>';
    else {
      picker = autocomplete({
        label: partnerType === "group" ? "Group *" : "Idol *",
        items: data[table]
          .filter((r) => !isArchived(r))
          .map((r) => resolveFromIndex(partnerType, r.id, index)),
        onChange: (items) => {
          row.querySelector("summary").textContent =
            items[0]?.name || "New membership";
        },
      });
      row.querySelector("[data-partner]").append(picker.element);
    }
    const inputs = {};
    for (const [key, label, inputType] of [
      ["role", "Role", "text"],
      ["startDate", "Start date", "date"],
      ["endDate", "End date", "date"],
      ["status", "Membership status", "select"],
    ]) {
      const wrapper = document.createElement("label");
      wrapper.textContent = label;
      const input = document.createElement(
        inputType === "select" ? "select" : "input",
      );
      if (inputType === "select")
        input.innerHTML = ["current", "former", "temporary", "subunit"]
          .map((s) => '<option value="' + s + '">' + s + "</option>")
          .join("");
      else input.type = inputType;
      input.value = previous?.[key] || (key === "status" ? "current" : "");
      if (key === "status" && previous?.status === "currentMember")
        input.value = "current";
      if (key === "status" && previous?.status === "formerMember")
        input.value = "former";
      wrapper.append(input);
      fields.append(wrapper);
      inputs[key] = input;
    }
    const draft = {
      previous,
      row,
      read: () => ({
        ...previous,
        [owner]: artist.id,
        [partnerKey]:
          previous?.[partnerKey] || picker?.getValue()[0]?.id || null,
        ...Object.fromEntries(
          Object.entries(inputs).map(([k, input]) => [k, input.value.trim()]),
        ),
      }),
    };
    drafts.push(draft);
    if (!previous) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "text-link";
      remove.textContent = "Remove unsaved membership";
      remove.onclick = () => {
        drafts.splice(drafts.indexOf(draft), 1);
        row.remove();
      };
      fields.append(remove);
    }
    list.append(row);
  }
  data.memberships.filter((m) => m[owner] === artist.id).forEach(add);
  element.querySelector("[data-add]").onclick = () => add();
  return {
    element,
    getChanges: () =>
      drafts
        .map((d) => ({ before: d.previous, after: d.read() }))
        .filter(
          ({ before, after }) =>
            !before ||
            ["role", "startDate", "endDate", "status"].some(
              (k) => (before[k] || "") !== (after[k] || ""),
            ),
        )
        .map((d) => d.after),
  };
}
