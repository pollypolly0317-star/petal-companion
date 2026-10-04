"""Start the instruction-tuned tool model with the installed llama.cpp server."""
import os
import shutil
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parent.parent
runner = shutil.which("llama-server")
if not runner and (root / ".local/runners/llama-b11398/llama-server").exists():
    runner = str(root / ".local/runners/llama-b11398/llama-server")
if not runner:
    raise SystemExit("Install llama.cpp first: brew install llama.cpp")
args = [runner, "-m", str(root / ".local/models/lfm-audio/LFM2.5-1.2B-Instruct-Q4_K_M.gguf"),
        "--host", "127.0.0.1", "--port", "8089", "-c", "4096", "-ngl", "99", "--jinja"]
if os.environ.get("PETAL_CPU_ONLY") == "1":
    args[args.index("-ngl") + 1] = "0"
    args.extend(["--device", "none", "-fit", "off"])
with (root / ".local/tool-server.log").open("ab") as log:
    process = subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
print(f"Tool server PID: {process.pid}; http://127.0.0.1:8089")
