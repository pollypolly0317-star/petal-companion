"""Probe the local speech server, saving streamed PCM and timing measurements."""
import argparse
import base64
import json
import struct
import time
import urllib.request
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def generate(messages, name, reset=True, max_tokens=256, extra=None, on_event=None):
    payload = {"model": "", "messages": messages, "stream": True,
               "max_tokens": max_tokens, "reset_context": reset, **(extra or {})}
    request = urllib.request.Request("http://127.0.0.1:8088/v1/chat/completions",
                                    data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    started = time.monotonic()
    text = ""
    pcm = bytearray()
    first_text = first_audio = None
    finish = None
    events = []
    with urllib.request.urlopen(request, timeout=180) as response:
        for line in response:
            if not line.startswith(b"data: "):
                continue
            raw = line[6:].strip()
            if raw == b"[DONE]":
                break
            event = json.loads(raw)
            if "error" in event:
                raise RuntimeError(event["error"].get("message", str(event["error"])))
            events.append(event)
            choice = event.get("choices", [{}])[0]
            delta = choice.get("delta", {})
            if delta.get("content"):
                if first_text is None:
                    first_text = time.monotonic() - started
                text += delta["content"]
                print(delta["content"], end="", flush=True)
                if on_event:
                    on_event({"type": "text", "delta": delta["content"]})
            audio = delta.get("audio_chunk")
            if audio and audio.get("data"):
                if first_audio is None:
                    first_audio = time.monotonic() - started
                pcm.extend(base64.b64decode(audio["data"]))
                if on_event:
                    on_event({"type": "audio", "data": audio["data"], "sample_rate": 24000, "encoding": "f32le"})
            if choice.get("finish_reason"):
                finish = choice["finish_reason"]
    elapsed = time.monotonic() - started
    output = ROOT / ".local/probes"
    output.mkdir(exist_ok=True)
    if pcm:
        samples = struct.unpack(f"<{len(pcm)//4}f", pcm)
        integers = [max(-32768, min(32767, int(sample * 32767))) for sample in samples]
        with wave.open(str(output / f"{name}.wav"), "wb") as wav:
            wav.setparams((1, 2, 24000, 0, "NONE", "not compressed"))
            wav.writeframes(struct.pack(f"<{len(integers)}h", *integers))
    result = {"name": name, "text": text, "first_text_s": first_text, "first_audio_s": first_audio,
              "elapsed_s": elapsed, "audio_duration_s": len(pcm) / 4 / 24000, "finish_reason": finish}
    (output / f"{name}.json").write_text(json.dumps({**result, "events": events}, indent=2))
    print("\n" + json.dumps(result, indent=2), flush=True)
    return result


def audio_message(path):
    return {"role": "user", "content": [{"type": "input_audio", "input_audio": {
        "format": "wav", "data": base64.b64encode(Path(path).read_bytes()).decode()}}]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", default="hello")
    parser.add_argument("--system", default="Respond with interleaved text and audio.")
    parser.add_argument("--text", default="Hello! In one short sentence, tell me what you can help me with.")
    parser.add_argument("--audio")
    parser.add_argument("--max-tokens", type=int, default=256)
    args = parser.parse_args()
    generate([{"role": "system", "content": args.system}, audio_message(args.audio) if args.audio else {"role": "user", "content": args.text}], args.name, max_tokens=args.max_tokens)
