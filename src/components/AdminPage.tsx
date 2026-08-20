import { useEffect, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import {
  clearAdminKey,
  deleteSentence,
  deleteSong,
  getVolume,
  isAdminUnlocked,
  markPlayed,
  nowPlaying,
  reorderSong,
  resetAll,
  setVolume,
  upNext,
  useStore,
  verifyAdminPassword,
} from "../lib/store"

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw] = useState("")
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (checking || !pw) return
    setChecking(true)
    const ok = await verifyAdminPassword(pw)
    setChecking(false)
    if (ok) {
      onUnlock()
    } else {
      setError(true)
      setPw("")
      setTimeout(() => setError(false), 1500)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-5">
        <div className="text-center">
          <p className="text-[13px] font-medium uppercase tracking-[0.22em] text-amber/90">
            진행자 전용
          </p>
          <h1 className="mt-3 font-serif text-2xl text-ivory">비밀번호 입력</h1>
        </div>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="비밀번호"
          autoFocus
          className={`w-full rounded-[10px] border bg-panel px-4 py-3 text-ivory placeholder:text-lavender/70 outline-none transition-colors focus:ring-2 focus:ring-amber/15 ${
            error ? "border-red-400/60 focus:border-red-400/60" : "border-white/8 focus:border-amber/50"
          }`}
        />
        <button
          type="submit"
          disabled={checking || !pw}
          className="w-full rounded-[10px] bg-amber px-5 py-3 font-medium text-ink transition-transform duration-150 active:scale-[0.985] disabled:opacity-40"
        >
          {checking ? "확인 중…" : "확인"}
        </button>
        {error && (
          <p className="text-center text-sm text-red-300">비밀번호가 맞지 않아요.</p>
        )}
      </form>
    </div>
  )
}

// 삭제는 되돌릴 수 없어서 항상 한 번 되묻습니다.
function DeleteControl({
  armed,
  onArm,
  onCancel,
  onConfirm,
  variant = "compact",
}: {
  armed: boolean
  onArm: () => void
  onCancel: () => void
  onConfirm: () => void
  variant?: "compact" | "regular"
}) {
  const compact = variant === "compact"

  const armClass = compact
    ? "shrink-0 rounded-md px-2.5 py-1 text-xs text-lavender/60 transition-colors hover:text-red-300"
    : "shrink-0 rounded-[10px] border border-white/10 px-3 py-2.5 text-sm text-lavender transition-colors hover:border-red-400/40 hover:text-red-300"
  const cancelClass = compact
    ? "rounded-md border border-white/10 px-2.5 py-1 text-xs text-lavender transition-colors hover:text-ivory"
    : "rounded-[10px] border border-white/10 px-3 py-2.5 text-sm text-lavender transition-colors hover:text-ivory"
  const confirmClass = compact
    ? "rounded-md bg-red-400/90 px-2.5 py-1 text-xs font-medium text-ink transition-transform active:scale-[0.97]"
    : "rounded-[10px] bg-red-400/90 px-4 py-2.5 text-sm font-medium text-ink transition-transform active:scale-[0.97]"

  if (!armed) {
    return (
      <button onClick={onArm} className={armClass}>
        삭제
      </button>
    )
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <span className="mr-0.5 hidden text-xs text-lavender/70 sm:inline">삭제할까요?</span>
      <button onClick={onCancel} className={cancelClass}>
        취소
      </button>
      <button onClick={onConfirm} className={confirmClass}>
        삭제
      </button>
    </div>
  )
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(isAdminUnlocked)

  if (!authed) {
    return <PasswordGate onUnlock={() => setAuthed(true)} />
  }

  return <AdminDashboard />
}

function VolumeControl() {
  const [vol, setVol] = useState(80)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getVolume().then((v) => {
      setVol(v)
      setLoaded(true)
    })
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Number(e.target.value)
    setVol(v)
    setVolume(v)
  }

  if (!loaded) return null

  return (
    <div className="mt-8 rounded-xl border border-white/8 bg-panel p-6">
      <p className="text-xs uppercase tracking-[0.24em] text-lavender/70">볼륨</p>
      <div className="mt-3 flex items-center gap-4">
        <span className="text-xs text-lavender/60">🔈</span>
        <input
          type="range"
          min={0}
          max={100}
          value={vol}
          onChange={handleChange}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-amber [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber [&::-webkit-slider-thumb]:shadow-md"
        />
        <span className="text-xs text-lavender/60">🔊</span>
        <span className="w-8 text-right text-sm tabular-nums text-ivory">{vol}</span>
      </div>
    </div>
  )
}

