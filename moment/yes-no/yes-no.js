"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const grid = $("yn-categories"), panel = $("yn-panel"), list = $("yn-questions"),
    title = $("yn-title"), count = $("yn-count"), back = $("yn-all"), dialog = $("yn-dialog");
  let catalog = null, active = null, selectedQuestion = null, answerRequest = 0, answerController = null;
  const timeInput = $("yn-time-input"), timeForm = $("yn-time-form"),
    timeError = $("yn-time-error"), timeResult = $("yn-time-result");
  const currentTime = () => {
    const date = new Date();
    return String(date.getHours()).padStart(2, "0") + ":" +
      String(date.getMinutes()).padStart(2, "0");
  };
  const normalizeTime = value => {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 4);
    return digits.length > 2 ? digits.slice(0, 2) + ":" + digits.slice(2) : digits;
  };
  const validTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  async function confirmTime(value) {
    if (!validTime(value)) {
      timeError.hidden = false;
      timeResult.hidden = true;
      timeInput.setAttribute("aria-invalid", "true");
      timeInput.focus();
      return;
    }
    timeError.hidden = true;
    timeInput.removeAttribute("aria-invalid");
    timeInput.value = value;
    const id = ++answerRequest;
    answerController?.abort();
    timeResult.hidden = false;
    if (!selectedQuestion || selectedQuestion.id !== "yn-man-001") {
      timeResult.textContent = "Ответ на этот вопрос ещё готовится.";
      return;
    }
    timeResult.textContent = "Подготавливаем ответ.";
    answerController = new AbortController();
    const timer = setTimeout(() => answerController?.abort(), 12000);
    try {
      const response = await fetch("/api/numi-yesno-answer.php?question=" + encodeURIComponent(selectedQuestion.id) + "&time=" + encodeURIComponent(value), {cache:"no-store", signal:answerController.signal});
      const data = await response.json();
      if (id !== answerRequest) return;
      if (data.error === "ZERO_TIME_UNDEFINED") {timeResult.textContent = "Для времени 00.00 правило ответа ещё не утверждено.";return;}
      if (!response.ok || data.ok !== true || typeof data.answer !== "string") throw Error("answer unavailable");
      const separator = data.answer.indexOf(".");
      if (separator < 0) {timeResult.textContent = data.answer;return;}
      const verdict = document.createElement("strong");
      verdict.className = "yn-answer-verdict";
      verdict.textContent = data.answer.slice(0, separator + 1);
      const explanation = document.createElement("p");
      explanation.className = "yn-answer-explanation";
      explanation.textContent = data.answer.slice(separator + 1).trim();
      timeResult.replaceChildren(verdict, explanation);
    } catch (error) {
      if (id === answerRequest) timeResult.textContent = "Не удалось получить ответ. Попробуйте ещё раз.";
    } finally {clearTimeout(timer);}
  }
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
    grid.hidden = true;
    document.querySelector(".yn-directory > .overline").hidden = true;
    document.querySelector(".yn-directory > h1").hidden = true;
    document.querySelector(".yn-directory-sub").hidden = true;
    panel.hidden = false;
    render();
    back.scrollIntoView({behavior: "auto", block: "start"});
  }
  function showCategories() {
    active = null;
    panel.hidden = true;
    grid.hidden = false;
    document.querySelector(".yn-directory > .overline").hidden = false;
    document.querySelector(".yn-directory > h1").hidden = false;
    document.querySelector(".yn-directory-sub").hidden = false;
    back.scrollIntoView({behavior: "auto", block: "start"});
  }
  function render() {
    if (!catalog || !active) return;
    const category = catalog.categories.find(c => c.id === active);
    const found = catalog.questions.filter(q => q.category === active);
    title.textContent = category.title;
    count.textContent = found.length + " вопросов";
    list.replaceChildren(...found.map((q, i) => {
      const button = node("button", "yn-question");
      button.type = "button";
      button.append(node("span", "yn-question-number", String(i + 1).padStart(2, "0")),
        node("span", "yn-question-text", q.title),
        node("span", "yn-question-arrow", "→"));
      button.addEventListener("click", () => {
        answerRequest++; answerController?.abort(); selectedQuestion = q;
        $("yn-dialog-title").textContent = q.title;
        timeForm.reset();
        timeError.hidden = true;
        timeResult.hidden = true;
        timeInput.removeAttribute("aria-invalid");
        dialog.showModal();
        document.body.style.overflow = "hidden";
      });
      return button;
    }));
  }
  timeInput.addEventListener("input", () => {
    answerRequest++; answerController?.abort();
    const cleaned = normalizeTime(timeInput.value);
    if (timeInput.value !== cleaned) timeInput.value = cleaned;
    if (validTime(cleaned)) {
      confirmTime(cleaned);
    } else {
      timeResult.hidden = true;
      timeError.hidden = cleaned.length !== 5;
      if (cleaned.length === 5) timeInput.setAttribute("aria-invalid", "true");
      else timeInput.removeAttribute("aria-invalid");
    }
  });
  timeForm.addEventListener("submit", event => {
    event.preventDefault();
    confirmTime(normalizeTime(timeInput.value));
  });
  $("yn-now").addEventListener("click", () => confirmTime(currentTime()));
  $("yn-close").addEventListener("click", () => dialog.close());
  $("yn-back").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {answerRequest++; answerController?.abort(); document.body.style.overflow = "";});
  dialog.addEventListener("click", e => {if (e.target === dialog) dialog.close();});
  back.addEventListener("click", () => {
    if (active) showCategories();
    else window.location.assign("../");
  });
  (async () => {
    try {
      const response = await fetch("./questions.json?v=2", {cache:"default"});
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