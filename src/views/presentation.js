import { modal, awardCard } from "../components/ui.js";
import { escapeHtml as e } from "../utils/helpers.js";
export function startPresentation(awards) {
  if (!awards.length) return;
  const content = document.createElement("div"),
    dialog = modal("Gala presentation", content);
  dialog.classList.add("presentation");
  let position = 0;
  function render() {
    const award = awards[Math.floor(position / 3)],
      step = position % 3;
    content.innerHTML =
      '<div class="presentation-slide">' +
      (step === 0
        ? '<p class="eyebrow">' +
          e(award.year) +
          " · " +
          e(award.tier) +
          "</p><h1>" +
          e(award.categoryName) +
          "</h1>"
        : step === 1
          ? "<h1>And the winner is…</h1>"
          : awardCard(award)) +
      '</div><div class="actions"><button class="button secondary" data-prev ' +
      (!position ? "disabled" : "") +
      '>← Previous</button><span class="small">' +
      "Award " + (Math.floor(position / 3) + 1) + " of " + awards.length +
      " · Slide " + (step + 1) + " of 3" +
      '</span><button class="button" data-next>' +
      (position === awards.length * 3 - 1 ? "Finish" : "Next →") +
      "</button></div>";
    content.querySelector("[data-prev]").onclick = () => {
      position = Math.max(0, position - 1);
      render();
    };
    content.querySelector("[data-next]").onclick = () => {
      if (position === awards.length * 3 - 1) {
        dialog.close();
        return;
      }
      position++;
      render();
    };
  }
  dialog.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      content
        .querySelector(
          event.key === "ArrowRight" ? "[data-next]" : "[data-prev]",
        )
        .click();
    }
  });
  render();
}
