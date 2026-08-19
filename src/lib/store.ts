import { useSyncExternalStore } from "react"
import { RealtimeClient } from "@supabase/supabase-js"
import { projectId, publicAnonKey } from "../../utils/supabase/info"

export type Track = {
  id: string
  uri: string
  name: string
  artists: string
  albumImage: string
  durationMs: number
}

export type Song = {
  id: string
  uri: string
  title: string
  artist: string
  albumImage: string
  durationMs: number
  name?: string
  status: "queued" | "playing" | "done"
  createdAt: number
}

export type Sentence = {
  id: string
  text: string
  name?: string
  createdAt: number
}

type State = {
  songs: Song[]
  sentences: Sentence[]
}

const API = `https://${projectId}.supabase.co/functions/v1/make-server-a010eb27`
const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
}

// auth(GoTrue) 없이 realtime 방송만 사용합니다. 전역 싱글턴으로 두어
// HMR로 모듈이 여러 번 평가돼도 소켓/채널을 하나만 유지합니다.
const g = globalThis as unknown as { __hrpRealtime?: RealtimeClient }
const realtime =
  g.__hrpRealtime ??
  (g.__hrpRealtime = new RealtimeClient(`wss://${projectId}.supabase.co/realtime/v1`, {
    params: { apikey: publicAnonKey },
  }))

let state: State = { songs: [], sentences: [] }
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useStore(): State {
  return useSyncExternalStore(subscribe, () => state, () => state)
}

async function refresh() {
  try {
    const res = await fetch(`${API}/state`, { headers: HEADERS })
    if (!res.ok) return
    const data = (await res.json()) as State
    state = { songs: data.songs ?? [], sentences: data.sentences ?? [] }
    emit()
  } catch {
    /* 네트워크 일시 오류는 조용히 넘어갑니다 */
  }
}

// 모든 기기가 같은 방송 채널을 구독해, 변경이 생기면 즉시 최신 상태를 다시 불러옵니다.
const gc = globalThis as unknown as { __hrpChannel?: ReturnType<RealtimeClient["channel"]> }
let channel = gc.__hrpChannel
if (!channel) {
  channel = realtime.channel("hangang-reading-party", {
    config: { broadcast: { self: false } },
  })
  gc.__hrpChannel = channel
  channel
    .on("broadcast", { event: "changed" }, () => refresh())
    .subscribe((status: string) => {
      if (status === "SUBSCRIBED") refresh()
    })
}

// 초기 로드 + 안전망 폴링(방송을 놓쳤을 때를 대비)
refresh()
if (typeof window !== "undefined") {
  setInterval(refresh, 8000)
}

async function notifyAndRefresh() {
  await channel!.send({ type: "broadcast", event: "changed", payload: {} })
  await refresh()
}

export async function searchTracks(q: string): Promise<Track[]> {
  if (!q.trim()) return []
  try {
    const res = await fetch(`${API}/search?q=${encodeURIComponent(q)}`, { headers: HEADERS })
    if (!res.ok) return []
    const data = await res.json()
    return (data.tracks ?? []) as Track[]
  } catch {
    return []
  }
}

export async function getSpotifyClientId(): Promise<string> {
  try {
    const res = await fetch(`${API}/config`, { headers: HEADERS })
    if (!res.ok) return ""
    const data = await res.json()
    return data.clientId ?? ""
  } catch {
    return ""
  }
}

export type SubmitResult = "ok" | "empty" | "profanity" | "error"

// 선택한 곡과 문장을 한 번에 제출합니다. 둘 다 선택이지만 최소 하나는 있어야 해요.
export async function submitEntry(
  track: Track | null,
  text: string,
  name: string,
): Promise<SubmitResult> {
  try {
    const res = await fetch(`${API}/submit`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ track, text, name }),
    })
    if (res.status === 422) return "profanity"
    if (res.status === 400) return "empty"
    if (!res.ok) return "error"
    await notifyAndRefresh()
    return "ok"
  } catch {
    return "error"
  }
}

export async function markPlayed(id: string) {
  await fetch(`${API}/played`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ id }),
  })
  await notifyAndRefresh()
}

export function nowPlaying(songs: Song[]) {
  return songs.find((s) => s.status === "playing") ?? null
}

export function upNext(songs: Song[]) {
  return songs
    .filter((s) => s.status === "queued")
    .sort((a, b) => a.createdAt - b.createdAt)
}
