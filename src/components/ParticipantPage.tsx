import { useEffect, useRef, useState } from "react"
import { searchTracks, submitEntry, type Track } from "../lib/store"
import { containsProfanity } from "../lib/profanity"

const fieldClass =
  "w-full rounded-[10px] border border-white/8 bg-panel px-4 py-3.5 text-[16px] text-ivory placeholder:text-lavender/60 outline-none transition-colors focus:border-amber/50 focus:ring-2 focus:ring-amber/15"

function fmt(ms: number) {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

export default function ParticipantPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Track[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Track | null>(null)

  const [sentence, setSentence] = useState("")
  const [name, setName] = useState("")
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")
  const [sending, setSending] = useState(false)

  const MAX_SUBMISSIONS = 2
  const STORAGE_KEY = "hrp-submit-count"

  function getSubmitCount(): number {
    try {
      return Number(localStorage.getItem(STORAGE_KEY) || "0")
    } catch {
      return 0
    }
  }

  function incrementSubmitCount() {
    try {
      localStorage.setItem(STORAGE_KEY, String(getSubmitCount() + 1))
    } catch { /* 무시 */ }
  }

  const [submitCount, setSubmitCount] = useState(getSubmitCount)
  const reachedLimit = submitCount >= MAX_SUBMISSIONS

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (selected) return
    if (debounce.current) clearTimeout(debounce.current)
    const q = query.trim()
    if (!q) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    debounce.current = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const r = await searchTracks(q, controller.signal)
      if (!controller.signal.aborted) {
        setResults(r)
        setSearching(false)
      }
    }, 350)
    return () => {
      if (debounce.current) clearTimeout(debounce.current)
    }
  }, [query, selected])

  const canSubmit = selected !== null || sentence.trim().length > 0

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || sending) return
    if (sentence.trim() && containsProfanity(sentence.trim())) {
      setError("조금만 더 부드러운 표현으로 남겨주실 수 있을까요.")
      return
    }
    setSending(true)
    const result = await submitEntry(selected, sentence, name)
    setSending(false)

    if (result === "profanity") {
      setError("조금만 더 부드러운 표현으로 남겨주실 수 있을까요.")
      return
    }
    if (result === "duplicate") {
      setError("이미 신청된 곡이에요. 다른 곡을 골라볼까요?")
      return
    }
    if (result !== "ok") {
      setError("전송이 잠시 막혔어요. 다시 한 번 눌러주실래요.")
      return
    }
    setSelected(null)
    setQuery("")
    setResults([])
    setSentence("")
    setError("")
    incrementSubmitCount()
    setSubmitCount((c) => c + 1)
    setDone(true)
  }

  // 성공 화면
  if (done) {
    return (
      <div className="flex min-h-full flex-col items-center px-6 pt-[30vh] text-center">
        <div className="success-appear">
          <span className="inline-block text-5xl">✨</span>
          <h2 className="mt-5 font-serif text-[26px] leading-snug text-ivory">
            잘 전달됐어요
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-lavender">
            큰 화면에서 곧 만나볼 수 있어요.
            <br />
            오늘 밤, 함께해주셔서 고마워요.
          </p>
          {reachedLimit ? (
            <p className="mt-8 text-sm text-lavender/60">
              오늘 참여가 마무리됐어요. 고마워요!
            </p>
          ) : (
            <button
              onClick={() => setDone(false)}
              className="mt-8 rounded-[10px] border border-white/10 px-6 py-3 text-sm text-lavender transition-colors hover:border-amber/30 hover:text-ivory"
            >
              한 곡 더 남기기 ({MAX_SUBMISSIONS - submitCount}회 남음)
            </button>
          )}
        </div>
      </div>
    )
  }

  // 제한 도달 시 폼 접근 차단
  if (reachedLimit) {
    return (
      <div className="flex min-h-full flex-col items-center px-6 pt-[30vh] text-center">
        <span className="inline-block text-4xl">🌙</span>
        <h2 className="mt-5 font-serif text-[24px] leading-snug text-ivory">
          오늘의 참여가 마무리됐어요
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-lavender">
          남겨주신 노래와 문장,<br />큰 화면에서 함께 만나요.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-5 pb-[max(5rem,calc(1.5rem+env(safe-area-inset-bottom)))] pt-[max(2.5rem,calc(1rem+env(safe-area-inset-top)))]">
      <header className="mb-7">
        <p className="text-[12px] font-medium uppercase tracking-[0.22em] text-amber/90">
          한강 리딩 파티
        </p>
        <h1 className="mt-3 font-serif text-[24px] leading-[1.5] text-ivory">
          오늘 밤, 함께 들을
          <br />
          노래와 문장을 남겨주세요.
        </h1>
        <p className="mt-2.5 text-[14px] leading-relaxed text-lavender">
          강변의 저녁이 라운지로 바뀌는 동안, 당신의 한 곡과 한 문장이
          이 자리를 채웁니다.
        </p>
      </header>

      <form onSubmit={submit} className="flex flex-1 flex-col gap-6">
        {/* 곡 검색 */}
        <div>
          <label className="mb-2.5 block text-sm font-medium text-lavender">신청곡</label>

          {selected ? (
            <div className="flex items-center gap-3 rounded-[10px] border border-amber/30 bg-panel p-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-white/5">
                {selected.albumImage && (
                  <img
                    src={selected.albumImage}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-[16px] text-ivory">{selected.name}</p>
                <p className="truncate text-sm text-lavender">{selected.artists}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="shrink-0 rounded-full px-3 py-1.5 text-sm text-lavender transition-colors hover:text-ivory active:scale-95"
              >
                변경
              </button>
            </div>
          ) : (
            <>
              <input
                className={fieldClass}
                placeholder="곡 제목이나 가수로 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                enterKeyHint="search"
                autoComplete="off"
              />
              {!query.trim() && !searching && results.length === 0 && (
                <p className="mt-2 px-1 text-[13px] leading-relaxed text-lavender/50">
                  오늘 읽은 책과 어울리는 곡, 지금 기분을 담은 노래,
                  혹은 이 강변에 흘렀으면 하는 한 곡을 찾아보세요.
                </p>
              )}
              {/* 검색 결과 — max-height로 스크롤 제한 */}
              <div className="mt-2 max-h-[280px] overflow-y-auto overscroll-contain rounded-[10px] border border-white/8 bg-panel/60 empty:hidden">
                {searching && (
                  <p className="px-4 py-3 text-sm text-lavender/70">찾고 있어요…</p>
                )}
                {!searching &&
                  results.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelected(t)
                        setResults([])
                      }}
                      className="flex w-full items-center gap-3 border-b border-white/5 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-white/5 active:bg-white/8"
                    >
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded bg-white/5">
                        {t.albumImage && (
                          <img src={t.albumImage} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] text-ivory">{t.name}</p>
                        <p className="truncate text-sm text-lavender">{t.artists}</p>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-lavender/60">
                        {fmt(t.durationMs)}
                      </span>
                    </button>
                  ))}
                {!searching && query.trim() && results.length === 0 && (
                  <p className="px-4 py-3 text-sm text-lavender/70">검색 결과가 없어요.</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* 문장 */}
        <div>
          <label className="mb-2.5 block text-sm font-medium text-lavender">
            이 노래와 어울리는 한 문장, 혹은 지금 기분
          </label>
          <textarea
            className={`${fieldClass} min-h-[100px] resize-none font-serif text-[17px] leading-relaxed`}
            placeholder="여기에 적어주세요"
            value={sentence}
            onChange={(e) => {
              setSentence(e.target.value)
              if (error) setError("")
            }}
            maxLength={140}
          />
          <div className="mt-1.5 flex justify-end">
            <span className={`text-xs tabular-nums ${sentence.length > 120 ? "text-amber" : "text-lavender/60"}`}>
              {sentence.length}/140
            </span>
          </div>
        </div>

        {/* 닉네임 */}
        <div>
          <label className="mb-2.5 block text-sm font-medium text-lavender">
            닉네임 <span className="font-normal text-lavender/50">(선택)</span>
          </label>
          <input
            className={fieldClass}
            placeholder="비워두면 '익명'으로 올라가요"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            autoComplete="off"
          />
        </div>

        {/* 제출 */}
        <div className="mt-auto pt-2">
          <button
            type="submit"
            disabled={!canSubmit || sending}
            className="w-full rounded-[10px] bg-amber px-5 py-4 text-[16px] font-semibold text-ink transition-transform duration-150 ease-out will-change-transform hover:brightness-[1.03] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            {sending ? "보내는 중…" : "올리기"}
          </button>
          <p className="mt-2.5 text-center text-xs text-lavender/60">
            곡만, 문장만 남기셔도 좋아요.
          </p>
          <div className="h-7 pt-2.5 text-center">
            {error && <p className="text-sm text-amber/90">{error}</p>}
          </div>
        </div>
      </form>

      <p className="pt-6 text-center text-[11px] leading-relaxed text-lavender/50">
        로그인 없이 익명으로 남겨집니다.
        <br />
        남겨주신 곡과 문장은 오늘 저녁, 큰 화면에 함께 걸려요.
      </p>
    </div>
  )
}
