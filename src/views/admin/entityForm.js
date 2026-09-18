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
export async function openEntityForm(type, record = null, onSaved = () => {}) {
  const definition = FORMS[type],
    data = await loadSnapshot();
  const form = document.createElement("form");
  form.className = "entity-form";
  const pickers = new Map();
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
    input.id = id;
    input.name = field.key;
    input.required = !!field.required;
    if (field.options)
      input.innerHTML = field.options
        .map(
          (option) =>
            '<option value="' +
            e(option) +
            '">' +
            e(option || "Not specified") +
            "</option>",
        )
        .join("");
    else if (input.tagName === "INPUT") input.type = field.type || "text";
    let value = record?.[field.key];
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
              : field.type === "number"
                ? Number(element.value)
                : element.value.trim();
          if (field.key === "userSlots")
            input[field.key] = input[field.key]
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
        }
      }
      const saved = ["idol", "group"].includes(type)
        ? await saveArtist(type, input, membershipEditor?.getChanges() || [])
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
