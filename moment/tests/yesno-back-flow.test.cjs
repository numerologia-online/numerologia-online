"use strict";
// Exercise the real yes-no browser controller with a minimal DOM double.
// No third-party dependencies; verify the three one-step Back transitions.
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

class Element {
  constructor(id) {
    this.id = id; this.hidden = false; this.value = ""; this.listeners = {};
    this.children = []; this.style = {}; this.attributes = {}; this.textContent = "";
  }
  addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
  fire(name, event = {}) { for (const callback of this.listeners[name] || []) callback(event); }
  replaceChildren(...children) { this.children = children; }
  append(...children) { this.children.push(...children); }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  reset() { if (this.id === "yn-time-form") elements["yn-time-input"].value = ""; }
  scrollIntoView() { this.scrolled = true; }
  focus() {}
  showModal() { this.open = true; }
  close() { this.open = false; this.fire("close"); }
}
const ids = ["yn-categories","yn-panel","yn-questions",
  "yn-title","yn-count","yn-all","yn-dialog","yn-close","yn-back","yn-dialog-title",
  "yn-time-input","yn-time-form","yn-time-error","yn-time-result","yn-now"];
const elements = Object.fromEntries(ids.map(id => [id, new Element(id)]));
const headings = Object.fromEntries([".yn-directory > .overline",".yn-directory > h1",
  ".yn-directory-sub"].map(name => [name, new Element(name)]));
const document = {
  body: new Element("body"),
  getElementById(id) { if (!elements[id]) throw Error("Missing #" + id); return elements[id]; },
  querySelector(selector) { if (!headings[selector]) throw Error("Missing selector: " + selector); return headings[selector]; },
  createElement(tag) { return new Element(tag); }
};
const catalog = JSON.parse(fs.readFileSync("moment/yes-no/questions.json", "utf8"));
let navigation = null;
const context = {
  document, URLSearchParams, location: {search:""},
  window: {location:{assign(path){navigation=path;}}},
  fetch: async () => ({ok:true, json:async()=>catalog}),
  console
};
const script = fs.readFileSync("moment/yes-no/yes-no.js","utf8");
vm.runInNewContext(script, context, {filename:"yes-no.js"});
const pause = () => new Promise(resolve => setImmediate(resolve));

(async () => {
  await pause(); await pause();
  assert.equal(elements["yn-categories"].children.length, 7, "Seven topics loaded");
  elements["yn-categories"].children[0].fire("click");
  assert.equal(elements["yn-panel"].hidden, false, "Question list opened");
  assert.equal(elements["yn-categories"].hidden, true, "Topic list hidden");
  assert.equal(elements["yn-questions"].children.length, 20, "All twenty questions in first topic displayed without searching");
  assert.equal(elements["yn-all"].scrolled, true, "Back button visible above questions");
  elements["yn-questions"].children[0].fire("click");
  assert.equal(elements["yn-dialog"].open, true, "Answer dialog opened");
  assert.equal(elements["yn-time-result"].hidden, true, "No chosen moment initially");
  elements["yn-time-input"].value = "2561";
  elements["yn-time-form"].fire("submit", {preventDefault(){}});
  assert.equal(elements["yn-time-error"].hidden, false, "Invalid 25:61 time rejected");
  assert.equal(elements["yn-time-result"].hidden, true, "No confirmation for invalid time");
  elements["yn-time-input"].value = "1431";
  elements["yn-time-input"].fire("input");
  assert.equal(elements["yn-time-input"].value, "14:31", "Digits auto formatted HH:MM");
  elements["yn-time-form"].fire("submit", {preventDefault(){}});
  assert.equal(elements["yn-time-result"].hidden, false, "Manual time confirmed");
  assert.ok(elements["yn-time-result"].textContent.includes("14:31"), "Correct time displayed");
  elements["yn-now"].fire("click");
  assert.match(elements["yn-time-input"].value, /^([01]\d|2[0-3]):[0-5]\d$/, "Now uses a valid local time");
  assert.equal(elements["yn-time-result"].hidden, false, "Ask now confirms immediately");
  elements["yn-back"].fire("click");
  assert.equal(elements["yn-dialog"].open, false, "Answer Back closes dialog");
  assert.equal(elements["yn-panel"].hidden, false, "Back returns to questions");
  elements["yn-all"].fire("click");
  assert.equal(elements["yn-panel"].hidden, true, "Question Back closes category");
  assert.equal(elements["yn-categories"].hidden, false, "Back returns to topics");
  elements["yn-all"].fire("click");
  assert.equal(navigation, "../", "Topics Back returns to Numerology Moment");
  assert.equal(catalog.questions.length, 100, "Original hundred questions preserved");
  assert.equal(elements["yn-count"].textContent, "20 вопросов", "Simple topic count without paging");
  for (const category of catalog.categories) {
    const selected = elements["yn-categories"].children.find(item => item.attributes["aria-label"]?.startsWith(category.title + ","));
    assert.ok(selected, "All categories accessible: " + category.title);
    selected.fire("click");
    assert.equal(elements["yn-questions"].children.length, category.count, "Every question shown for " + category.title);
    elements["yn-all"].fire("click");
  }
  console.log("PASS: 100 question navigation, HH:MM validation, auto formatting and ask-now preview");
})().catch(error => {console.error(error); process.exitCode=1;});
