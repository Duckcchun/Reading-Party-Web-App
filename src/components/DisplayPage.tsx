import { useEffect, useMemo, useRef, useState } from "react"
import { markPlayed, nowPlaying, useOnline, useStore, type Song, type Sentence } from "../lib/store"
import { useSpotifyPlayer } from "../lib/spotify"
import { extractColors, type RGB } from "../lib/extractColor"
import WaveBackground from "./WaveBackground"
import { QRCodeSVG } from "qrcode.react"

const HOST = "한강 리딩 파티"

function todayLabel(): string {
  // 배포 환경(UTC)에서도 한국 날짜가 맞도록 Asia/Seoul 기준으로 계산한다.
  const parts = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "long",
    timeZone: "Asia/Seoul",
  }).formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  const year = get("year")
  const month = get("month")
  const day = get("day")
  const weekday = get("weekday")
  return `${year}. ${month}. ${day}. ${weekday}`
}

const HOST_MESSAGES = [
  "오늘 밤, 도서관이 조용한 라운지로 바뀌어요. 편히 머물러주세요.",
  "노래와 문장을 남겨주시면, 이 자리에 함께 걸립니다.",
]

type Item =
  | { kind: "song"; id: string; song: Song; at: number }
  | { kind: "sentence"; id: string; sentence: Sentence; at: number }

function fmtTime(ms: number) {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="tabular-nums text-lg text-lavender/50">
      {now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
    </span>
  )
}

function EventDate() {
  const [label, setLabel] = useState(todayLabel())
  useEffect(() => {
    const id = setInterval(() => setLabel(todayLabel()), 60_000)
    return () => clearInterval(id)
  }, [])
  return <p className="mt-1 text-lg text-lavender/70">{label}</p>
}

function DuskBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-ink">
      <div className="absolute inset-0 opacity-50">
        <div className="mesh-blob blob-1" />
        <div className="mesh-blob blob-2" />
        <div className="mesh-blob blob-3" />
        <div className="mesh-blob blob-4" />
        <div className="mesh-blob blob-5" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-ink/60 via-transparent to-ink/70" />
    </div>
  )
}

function AlbumBackdrop({ url }: { url?: string }) {
  const [layers, setLayers] = useState<{ id: number; url: string }[]>([])
  const idRef = useRef(0)

  useEffect(() => {
    if (!url) {
      setLayers([])
      return
    }
    setLayers((prev) => {
      if (prev.length && prev[prev.length - 1].url === url) return prev
      idRef.current += 1
      return [...prev, { id: idRef.current, url }].slice(-2)
    })
  }, [url])

  useEffect(() => {
    if (layers.length < 2) return
    const t = setTimeout(() => setLayers((p) => p.slice(-1)), 2200)
    return () => clearTimeout(t)
  }, [layers])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {layers.map((l, i) => (
        <div
          key={l.id}
          className={`album-layer ${i === layers.length - 1 ? "album-fade-in" : ""}`}
          style={{ backgroundImage: `url(${l.url})` }}
        />
      ))}
    </div>
  )
}

function Equalizer() {
  const bars = [0, 1, 2, 3, 4]
  return (
    <div className="flex h-5 items-end gap-1">
      {bars.map((b) => (
        <span
          key={b}
          className="eq-bar w-1 rounded-full bg-amber/80"
          style={{
            height: "100%",
            animationDelay: `${b * 0.18}s`,
            animationDuration: `${1 + (b % 3) * 0.25}s`,
          }}
        />
      ))}
    </div>
  )
}

