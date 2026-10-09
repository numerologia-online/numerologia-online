import { activeSoulSpeech, stopSoulSpeech, speakSoulLines, makeSoulAmbient } from "./pro-voice.js?v=2";

// Карточка художественной истории отдельно от расчётов и схемы.
export function createSoulStory({element, paragraph, karmic, getCurrent}) {
function appendSoulStoryCard(tail, calculatedCode) {
  // История доступна только для найденной программы 6-9-15. Расчёты не изменяем.
  if (tail?.code !== "6-9-15") return;
  const shell = element("section", null, "pro-soul-card");
  shell.append(paragraph("ТИХАЯ ИСТОРИЯ ДУШИ", "pro-soul-eyebrow"));
  shell.append(element("h3", "Услышать историю своей души"));
  shell.append(paragraph("Ваш кармический хвост: " + calculatedCode + " · программа " + tail.code, "pro-soul-meta"));
  shell.append(paragraph("Представьте одну из жизней, которые могла бы прожить эта душа. Нежный рассказ о даре чувствовать, мечтать и возвращаться к себе.", "pro-soul-lead"));
  shell.append(paragraph("Это художественный образ программы, а не буквальное описание прошлой жизни.", "pro-soul-disclaimer"));

  const controls = element("div", null, "pro-soul-controls");
  const play = element("button", "▶ Слушать историю", "pro-soul-play");
  const read = element("button", "Читать историю", "pro-soul-read");
  const stop = element("button", "■ Остановить", "pro-soul-stop");
  [play, read, stop].forEach(button => { button.type = "button"; });
  play.disabled = read.disabled = stop.disabled = true;
  controls.append(play, read, stop);
  shell.append(controls);

  const musicRow = element("label", null, "pro-soul-music");
  const musicCheckbox = element("input");
  musicCheckbox.type = "checkbox";
  musicCheckbox.checked = true;
  musicRow.append(musicCheckbox, document.createTextNode("Тихая музыка на фоне"));
  musicCheckbox.addEventListener("change", () => {
    if (!activeSoulSpeech) return;
    if (!musicCheckbox.checked) {
      activeSoulSpeech.ambient?.stop();
      activeSoulSpeech.ambient = null;
    } else if (!activeSoulSpeech.ambient) {
      activeSoulSpeech.ambient = makeSoulAmbient();
    }
  });
  shell.append(musicRow);

  const status = paragraph("Готовлю рассказ…", "pro-soul-status");
  status.setAttribute("role", "status");
  shell.append(status);
  const body = element("div", null, "pro-soul-body");
  body.hidden = true;
  shell.append(body);
  karmic.append(shell);

  fetch("pro/soul-stories.json?v=2")
    .then(response => {
      if (!response.ok) throw new Error("Story unavailable");
      return response.json();
    })
    .then(data => {
      if (!shell.isConnected || !getCurrent()) return;
      const story = data.stories?.[tail.code];
      if (!story?.paragraphs?.length || !story?.currentLife?.paragraphs?.length) throw new Error("Incomplete story");
      const narration = story.paragraphs;
      const interpretation = story.currentLife;
      shell.insertBefore(element("p", story.title + " · " + story.subtitle, "pro-soul-story-title"), controls);

      const article = element("article", null, "pro-soul-narrative");
      narration.forEach(item => article.append(paragraph(item)));
      body.append(article);

      const today = element("section", null, "pro-soul-today");
      today.append(element("h4", interpretation.title));
      interpretation.paragraphs.forEach(item => today.append(paragraph(item)));
      today.append(element("h5", interpretation.actionTitle));
      const list = element("ol");
      interpretation.actions.forEach(item => list.append(element("li", item)));
      today.append(list);
      const todayControls = element("div", null, "pro-soul-controls");
      const todayPlay = element("button", "▶ Слушать подсказку", "pro-soul-read");
      const todayStop = element("button", "■ Остановить", "pro-soul-stop");
      const todayStatus = paragraph("Можно читать или слушать эту подсказку.", "pro-soul-status");
      todayStatus.setAttribute("role", "status");
      todayPlay.type = todayStop.type = "button";
      todayStop.disabled = true;
      todayPlay.addEventListener("click", () => speakSoulLines(
        [...interpretation.paragraphs, interpretation.actionTitle, ...interpretation.actions],
        todayPlay, todayStop, todayStatus, () => musicCheckbox.checked
      ));
      todayStop.addEventListener("click", stopSoulSpeech);
      todayControls.append(todayPlay, todayStop);
      today.append(todayControls, todayStatus);
      body.append(today);

      const open = (listen = false) => {
        body.hidden = false;
        read.textContent = "История открыта ✓";
        if (listen) speakSoulLines(narration, play, stop, status, () => musicCheckbox.checked);
        else {
          status.textContent = "Рассказ открыт. Его можно читать или слушать.";
          body.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      };
      read.addEventListener("click", () => open(false));
      play.addEventListener("click", () => body.hidden ? open(true) : speakSoulLines(narration, play, stop, status, () => musicCheckbox.checked));
      stop.addEventListener("click", stopSoulSpeech);
      play.disabled = false;
      read.disabled = false;
      status.textContent = "Рассказ готов. Выберите чтение или прослушивание.";
    })
    .catch(() => {
      if (shell.isConnected) status.textContent = "Не получилось загрузить рассказ. Обновите страницу и попробуйте ещё раз.";
    });
}


  return appendSoulStoryCard;
}
