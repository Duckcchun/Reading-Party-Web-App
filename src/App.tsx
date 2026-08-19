import { useEffect, useState } from "react"
import ParticipantPage from "./components/ParticipantPage"
import DisplayPage from "./components/DisplayPage"
import AdminPage from "./components/AdminPage"

type Route = "participant" | "display" | "admin"

function parseHash(): Route {
  const h = window.location.hash.replace("#/", "").replace("#", "")
  if (h === "display") return "display"
  if (h === "admin") return "admin"
  return "participant"
}

function Nav({ route }: { route: Route }) {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    // 모바일에서 input/textarea 포커스 시 Nav 숨기기
    const onFocus = (e: FocusEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") setHidden(true)
    }
    const onBlur = () => setHidden(false)
    document.addEventListener("focusin", onFocus)
    document.addEventListener("focusout", onBlur)
    return () => {
      document.removeEventListener("focusin", onFocus)
      document.removeEventListener("focusout", onBlur)
    }
  }, [])

  if (hidden) return null

  const items: { key: Route; label: string }[] = [
    { key: "participant", label: "참가자" },
    { key: "display", label: "디스플레이" },
    { key: "admin", label: "진행자" },
  ]
  return (
    <nav className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex -translate-x-1/2 gap-1 rounded-full border border-white/10 bg-panel/80 p-1 backdrop-blur-md">
      {items.map((it) => (
        <a
          key={it.key}
          href={`#/${it.key}`}
          className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
            route === it.key
              ? "bg-amber text-ink"
              : "text-lavender hover:text-ivory"
          }`}
        >
          {it.label}
        </a>
      ))}
    </nav>
  )
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash)

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])

  return (
    <div className="min-h-full bg-ink">
      {route === "participant" && <ParticipantPage />}
      {route === "display" && <DisplayPage />}
      {route === "admin" && <AdminPage />}
      {route !== "display" && <Nav route={route} />}
    </div>
  )
}
