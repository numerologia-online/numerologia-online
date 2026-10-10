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
    const clamp = (value, max) => Math.max(8, Math.min(value, max));
    const preferredX = clamp(x - width / 2, maxX);
    const desiredY = p.y > 400 ? y - height - 27 : y + 28;
    const preferredY = clamp(desiredY, maxY);

    // Плашка остаётся на прежнем месте, если не закрывает числа своей сферы.
    // Иначе подбираем ближайшее свободное положение внутри схемы.
    const selected = new Set(zone.points);
    const numbers = data.points.map(point => ({
      x: rect.left - holder.left + point.x * scale,
      y: rect.top - holder.top + point.y * scale,
      radius: (point.kind === "center" ? 34 : point.kind === "major" ? 29 : 17) * scale + 4,
      selected: selected.has(point.key)
    }));

    const overlap = (number, left, top) => {
      const r = number.radius;
      const w = Math.max(0, Math.min(left + width, number.x + r) - Math.max(left, number.x - r));
      const h = Math.max(0, Math.min(top + height, number.y + r) - Math.max(top, number.y - r));
      return w * h / (4 * r * r);
    };
    const obscuresSelected = (left, top) =>
      numbers.some(number => number.selected && overlap(number, left, top) > 0);

    let bestX = preferredX;
    let bestY = preferredY;
    if (obscuresSelected(preferredX, preferredY)) {
      const xs = new Set([8, maxX, preferredX]);
      const ys = new Set([8, maxY, preferredY]);
      for (let left = 8; left <= maxX; left += 8) xs.add(left);
      for (let top = 8; top <= maxY; top += 8) ys.add(top);
      numbers.filter(number => number.selected).forEach(number => {
        xs.add(clamp(number.x - number.radius - width - 4, maxX));
        xs.add(clamp(number.x + number.radius + 4, maxX));
        ys.add(clamp(number.y - number.radius - height - 4, maxY));
        ys.add(clamp(number.y + number.radius + 4, maxY));
      });

      let bestScore = Infinity;
      for (const left of xs) for (const top of ys) {
        let score = Math.hypot(left - preferredX, top - preferredY) * 0.22;
        for (const number of numbers) {
          const covered = overlap(number, left, top);
          if (!covered) continue;
          const centerHidden = number.x >= left && number.x <= left + width &&
            number.y >= top && number.y <= top + height;
          score += covered * (number.selected ? 16000 : 35);
          if (number.selected && centerHidden) score += 3000;
        }
        if (score < bestScore) {
          bestScore = score;
          bestX = left;
          bestY = top;
        }
      }
    }
    preview.style.left = bestX + "px";
    preview.style.top = bestY + "px";
  }

  preview.addEventListener("click", () => {
    const zone = getCurrent()?.zones.find(item => item.id === preview.dataset.zone);
    if (!zone) return;
    hide();
    onSelectZone(zone, true);
  });

  return {preview, show, hide};
}
