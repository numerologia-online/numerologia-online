"""Проба Silero v5 CIS с вручную проставленными ударениями (+ перед гласной).
Два коротких отрывка: Жазира с ударениями и Альбина с более мягкими паузами."""
from pathlib import Path
import json
import re
import subprocess
import sys
import urllib.request
import wave

import numpy as np
import torch
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "pro" / "soul-stories.json"
OUT = ROOT / "voice-preview"
MODEL = "https://models.silero.ai/models/tts/ru/v5_cis_base_nostress.pt"
WEIGHTS = Path("/tmp/v5_cis_base_nostress.pt")
VOICES = {"zhazira-accents": "ru_zhazira", "albina-gentle": "ru_albina"}
SAMPLE_RATE = 24000

STRESSED_SENTENCES = [
    "Предст+авьте небольш+ой город+ок у м+оря.",
    "+Узкие +улочки нагрев+аются под с+олнцем, по утр+ам п+ахнет св+ежим хл+ебом, а за +окнами одног+о д+ома всегд+а гор+ит т+ёплый свет.",
    "Возм+ожно, когд+а-то +именно там жил+а ж+енщина, кот+орая ум+ела превращ+ать об+ычные соб+ытия в удив+ительные ист+ории.",
]

def get_excerpt():
    story = json.loads(SOURCE.read_text(encoding="utf-8"))["stories"]["6-9-15"]["paragraphs"][0]
    # Только 3 предложения, без изменений текста и без новых интерпретаций.
    sentences = re.split(r"(?<=[.!?])\s+", story)
    assert len(sentences) >= 3
    reference = sentences[:3]
    assert [line.replace("+", "") for line in STRESSED_SENTENCES] == reference, "Accent markup must preserve the story verbatim"
    return STRESSED_SENTENCES

def save_wav(path, pcm):
    samples = np.clip(pcm, -1.0, 1.0)
    with wave.open(str(path), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(SAMPLE_RATE)
        audio.writeframes((samples * 32767).astype("<i2").tobytes())

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    if not WEIGHTS.exists():
        print("Loading MIT licensed Silero v5_cis_base_nostress neural voice...")
        urllib.request.urlretrieve(MODEL, WEIGHTS)
    torch.set_num_threads(3)
    model = torch.package.PackageImporter(str(WEIGHTS)).load_pickle("tts_models", "model")
    model.to(torch.device("cpu"))
    excerpts = get_excerpt()
    for short_name, speaker in VOICES.items():
        # Тёплый ритм не подменяет актёрскую интонацию: модель не имеет контроля эмоций.
        pause = .78 if short_name == "albina-gentle" else .55
        silence = np.zeros(int(SAMPLE_RATE * pause), dtype="float32")
        parts = []
        print("Synthesizing", speaker, flush=True)
        for sentence in excerpts:
            waveform = model.apply_tts(text=sentence, speaker=speaker, sample_rate=SAMPLE_RATE)
            parts.extend([waveform.detach().cpu().numpy().astype("float32").ravel(), silence])
        merged = np.concatenate(parts)
        peak = float(np.max(np.abs(merged)))
        if peak > 0:
            merged = merged * min(.90 / peak, 1.0)
        wav_path = OUT / f"soul-demo-{short_name}.wav"
        mp3_path = OUT / f"soul-demo-{short_name}.mp3"
        save_wav(wav_path, merged)
        subprocess.run([
            imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-nostdin", "-loglevel", "error",
            "-i", str(wav_path),
            "-af", "atempo=0.965" if short_name == "albina-gentle" else "anull",
            "-ac", "1", "-ar", "24000", "-b:a", "112k",
            str(mp3_path)
        ], check=True)
        wav_path.unlink()
        assert mp3_path.stat().st_size > 12000, "Audio output too small"
        print("Created", mp3_path.name, f"({mp3_path.stat().st_size} bytes)", flush=True)

if __name__ == "__main__":
    sys.exit(main())
