// Отдельная мини-карточка сферы. Подсветка и навигация не смешаны.
export function createZonePreview({diagram, element, getCurrent, hidePointPreview, onSelectZone}) {
  const preview = document.createElement("button");
  preview.type = "button";
  preview.className = "pro-point-preview pro-zone-preview";
  preview.setAttribute("aria-label", "Читать подробный разбор выбранной сферы");
  preview.hidden = true;

  function hide() {
    preview.hidden = true;
    delete preview.dataset.zone;
    preview.classList.remove("inline");
    preview.remove();
  }

  function show(zone, positions, source = "diagram", button = null) {
    const data = getCurrent();
    if (!data) return;
    hidePointPreview();
    preview.replaceChildren();
    preview.append(element("span", "ВЫБРАННАЯ СФЕРА", "pro-point-preview-eyebrow"));
    preview.append(element("strong", zone.title, "pro-point-preview-title"));
    const values = zone.points.map(key => data.points.find(point => point.key === key)?.value).filter(Number.isInteger);
    preview.append(element("span", "Ваши числа: " + values.join(" · "), "pro-zone-preview-values"));
    if (zone.reading?.lead) preview.append(element("span", zone.reading.lead, "pro-point-preview-excerpt"));
    preview.append(element("span", "Открыть разбор ↓", "pro-point-preview-next"));
    preview.dataset.zone = zone.id;
    preview.hidden = false;

    // Карточки списка получают подсказку прямо под нажатой карточкой.
    if (source === "picker" && button) {
      preview.classList.add("inline");
      button.after(preview);
      preview.style.left = "";
      preview.style.top = "";
      return;
    }

    // У надписи SVG всплывающая подсказка появляется рядом, как у чисел.
    preview.classList.remove("inline");
    diagram.append(preview);
    const p = positions[zone.id];
    const svg = diagram.querySelector("svg");
    if (!p || !svg) return;
    const rect = svg.getBoundingClientRect();
    const holder = diagram.getBoundingClientRect();
    const scale = rect.width / 620;
    const width = preview.getBoundingClientRect().width;
    const height = preview.getBoundingClientRect().height;
    const x = rect.left - holder.left + p.x * scale;
    const y = rect.top - holder.top + p.y * scale;
    const maxX = Math.max(8, diagram.clientWidth - width - 8);
    const maxY = Math.max(8, diagram.clientHeight - height - 8);
    preview.style.left = Math.max(8, Math.min(x - width / 2, maxX)) + "px";
    const desiredY = p.y > 400 ? y - height - 27 : y + 28;
    preview.style.top = Math.max(8, Math.min(desiredY, maxY)) + "px";
  }

  preview.addEventListener("click", () => {
    const zone = getCurrent()?.zones.find(item => item.id === preview.dataset.zone);
    if (!zone) return;
    hide();
    onSelectZone(zone, true);
  });

  return {preview, show, hide};
}
