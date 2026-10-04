# Petal local app

Run instructions are in the [main README](../README.md). Measurements and microphone verification are in [voice verification](../docs/voice-verification.md).

The Python server serves the English-first companion showcase and local notes/chat/audio APIs. Companion JavaScript handles sample moments, focus and breathing timers; i18n provides English/Chinese text. The vault preserves unsaved drafts and uses optimistic revisions. The voice module captures the microphone with an AudioWorklet and plays streamed PCM.

Real voice requires the local audio model (8088). Text chat and voice + notes also require the instruction model (8089). Both models run separately from the web server (8090). Fast audio mode is English-oriented and uses the model's fixed system prompt.

This is a single-user localhost application. Do not bind the model servers or note APIs to a public interface. Model weights, recordings, notes, logs, and prior note revisions stay in .local/ and are excluded from Git.
