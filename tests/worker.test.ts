import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker, { executeTool, type Env } from "../src/index";
import { notePath, readNote, wikiLinks, writeNote } from "../src/knowledge";

// Exercise the real migration and SQL through a small D1 adapter, not canned query results.
function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../migrations/0001_vault.sql", import.meta.url), "utf8"));
  function prepare(sql: string) {
    let args: unknown[] = [];
    const statement = {
      bind(...values: unknown[]) { args = values; return statement; },
      async first() { return sqlite.prepare(sql).get(...args as []) || null; },
      async all() { return { results: sqlite.prepare(sql).all(...args as []) }; },
      async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...args as []).changes) } }; },
    };
    return statement;
  }
  const db = {
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      sqlite.exec("BEGIN");
      try {
        const result = [];
        for (const statement of statements) result.push(await statement.run());
        sqlite.exec("COMMIT");
        return result;
      } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  } as unknown as D1Database;
  return { db, close: () => sqlite.close() };
}

let env: Env;
let close: () => void;
beforeEach(() => {
  const instance = database();
  close = instance.close;
  env = { DB: instance.db, ASSETS: { fetch: async () => new Response("assets") } as Fetcher, APP_PASSWORD: "test-password", OPENAI_API_KEY: "server-only-openai", EXA_API_KEY: "server-only-exa", REALTIME_MODEL: "gpt-realtime-2.1-mini", REALTIME_VOICE: "marin", EXA_SEARCH_TYPE: "fast" };
});
afterEach(() => { close(); vi.unstubAllGlobals(); });

function request(path: string, method = "GET", body?: unknown, password = "test-password") {
  return new Request(`https://hackbuddy.example${path}`, { method, headers: { Authorization: `Bearer ${password}`, Origin: "https://hackbuddy.example", "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
}

describe("persistent Markdown vault", () => {
  it("preserves edits and history and rejects stale revisions and duplicate creation", async () => {
    await writeNote(env.DB, "Ideas/Voice.md", "# Voice\nAn idea", 0);
    const updated = await writeNote(env.DB, "Ideas/Voice.md", "# Voice\nAn idea, expanded", 1);
    expect(updated.revision).toBe(2);
    await expect(writeNote(env.DB, "Ideas/Voice.md", "overwrite", 1)).rejects.toMatchObject({ status: 409 });
    await expect(writeNote(env.DB, "Ideas/Voice.md", "duplicate", 0)).rejects.toMatchObject({ status: 409 });
    expect((await readNote(env.DB, "Ideas/Voice.md")).content).toContain("expanded");
    const response = await worker.fetch(request("/api/revisions?path=Ideas%2FVoice.md"), env);
    const { revisions } = await response.json() as any;
    expect(revisions.map((r: any) => r.revision)).toEqual([2, 1]);
    expect(revisions[1].content).toBe("# Voice\nAn idea");
  });
  it("finds content, literal LIKE characters, aliases and backlinks", async () => {
    await writeNote(env.DB, "Projects/Voice.md", "# Voice\nRealtime architecture", 0);
    await writeNote(env.DB, "Context.md", "[[Projects/Voice|Voice project]] and [[Voice#Plan]] 100%", 0);
    expect(wikiLinks("[[Voice#Plan|label]]")).toEqual(["Voice"]);
    const search = await executeTool(env, "search_notes", { query: "architecture" }) as any;
    expect(search.notes.map((n: any) => n.path)).toEqual(["Projects/Voice.md"]);
    const literal = await executeTool(env, "search_notes", { query: "%" }) as any;
    expect(literal.notes.map((n: any) => n.path)).toEqual(["Context.md"]);
    expect(await executeTool(env, "get_backlinks", { path: "Projects/Voice.md" })).toEqual({ backlinks: ["Context.md"] });
  });
  it("rejects traversal and malformed paths but accepts Unicode folders", () => {
    for (const path of ["../secret.md", "/root.md", "a//b.md", "a\\b.md", "a/./b.md", "x.txt", "x\0.md"]) expect(() => notePath(path)).toThrow();
    expect(notePath("Idées/Café.md")).toBe("Idées/Café.md");
  });
});

describe("Worker API and provider contracts", () => {
  it("requires a password for all APIs and rejects other origins", async () => {
    expect((await worker.fetch(request("/api/export", "GET", undefined, "wrong"), env)).status).toBe(401);
    const foreign = request("/api/config");
    foreign.headers.set("Origin", "https://foreign.example");
    expect((await worker.fetch(foreign, env)).status).toBe(403);
    expect((await worker.fetch(request("/api/config"), { ...env, APP_PASSWORD: undefined })).status).toBe(503);
  });
  it("posts multipart SDP and Realtime config using server credentials", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(_url).toBe("https://api.openai.com/v1/realtime/calls");
      expect(init.headers).toEqual({ Authorization: "Bearer server-only-openai" });
      const form = init.body as FormData;
      expect(form.get("sdp")).toBe("v=0\r\nmock-offer");
      const session = JSON.parse(form.get("session") as string);
      expect(session.type).toBe("realtime");
      expect(session.model).toBe("gpt-realtime-2.1-mini");
      expect(session.tools.map((tool: any) => tool.name)).toContain("write_note");
      expect(session.audio.input.format).toBeUndefined();
      return new Response("v=0\r\nmock-answer", { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(request("/api/session", "POST", { sdp: "v=0\r\nmock-offer" }), env);
    expect(response.status).toBe(201);
    expect(await response.text()).toBe("v=0\r\nmock-answer");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("returns useful OpenAI failures and validates Exa result limits", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { message: "Model access unavailable" } }, { status: 403 })));
    const response = await worker.fetch(request("/api/session", "POST", { sdp: "v=0\r\noffer" }), env);
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Model access unavailable" });
    await expect(executeTool(env, "web_search", { query: "test", num_results: 100 })).rejects.toMatchObject({ status: 400 });
  });
  it("returns sourced Exa text and keeps the search key server-side", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("https://api.exa.ai/search");
      expect(init.headers).toMatchObject({ "x-api-key": "server-only-exa" });
      expect(JSON.parse(init.body as string)).toMatchObject({ query: "WebRTC", type: "fast", numResults: 3 });
      return Response.json({ results: [{ title: "WebRTC docs", url: "https://webrtc.org", text: "Reference", highlights: ["Audio"], irrelevant: "omit" }] });
    }));
    const result = await executeTool(env, "web_search", { query: "WebRTC", num_results: 3 }) as any;
    expect(result.results[0]).toEqual({ title: "WebRTC docs", url: "https://webrtc.org", text: "Reference", highlights: ["Audio"] });
    expect(result.searched_at).toBeTruthy();
  });
});
