# Petal — Small, fluffy friend.

An English-first, bilingual web prototype for a furry desktop companion: a little focus, a little laughter, and a softer place to land.

## Open the showcase

**https://pollypolly0317-star.github.io/petal-companion/**

The online showcase includes a pat interaction, four mood examples, playful replies, a 60-second breathing break, a persistent 25-minute focus timer, notes stored in the current browser, English/Chinese switching, the furry family concept, and the owner-selected 10-second product demo, including its original audio.

Guided replies are explicitly labeled as samples. The physical companion is a concept. The site does not claim to sense your emotions.

## Full narrated walkthrough

[Watch the complete English demo](https://pollypolly0317-star.github.io/petal-companion/assets/petal-full-demo.mp4): about two minutes, with narration, English captions, the owner-selected product video, and all main web features.

## Live voice on your computer

Live inference runs in the local Python application. GitHub Pages serves static files and does not run model servers.

Requirements: an Apple Silicon Mac, Python 3.10+, approximately 3 GB for models/runners, and a browser with microphone permission.

    git clone https://github.com/pollypolly0317-star/petal-companion.git
    cd petal-companion
    brew install llama.cpp
    python3 local/setup.py
    python3 local/setup_tools.py
    python3 local/setup_encoder.py
    python3 local/start.py
    python3 local/start_tools.py
    python3 local/server.py

Open http://localhost:8090/, choose **Local chat**, and click the microphone. **Fast voice · English** is the default. **Voice + notes · slower** adds the local instruction model and Markdown tools. Click during a response to interrupt, or while listening to end the session.

If Metal cannot initialize, run the model launchers with PETAL_CPU_ONLY=1. Do not start another model process on an occupied port.

- Audio inference: localhost:8088
- Instruction model: localhost:8089
- Web app: localhost:8090
- Local notes: .local/vault/, with prior versions in .local/history/
- Models, logs and generated audio: .local/ (excluded from Git)

See [voice verification](docs/voice-verification.md) for measured results and limitations.

## Build the public site

    python3 scripts/build_showcase.py
    python3 -m http.server 8091 --directory dist

The dist directory contains an explicit allowlist of frontend files. No local notes, recordings, models or secrets are copied. GitHub Actions publishes it to Pages on pushes to main. Browser notes on Pages are separate from the local Markdown vault; clearing site data deletes the browser notes.

## Credits

Built from [Masmedeam/hackbuddy](https://github.com/Masmedeam/hackbuddy), with an original Petal showcase UI. The repository retains the upstream Cloudflare implementation in src/ and public/; it is not used by this Pages deployment. Companion family reference supplied by the project owner. Pink Petal and desk artwork generated for this prototype. Product demo video supplied by the project owner. Icons by [Lucide](https://lucide.dev/), with the ISC license included in local/assets/lucide-LICENSE.
