import { useEffect, useMemo, useRef, useState } from "react"
import { markPlayed, nowPlaying, useStore, type Song, type Sentence } from "../lib/store"
import { useSpotifyPlayer } from "../lib/spotify"

const HOST = "한강 리딩 파티"

// 진행자의 고정 안내 말풍선 (오른쪽 정렬)
const HOST_MESSAGES = [
  "오늘 밤, 강변의 도서관이 조용한 라운지로 바뀌어요. 편히 머물러주세요.",
  "QR로 노래와 문장을 남겨주시면, 이 자리에 함께 걸립니다.",
]

type Item =
  | { kind: "host"; id: string; text: string; at: number }
  | { kind: "song"; id: string; song: Song; at: number }
  | { kind: "sentence"; id: string; sentence: Sentence; at: number }

function fmtTime(ms: number) {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

function DuskBackdrop() {
  // 두 겹의 커다란 빛무리를 서로 다른 속도로 아주 느리게 흘려, 자연스러운 오로라 느낌을 냅니다.
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-ink">
      <div
        className="aurora-a absolute -inset-1/4 blur-[130px] will-change-transform"
        style={{
          background:
            "radial-gradient(38% 44% at 24% 28%, rgba(242,166,90,0.30), transparent 70%), radial-gradient(40% 46% at 74% 22%, rgba(120,132,196,0.30), transparent 72%), radial-gradient(46% 50% at 60% 78%, rgba(88,102,168,0.26), transparent 74%)",
        }}
      />
      <div
        className="aurora-b absolute -inset-1/4 blur-[140px] will-change-transform"
        style={{
          background:
            "radial-gradient(42% 48% at 78% 62%, rgba(242,166,90,0.20), transparent 72%), radial-gradient(44% 50% at 30% 70%, rgba(70,84,150,0.34), transparent 74%), radial-gradient(40% 46% at 50% 12%, rgba(150,152,184,0.16), transparent 72%)",
        }}
      />
      {/* 위·아래로 인디고가 가라앉으며 깊이를 만들고 텍스트 가독성을 지켜줍니다 */}
      <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-transparent to-ink/85" />
    </div>
  )
}

