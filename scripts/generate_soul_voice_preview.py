"""Некоммерческая проба? Нет: MIT-licensed Silero CIS Base, голос не хранится в браузере.
Только короткие демонстрации; пользователь выбирает тембр до публикации."""
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
VOICES = {"albina": "ru_albina", "zhazira": "ru_zhazira"}
SAMPLE_RATE = 24000

def get_excerpt():
    story = json.loads(SOURCE.read_text(encoding="utf-8"))["stories"]["6-9-15"]["paragraphs"][0]
    # Только 3 предложения, без изменений текста и без новых интерпретаций.
    sentences = re.split(r"(?<=[.!?])\s+", story)
    assert len(sentences) >= 3
    return sentences[:3]

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
    silence = np.zeros(int(SAMPLE_RATE * .38), dtype="float32")
    for short_name, speaker in VOICES.items():
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
            "-i", str(wav_path), "-ac", "1", "-ar", "24000", "-b:a", "112k",
            str(mp3_path)
        ], check=True)
        wav_path.unlink()
        assert mp3_path.stat().st_size > 12000, "Audio output too small"
        print("Created", mp3_path.name, f"({mp3_path.stat().st_size} bytes)", flush=True)

if __name__ == "__main__":
    sys.exit(main())
