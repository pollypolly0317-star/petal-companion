"""Start the downloaded audio server on localhost, logging outside source control."""
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parent.parent
models = root / ".local/models/lfm-audio"
runner = root / ".local/runners/llama-liquid-audio-macos-arm64/llama-liquid-audio-server"
encoder = models / "mmproj-LFM2.5-Audio-1.5B-F16.gguf"
if not encoder.exists():
    encoder = models / "mmproj-LFM2.5-Audio-1.5B-Q4_0.gguf"
args = [str(runner), "-m", str(models / "LFM2.5-Audio-1.5B-Q4_0.gguf"),
        "-mm", str(encoder),
        "-mv", str(models / "vocoder-LFM2.5-Audio-1.5B-Q4_0.gguf"),
        "--tts-speaker-file", str(models / "tokenizer-LFM2.5-Audio-1.5B-Q4_0.gguf"),
        "--host", "127.0.0.1", "--port", "8088", "-c", "4096", "-ngl", "99", "-t", "4"]
with (root / ".local/audio-server.log").open("ab") as log:
    process = subprocess.Popen(args, cwd=runner.parent, stdin=subprocess.DEVNULL,
                               stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
print(f"Audio server PID: {process.pid}; http://127.0.0.1:8088")
