"""Build only the public showcase: never copy notes, recordings, models or keys."""
from pathlib import Path
import shutil

root = Path(__file__).resolve().parent.parent
source, target = root / "local", root / "dist"
target.mkdir(exist_ok=True)
files = ["index.html", "style.css", "companion.js", "i18n.js", "runtime.js", "vault.js", "voice.js", "microphone.js"]
assets = ["desk-scene.png", "petal-pink.png", "petal-family.png", "icons.svg", "lucide-LICENSE", "petal-product-demo.mp4", "demo-poster.jpg"]
for name in files:
    shutil.copyfile(source / name, target / name)
(target / "assets").mkdir(exist_ok=True)
for name in assets:
    shutil.copyfile(source / "assets" / name, target / "assets" / name)
index = target / "index.html"
index.write_text(index.read_text().replace("<head>", '<head>\n<meta name="petal-mode" content="showcase">'))
(target / ".nojekyll").touch()
print(f"Built showcase in {target}")
