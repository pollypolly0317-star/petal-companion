const $ = (id) => document.getElementById(id);
let password = "";
let selected = null;
let dirty = false;
let notes = [];
let call = null;
let noticeTimer;

function notice(message) {
  $("notice").textContent = message;
  $("notice").classList.add("visible");
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => $("notice").classList.remove("visible"), 9000);
}
async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { Authorization: `Bearer ${password}`, ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return response;
}
const apiJSON = async (path, options) => (await api(path, options)).json();

$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  password = $("password").value;
  try {
    const config = await apiJSON("/api/config");
    $("model").textContent = config.model;
    $("login").hidden = true;
    $("workspace").hidden = false;
    $("export").disabled = false;
    $("password").value = "";
    await refreshNotes();
    if (!config.openai) notice("Add OPENAI_API_KEY to enable voice conversations.");
    else if (!config.exa) notice("Add EXA_API_KEY to enable web research.");
  } catch (error) { notice(error.message); }
});

async function refreshNotes() {
  const data = await apiJSON(`/api/notes?q=${encodeURIComponent($("search").value)}`);
  notes = data.notes;
  $("notes").replaceChildren();
  for (const note of notes) {
    const button = document.createElement("button");
    button.className = "note-item" + (selected?.path === note.path ? " active" : "");
    button.textContent = note.path;
    const meta = document.createElement("small");
    meta.textContent = `revision ${note.revision} · ${new Date(note.updated_at).toLocaleDateString()}`;
    button.append(meta);
    button.addEventListener("click", () => openNote(note.path).catch(error => notice(error.message)));
    $("notes").append(button);
  }
  if (!notes.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "No notes yet. Your conversation can create the first one.";
    $("notes").append(empty);
  }
}
async function openNote(path, force = false) {
  if (dirty && !force && !confirm("Discard your unsaved editor changes?")) return;
  selected = await apiJSON(`/api/note?path=${encodeURIComponent(path)}`);
  showNote();
  await refreshNotes();
}
function showNote() {
  dirty = false;
  $("note-title").textContent = selected.path;
  $("note-meta").textContent = `Revision ${selected.revision} · ${new Date(selected.updated_at).toLocaleString()}`;
  $("editor").value = selected.content;
  $("editor").disabled = false;
  $("save").disabled = true;
  $("download").disabled = false;
  $("history").open = false;
  $("revisions").replaceChildren();
  renderLinks();
}
function renderLinks() {
  $("links").replaceChildren();
  const targets = [...$("editor").value.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)].map(match => match[1].split("#")[0]);
  for (const target of new Set(targets)) {
    const button = document.createElement("button");
    button.textContent = `↗ ${target}`;
    button.addEventListener("click", async () => {
      try {
        const { notes: all } = await apiJSON("/api/export");
        const found = all.find(note => note.path.replace(/\.md$/, "") === target) || all.find(note => note.path.split("/").pop().replace(/\.md$/, "") === target);
        if (found) await openNote(found.path);
        else notice(`No note exists yet for [[${target}]].`);
      } catch (error) { notice(error.message); }
    });
    $("links").append(button);
  }
}
$("editor").addEventListener("input", () => { dirty = true; $("save").disabled = false; renderLinks(); });
$("save").addEventListener("click", async () => {
  if (!selected) return;
  try {
    selected = await apiJSON("/api/note", { method: "PUT", body: JSON.stringify({ path: selected.path, content: $("editor").value, expected_revision: selected.revision }) });
    showNote();
    await refreshNotes();
  } catch (error) { notice(error.message); }
});
$("new-note").addEventListener("click", async () => {
  if (dirty && !confirm("Discard your unsaved editor changes?")) return;
  const path = prompt("Markdown path", "Ideas/New idea.md");
  if (!path) return;
  try {
    selected = await apiJSON("/api/note", { method: "PUT", body: JSON.stringify({ path, content: `# ${path.split("/").pop().replace(/\.md$/, "")}\n\n`, expected_revision: 0 }) });
    showNote();
    await refreshNotes();
  } catch (error) { notice(error.message); }
});
let searchTimer;
$("search").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => refreshNotes().catch(error => notice(error.message)), 250);
});
$("history").addEventListener("toggle", async () => {
  if (!$("history").open || !selected) return;
  const path = selected.path;
  try {
    const { revisions } = await apiJSON(`/api/revisions?path=${encodeURIComponent(path)}`);
    if (selected?.path !== path) return;
    $("revisions").replaceChildren();
    for (const revision of revisions) {
      const button = document.createElement("button");
      button.textContent = `Load revision ${revision.revision} · ${new Date(revision.updated_at).toLocaleString()}`;
      button.addEventListener("click", () => {
        if (dirty && !confirm("Replace unsaved editor changes with this revision?")) return;
        $("editor").value = revision.content;
        dirty = true;
        $("save").disabled = false;
        renderLinks();
        notice("Revision loaded in the editor. Save to create a new revision.");
      });
      $("revisions").append(button);
    }
  } catch (error) { notice(error.message); }
});
function download(name, content, type = "text/markdown") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("download").addEventListener("click", () => { if (selected) download(selected.path.split("/").pop(), $("editor").value); });
// A portable uncompressed tar preserves folder paths and Unicode Markdown filenames.
function tar(files) {
  const encoder = new TextEncoder();
  const chunks = [];
  const octal = (n, width) => n.toString(8).padStart(width - 1, "0") + "\0";
  for (const file of files) {
    const content = encoder.encode(file.content);
    const header = new Uint8Array(512);
    const put = (value, offset, length) => header.set(encoder.encode(value).slice(0, length), offset);
    let name = file.path;
    if (encoder.encode(name).length > 100) {
      const splits = [...name.matchAll(/\//g)].map(match => match.index).reverse();
      const split = splits.find(index => encoder.encode(name.slice(0, index)).length <= 155 && encoder.encode(name.slice(index + 1)).length <= 100);
      if (split === undefined) throw new Error(`Path too long for tar export: ${name}. Download it individually.`);
      put(name.slice(0, split), 345, 155);
      name = name.slice(split + 1);
    }
    put(name, 0, 100); put(octal(420, 8), 100, 8); put(octal(0, 8), 108, 8); put(octal(0, 8), 116, 8);
    put(octal(content.length, 12), 124, 12); put(octal(Math.floor(Date.now() / 1000), 12), 136, 12);
    put("        ", 148, 8); put("0", 156, 1); put("ustar\0", 257, 6); put("00", 263, 2);
    put(header.reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, "0") + "\0 ", 148, 8);
    chunks.push(header, content, new Uint8Array((512 - content.length % 512) % 512));
  }
  chunks.push(new Uint8Array(1024));
  return new Blob(chunks, { type: "application/x-tar" });
}
$("export").addEventListener("click", async () => {
  try { const { notes: all } = await apiJSON("/api/export"); download("hackbuddy-vault.tar", tar(all), "application/x-tar"); }
  catch (error) { notice(error.message); }
});

function logTool(name, message) {
  const entry = document.createElement("div");
  entry.className = "tool-entry";
  entry.textContent = `${new Date().toLocaleTimeString()} · ${name} · ${message}`;
  $("activity").prepend(entry);
  while ($("activity").children.length > 50) $("activity").lastChild.remove();
  return entry;
}
function transcript(session, id, role, text, append = false) {
  let element = session.transcripts.get(id);
  if (!element) {
    element = document.createElement("div");
    element.className = `utterance ${role}`;
    const label = document.createElement("small");
    label.textContent = role === "user" ? "You" : "HackBuddy";
    const content = document.createElement("span");
    element.append(label, content);
    session.transcripts.set(id, element);
    $("transcript").append(element);
  }
  const content = element.querySelector("span");
  content.textContent = append ? content.textContent + text : text;
  $("transcript").scrollTop = $("transcript").scrollHeight;
}
function send(session, event) {
  if (call !== session || session.channel?.readyState !== "open") return false;
  session.channel.send(JSON.stringify(event));
  return true;
}
function resume(session) {
  if (call === session && !session.ending && session.resume && !session.responding && !session.speaking && !session.pendingTools) {
    session.resume = false;
    send(session, { type: "response.create" });
    session.responding = true;
  }
}
async function handleTools(session, calls) {
  // One batch per completed response; serialize edits and return every output before resuming.
  session.pendingTools += 1;
  for (const item of calls) {
    if (session.seen.has(item.call_id)) continue;
    session.seen.add(item.call_id);
    const entry = logTool(item.name, "running…");
    let result;
    try {
      const args = JSON.parse(item.arguments);
      result = await apiJSON("/api/tools", { method: "POST", body: JSON.stringify({ name: item.name, arguments: args }) });
      entry.textContent = `${item.name} · done${result.path ? ` · ${result.path}` : ""}`;
      if (item.name === "write_note") {
        await refreshNotes().catch(error => notice(error.message));
        if (!dirty && (!selected || selected.path === result.path)) { selected = result; showNote(); }
        else if (selected?.path === result.path) notice("HackBuddy updated this note. Your unsaved edit is preserved; reload and merge before saving.");
      }
    } catch (error) {
      result = { error: error.message };
      entry.textContent = `${item.name} · ${error.message}`;
    }
    send(session, { type: "conversation.item.create", item: { type: "function_call_output", call_id: item.call_id, output: JSON.stringify(result) } });
  }
  session.pendingTools -= 1;
  session.resume = true;
  resume(session);
}
function handleEvent(session, event) {
  if (call !== session) return;
  switch (event.type) {
    case "session.created":
      clearTimeout(session.timeout);
      $("voice-status").textContent = "Connected · tell me what’s on your mind";
      $("orb").classList.add("connected");
      $("mute").disabled = false;
      $("message").disabled = false;
      $("send").disabled = false;
      break;
    case "input_audio_buffer.speech_started": session.speaking = true; $("voice-status").textContent = "Listening…"; break;
    case "input_audio_buffer.speech_stopped": session.speaking = false; $("voice-status").textContent = "Thinking…"; break;
    case "conversation.item.input_audio_transcription.completed": transcript(session, event.item_id, "user", event.transcript); break;
    case "conversation.item.input_audio_transcription.failed": notice("Could not transcribe this turn; voice conversation can continue."); break;
    case "response.output_audio_transcript.delta":
    case "response.output_text.delta": transcript(session, event.item_id, "assistant", event.delta, true); break;
    case "response.output_audio_transcript.done":
    case "response.output_text.done": transcript(session, event.item_id, "assistant", event.transcript ?? event.text); break;
    case "response.created": session.responding = true; session.resume = false; break;
    case "response.done": {
      session.responding = false;
      $("voice-status").textContent = "Connected · listening";
      const calls = (event.response.output || []).filter(item => item.type === "function_call" && item.status === "completed");
      if (calls.length) {
        session.toolQueue = session.toolQueue.then(() => handleTools(session, calls)).catch(error => notice(error.message));
      } else resume(session);
      if (event.response.status === "failed") notice(event.response.status_details?.error?.message || "The model response failed.");
      break;
    }
    case "error": notice(event.error?.message || "Realtime error"); break;
  }
}
function cleanup(session) {
  if (call !== session) return;
  call = null;
  clearTimeout(session.timeout);
  session.abort.abort();
  session.microphone?.getTracks().forEach(track => track.stop());
  session.channel?.close();
  session.peer?.close();
  $("audio").srcObject = null;
  $("orb").classList.remove("connected");
  $("start").disabled = false;
  for (const id of ["stop", "mute", "message", "send"]) $(id).disabled = true;
  $("mute").textContent = "Mute";
}
async function gatherIce(peer, signal) {
  if (peer.iceGatheringState === "complete") return;
  await new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timer);
      peer.removeEventListener("icegatheringstatechange", onState);
      signal.removeEventListener("abort", onAbort);
      error ? reject(error) : resolve();
    };
    const onState = () => { if (peer.iceGatheringState === "complete") finish(); };
    const onAbort = () => finish(new Error("Connection cancelled"));
    const timer = setTimeout(() => finish(new Error("ICE gathering timed out")), 10_000);
    peer.addEventListener("icegatheringstatechange", onState);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort(); else onState();
  });
}
$("start").addEventListener("click", async () => {
  const session = { abort: new AbortController(), transcripts: new Map(), seen: new Set(), toolQueue: Promise.resolve(), pendingTools: 0, responding: false, speaking: false, resume: false };
  call = session;
  $("start").disabled = true;
  $("stop").disabled = false;
  $("voice-status").textContent = "Connecting…";
  session.timeout = setTimeout(() => {
    if (call === session) { notice("Connection timed out. Try starting again."); cleanup(session); $("voice-status").textContent = "Connection timed out"; }
  }, 45_000);
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access requires HTTPS or localhost.");
    const microphone = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    if (call !== session) { microphone.getTracks().forEach(track => track.stop()); return; }
    session.microphone = microphone;
    const peer = new RTCPeerConnection();
    session.peer = peer;
    peer.addEventListener("track", event => {
      if (call !== session) return;
      $("audio").srcObject = event.streams[0] || new MediaStream([event.track]);
      $("audio").play().catch(() => notice("Use the audio play control to hear HackBuddy."));
    });
    peer.addEventListener("connectionstatechange", () => {
      if (call === session && ["failed", "closed"].includes(peer.connectionState)) {
        cleanup(session); $("voice-status").textContent = "Disconnected";
      }
    });
    microphone.getTracks().forEach(track => peer.addTrack(track, microphone));
    const channel = peer.createDataChannel("oai-events");
    session.channel = channel;
    channel.addEventListener("message", ({ data }) => {
      try { handleEvent(session, JSON.parse(data)); } catch (error) { notice(error.message); }
    });
    channel.addEventListener("close", () => {
      if (call === session) { cleanup(session); $("voice-status").textContent = "Disconnected"; }
    });
    await peer.setLocalDescription(await peer.createOffer());
    await gatherIce(peer, session.abort.signal);
    const response = await api("/api/session", { method: "POST", body: JSON.stringify({ sdp: peer.localDescription.sdp }), signal: session.abort.signal });
    const sdp = await response.text();
    if (call !== session) return;
    await peer.setRemoteDescription({ type: "answer", sdp });
  } catch (error) {
    if (call === session) { notice(error.message); cleanup(session); $("voice-status").textContent = "Could not connect"; }
  }
});
$("stop").addEventListener("click", async () => {
  const session = call;
  if (!session) return;
  session.ending = true;
  $("stop").disabled = true;
  $("message").disabled = true;
  $("send").disabled = true;
  if (session.responding) send(session, { type: "response.cancel" });
  session.microphone?.getTracks().forEach(track => { track.enabled = false; });
  $("voice-status").textContent = "Finishing pending note saves…";
  // Realtime closes by disconnecting; it does not use GPT-Live session.close events.
  await session.toolQueue;
  cleanup(session);
  if (!call) $("voice-status").textContent = "Conversation ended · saved notes remain in your vault";
});
$("mute").addEventListener("click", () => {
  if (!call?.microphone) return;
  const tracks = call.microphone.getAudioTracks();
  const enabled = !tracks[0].enabled;
  tracks.forEach(track => { track.enabled = enabled; });
  $("mute").textContent = enabled ? "Mute" : "Unmute";
});
$("message-form").addEventListener("submit", event => {
  event.preventDefault();
  const value = $("message").value.trim();
  if (!value || !call || call.responding || call.pendingTools) { if (value) notice("Wait for the current response to finish."); return; }
  const session = call;
  if (!send(session, { type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: value }] } })) return;
  transcript(session, crypto.randomUUID(), "user", value);
  send(session, { type: "response.create" });
  session.responding = true;
  $("message").value = "";
});
window.addEventListener("beforeunload", event => { if (dirty) { event.preventDefault(); event.returnValue = ""; } });
window.addEventListener("pagehide", () => { if (call) cleanup(call); });
