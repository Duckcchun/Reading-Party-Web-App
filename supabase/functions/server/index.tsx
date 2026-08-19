import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use("*", logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

const BASE = "/server";

// ─── 비속어 필터 ────────────────────────────────────────────────────────────────
const BLOCKED = [
  "시발", "씨발", "ㅅㅂ", "병신", "ㅂㅅ", "개새", "지랄", "좆",
  "fuck", "shit", "bitch",
];
function containsProfanity(text: string): boolean {
  const n = text.toLowerCase().replace(/\s+/g, "");
  return BLOCKED.some((w) => n.includes(w.toLowerCase().replace(/\s+/g, "")));
}

// ─── Spotify Client Credentials (서버 사이드 검색용) ─────────────────────────────
let spotifyToken: { access: string; expiresAt: number } | null = null;

async function getSpotifyToken(): Promise<string | null> {
  const clientId = Deno.env.get("SPOTIFY_CLIENT_ID");
  const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;

  if (spotifyToken && spotifyToken.expiresAt > Date.now() + 10000) {
    return spotifyToken.access;
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  spotifyToken = {
    access: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return spotifyToken.access;
}

// ─── Health ─────────────────────────────────────────────────────────────────────
app.get(`${BASE}/health`, (c) => {
  return c.json({ status: "ok" });
});

// ─── GET /config — Spotify clientId 반환 ────────────────────────────────────────
app.get(`${BASE}/config`, (c) => {
  const clientId = Deno.env.get("SPOTIFY_CLIENT_ID") ?? "";
  return c.json({ clientId });
});

// ─── GET /state — 현재 곡 목록 + 문장 목록 ─────────────────────────────────────
app.get(`${BASE}/state`, async (c) => {
  try {
    const songs = (await kv.get("songs")) ?? [];
    const sentences = (await kv.get("sentences")) ?? [];
    return c.json({ songs, sentences });
  } catch (e) {
    console.error("state error:", e);
    return c.json({ songs: [], sentences: [] });
  }
});

// ─── GET /search?q= — Spotify 검색 프록시 ──────────────────────────────────────
app.get(`${BASE}/search`, async (c) => {
  const q = c.req.query("q")?.trim();
  if (!q) return c.json({ tracks: [] });

  const token = await getSpotifyToken();
  if (!token) return c.json({ tracks: [] }, 500);

  try {
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&market=KR&limit=8`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return c.json({ tracks: [] });

    const data = await res.json();
    const tracks = (data.tracks?.items ?? []).map((t: any) => ({
      id: t.id,
      uri: t.uri,
      name: t.name,
      artists: t.artists?.map((a: any) => a.name).join(", ") ?? "",
      albumImage: t.album?.images?.[1]?.url ?? t.album?.images?.[0]?.url ?? "",
      durationMs: t.duration_ms ?? 0,
    }));

    return c.json({ tracks });
  } catch (e) {
    console.error("search error:", e);
    return c.json({ tracks: [] });
  }
});

// ─── POST /submit — 곡 + 문장 제출 ─────────────────────────────────────────────
app.post(`${BASE}/submit`, async (c) => {
  const body = await c.req.json();
  const { track, text, name } = body;

  const trimmedText = (text ?? "").trim();
  const trimmedName = (name ?? "").trim();

  // 최소 하나는 있어야 함
  if (!track && !trimmedText) {
    return c.json({ error: "empty" }, 400);
  }

  // 비속어 체크
  if (trimmedText && containsProfanity(trimmedText)) {
    return c.json({ error: "profanity" }, 422);
  }
  if (trimmedName && containsProfanity(trimmedName)) {
    return c.json({ error: "profanity" }, 422);
  }

  try {
    const now = Date.now();
    const songs: any[] = (await kv.get("songs")) ?? [];
    const sentences: any[] = (await kv.get("sentences")) ?? [];

    // 곡 추가
    if (track) {
      const hasPlaying = songs.some((s: any) => s.status === "playing");
      const song = {
        id: crypto.randomUUID(),
        uri: track.uri,
        title: track.name,
        artist: track.artists,
        albumImage: track.albumImage,
        durationMs: track.durationMs,
        name: trimmedName || undefined,
        status: hasPlaying ? "queued" : "playing",
        createdAt: now,
      };
      songs.push(song);
    }

    // 문장 추가
    if (trimmedText) {
      const sentence = {
        id: crypto.randomUUID(),
        text: trimmedText,
        name: trimmedName || undefined,
        createdAt: now,
      };
      sentences.push(sentence);
    }

    await kv.set("songs", songs);
    await kv.set("sentences", sentences);

    return c.json({ ok: true });
  } catch (e) {
    console.error("submit error:", e);
    return c.json({ error: "server" }, 500);
  }
});

// ─── POST /played — 재생완료 처리 ──────────────────────────────────────────────
app.post(`${BASE}/played`, async (c) => {
  const body = await c.req.json();
  const { id } = body;

  if (!id) return c.json({ error: "missing id" }, 400);

  try {
    const songs: any[] = (await kv.get("songs")) ?? [];

    // 해당 곡을 done으로 전환
    const idx = songs.findIndex((s: any) => s.id === id);
    if (idx !== -1) {
      songs[idx].status = "done";
    }

    // 다음 대기곡을 playing으로 승격
    const hasPlaying = songs.some((s: any) => s.status === "playing");
    if (!hasPlaying) {
      const nextQueued = songs
        .filter((s: any) => s.status === "queued")
        .sort((a: any, b: any) => a.createdAt - b.createdAt);
      if (nextQueued.length > 0) {
        const nextIdx = songs.findIndex((s: any) => s.id === nextQueued[0].id);
        if (nextIdx !== -1) {
          songs[nextIdx].status = "playing";
        }
      }
    }

    await kv.set("songs", songs);
    return c.json({ ok: true });
  } catch (e) {
    console.error("played error:", e);
    return c.json({ error: "server" }, 500);
  }
});

Deno.serve(app.fetch);
