import { HttpError, instructions, listNotes, notePath, readNote, tools, wikiLinks, writeNote, type Note } from "./knowledge";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  OPENAI_API_KEY?: string;
  EXA_API_KEY?: string;
  APP_PASSWORD?: string;
  REALTIME_MODEL: string;
  REALTIME_VOICE: string;
  EXA_SEARCH_TYPE: string;
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
function text(value: unknown, name: string, max = 1000) {
  if (typeof value !== "string" || value.length > max) throw new HttpError(400, `Invalid ${name}`);
  return value;
}
async function body(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length")) > 70_000) throw new HttpError(413, "Request too large");
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > 70_000) throw new HttpError(413, "Request too large");
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new HttpError(400, "Expected a JSON object"); }
}
async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}
async function authorize(request: Request, env: Env) {
  if (!env.APP_PASSWORD) throw new HttpError(503, "Set APP_PASSWORD on the Worker first");
  const provided = request.headers.get("Authorization")?.replace(/^Bearer /, "") || "";
  const [a, b] = await Promise.all([digest(provided), digest(env.APP_PASSWORD)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  if (difference) throw new HttpError(401, "Incorrect vault password");
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) throw new HttpError(403, "Unexpected request origin");
}

export async function executeTool(env: Env, name: string, args: Record<string, unknown>) {
  switch (name) {
    case "search_notes": return { notes: await listNotes(env.DB, text(args.query, "query", 200)) };
    case "read_note": return readNote(env.DB, notePath(args.path));
    case "write_note": return writeNote(env.DB, notePath(args.path), args.content, args.expected_revision);
    case "get_backlinks": {
      const path = notePath(args.path);
      const target = path.slice(0, -3);
      const basename = target.split("/").pop();
      const { results } = await env.DB.prepare("SELECT path, content FROM notes").all<Note>();
      return { backlinks: results.filter(note => wikiLinks(note.content).some(link =>
        link.replace(/\.md$/, "") === target || link.replace(/\.md$/, "") === basename
      )).map(note => note.path) };
    }
    case "web_search": {
      if (!env.EXA_API_KEY) throw new HttpError(503, "Set EXA_API_KEY to enable web search");
      const query = text(args.query, "query").trim();
      if (!query) throw new HttpError(400, "Search query is required");
      if (!Number.isInteger(args.num_results) || (args.num_results as number) < 1 || (args.num_results as number) > 5)
        throw new HttpError(400, "num_results must be between 1 and 5");
      const response = await fetch("https://api.exa.ai/search", {
        method: "POST", headers: { "x-api-key": env.EXA_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ query, type: env.EXA_SEARCH_TYPE || "fast", numResults: args.num_results, contents: { text: { maxCharacters: 3500 }, highlights: { maxCharacters: 1000 } } }),
        signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) throw new HttpError(502, `Exa search failed (${response.status})`);
      const data = await response.json() as { results: Record<string, unknown>[] };
      return { query, searched_at: new Date().toISOString(), results: data.results.map(({ title, url, text, highlights, publishedDate }) => ({ title, url, text, highlights, publishedDate })) };
    }
    default: throw new HttpError(400, "Unknown tool");
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      await authorize(request, env);
      if (url.pathname === "/api/config" && request.method === "GET")
        return json({ model: env.REALTIME_MODEL, voice: env.REALTIME_VOICE, openai: Boolean(env.OPENAI_API_KEY), exa: Boolean(env.EXA_API_KEY) });
      if (url.pathname === "/api/session" && request.method === "POST") {
        if (!env.OPENAI_API_KEY) throw new HttpError(503, "Set OPENAI_API_KEY to start voice chat");
        const input = await body(request);
        const sdp = text(input.sdp, "SDP", 60_000);
        if (!sdp.startsWith("v=0")) throw new HttpError(400, "An SDP offer is required");
        const notes = await listNotes(env.DB);
        const form = new FormData();
        form.set("sdp", sdp);
        form.set("session", JSON.stringify({
          type: "realtime", model: env.REALTIME_MODEL || "gpt-realtime-2.1-mini",
          instructions: `${instructions}\nToday: ${new Date().toISOString().slice(0, 10)}.\nVault note paths: ${JSON.stringify(notes.map(note => note.path))}`,
          output_modalities: ["audio"],
          audio: { input: { transcription: { model: "gpt-4o-mini-transcribe" }, turn_detection: { type: "semantic_vad", create_response: true, interrupt_response: true } }, output: { voice: env.REALTIME_VOICE || "marin" } },
          tools, tool_choice: "auto",
        }));
        const response = await fetch("https://api.openai.com/v1/realtime/calls", {
          method: "POST", headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: form, signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({})) as { error?: { message?: string } };
          throw new HttpError(502, error.error?.message || `OpenAI session creation failed (${response.status})`);
        }
        return new Response(await response.text(), { status: 201, headers: { "Content-Type": "application/sdp", "Cache-Control": "no-store" } });
      }
      if (url.pathname === "/api/tools" && request.method === "POST") {
        const input = await body(request);
        if (!input.arguments || typeof input.arguments !== "object" || Array.isArray(input.arguments)) throw new HttpError(400, "Tool arguments must be an object");
        return json(await executeTool(env, text(input.name, "tool name", 60), input.arguments as Record<string, unknown>));
      }
      if (url.pathname === "/api/notes" && request.method === "GET") return json({ notes: await listNotes(env.DB, url.searchParams.get("q") || "") });
      if (url.pathname === "/api/note" && request.method === "GET") return json(await readNote(env.DB, notePath(url.searchParams.get("path"))));
      if (url.pathname === "/api/note" && request.method === "PUT") {
        const input = await body(request);
        return json(await writeNote(env.DB, notePath(input.path), input.content, input.expected_revision));
      }
      if (url.pathname === "/api/revisions" && request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM revisions WHERE path = ? ORDER BY revision DESC LIMIT 30").bind(notePath(url.searchParams.get("path"))).all();
        return json({ revisions: results });
      }
      if (url.pathname === "/api/export" && request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM notes ORDER BY path").all<Note>();
        return json({ notes: results });
      }
      throw new HttpError(404, "API route not found");
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error("Worker request failed", error instanceof Error ? error.message : "Unknown error");
      return json({ error: "Request failed. Check Worker logs for details." }, 500);
    }
  },
};
