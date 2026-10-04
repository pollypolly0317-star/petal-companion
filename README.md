# HackBuddy

## Start the local voice workspace

HackBuddy includes a minimal, flat pink **Petal** workspace for personal knowledge: hands-free voice, a Markdown editor, wikilinks, and live tool feedback. Models run locally without an OpenAI API key. The tested machine is an Apple M4 MacBook Air with 24 GB RAM.

### Requirements

- Apple Silicon Mac (the included audio runner setup targets macOS ARM64).
- Python 3.10+ and Homebrew; roughly 3 GB free for downloaded models/runners.
- A browser with microphone permission on localhost.

```sh
git clone https://github.com/Masmedeam/hackbuddy.git
cd hackbuddy
brew install llama.cpp

# Download and checksum-verify the local models and audio runner.
python3 local/setup.py
python3 local/setup_tools.py
python3 local/setup_encoder.py

# Start local inference (these two commands launch background processes).
python3 local/start.py
python3 local/start_tools.py

# Start the web app in this terminal.
python3 local/server.py
```

Open **http://localhost:8090** and click **Talk**. Allow the microphone, then speak. For example:

> Remember this in a note: my project is Balcony Buddy, an app for growing herbs in small apartments.

The app detects the end of speech, runs knowledge tools, and streams a spoken reply. Click the same button during a response to interrupt, or while listening to end the conversation. Create and edit Markdown notes in the editor while talking; click **Save** to save manual edits. Concurrent edits are protected with content revisions.

**Storage:** Markdown files live in `.local/vault/`; previous contents are backed up in `.local/history/`. Models, generated audio, and logs also live under `.local/`, which is excluded from Git. Back up your vault separately. Local voice startup does not need `npm install`, Cloudflare, or an OpenAI key.

**Web search:** optional Exa support reads `EXA_API_KEY` from the web app's environment. Supply it before running `python3 local/server.py` to enable the search tool.

**Runtime:** audio inference uses port **8088**, tool inference **8089**, and the web app **8090**. The inference launchers print process IDs; stop those processes with `kill <PID>` when finished. Avoid launching duplicate servers on the same ports. Stop the foreground web app with Ctrl+C.

The reliable tool-enabled mode currently uses **local ASR → LFM2.5-1.2B-Instruct → tools → LFM2.5-Audio TTS**. Native speech-to-speech is available in Settings as an audio-only comparison. Automatic spoken interruption/full duplex is not yet implemented. A warm-model spoken-note smoke test measured approximately **1.17 seconds to first audio after submission**, plus the 650 ms end-of-turn detection delay. Voice quality is still experimental.

See **[local/README.md](local/README.md)** for measurements, limitations, and voice-upgrade candidates.

---

## Cloudflare + OpenAI version

A browser voice partner that builds a persistent, Obsidian-style Markdown vault as you talk. Uses **OpenAI `gpt-realtime-2.1-mini` over WebRTC**, **Exa** for web context, and a **Cloudflare Worker + D1** for storage and tools.

## Architecture

```text
Browser ── microphone / generated audio (WebRTC) ── OpenAI Realtime
   │                 JSON events (data channel)         │
   │ ←── function calls / function_call_output ─────────┘
   │
   └── authenticated same-origin HTTP ── Cloudflare Worker
                                           ├── D1: notes + revisions
                                           ├── Exa: search + extracted sources
                                           └── OpenAI: SDP session creation
```

The Worker serves the UI, holds provider keys, exchanges multipart SDP at `POST /v1/realtime/calls`, and executes the five tools: `search_notes`, `read_note`, `write_note`, `get_backlinks`, and `web_search`. The browser executes completed function-call batches through `/api/tools`, sends all outputs back on the data channel, then requests the next model response.

The model instructions encourage saving substantive conversation context automatically, maintaining `Context.md`, connecting topic notes with `[[wikilinks]]`, and citing web research. Saves appear in the UI immediately. The editor supports manual edits, note creation, revision loading, individual Markdown downloads, and a folder-preserving `.tar` vault export. Extract the export and open the folder as an Obsidian vault.

This is a **single-user vault**. `APP_PASSWORD` gates every API endpoint. The password is held in browser memory for the current page; OpenAI and Exa keys remain on the Worker. All authenticated clients use the same vault.

## Local setup

Requires Node.js 22.13+ (Node 24 recommended; tests use its built-in SQLite support).

