import { useEffect, useRef, useState } from "react"
import { searchTracks, submitEntry, type Track } from "../lib/store"
import { containsProfanity } from "../lib/profanity"

const fieldClass =
  "w-full rounded-[10px] border border-white/8 bg-panel px-4 py-3 text-ivory placeholder:text-lavender/70 outline-none transition-colors focus:border-amber/50 focus:ring-2 focus:ring-amber/15"

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

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      const r = await searchTracks(q)
      setResults(r)
      setSearching(false)
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
    if (result !== "ok") {
      setError("전송이 잠시 막혔어요. 다시 한 번 눌러주실래요.")
      return
    }
    setSelected(null)
    setQuery("")
    setResults([])
    setSentence("")
    setError("")
    // 닉네임은 다음 신청에도 이어 쓸 수 있게 지우지 않습니다.
    setDone(true)
    setTimeout(() => setDone(false), 3600)
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-6 pb-16 pt-12">
      <header className="mb-8">
        <p className="text-[13px] font-medium uppercase tracking-[0.22em] text-amber/90">
          한강 리딩 파티
        </p>
        <h1 className="mt-4 font-serif text-[26px] leading-[1.5] text-ivory">
          오늘 밤, 함께 들을
          <br />
          노래와 문장을 남겨주세요.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-lavender">
          강변의 저녁이 라운지로 바뀌는 동안, 당신의 한 곡과 한 문장이
          이 자리를 채웁니다.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-7">
        <div>
          <label className="mb-3 block text-sm text-lavender">신청곡</label>

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
                <p className="truncate font-serif text-[17px] text-ivory">{selected.name}</p>
                <p className="truncate text-sm text-lavender">{selected.artists}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="shrink-0 rounded-full px-3 py-1 text-sm text-lavender transition-colors hover:text-ivory"
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
              />
              <div className="mt-2 overflow-hidden rounded-[10px] border border-white/8 bg-panel/60 empty:hidden">
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
                      className="flex w-full items-center gap-3 border-b border-white/5 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-white/5 active:scale-[0.995]"
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

        <div>
          <label className="mb-3 block text-sm text-lavender">
            이 노래와 어울리는 한 문장, 혹은 지금 기분
          </label>
          <textarea
            className={`${fieldClass} min-h-28 resize-none font-serif text-[17px] leading-relaxed`}
            placeholder="여기에 적어주세요"
            value={sentence}
            onChange={(e) => {
              setSentence(e.target.value)
              if (error) setError("")
            }}
            maxLength={140}
          />
          <div className="mt-2 flex justify-end">
            <span className="text-xs text-lavender/70">{sentence.length}/140</span>
          </div>
        </div>

        <div>
          <label className="mb-3 block text-sm text-lavender">
            닉네임 <span className="text-lavender/60">(선택)</span>
          </label>
          <input
            className={fieldClass}
            placeholder="비워두면 '익명'으로 올라가요"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
          />
        </div>

        <div>
          <button
            type="submit"
            disabled={!canSubmit || sending}
            className="w-full rounded-[10px] bg-amber px-5 py-3.5 font-medium text-ink transition-transform duration-150 ease-out will-change-transform hover:brightness-[1.03] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            {sending ? "보내는 중…" : "올리기"}
          </button>
          <p className="mt-2 text-center text-xs text-lavender/60">
            곡만, 문장만 남기셔도 좋아요.
          </p>
          <div className="h-6 pt-2 text-center">
            {error && <p className="text-sm text-amber/90">{error}</p>}
            {done && !error && (
              <p className="text-sm text-amber/90">잘 전달됐어요. 화면에서 만나요.</p>
            )}
          </div>
        </div>
      </form>

      <p className="mt-auto pt-10 text-center text-xs leading-relaxed text-lavender/60">
        로그인 없이 익명으로 남겨집니다.
        <br />
        남겨주신 곡과 문장은 오늘 저녁, 큰 화면에 함께 걸려요.
      </p>
    </div>
  )
}
