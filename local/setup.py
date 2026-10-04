"""Download the pinned official Apple Silicon runner and Q4 audio model bundle."""
import concurrent.futures
import hashlib
import json
import time
from pathlib import Path
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent / ".local"
MODELS = ROOT / "models" / "lfm-audio"
RUNNERS = ROOT / "runners"
REPO = "LiquidAI/LFM2.5-Audio-1.5B-GGUF"
REVISION = "7d525f883a077e20afb782f2ff618edcae0e39e4"


def download(item):
    filename = item["path"]
    destination = ROOT / "runner.zip" if filename.endswith(".zip") else MODELS / Path(filename).name
    expected = item["lfs"]["oid"]
    if destination.exists() and hashlib.file_digest(destination.open("rb"), "sha256").hexdigest() == expected:
        print(f"Already verified: {destination.name}", flush=True)
        return
    print(f"Downloading {filename} ({item['size'] / 1e6:.1f} MB)", flush=True)
    temporary = destination.with_suffix(destination.suffix + ".partial")
    offset = temporary.stat().st_size if temporary.exists() else 0
    print(f"{destination.name}: resuming at {offset / 1e6:.1f} / {item['size'] / 1e6:.1f} MB", flush=True)
    request = urllib.request.Request(f"https://huggingface.co/{REPO}/resolve/{REVISION}/{filename}?download=true", headers={"Range": f"bytes={offset}-"} if offset else {})
    digest = hashlib.sha256()
    with urllib.request.urlopen(request, timeout=120) as response:
        resume = offset and response.status == 206
        if resume:
            with temporary.open("rb") as previous:
                while chunk := previous.read(1024 * 1024):
                    digest.update(chunk)
        with temporary.open("ab" if resume else "wb") as output:
            downloaded = offset if resume else 0
            started = time.monotonic()
            initial = downloaded
            last_report = started
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
                digest.update(chunk)
                downloaded += len(chunk)
                now = time.monotonic()
                if now - last_report >= 15:
                    speed = (downloaded - initial) / (now - started)
                    remaining = (item["size"] - downloaded) / speed if speed else 0
                    print(f"{destination.name}: {downloaded / 1e6:.1f} / {item['size'] / 1e6:.1f} MB ({100 * downloaded / item['size']:.1f}%), {speed / 1e6:.2f} MB/s, ETA {remaining / 60:.1f} min", flush=True)
                    last_report = now
    if digest.hexdigest() != expected:
        raise RuntimeError(f"Checksum mismatch for {filename}")
    temporary.replace(destination)
    print(f"Verified {filename}", flush=True)


def main():
    MODELS.mkdir(parents=True, exist_ok=True)
    RUNNERS.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(f"https://huggingface.co/api/models/{REPO}/tree/{REVISION}?recursive=true") as response:
        tree = json.load(response)
    wanted = [item for item in tree if item["path"].endswith("Q4_0.gguf") or item["path"] == "runners/llama-liquid-audio-macos-arm64.zip"]
    if len(wanted) != 5:
        raise RuntimeError("Expected four model components and one runner")
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(download, wanted))
    with zipfile.ZipFile(ROOT / "runner.zip") as archive:
        for entry in archive.infolist():
            path = (RUNNERS / entry.filename).resolve()
            if not path.is_relative_to(RUNNERS.resolve()):
                raise RuntimeError("Unexpected archive path")
            archive.extract(entry, RUNNERS)
            if not entry.is_dir():
                path.chmod(0o755)
    print(f"Ready. Models: {MODELS}\nRunner files:", flush=True)
    for path in RUNNERS.rglob("*"):
        if path.is_file():
            print(path.relative_to(ROOT))


if __name__ == "__main__":
    main()
