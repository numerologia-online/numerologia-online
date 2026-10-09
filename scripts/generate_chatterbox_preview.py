"""Only create a private audition MP3; leave website untouched."""
from pathlib import Path
import json
import subprocess

import imageio_ffmpeg
from gradio_client import Client, handle_file

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / "reference" / "soul-demo-albina-accents.mp3"
OUTPUT = ROOT / "voice-preview" / "chatterbox-v3-russian-narration.mp3"

def main():
    if not REFERENCE.exists():
        raise FileNotFoundError(str(REFERENCE))
    story = json.loads((ROOT / "pro" / "soul-stories.json").read_text(encoding="utf-8"))
    text = ". ".join(story["stories"]["6-9-15"]["paragraphs"][0].split(". ")[:3])
    if not text.endswith("."):
        text += "."
    if len(text) > 300:
        raise ValueError("Too many characters: " + str(len(text)))
    print("Russian text length:", len(text), flush=True)
    print("Connecting to Chatterbox Multilingual V3 demo...", flush=True)
    client = Client("ResembleAI/Chatterbox-Multilingual-TTS-V3", httpx_kwargs={"timeout": 120.0})
    print("Generating Russian storytelling voice...", flush=True)
    result = client.predict(
        text, handle_file(str(REFERENCE)), "ru", 0.82, 0.8, 20261009, 0.30,
        api_name="/generate_tts_audio"
    )
    if isinstance(result, dict):
        path = result.get("path") or result.get("name")
    elif isinstance(result, (str, Path)):
        path = str(result)
    elif isinstance(result, (list, tuple)) and result:
        first = result[0]
        path = first.get("path") or first.get("name") if isinstance(first, dict) else str(first)
    else:
        raise TypeError("Unknown Gradio audio result: " + type(result).__name__)
    if not path or not Path(path).is_file():
        raise FileNotFoundError("Audio missing: " + str(path))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-nostdin", "-loglevel", "error",
        "-i", str(path), "-ac", "1", "-ar", "24000", "-b:a", "128k", str(OUTPUT)
    ], check=True)
    assert OUTPUT.stat().st_size > 16000
    print("SUCCESS", OUTPUT.name, "bytes", OUTPUT.stat().st_size, flush=True)

if __name__ == "__main__":
    main()
