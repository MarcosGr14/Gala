import {
  loadSnapshot,
  createIndex,
  resolveFromIndex,
  winnerRefs,
} from "../../services/entityService.js";
import { saveAward } from "../../services/awardService.js";
import { validateAward } from "../../services/awardValidation.js";
import { ENTITY_TABLES } from "../../data/catalog.js";
import { autocomplete } from "../../components/autocomplete.js";
import { modal, toast, awardCard } from "../../components/ui.js";
import { pickerItems, openEntityForm } from "./entityForm.js";
import { escapeHtml as e } from "../../utils/helpers.js";
export async function openAwardForm(existing = null, onSaved = () => {}) {
  let data = await loadSnapshot(),
    category = null,
    winners = null;
  const form = document.createElement("form");
  form.className = "award-form";
  form.innerHTML =
    '<p class="small">01 Season & category → 02 Winners → 03 Preview & save</p><label>Season<select name="seasonId" required>' +
    [...data.seasons]
      .sort((a, b) => b.year - a.year)
      .map(
        (s) =>
          '<option value="' +
          e(s.id) +
          '">' +
          s.year +
          " · " +
          e(s.title) +
          "</option>",
      )
      .join("") +
    '</select></label><div data-category></div><div data-dynamic></div><div data-preview aria-live="polite"></div><p class="form-error" role="alert"></p><button class="button" type="submit">Save historical result</button>';
  if (existing) form.elements.seasonId.value = existing.seasonId;
  const categoryPicker = autocomplete({
    label: "Category",
    items: pickerItems(["category"], data),
    onChange: (items) => {
      category = items[0] || null;
      renderDynamic();
    },
  });
  form.querySelector("[data-category]").append(categoryPicker.element);
  const dynamic = form.querySelector("[data-dynamic]"),
    preview = form.querySelector("[data-preview]");
  function input() {
    return {
      ...(existing || {}),
      seasonId: form.elements.seasonId.value,
      categoryId: category?.id,
      winnerType: category?.winnerType,
      slot: dynamic.querySelector("[name=slot]")?.value || "",
      winners: (winners?.getValue() || []).map((w) => ({
        id: w.id,
        type: w.entityType,
      })),
    };
  }
  function renderPreview() {
    if (!category || !winners?.getValue().length) {
      preview.innerHTML = "";
      return;
    }
    const season = data.seasons.find(
      (s) => s.id === form.elements.seasonId.value,
    );
    preview.innerHTML =
      '<p class="eyebrow">PREVIEW</p>' +
      awardCard({
        category,
        categoryName: category.displayName,
        tier: category.tier,
        year: season?.year,
        winners: winners.getValue(),
        slot: input().slot,
      });
  }
  function renderDynamic() {
    dynamic.innerHTML = "";
    winners = null;
    preview.innerHTML = "";
    if (!category) return;
    const structure = category.winnerStructure,
      types =
        category.winnerType === "mixedEntity"
          ? Object.keys(ENTITY_TABLES)
          : [category.winnerType === "pair" ? "idol" : category.winnerType];
    if (["maleFemale", "userGenderSlots"].includes(structure)) {
      const slots =
        structure === "maleFemale"
          ? ["male", "female"]
          : (category.userSlots || ["user1", "user2"]).flatMap((user) => [
              user + "_male",
              user + "_female",
            ]);
      const label = document.createElement("label");
      label.innerHTML =
        'Result slot<select name="slot">' +
        slots
          .map((s) => '<option value="' + e(s) + '">' + e(s) + "</option>")
          .join("") +
        "</select>";
      dynamic.append(label);
      if (existing?.slot) label.querySelector("select").value = existing.slot;
      label.querySelector("select").onchange = renderPreview;
    }
    const hint = document.createElement("p");
    hint.className = "small";
    hint.textContent =
      structure === "pair"
        ? "Choose exactly two different winners. This is one shared award."
        : structure === "multiple"
          ? "Choose all winners. They share one award result."
          : ["maleFemale", "userGenderSlots"].includes(structure)
            ? "Each slot is a separate award result."
            : "Choose one winner.";
    dynamic.append(hint);
    winners = autocomplete({
      label: "Winners",
      items: pickerItems(types, data),
      multiple: ["pair", "multiple"].includes(structure),
      onChange: renderPreview,
    });
    dynamic.append(winners.element);
    const quick = document.createElement("div");
    quick.className = "quick-create";
    quick.innerHTML =
      '<span class="small">Missing someone?</span>' +
      types
        .map(
          (t) =>
            '<button class="text-link" type="button" data-type="' +
            t +
            '">+ Add ' +
            e(t) +
            "</button>",
        )
        .join("");
    quick.querySelectorAll("button").forEach(
      (button) =>
        (button.onclick = async () => {
          await openEntityForm(button.dataset.type, null, async () => {
            data = await loadSnapshot();
            winners.setItems(pickerItems(types, data));
          });
        }),
    );
    dynamic.append(quick);
    if (existing && existing.categoryId === category.id)
      winners.setValue(
        winnerRefs(existing).map((ref) =>
          resolveFromIndex(ref.type, ref.id, createIndex(data)),
        ),
      );
    renderPreview();
  }
  if (existing) {
    category =
      pickerItems(["category"], data).find(
        (c) => c.id === existing.categoryId,
      ) || data.categories.find((c) => c.id === existing.categoryId);
    categoryPicker.setValue(
      category ? [{ ...category, name: category.displayName }] : [],
    );
    renderDynamic();
  }
  form.elements.seasonId.onchange = renderPreview;
  const dialog = modal(
    existing ? "Edit award result" : "Register an award",
    form,
  );
  form.onsubmit = async (event) => {
    event.preventDefault();
    const button = form.querySelector("[type=submit]");
    button.disabled = true;
    try {
      validateAward(input(), category, createIndex(data));
      await saveAward(input());
      dialog.close();
      toast("Historical result saved.");
      await onSaved();
      window.dispatchEvent(new Event("catalog-changed"));
    } catch (error) {
      form.querySelector(".form-error").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
  return dialog;
}