export default function DisplayPage() {
  const { songs, sentences } = useStore()
  const current = nowPlaying(songs)

  // 진행자 안내 + 신청곡 + 문장을 하나의 대화 흐름으로 병합 (시간순)
  const items = useMemo<Item[]>(() => {
    const base = songs[0]?.createdAt ?? Date.now()
    const host: Item[] = HOST_MESSAGES.map((text, i) => ({
      kind: "host",
      id: `host-${i}`,
      text,
      at: base - (HOST_MESSAGES.length - i) * 1000,
    }))
    const songItems: Item[] = songs.map((s) => ({ kind: "song", id: `song-${s.id}`, song: s, at: s.createdAt }))
    const sentItems: Item[] = sentences.map((s) => ({
      kind: "sentence",
      id: `sent-${s.id}`,
      sentence: s,
      at: s.createdAt,
    }))
    return [...host, ...songItems, ...sentItems].sort((a, b) => a.at - b.at)
  }, [songs, sentences])

  // 새 말풍선에만 등장 애니메이션
  const seen = useRef<Set<string> | null>(null)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(items.map((i) => i.id))
      return
    }
    const fresh = items.filter((i) => !seen.current!.has(i.id)).map((i) => i.id)
    if (fresh.length) {
      fresh.forEach((id) => seen.current!.add(id))
      setNewIds(new Set(fresh))
      const t = setTimeout(() => setNewIds(new Set()), 1400)
      return () => clearTimeout(t)
    }
  }, [items])

  // 자동 스크롤 (맨 아래로)
  const feedRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = feedRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [items.length])

  // ── Spotify 재생 ──────────────────────────────
  const currentIdRef = useRef<string | null>(null)
  currentIdRef.current = current?.id ?? null
  const { status, login, play } = useSpotifyPlayer(() => {
    if (currentIdRef.current) markPlayed(currentIdRef.current)
  })
  const playedUri = useRef<string>("")
  useEffect(() => {
    if (status !== "ready") return
    if (current?.uri && current.uri !== playedUri.current) {
      playedUri.current = current.uri
      play(current.uri)
    }
    if (!current) playedUri.current = ""
  }, [status, current?.uri, play])

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <DuskBackdrop />

      {/* 상단 — 지금 재생 중 + 연결 상태 */}
      <header className="relative z-10 flex items-center justify-between gap-4 border-b border-white/8 px-8 py-5 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-4">
          {current?.albumImage ? (
            <img src={current.albumImage} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
          ) : (
            <span className="now-playing-dot inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-amber" />
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-amber">
              지금 재생 중
            </p>
            {current ? (
              <p className="truncate text-lg text-ivory">
                {current.title}
                {current.artist && <span className="text-lavender"> · {current.artist}</span>}
              </p>
            ) : (
              <p className="text-lg text-lavender">다음 곡을 기다리는 중이에요.</p>
            )}
          </div>
        </div>

        <div className="shrink-0">
          {status === "loggedout" && (
            <button
              onClick={login}
              className="rounded-full bg-[#1DB954] px-4 py-2 text-sm font-medium text-black transition-transform active:scale-[0.98]"
            >
              Spotify 연결
            </button>
          )}
          {status === "unconfigured" && (
            <span className="text-xs text-lavender/70">Spotify 키 설정 필요</span>
          )}
          {status === "error" && (
            <button onClick={login} className="text-xs text-lavender/80 underline">
              다시 연결 (Premium 필요)
            </button>
          )}
        </div>
      </header>

      <p className="relative z-10 pt-6 text-center text-xs uppercase tracking-[0.28em] text-lavender/60">
        오늘 밤의 라운지
      </p>

      {/* 채팅 피드 */}
      <div ref={feedRef} className="relative z-10 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          {items.map((item) => {
            const isNew = newIds.has(item.id)
            const rise = isNew ? "sentence-rise" : ""

            if (item.kind === "host") {
              return (
                <div key={item.id} className={`flex flex-col items-end ${rise}`}>
                  <span className="mb-1.5 pr-1 text-[11px] text-lavender/60">
                    {HOST} · {fmtTime(item.at)}
                  </span>
                  <p className="max-w-[80%] rounded-2xl rounded-tr-sm border border-amber/25 bg-amber/12 px-5 py-3 text-[15px] leading-relaxed text-ivory">
                    {item.text}
                  </p>
                </div>
              )
            }

            if (item.kind === "song") {
              return (
                <div key={item.id} className={`flex flex-col items-start ${rise}`}>
                  <span className="mb-1.5 pl-1 text-[11px] text-lavender/60">
                    {item.song.name?.trim() || "익명"} · 신청곡 · {fmtTime(item.at)}
                  </span>
                  <div className="flex max-w-[80%] items-center gap-3 rounded-2xl rounded-tl-sm border border-white/8 bg-panel/75 px-4 py-3 backdrop-blur-sm">
                    {item.song.albumImage ? (
                      <img src={item.song.albumImage} alt="" className="h-11 w-11 shrink-0 rounded object-cover" />
                    ) : (
                      <span className="text-amber">♪</span>
                    )}
                    <p className="text-[15px] leading-snug text-ivory">
                      <span className="text-amber">♪ </span>
                      <span className="font-medium">{item.song.title}</span>
                      {item.song.artist && <span className="text-lavender"> — {item.song.artist}</span>}
                      <span className="text-lavender/80"> 신청받았어요</span>
                    </p>
                  </div>
                </div>
              )
            }

            return (
              <div key={item.id} className={`flex flex-col items-start ${rise}`}>
                <span className="mb-1.5 pl-1 text-[11px] text-lavender/60">
                  {item.sentence.name?.trim() || "익명"} · {fmtTime(item.at)}
                </span>
                <p className="max-w-[82%] rounded-2xl rounded-tl-sm border border-white/8 bg-panel/75 px-5 py-4 font-serif text-[19px] leading-[1.6] text-ivory backdrop-blur-sm">
                  {item.sentence.text}
                </p>
              </div>
            )
          })}

          {songs.length === 0 && sentences.length === 0 && (
            <div className="flex flex-col items-center py-16 text-center">
              <span className="now-playing-dot mb-5 inline-block h-2 w-2 rounded-full bg-amber/70" />
              <p className="font-serif text-2xl text-lavender">첫 문장을 기다리고 있어요.</p>
              <p className="mt-2 text-sm text-lavender/60">
                곧 이 자리에 오늘 밤의 노래와 문장이 걸립니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
