// Музыка, голос и управление прослушиванием историй.
export let activeSoulSpeech = null;

// Фоновая мелодия синтезируется на устройстве: никаких аудиофайлов и внешних сервисов.
function makeSoulAmbient() {
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  if (!AudioEngine) return null;
  try {
    const context = new AudioEngine();
    const sequence = [392, 440, 523.25, 440, 349.23, 392, 329.63, 349.23];
    let cursor = 0;
    let timer = null;
    let closed = false;

    function note(frequency, amplitude, seconds) {
      if (closed || context.state !== "running") return;
      const now = context.currentTime + 0.025;
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      envelope.gain.setValueAtTime(0.00001, now);
      envelope.gain.exponentialRampToValueAtTime(amplitude, now + 0.18);
      envelope.gain.exponentialRampToValueAtTime(0.00001, now + seconds);
      oscillator.connect(envelope);
      envelope.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + seconds + 0.03);
    }

    function step() {
      note(sequence[cursor % sequence.length], 0.008, 3.6);
      if (cursor % 4 === 0) note(cursor % 8 === 0 ? 196 : 174.61, 0.003, 6.3);
      cursor++;
    }

    function resume() {
      if (closed || timer !== null) return;
      context.resume().then(() => {
        if (closed) return;
        step();
        timer = window.setInterval(step, 2300);
      }).catch(() => {});
    }
    function pause() {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      if (!closed && context.state === "running") context.suspend().catch(() => {});
    }
    function stop() {
      if (closed) return;
      closed = true;
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      context.close().catch(() => {});
    }
    resume();
    return { resume, pause, stop };
  } catch {
    return null;
  }
}

export function stopSoulSpeech() {
  const session = activeSoulSpeech;
  activeSoulSpeech = null;
  if (session) {
    session.ambient?.stop();
    session.play.textContent = session.label;
    session.stop.disabled = true;
    session.status.textContent = "Чтение остановлено.";
  }
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

function chooseSoulVoice(synth) {
  const voices = synth.getVoices().filter(voice => /^ru/i.test(voice.lang));
  // Имена зависят от ОС: женский голос выбирается, когда он доступен.
  const feminine = /milena|anna|анна|алёна|алена|elena|елена|irina|ирина|maria|mariya|мария|svetlana|светлана|tatiana|татьяна|daria|дарья|yulia|юлия|katya|катя|katerina|екатерина|female|женский|alisa|алиса/i;
  return voices.find(voice => feminine.test(voice.name))
    || voices.find(voice => voice.localService)
    || voices[0] || null;
}

export function speakSoulLines(lines, play, stop, status, musicEnabled = () => true) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    status.textContent = "На этом устройстве нет системной озвучки. Рассказ можно прочитать ниже.";
    return;
  }
  const synth = window.speechSynthesis;
  if (activeSoulSpeech?.play === play) {
    const session = activeSoulSpeech;
    if (synth.paused) {
      synth.resume();
      session.ambient?.resume();
      play.textContent = "⏸ Пауза";
      status.textContent = "Продолжаю чтение.";
    } else {
      synth.pause();
      session.ambient?.pause();
      play.textContent = "▶ Продолжить";
      status.textContent = "На паузе.";
    }
    return;
  }
  stopSoulSpeech();
  const chunks = lines.map(item => typeof item === "string" ? item : item?.text).filter(text => typeof text === "string" && text.trim());
  if (!chunks.length) return;
  const session = { play, stop, status, label: play.textContent, ambient: musicEnabled() ? makeSoulAmbient() : null };
  activeSoulSpeech = session;
  play.textContent = "⏸ Пауза";
  stop.disabled = false;
  status.textContent = "Спокойное чтение. Звучание голоса зависит от настроек телефона.";
  let index = 0;
  const voice = chooseSoulVoice(synth);
  const next = () => {
    if (activeSoulSpeech !== session) return;
    if (index >= chunks.length) {
      stopSoulSpeech();
      status.textContent = "Рассказ окончен. Возвращайтесь к нему, когда захочется.";
      return;
    }
    const utterance = new SpeechSynthesisUtterance(chunks[index++]);
    utterance.lang = "ru-RU";
    utterance.rate = 0.86;
    utterance.pitch = 1.06;
    utterance.volume = 1;
    if (voice) utterance.voice = voice;
    utterance.onend = next;
    utterance.onerror = () => {
      if (activeSoulSpeech !== session) return;
      stopSoulSpeech();
      status.textContent = "Чтение прервалось. Можно нажать «Слушать» ещё раз.";
    };
    synth.speak(utterance);
  };
  next();
}

