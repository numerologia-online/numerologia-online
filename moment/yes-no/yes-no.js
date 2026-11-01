"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const grid = $("yn-categories"), panel = $("yn-panel"), list = $("yn-questions"),
    search = $("yn-search"), clear = $("yn-clear"), title = $("yn-title"),
    count = $("yn-count"), more = $("yn-more"), back = $("yn-all"), dialog = $("yn-dialog");
  let catalog = null, active = null, visible = 12;
  const normalize = s => String(s || "").toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е").replace(/[^а-яa-z0-9 ]/gi, " ").replace(/\s+/g, " ").trim();
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  function renderCategories() {
    grid.replaceChildren(...catalog.categories.map(category => {
      const a = node("button", "yn-topic");
      a.type = "button";
      a.setAttribute("aria-label", category.title + ", " + category.count + " вопросов. Открыть");
      const icon = node("span", "yn-topic-icon", category.icon);
      icon.setAttribute("aria-hidden", "true");
      const words = node("span", "yn-topic-copy");
      words.append(node("strong", "yn-topic-name", category.title),
        node("span", "yn-topic-count", category.count + " вопросов"));
      const arrow = node("span", "yn-topic-arrow", "→");
      arrow.setAttribute("aria-hidden", "true");
      a.append(icon, words, arrow);
      a.addEventListener("click", () => openCategory(category.id));
      return a;
    }));
  }
  function openCategory(id) {
    if (!catalog.categories.some(c => c.id === id)) return;
    active = id;
    visible = 12;
    search.value = "";
    grid.hidden = true;
    document.querySelector(".yn-directory > .overline").hidden = true;
    document.querySelector(".yn-directory > h1").hidden = true;
    document.querySelector(".yn-directory-sub").hidden = true;
    panel.hidden = false;
    render();
    panel.scrollIntoView({behavior: "auto", block: "start"});
  }
  function showCategories() {
    active = null;
    search.value = "";
    panel.hidden = true;
    grid.hidden = false;
    document.querySelector(".yn-directory > .overline").hidden = false;
    document.querySelector(".yn-directory > h1").hidden = false;
    document.querySelector(".yn-directory-sub").hidden = false;
    grid.scrollIntoView({behavior: "auto", block: "start"});
  }
  function render() {
    if (!catalog || !active) return;
    const category = catalog.categories.find(c => c.id === active);
    const words = normalize(search.value).split(" ").filter(Boolean);
    const found = catalog.questions.filter(q => q.category === active &&
      words.every(w => normalize(q.title).includes(w)));
    title.textContent = category.title;
    count.textContent = found.length ? "Найдено " + found.length + " · показано " +
      Math.min(visible, found.length) : "В этой теме совпадений нет.";
    clear.hidden = !search.value;
    more.hidden = visible >= found.length;
    list.replaceChildren(...found.slice(0, visible).map((q, i) => {
      const button = node("button", "yn-question");
      button.type = "button";
      button.append(node("span", "yn-question-number", String(i + 1).padStart(2, "0")),
        node("span", "yn-question-text", q.title),
        node("span", "yn-question-arrow", "→"));
      button.addEventListener("click", () => {
        $("yn-dialog-title").textContent = q.title;
        dialog.showModal();
        document.body.style.overflow = "hidden";
      });
      return button;
    }));
  }
  $("yn-close").addEventListener("click", () => dialog.close());
  $("yn-back").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {document.body.style.overflow = "";});
  dialog.addEventListener("click", e => {if (e.target === dialog) dialog.close();});
  back.addEventListener("click", showCategories);
  search.addEventListener("input", () => {visible = 12; render();});
  clear.addEventListener("click", () => {search.value = ""; visible = 12; render(); search.focus();});
  more.addEventListener("click", () => {visible += 12; render();});
  (async () => {
    try {
      const response = await fetch("./questions.json?v=2", {cache:"no-store"});
      if (!response.ok) throw Error("catalog request");
      const data = await response.json();
      if (data.categories?.length !== 7 || data.questions?.length !== 100 ||
        new Set(data.questions.map(q => q.id)).size !== 100 ||
        new Set(data.questions.map(q => q.title)).size !== 100) throw Error("catalog integrity");
      const ids = new Set(data.categories.map(c => c.id));
      if (data.questions.some(q => !ids.has(q.category))) throw Error("category mismatch");
      for (const c of data.categories) {
        if (data.questions.filter(q => q.category === c.id).length !== c.count)
          throw Error("category count");
      }
      catalog = data;
      renderCategories();
      const param = new URLSearchParams(location.search).get("category");
      if (param && ids.has(param)) openCategory(param);
    } catch (error) {
      grid.replaceChildren(node("p", "yn-error", "Не удалось открыть темы. Обновите страницу."));
      console.error("NUMI_YES_NO", error);
    }
  })();
})();