1. Install dependencies:
   ```sh
   npm install
   ```
2. Create `.dev.vars` using `.dev.vars.example` and supply:
   ```dotenv
   OPENAI_API_KEY=your-openai-project-key
   EXA_API_KEY=your-exa-key
   APP_PASSWORD=your-long-private-vault-password
   ```
3. Initialize the local database and run:
   ```sh
   npm run db:local
   npm run dev
   ```
4. Open the localhost URL printed by Wrangler (normally `http://localhost:8787`), unlock with `APP_PASSWORD`, and click **Start conversation**. Allow microphone access.

The zero UUID in `wrangler.jsonc` is a placeholder for remote deployment. Wrangler local D1 uses local storage under `.wrangler/`; it does not need a remote database ID. Local and remote databases are separate.

## Deploy to Cloudflare

```sh
npx wrangler login
npx wrangler d1 create hackbuddy-vault
```

Replace `database_id` in `wrangler.jsonc` with the UUID returned by the create command. Then:

```sh
npm run db:remote
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put EXA_API_KEY
npx wrangler secret put APP_PASSWORD
npm run deploy
```

Open the returned `https://hackbuddy.<your-subdomain>.workers.dev` URL. Production HTTPS supports browser microphone access. Set `REALTIME_MODEL`, `REALTIME_VOICE`, and `EXA_SEARCH_TYPE` in `wrangler.jsonc` to change defaults. The OpenAI project must have access to the selected model.

To inspect deployed requests:

```sh
npx wrangler tail
```

## Checks

```sh
npm run check
npm test
node --check public/app.js
npx wrangler deploy --dry-run
```

Tests run the actual migration and vault SQL against SQLite, including stale-write conflicts, revision preservation, search and backlinks, authentication, and mocked OpenAI/Exa HTTP contracts. Actual voice and provider access require a browser and configured keys.

## End-to-end smoke test

1. Unlock the vault and create `Projects/Test.md`. Save an edit and load its earlier revision, then save again. Refresh the page and verify persistence.
2. Start a voice conversation: “I’m building a gardening app for apartment dwellers. Remember that my MVP is plant reminders and help me keep a project note.”
3. Verify `search_notes` / `write_note` activity, an updated Markdown note, and an audible response. Talk again while the assistant speaks to test interruption.
4. Ask: “Search the web for useful balcony gardening guidance, add source links to the note, and link it from my context index.” Verify Exa results and source URLs.
5. Mute/unmute; send a typed message; end the call. Confirm the microphone indicator turns off. Start another conversation and ask what your project is about to verify recall through note tools.
6. Edit a note manually while the model updates it. Unsaved editor text should stay intact; a stale save should report a revision conflict rather than overwrite the newer note.
7. Export the vault, extract the `.tar`, and inspect Markdown files and folders in Obsidian.

## API

All routes require `Authorization: Bearer <APP_PASSWORD>`.

| Route | Purpose |
| --- | --- |
| `GET /api/config` | Model and provider configuration flags |
| `POST /api/session` | JSON `{sdp}` → SDP answer |
| `POST /api/tools` | JSON `{name, arguments}` → tool output |
| `GET /api/notes?q=...` | Recent notes or substring search (up to 100) |
| `GET /api/note?path=...` | Full note with revision |
| `PUT /api/note` | `{path, content, expected_revision}`; 0 creates |
| `GET /api/revisions?path=...` | Latest 30 saved versions |
| `GET /api/export` | All saved notes |

Paths must be relative `.md` paths, and content is limited to 48 KB per note. Writes use optimistic revision checks and transactional history. Stop waits for already-dispatched tool batches before disconnecting; tab closure or network loss can interrupt undispatched work. Saved notes persist independently of the voice session. Conversation transcripts appear in the UI; durable memory is curated notes, rather than raw recordings or automatically stored transcripts.

## API documentation

- [Model](https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini)
- [Realtime WebRTC](https://developers.openai.com/api/docs/guides/realtime-webrtc)
- [Realtime function calls](https://developers.openai.com/api/docs/guides/realtime-conversations)
- [Exa search](https://docs.exa.ai/reference/search)

The docs page also includes GPT-Live examples. This implementation uses the **Realtime** lifecycle (`session.created`, `conversation.item.create`, `response.create`) for `gpt-realtime-2.1-mini`. Audio uses negotiated WebRTC media tracks, not audio chunks on the data channel.
