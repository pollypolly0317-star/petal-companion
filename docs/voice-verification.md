# Voice verification — 4 October 2026

Tested locally with checksum-verified Liquid audio and instruction models, using CPU inference because Metal initialization was unavailable in the execution environment.

| Test | Result |
| --- | --- |
| Text → native streamed speech | Passed; first audio at 0.47 seconds |
| Synthetic WAV → native streamed speech | Passed; first audio at 0.81 seconds |
| Synthetic WAV → ASR → instruction agent → streamed TTS | Passed; accurate transcript; 128 audio chunks; first audio at 17.64 seconds |
| Physical microphone and speaker playback | User confirmed audible reply in the browser |

These are single-run measurements after HTTP submission, not latency guarantees. Browser silence detection adds about 650 ms before submission. Voice + notes is currently too slow for a fluid real-time experience in this CPU configuration.

Fast voice uses the audio model's supported interleaved speech prompt. It does not run note tools or the custom Petal instruction-agent personality. Voice + notes uses the Petal prompt and local Markdown tools. Current audio models are English-oriented even when the surrounding UI is switched to Chinese.

The browser gates new capture during playback to prevent echo. Tap the microphone button to interrupt; automatic spoken barge-in and full duplex are not implemented.

The audio runner has no /health endpoint: it returns 404 after starting its HTTP listener, which occurs after model initialization. The app handles that response for audio readiness. The instruction server provides /health.

GitHub Pages includes the UI and recorded prototype demo. Live inference requires the local app; the online page does not expose or automatically connect to a local model server.
