import { markPlayed, nowPlaying, upNext, useStore } from "../lib/store"

export default function AdminPage() {
  const { songs, sentences } = useStore()
  const current = nowPlaying(songs)
  const queue = upNext(songs)

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <p className="text-[13px] font-medium uppercase tracking-[0.22em] text-amber/90">
        진행자용
      </p>
      <h1 className="mt-3 font-serif text-3xl text-ivory">오늘 밤의 흐름</h1>
      <p className="mt-2 text-sm text-lavender">
        재생이 끝난 곡은 &ldquo;재생완료&rdquo;를 눌러 다음 곡으로 넘겨주세요.
      </p>

      <div className="mt-9 rounded-xl border border-amber/25 bg-panel p-6">
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
            <button
              onClick={() => markPlayed(current.id)}
              className="shrink-0 rounded-[10px] bg-amber px-4 py-2.5 font-medium text-ink transition-transform duration-150 active:scale-[0.985]"
            >
              재생완료
            </button>
          </div>
        ) : (
          <p className="mt-3 text-lavender">재생 중인 곡이 없어요.</p>
        )}
      </div>

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
              <span className="flex items-baseline gap-3">
                <span className="text-sm tabular-nums text-lavender/50">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-ivory">
                  {s.title}
                  {s.artist && <span className="text-lavender"> · {s.artist}</span>}
                </span>
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

      <p className="mt-8 text-sm text-lavender/70">
        지금까지 모인 문장 {sentences.length}개
      </p>
    </div>
  )
}
