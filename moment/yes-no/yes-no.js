"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const grid = $("yn-categories"), back = $("yn-all"), dialog = $("yn-dialog");
  const questionTitle = $("yn-dialog-title"), submit = $("yn-submit"), now = $("yn-now");
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
  let useCurrentTime = true;
  const scrollBehavior = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  async function confirmTime(value, scrollToAnswer = false) {
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
    timeInput.blur();
    const id = ++answerRequest;
    answerController?.abort();
    timeResult.hidden = false;
    if (!selectedQuestion) {
      timeResult.textContent = "Ответ на этот вопрос ещё готовится.";
      return;
    }
    timeResult.textContent = "Подготавливаем ответ.";
    answerController = new AbortController();
    const controller = answerController;
    submit.disabled = true;
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch("/api/numi-yesno-answer.php", {method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:selectedQuestion.id,time:value}),cache:"no-store", signal:controller.signal});
      const data = await response.json();
      if (id !== answerRequest) return;
      if(data.error==="DAILY_LIMIT_REACHED"||data.error==="LOGIN_REQUIRED"){
        const mustLogin=data.error==="LOGIN_REQUIRED";
        timeResult.textContent=mustLogin
          ? "Войдите в личный кабинет, чтобы использовать бесплатный вопрос дня."
          : "Бесплатный ответ на сегодня уже использован. Остальные ответы доступны участникам Клуба без доплаты.";
        const link=document.createElement("a");
        link.href=mustLogin?"/?account=1":"/?account=1&club_offer=1";
        link.className="yn-subscription-link";
        link.textContent=mustLogin?"Войти в личный кабинет":"Подключить Клуб · 490 ₽ в месяц";
        timeResult.append(link);
        return;
      }
      if (data.error === "ANSWER_NOT_READY") {timeResult.textContent = "Ответ на этот вопрос ещё готовится.";return;}
      if (!response.ok || data.ok !== true || typeof data.answer !== "string") throw Error("answer unavailable");
      const separator = data.answer.indexOf(".");
      if (separator < 0) {
        timeResult.textContent = data.answer;
        attachAnswerActions(data.answer, value, id);
        return;
      }
      const verdict = document.createElement("strong");
      verdict.className = "yn-answer-verdict";
      verdict.textContent = data.answer.slice(0, separator + 1);
      const explanation = document.createElement("p");
      explanation.className = "yn-answer-explanation";
      explanation.textContent = data.answer.slice(separator + 1).trim();
      timeResult.replaceChildren(verdict, explanation);
      attachAnswerActions(data.answer, value, id);
    } catch (error) {
      if (id === answerRequest) timeResult.textContent = "Не удалось получить ответ. Попробуйте ещё раз.";
    } finally {
      clearTimeout(timer);
      if (id === answerRequest) submit.disabled = false;
      // Scroll only after an explicit question submission.
      if (scrollToAnswer && id === answerRequest && !dialog.hidden && !timeResult.hidden) {
        requestAnimationFrame(() => {
          if (id !== answerRequest || dialog.hidden || timeResult.hidden) return;
          const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          timeResult.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
        });
      }
    }
  }
  function attachAnswerActions(answerText, questionTime, requestId) {
    if (requestId !== answerRequest || !selectedQuestion || !answerText.trim()) return;
    const questionTitle = selectedQuestion.title;
    // Only the actual approved answer returned from PHP is saveable.
    const report = [
      '❓ Вопрос «Да или нет»',
      'Вопрос: ' + questionTitle,
      'Время вопроса: ' + questionTime,
      'Ответ: ' + answerText,
      '', '✨ Нумерология Онлайн',
      '🌐 Сайт: https://xn--c1adkkdfjbp1a4l.online/moment/yes-no/',
      '🤖 Бот: https://t.me/Numerologiaonline_bot'
    ].join('\n');
    const actions = document.createElement('div');
    actions.className = 'yn-telegram-actions';
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'yn-telegram-save';
    save.textContent = '❤️ Сохранить в Telegram';
    const share = document.createElement('button');
    share.type = 'button';
    share.className = 'yn-telegram-share';
    share.textContent = '💌 Поделиться';
    const status = document.createElement('p');
    status.className = 'yn-telegram-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.hidden = true;
    actions.append(save, share, status);
    save.addEventListener('click', async () => {
      save.disabled = true;
      try {
        const { saveAnswerToTelegram } = await import('../../telegram-answer-save.js?v=20261104');
        await saveAnswerToTelegram(report, save, status);
      } catch {
        status.textContent = 'Не удалось открыть сохранение. Попробуйте ещё раз.';
        status.hidden = false;
      } finally { save.disabled = false; }
    });
    share.addEventListener('click', async () => {
      try {
        const { shareAnswerInTelegram } = await import('../../telegram-answer-save.js?v=20261104');
        await shareAnswerInTelegram(report, 'Ответ «Да или нет»');
      } catch {
        status.textContent = 'Не удалось открыть отправку. Попробуйте ещё раз.';
        status.hidden = false;
      }
    });
    timeResult.append(actions);
  }
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  function renderCategories() {
    grid.replaceChildren(...catalog.categories.map(category => {
      const group = node("div", "yn-topic-group");
      const toggle = node("button", "yn-topic");
      toggle.type = "button";
      toggle.setAttribute("aria-expanded", "false");
      const listId = "yn-category-" + category.id;
      toggle.setAttribute("aria-controls", listId);
      const icon = node("span", "yn-topic-icon", category.icon);
      icon.setAttribute("aria-hidden", "true");
      const words = node("span", "yn-topic-copy", category.title);
      const count = node("span", "yn-topic-count", String(category.count));
      const chevron = node("span", "yn-topic-arrow", "⌄");
      chevron.setAttribute("aria-hidden", "true");
      toggle.append(icon, words, count, chevron);
      const questions = node("div", "yn-questions-list");
      questions.id = listId;
      questions.hidden = true;
      questions.setAttribute("role", "group");
      questions.setAttribute("aria-label", category.title);
      questions.replaceChildren(...catalog.questions.filter(q => q.category === category.id).map(q => {
        const button = node("button", "yn-question", q.title);
        button.type = "button";
        button.setAttribute("aria-pressed", String(selectedQuestion?.id === q.id));
        button.addEventListener("click", () => selectQuestion(q));
        return button;
      }));
      toggle.addEventListener("click", () => openCategory(active === category.id ? null : category.id));
      group.dataset.category = category.id;
      group.append(toggle, questions);
      return group;
    }));
  }
  function openCategory(id) {
    if (id !== null && !catalog.categories.some(c => c.id === id)) return;
    active = id;
    for (const group of grid.children) {
      const expanded = group.dataset.category === id;
      group.querySelector(".yn-topic").setAttribute("aria-expanded", String(expanded));
      group.querySelector(".yn-questions-list").hidden = !expanded;
    }
  }
  function selectQuestion(q) {
    answerRequest++; answerController?.abort();
    selectedQuestion = q;
    questionTitle.textContent = q.title;
    timeForm.reset();
    useCurrentTime = true;
    timeInput.value = currentTime();
    timeInput.disabled = now.disabled = submit.disabled = false;
    timeError.hidden = timeResult.hidden = true;
    timeResult.replaceChildren();
    timeInput.removeAttribute("aria-invalid");
    renderCategories();
    openCategory(null);
    questionTitle.focus({preventScroll:true});
    dialog.scrollIntoView({behavior:scrollBehavior(),block:"start"});
  }
  timeInput.addEventListener("input", () => {
    useCurrentTime = false;
    answerRequest++; answerController?.abort();
    submit.disabled = !selectedQuestion;
    const cleaned = normalizeTime(timeInput.value);
    if (timeInput.value !== cleaned) timeInput.value = cleaned;
    timeResult.hidden = true;
    timeError.hidden = cleaned.length !== 5 || validTime(cleaned);
    if (!timeError.hidden) timeInput.setAttribute("aria-invalid", "true");
    else timeInput.removeAttribute("aria-invalid");
  });
  timeForm.addEventListener("submit", event => {
    event.preventDefault();
    if (!selectedQuestion || submit.disabled) return;
    confirmTime(useCurrentTime ? currentTime() : normalizeTime(timeInput.value), true);
  });
  now.addEventListener("click", () => {
    if (!selectedQuestion) return;
    answerRequest++; answerController?.abort();
    useCurrentTime = true;
    timeInput.value = currentTime();
    timeInput.removeAttribute("aria-invalid");
    timeError.hidden = timeResult.hidden = true;
    submit.disabled = false;
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && active !== null) {
      const group = Array.from(grid.children).find(el => el.dataset.category === active);
      openCategory(null);
      group?.querySelector(".yn-topic")?.focus();
    }
  });
  back.addEventListener("click", () => window.location.assign("../../"));
  (async () => {
    try {
      const response = await fetch("./questions.json?v=3", {cache:"default"});
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
