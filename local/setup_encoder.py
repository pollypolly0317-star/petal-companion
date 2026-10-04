"""Download the official F16 audio encoder to compare recognition quality."""
import json
import urllib.request
import setup

with urllib.request.urlopen(f"https://huggingface.co/api/models/{setup.REPO}/tree/{setup.REVISION}") as response:
    tree = json.load(response)
setup.download(next(item for item in tree if item["path"] == "mmproj-LFM2.5-Audio-1.5B-F16.gguf"))
