import {isShowcase} from './runtime.js';
import {t} from './i18n.js';
const $ = id => document.getElementById(id);
let session = null;
const SILENCE_MS = 650;
const THRESHOLD = 0.012;

function log(message) {
  $("activity").textContent = `${new Date().toLocaleTimeString()} ${message}\n` + $("activity").textContent.slice(0, 6000);

}
function line(role, text) {
  const entry = document.createElement("div");
  const label = document.createElement("small"); label.textContent = role === "You" ? t("you") : "PETAL";
  entry.className = role === "You" ? "user-message" : "";
  const content = document.createElement("span"); content.textContent = text;
  entry.append(label, content);
  $("conversation").append(entry);
  $("conversation").scrollTop = $("conversation").scrollHeight;
  return entry;
}
async function refreshNotes() {
  window.dispatchEvent(new Event("vault-changed"));
}
let currentState = "idle";
function talkState(state) {
  currentState = state;
  window.petalVoiceActive = state !== "idle";
  $("send-message").disabled = isShowcase || state !== "idle" || Boolean(window.petalChatBusy);
  const ready = window.petalReadiness || {};
  $("start").disabled = isShowcase || state === "idle" && (!ready.audio_ready || ($("mode").value === "tools" && !ready.chat_ready) || window.petalChatBusy);
  $("start").className = "talk-button icon-button" + (state === "listening" ? " listening" : state === "speaking" ? " speaking" : "");
  const label = t(state === "idle" ? "talk" : state === "listening" ? "endTalk" : "interrupt");
  $("talk-label").textContent = label; $("start").setAttribute("aria-label", label);
  $("talk-icon").innerHTML = '<svg class="icon"><use href="./assets/icons.svg#' + (state === "idle" ? "Mic" : state === "listening" ? "Square" : "Pause") + '"/></svg>';
}
window.addEventListener("petal-readiness", () => talkState(currentState));
window.addEventListener("petal-language", () => talkState(currentState));
$("mode").addEventListener("change", () => talkState(currentState));
function resetCapture(s) { s.chunks = []; s.preRoll = []; s.started = null; s.lastVoice = null; s.voicedMs = 0; }
function stopPlayback(s) {
  for (const source of s.sources) { try { source.stop(); } catch {} }
  s.sources.clear();
  s.playAt = 0;
}
function release(s) {
  if (session !== s) return;
  session = null;
  s.abort?.abort();
  stopPlayback(s);
  s.stream?.getTracks().forEach(track => track.stop());
  s.node?.disconnect(); s.source?.disconnect(); s.gain?.disconnect();
  s.context?.close();
  talkState("idle"); $("mode").disabled = false;
  $("level").style.width = "0";
}
function encodeWav(chunks, rate) {
  const count = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const buffer = new ArrayBuffer(44 + count * 2);
  const view = new DataView(buffer);
  const text = (offset, value) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, 36 + count * 2, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, "data"); view.setUint32(40, count * 2, true);
  let offset = 44;
  for (const chunk of chunks) for (const sample of chunk) {
    view.setInt16(offset, Math.max(-32768, Math.min(32767, Math.round(sample * 32767))), true);
    offset += 2;
  }
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
function play(s, event) {
  const raw = atob(event.data);
  const bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const samples = new Float32Array(bytes.length / 4);
  for (let i = 0; i < samples.length; i++) samples[i] = view.getFloat32(i * 4, true);
  const buffer = s.context.createBuffer(1, samples.length, event.sample_rate);
  buffer.copyToChannel(samples, 0);
  const source = s.context.createBufferSource(); source.buffer = buffer; source.connect(s.context.destination);
  s.playAt = Math.max(s.playAt, s.context.currentTime + 0.04);
  source.start(s.playAt); s.playAt += buffer.duration;
  s.sources.add(source); source.onended = () => s.sources.delete(source);
  $("status").textContent = t("speaking");
  talkState("speaking");
}
async function turn(s, chunks) {
  s.busy = true;
  s.abort = new AbortController();
  const abort = s.abort;
  resetCapture(s);
  talkState("speaking");
  $("status").textContent = t("thinking");
  const sentAt = performance.now();
  let firstAudio = null, assistant = null, responseText = "", completed = false;
  try {
    const response = await fetch("/turn-stream", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: $("mode").value, audio: encodeWav(chunks, s.context.sampleRate) }), signal: abort.signal });
    if (!response.ok) throw new Error(`Local request failed (${response.status})`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder(); let pending = "";
    const handle = event => {
      if (session !== s || abort.signal.aborted) return;
      if (event.type === "error") throw new Error(event.message);
      if (event.type === "status") $("status").textContent = event.message.startsWith("Waiting") ? t("waiting") : t("thinking");
      if (event.type === "transcript") line("You", event.text);
      if (event.type === "response") { responseText = event.text; assistant = line("HackBuddy", event.text); }
      if (event.type === "text" && $("mode").value === "native") {
        if (!assistant) { line("You", t("spoken")); assistant = line("HackBuddy", ""); }
        responseText += event.delta; assistant.querySelector("span").textContent = responseText;
      }
      if (event.type === "tool_started") log(`${event.name} · running`);
      if (event.type === "tool_done") {
        const result = event.result;
        log(result.error ? `${event.name} · ${result.error}` : result.saved ? `Saved · ${result.path} · ${result.content.slice(0, 120).replace(/\n/g, " ")}` : `${event.name} · done`);
        refreshNotes().catch(error => log(error.message));
      }
      if (event.type === "audio") {
        if (firstAudio === null) firstAudio = (performance.now() - sentAt) / 1000;
        play(s, event);
      }
      if (event.type === "done") {
        completed = true;
        $("timing").textContent = JSON.stringify({ ...event.timing, browser_first_audio_s: firstAudio,
          approximate_end_of_speech_to_audio_s: firstAudio === null ? null : firstAudio + SILENCE_MS / 1000 }, null, 2);
      }
    };
    while (true) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      let index;
      while ((index = pending.indexOf("\n")) >= 0) {
        const text = pending.slice(0, index); pending = pending.slice(index + 1);
        if (text.trim()) handle(JSON.parse(text));
      }
      if (done) break;
    }
    if (!completed) throw new Error(t("streamError"));
  } catch (error) {
    if (error.name !== "AbortError" && session === s) { log(error.message); $("status").textContent = error.message; }
  } finally {
    if (session === s && s.abort === abort) {
      // Keep the microphone active but gate turn capture until generated speech finishes.
      const remaining = Math.max(0, s.playAt - s.context.currentTime);
      await new Promise(resolve => setTimeout(resolve, remaining * 1000 + 180));
      if (session === s && s.abort === abort) { s.busy = false; resetCapture(s); talkState("listening"); $("status").textContent = t("listening"); }
    }
  }
}
function capture(s, samples) {
  if (session !== s) return;
  const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
  $("level").style.width = `${Math.min(100, rms * 1200)}%`;
  if (s.busy) return;
  const now = performance.now();
  const duration = samples.length / s.context.sampleRate * 1000;
  if (s.started === null) {
    s.preRoll.push(samples);
    while (s.preRoll.length > 4) s.preRoll.shift();
    if (rms < THRESHOLD) return;
    s.started = now; s.lastVoice = now; s.chunks = [...s.preRoll]; s.preRoll = [];
    s.voicedMs = duration;
    $("status").textContent = t("listening");
    return;
  }
  s.chunks.push(samples);
  if (rms >= THRESHOLD) { s.lastVoice = now; s.voicedMs += duration; }
  if (now - s.lastVoice >= SILENCE_MS || now - s.started > 25000) {
    if (s.voicedMs >= 240) turn(s, [...s.chunks]);
    else resetCapture(s);
  }
}
$("start").onclick = async () => {
  if (session) {
    const s = session;
    if (s.busy) {
      s.abort?.abort(); s.abort = null; stopPlayback(s); s.busy = false; resetCapture(s); talkState("listening");
      $("status").textContent = t("listening");
    } else { release(s); $("status").textContent = t("ready"); }
    return;
  }
  if ($("start").disabled || window.petalChatBusy) return;
  window.petalVoiceActive = true;
  const s = { sources: new Set(), playAt: 0, busy: false };
  session = s; resetCapture(s);
  $("start").disabled = true; $("mode").disabled = true;
  try {
    s.context = new AudioContext({ sampleRate: 16000 });
    await s.context.resume();
    s.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    if (session !== s) { s.stream.getTracks().forEach(track => track.stop()); return; }
    await s.context.audioWorklet.addModule("/microphone.js");
    if (session !== s) return;
    s.node = new AudioWorkletNode(s.context, "microphone");
    s.source = s.context.createMediaStreamSource(s.stream);
    s.gain = s.context.createGain(); s.gain.gain.value = 0;
    s.source.connect(s.node); s.node.connect(s.gain); s.gain.connect(s.context.destination);
    s.node.port.onmessage = event => capture(s, event.data);
    talkState("listening"); $("status").textContent = t("listening");
  } catch (error) { release(s); $("status").textContent = t("micError"); }
};
window.addEventListener("pagehide", () => { if (session) release(session); });
refreshNotes().catch(error => log(error.message));

$("chat-dialog").addEventListener("close", () => { if(session) release(session); });
window.addEventListener("petal-quiet", () => { if(session) release(session); });
talkState("idle");