function ResetAllControl() {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 5000)
    return () => clearTimeout(t)
  }, [armed])

  return (
    <div className="mt-8 rounded-xl border border-red-400/20 bg-panel p-6">
      <p className="text-xs uppercase tracking-[0.24em] text-red-300/80">위험 구역</p>
      <p className="mt-2 text-sm text-lavender">
        곡과 문장을 모두 초기화합니다. 되돌릴 수 없습니다.
      </p>
      <div className="mt-4">
        {!armed ? (
          <button
            onClick={() => setArmed(true)}
            className="rounded-[10px] border border-red-400/30 px-4 py-2.5 text-sm text-red-300 transition-colors hover:border-red-400/50 hover:text-red-200"
          >
            모두 초기화
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-red-300">정말 초기화할까요?</span>
            <button
              onClick={() => setArmed(false)}
              className="rounded-[10px] border border-white/10 px-3 py-2 text-sm text-lavender transition-colors hover:text-ivory"
            >
              취소
            </button>
            <button
              onClick={() => {
                resetAll()
                setArmed(false)
              }}
              className="rounded-[10px] bg-red-400/90 px-4 py-2 text-sm font-medium text-ink transition-transform active:scale-[0.97]"
            >
              초기화 실행
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function AdminDashboard() {
  const { songs, sentences, stats } = useStore()
  const current = nowPlaying(songs)
  const queue = upNext(songs)

  // 삭제 확인 중인 항목(곡·문장 공용). 한 번에 하나만 열립니다.
  const [confirmId, setConfirmId] = useState<string | null>(null)

  // 확인 상태를 열어둔 채 방치되면 스스로 닫힙니다.
  useEffect(() => {
    if (!confirmId) return
    const t = setTimeout(() => setConfirmId(null), 5000)
    return () => clearTimeout(t)
  }, [confirmId])

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-medium uppercase tracking-[0.22em] text-amber/90">
            진행자용
          </p>
          <h1 className="mt-3 font-serif text-3xl text-ivory">오늘 밤의 흐름</h1>
        </div>
        <button
          onClick={() => {
            clearAdminKey()
            window.location.reload()
          }}
          className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-lavender transition-colors hover:border-white/20 hover:text-ivory"
        >
          로그아웃
        </button>
      </div>

      {/* 참여 현황 카운터 */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-white/8 bg-panel/60 px-4 py-3 text-center">
          <p className="text-2xl font-semibold tabular-nums text-amber">{stats.totalSongs}</p>
          <p className="mt-0.5 text-xs text-lavender/70">신청곡</p>
        </div>
        <div className="rounded-lg border border-white/8 bg-panel/60 px-4 py-3 text-center">
          <p className="text-2xl font-semibold tabular-nums text-ivory">{sentences.length}</p>
          <p className="mt-0.5 text-xs text-lavender/70">문장</p>
        </div>
        <div className="rounded-lg border border-white/8 bg-panel/60 px-4 py-3 text-center">
          <p className="text-2xl font-semibold tabular-nums text-lavender">{stats.doneSongs}</p>
          <p className="mt-0.5 text-xs text-lavender/70">재생완료</p>
        </div>
      </div>

      <p className="mt-5 text-sm text-lavender">
        재생이 끝난 곡은 &ldquo;재생완료&rdquo;를 눌러 다음 곡으로 넘겨주세요.
      </p>

      {/* 지금 재생 중 */}
      <div className="mt-7 rounded-xl border border-amber/25 bg-panel p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-amber">지금 재생 중</p>
        {current ? (
          <div className="mt-3 flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              {current.albumImage && (
                <img src={current.albumImage} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
              )}
              <div className="min-w-0">
                <p className="truncate font-serif text-2xl text-ivory">{current.title}</p>
                {current.artist && <p className="mt-1 truncate text-lavender">{current.artist}</p>}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <DeleteControl
                variant="regular"
                armed={confirmId === current.id}
                onArm={() => setConfirmId(current.id)}
                onCancel={() => setConfirmId(null)}
                onConfirm={() => {
                  deleteSong(current.id)
                  setConfirmId(null)
                }}
              />
              {/* 삭제 확인 중에는 재생완료를 숨겨 오조작을 막습니다 */}
              {confirmId !== current.id && (
                <button
                  onClick={() => markPlayed(current.id)}
                  className="rounded-[10px] bg-amber px-4 py-2.5 font-medium text-ink transition-transform duration-150 active:scale-[0.985]"
                >
                  재생완료
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-lavender">재생 중인 곡이 없어요.</p>
        )}

        {/* 다음 곡 미리보기 */}
        {current && queue.length > 0 && (
          <div className="mt-4 flex items-center gap-3 border-t border-white/8 pt-4">
            <span className="text-xs text-lavender/60">다음</span>
            {queue[0].albumImage && (
              <img src={queue[0].albumImage} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
            )}
            <p className="truncate text-sm text-lavender">
              {queue[0].title}
              {queue[0].artist && <span className="text-lavender/60"> · {queue[0].artist}</span>}
            </p>
          </div>
        )}
      </div>

      {/* 대기열 */}
      <div className="mt-8">
        <p className="mb-3 text-xs uppercase tracking-[0.24em] text-lavender/70">
          대기열 {queue.length}곡
        </p>
        <ul className="space-y-2">
          {queue.map((s, i) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-white/6 bg-panel/60 px-4 py-3"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="text-sm tabular-nums text-lavender/50">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.albumImage && (
                  <img src={s.albumImage} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
                )}
                <span className="truncate text-ivory">
                  {s.title}
                  {s.artist && <span className="text-lavender"> · {s.artist}</span>}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => reorderSong(s.id, "up")}
                  disabled={i === 0}
                  className="rounded px-1.5 py-1 text-xs text-lavender/50 transition-colors hover:text-ivory disabled:opacity-30"
                  title="위로"
                >
                  ▲
                </button>
                <button
                  onClick={() => reorderSong(s.id, "down")}
                  disabled={i === queue.length - 1}
                  className="rounded px-1.5 py-1 text-xs text-lavender/50 transition-colors hover:text-ivory disabled:opacity-30"
                  title="아래로"
                >
                  ▼
                </button>
                <DeleteControl
                  armed={confirmId === s.id}
                  onArm={() => setConfirmId(s.id)}
                  onCancel={() => setConfirmId(null)}
                  onConfirm={() => {
                    deleteSong(s.id)
                    setConfirmId(null)
                  }}
                />
              </span>
            </li>
          ))}
          {!queue.length && (
            <li className="rounded-lg px-4 py-3 text-lavender/60">
              대기 중인 곡이 없어요.
            </li>
          )}
        </ul>
      </div>

      {/* 모인 문장 */}
      <div className="mt-8">
        <p className="mb-3 text-xs uppercase tracking-[0.24em] text-lavender/70">
          모인 문장 {sentences.length}개
        </p>
        {sentences.length > 0 ? (
          <ul className="space-y-2">
            {[...sentences].reverse().map((s) => (
              <li
                key={s.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-white/6 bg-panel/60 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-serif text-[15px] leading-relaxed text-ivory">
                    &ldquo;{s.text}&rdquo;
                  </p>
                  <p className="mt-1.5 text-xs text-lavender/60">
                    {s.name?.trim() || "익명"} · {new Date(s.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <DeleteControl
                  armed={confirmId === s.id}
                  onArm={() => setConfirmId(s.id)}
                  onCancel={() => setConfirmId(null)}
                  onConfirm={() => {
                    deleteSentence(s.id)
                    setConfirmId(null)
                  }}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg px-4 py-3 text-lavender/60">아직 문장이 없어요.</p>
        )}
      </div>

      {/* 볼륨 조절 */}
      <VolumeControl />

      {/* 모두 초기화 */}
      <ResetAllControl />

      {/* QR 코드 섹션 */}
      <div className="mt-10 rounded-xl border border-white/8 bg-panel p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-lavender/70">참가자 접속 QR</p>
        <p className="mt-2 text-sm text-lavender">
          이 QR 코드를 현장 화면이나 인쇄물에 비치하세요.
        </p>
        <div className="mt-5 flex flex-col items-center gap-4">
          <div className="rounded-xl bg-white p-4">
            <QRCodeSVG
              value={`${window.location.origin}/#/participant`}
              size={180}
              level="M"
              bgColor="#ffffff"
              fgColor="#1b2140"
            />
          </div>
          <p className="text-xs text-lavender/60 select-all">
            {window.location.origin}/#/participant
          </p>
        </div>
      </div>
    </div>
  )
}