export default function DisplayPage() {
  const { songs, sentences } = useStore()
  const isOnline = useOnline()
  const current = nowPlaying(songs)

  const items = useMemo<Item[]>(() => {
    const songItems: Item[] = songs.map((s) => ({ kind: "song", id: `song-${s.id}`, song: s, at: s.createdAt }))
    const sentItems: Item[] = sentences.map((s) => ({
      kind: "sentence",
      id: `sent-${s.id}`,
      sentence: s,
      at: s.createdAt,
    }))
    return [...songItems, ...sentItems].sort((a, b) => a.at - b.at)
  }, [songs, sentences])

  const hasContent = items.length > 0

  // 인트로
  const [intro, setIntro] = useState<"in" | "out" | "gone">(hasContent ? "gone" : "in")
  useEffect(() => {
    if (!hasContent) {
      setIntro("in")
      return
    }
    setIntro((s) => (s === "in" ? "out" : s))
  }, [hasContent])
  useEffect(() => {
    if (intro !== "out") return
    const t = setTimeout(() => setIntro("gone"), 1200)
    return () => clearTimeout(t)
  }, [intro])

  const introAt = useRef(Date.now()).current

  // 새 항목 감지
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
      const t = setTimeout(() => setNewIds(new Set()), 3000)
      return () => clearTimeout(t)
    }
  }, [items])

  // 자동 스크롤
  const feedRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = feedRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [items.length])

  // Spotify 재생
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

  // 듀얼 모드
  const [stageMode, setStageMode] = useState<"off" | "enter" | "leave">("off")
  const [stageSong, setStageSong] = useState<Song | null>(null)
  const [stageColors, setStageColors] = useState<RGB[]>([[242, 166, 90], [100, 120, 200]])
  const prevSongId = useRef<string | null>(null)

  useEffect(() => {
    if (!current) {
      prevSongId.current = null
      return
    }
    if (current.id !== prevSongId.current) {
      prevSongId.current = current.id
      setStageSong(current)
      setStageMode("enter")

      if (current.albumImage) {
        extractColors(current.albumImage).then(setStageColors)
      }

      const leaveTimer = setTimeout(() => setStageMode("leave"), 2000)
      const offTimer = setTimeout(() => setStageMode("off"), 2600)

      return () => {
        clearTimeout(leaveTimer)
        clearTimeout(offTimer)
      }
    }
  }, [current?.id])

  return (
    <div className="relative flex h-full flex-col overflow-hidden lg:flex-row">
      <DuskBackdrop />
      <WaveBackground isPlaying={!!current} />
      <AlbumBackdrop url={current?.albumImage} />
      <div className="vignette pointer-events-none absolute inset-0 z-[5]" />
      <div className="grain pointer-events-none absolute z-[6]" />

      {/* ── 무대 모드 오버레이 ─── */}
      {stageMode !== "off" && stageSong && (
        <div
          className={`absolute inset-0 z-50 flex items-center justify-center backdrop-blur-md ${
            stageMode === "enter" ? "stage-enter" : "stage-leave"
          }`}
          style={{
            background: `radial-gradient(ellipse at 50% 40%, rgba(${stageColors[0].join(",")},0.35) 0%, rgba(${stageColors[1].join(",")},0.15) 40%, rgba(27,33,64,0.92) 70%)`,
          }}
        >
          <div className="flex flex-col items-center gap-6 px-8 text-center">
            {stageSong.albumImage && (
              <div className="relative">
                <div
                  className="absolute inset-0 scale-110 rounded-3xl blur-[60px] opacity-60"
                  style={{
                    background: `linear-gradient(135deg, rgba(${stageColors[0].join(",")},0.8), rgba(${stageColors[1].join(",")},0.6))`,
                  }}
                />
                <img
                  src={stageSong.albumImage}
                  alt=""
                  className="relative h-56 w-56 rounded-3xl object-cover shadow-2xl"
                />
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber">
                지금 재생
              </p>
              <p className="mt-2 font-serif text-3xl leading-snug text-ivory">
                {stageSong.title}
              </p>
              {stageSong.artist && (
                <p className="mt-2 text-lg text-lavender">{stageSong.artist}</p>
              )}
              {stageSong.name?.trim() && (
                <p className="mt-3 text-sm text-lavender/60">
                  {stageSong.name.trim()} 님의 신청곡
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 왼쪽: 타이틀 + 앨범 + 지금 재생 중 + QR ─── */}
      <aside className="relative z-10 flex shrink-0 flex-col justify-between gap-5 border-b border-white/8 bg-ink/25 px-10 py-8 backdrop-blur-[2px] lg:w-[36%] lg:border-b-0 lg:border-r lg:px-12 lg:py-10 2xl:gap-8 2xl:py-12">
        {/* 상단: 시계 → 타이틀 + 날짜 (세로 배치) */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            {!isOnline && (
              <span className="flex items-center gap-1.5 rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1 text-xs text-red-300">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />
                연결 복구 중
              </span>
            )}
            <Clock />
          </div>
          <div>
            <h1 className="font-serif text-3xl text-ivory 2xl:text-4xl">{HOST}</h1>
            <EventDate />
          </div>
        </div>

        {/* 중앙: 앨범 + 지금 재생 중 + QR */}
        <div className="flex flex-col">
          {current?.albumImage ? (
            <img
              src={current.albumImage}
              alt=""
              className="aspect-square w-full max-w-[240px] rounded-2xl object-cover shadow-2xl shadow-black/50 2xl:max-w-[300px]"
            />
          ) : (
            <div className="flex aspect-square w-full max-w-[240px] items-center justify-center rounded-2xl border border-white/8 bg-panel/40 2xl:max-w-[300px]">
              <span className="now-playing-dot inline-block h-4 w-4 rounded-full bg-amber/70" />
            </div>
          )}

          <div className="mt-5 max-w-[300px] 2xl:mt-7">
            <div className="flex items-center gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber">
                지금 재생 중
              </p>
              {current && <Equalizer />}
            </div>
            {current ? (
              <>
                <p className="mt-3 font-serif text-2xl leading-snug text-ivory 2xl:text-3xl">
                  {current.title}
                </p>
                {current.artist && (
                  <p className="mt-2 text-base text-lavender 2xl:text-lg">{current.artist}</p>
                )}
                {current.name?.trim() && (
                  <p className="mt-3 text-sm text-lavender/60 2xl:mt-4">
                    {current.name.trim()} 님의 신청곡
                  </p>
                )}
              </>
            ) : (
              <p className="mt-3 font-serif text-xl text-lavender 2xl:text-2xl">
                다음 곡을 기다리는 중이에요.
              </p>
            )}
          </div>

          {/* 앨범 아래 QR — 참가자 화면으로 이동 */}
          <div className="mt-8 2xl:mt-12">
            <div className="inline-block rounded-xl bg-white p-3 2xl:p-4">
              <QRCodeSVG
                value={`${window.location.origin}/#/participant`}
                size={140}
                level="M"
                bgColor="#ffffff"
                fgColor="#1b2140"
                className="h-[140px] w-[140px] 2xl:h-[180px] 2xl:w-[180px]"
              />
            </div>
          </div>
        </div>

        {/* 하단: Spotify 연결 */}
        <div>
          {status === "loggedout" && (
            <button
              onClick={login}
              className="rounded-full bg-[#1DB954] px-5 py-2.5 text-sm font-medium text-black transition-transform active:scale-[0.98]"
            >
              Spotify 연결
            </button>
          )}
          {status === "error" && (
            <button onClick={login} className="text-sm text-lavender/70 underline">
              다시 연결
            </button>
          )}
        </div>
      </aside>

      {/* ── 오른쪽: 문장 피드 ─── */}
      <div ref={feedRef} className="feed-mask relative z-10 flex-1 overflow-y-auto px-8 py-10 lg:px-12">
        <div className="mx-auto flex max-w-3xl flex-col gap-7">
          {/* 인트로 */}
          {intro !== "gone" && (
            <div className={`flex flex-col gap-7 overflow-hidden ${intro === "out" ? "intro-leave" : ""}`}>
              <div className="flex flex-col items-center py-12 text-center">
                <span className="now-playing-dot inline-block h-3 w-3 rounded-full bg-amber/70" />
                <p className="mt-6 font-serif text-3xl leading-snug text-ivory">
                  오늘 밤의 라운지가
                  <br />
                  열렸습니다
                </p>
                <p className="mt-3 text-lg text-lavender/70">
                  곧 이 자리에 여러분의 노래와 문장이 걸려요.
                </p>
              </div>

              {HOST_MESSAGES.map((text, i) => (
                <div key={`host-${i}`} className="flex flex-col items-end">
                  <span className="mb-1.5 pr-1 text-[11px] text-lavender/50">
                    {HOST} · {fmtTime(introAt)}
                  </span>
                  <p className="max-w-[88%] rounded-2xl rounded-tr-sm border border-amber/25 bg-amber/12 px-5 py-3.5 text-lg leading-relaxed text-ivory">
                    {text}
                  </p>
                </div>
              ))}
            </div>
          )}

          {hasContent && (
            <p className="text-center text-xs uppercase tracking-[0.3em] text-lavender/50">
              오늘 밤의 라운지
            </p>
          )}

          {items.map((item) => {
            const isNew = newIds.has(item.id)
            const rise = isNew ? "sentence-rise" : ""
            const glow = isNew ? "bubble-glow" : ""

            if (item.kind === "song") {
              return (
                <div key={item.id} className={`flex flex-col items-start ${rise}`}>
                  <span className="mb-1.5 pl-1 text-[11px] text-lavender/50">
                    {item.song.name?.trim() || "익명"} · 신청곡 · {fmtTime(item.at)}
                  </span>
                  <div
                    className={`flex max-w-[90%] items-center gap-3 rounded-2xl rounded-tl-sm border border-white/8 bg-panel/75 px-4 py-3.5 backdrop-blur-sm ${glow}`}
                  >
                    {item.song.albumImage ? (
                      <img src={item.song.albumImage} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="text-xl text-amber">♪</span>
                    )}
                    <p className="text-lg leading-snug text-ivory">
                      <span className="text-amber">♪ </span>
                      <span className="font-medium">{item.song.title}</span>
                      {item.song.artist && <span className="text-lavender"> — {item.song.artist}</span>}
                    </p>
                  </div>
                </div>
              )
            }

            return (
              <div key={item.id} className={`flex flex-col items-start ${rise}`}>
                <span className="mb-1.5 pl-1 text-[11px] text-lavender/50">
                  {item.sentence.name?.trim() || "익명"} · {fmtTime(item.at)}
                </span>
                <p
                  className={`max-w-[92%] rounded-2xl rounded-tl-sm border border-white/8 bg-panel/75 px-5 py-4 font-serif text-xl leading-[1.7] text-ivory backdrop-blur-sm ${glow}`}
                >
                  {item.sentence.text}
                </p>
              </div>
            )
          })}

          {hasContent && <div className="pt-4" />}
        </div>
      </div>
    </div>
  )
}
