"""Download the official instruction-tuned model for structured tool calls."""
import json
import urllib.request
import setup

setup.REPO = "LiquidAI/LFM2.5-1.2B-Instruct-GGUF"
with urllib.request.urlopen(f"https://huggingface.co/api/models/{setup.REPO}") as response:
    setup.REVISION = json.load(response)["sha"]
with urllib.request.urlopen(f"https://huggingface.co/api/models/{setup.REPO}/tree/{setup.REVISION}") as response:
    tree = json.load(response)
item = next(item for item in tree if item["path"] == "LFM2.5-1.2B-Instruct-Q4_K_M.gguf")
setup.download(item)
