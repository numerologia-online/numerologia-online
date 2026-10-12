import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("Матрица сохраняет объяснение и сразу раскрывает полный авторский текст", async () => {
  const js = await source("pro/pro.js");
  const diagram = await source("pro/pro-diagram.js");
  const preview = await source("pro/pro-zone-preview.js");
  const html = await source("pro/index.html");
  assert.ok(diagram.includes("showZonePreview(zone, sectorLabelPositions, source, button)"));
  assert.ok(preview.includes("onSelectZone(zone, true)"));
  assert.ok(js.includes('content.append(paragraph(role.meaning))'));
  assert.ok(js.includes("loadInlineFullReading(full, authoredKey)"));
  assert.ok(js.includes("loadInlineFullReading(full, point.topic)"));
  assert.ok(js.includes("loadFullReportSection(definition.energy)"));
  assert.ok(js.includes("loadPracticalGuidance(definition.energy)"));
  assert.ok(js.includes('current.previews.details?.[point.key]'));
  assert.ok(!js.includes("Разобрать эту точку подробнее →"));
  assert.ok(!js.includes("Читать полный разбор по этой теме ↓"));
  assert.ok(html.includes('src="pro/pro.js?v=86"'));
});

test("Для каждой вспомогательной точки и для каждой сферы есть исходное объяснение", async () => {
  const nodes = await source("pro/pro-points.js");
  const preview = JSON.parse(await source("pro/point-previews.json"));
  const zones = JSON.parse(await source("pro/zones.json")).zones;
  assert.equal(Object.keys(preview.details).length, 31);
  assert.equal(zones.length, 13);
  assert.equal(zones.reduce((sum, zone) => sum + zone.points.length, 0), 56);
  for (const [key, detail] of Object.entries(preview.details)) {
    assert.ok(detail.meaning?.trim().length, `Нет текста точки ${key}`);
    assert.ok(detail.action?.trim().length, `Нет практики точки ${key}`);
  }
  for (const zone of zones) {
    for (const point of zone.points) {
      assert.ok(preview.details[point], `Нет деталей ${zone.id}/${point}`);
      assert.ok(zone.reading.roles[point]?.meaning?.trim(), `Нет пояснения ${zone.id}/${point}`);
    }
  }
  assert.ok(nodes.includes("export function nodesFor"));
});
