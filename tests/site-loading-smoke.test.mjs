import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const source = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("Red Flag loads an individual answer only when its question opens", async () => {
  const [feature, money, generic, catalog, category] = await Promise.all([
    source("redflag-feature.js"),
    source("data/redflag/categories/money-questions.js"),
    source("redflag-text-bank.js"),
    source("redflag-categories.js"),
    source("data/redflag/banks/money-questions.json")
  ]);
  assert.doesNotMatch(feature, /const response = question\.answer\(activeProfile\)/);
  assert.match(feature, /if \(!opened\) ensureAnswer\(question, state\)/);
  assert.match(feature, /state\.answers\.get\(question\.id\)/);
  assert.match(feature, /state\.answerRequests\.has\(id\)/);
  assert.match(money, /await loadTextBank\(question\)/);
  assert.doesNotMatch(money, /Promise\.all\(bank\.questions/);
  assert.match(generic, /await loadTextBank\(question\)/);
  assert.doesNotMatch(generic, /Promise\.all\(bank\.questions/);
  assert.match(catalog, /loadQuestionBank\(category\.bank\)/);

  const questions = JSON.parse(category).questions;
  for (const question of questions.filter(item => item.textFile)) {
    const filename = question.textFile.split("?")[0];
    const text = JSON.parse(await source("data/redflag/" + filename));
    assert.equal(text.questionId, question.id, filename);
    assert.ok(["reduce22(day)-month", "day-month"].includes(text.keyRule), filename);
    assert.ok(Object.keys(text.entries || {}).length > 0, filename);
  }
});

test("Home card pictures exist and are downloaded only near viewport", async () => {
  const [html, css, loader] = await Promise.all([
    source("index.html"), source("artwork.css"), source("artwork-loader.js")
  ]);
  assert.match(html, /artwork-loader\.js\?v=/);
  assert.match(loader, /IntersectionObserver/);
  assert.match(loader, /rootMargin:/);
  assert.doesNotMatch(css, /background-image:\s*url\(/);
  const images = [...html.matchAll(/data-artwork="(assets\/[^"]+)"/g)].map(match => match[1]);
  assert.ok(images.length >= 10, "Expected home illustration cards");
  for (const filename of images) {
    assert.match(filename, /^assets\/[a-z0-9-]+\.(webp|jpe?g|png)$/);
    const info = await stat(new URL("../" + filename, import.meta.url));
    assert.ok(info.size < 200_000, filename + " should not be a large download");
  }
});

test("Saving Red Flag replies to Telegram still has both paths", async () => {
  const script = await source("redflag-feature.js");
  assert.match(script, /REDFLAG_SAVE_URL/);
  assert.match(script, /REDFLAG_TICKET_URL/);
  assert.match(script, /action: "create", text: report/);
  assert.match(script, /share\.addEventListener\("click"/);
});
