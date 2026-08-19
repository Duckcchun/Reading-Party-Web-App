import { useCallback, useEffect, useRef, useState } from "react"
import { getSpotifyClientId } from "./store"

// 주최측 Premium 계정 1개로만 로그인하는 디스플레이용 재생 모듈 (PKCE)
const SCOPES =
  "streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state"
const TOKEN_KEY = "hrp-spotify-token"
const VERIFIER_KEY = "hrp-spotify-verifier"

const redirectUri = () => window.location.origin + window.location.pathname

type Stored = { access: string; refresh: string; expiresAt: number }

function loadToken(): Stored | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    return raw ? (JSON.parse(raw) as Stored) : null
  } catch {
    return null
  }
}
function saveToken(t: Stored) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(t))
}

function randomString(len: number) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
  const arr = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(arr, (n) => chars[n % chars.length]).join("")
}
async function sha256base64url(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

async function beginLogin(clientId: string) {
  const verifier = randomString(64)
  localStorage.setItem(VERIFIER_KEY, verifier)
  const challenge = await sha256base64url(verifier)
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri(),
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: challenge,
  })
  window.location.href = `https://accounts.spotify.com/authorize?${params}`
}

async function exchangeCode(clientId: string, code: string): Promise<Stored | null> {
  const verifier = localStorage.getItem(VERIFIER_KEY) ?? ""
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  })
  if (!res.ok) return null
  const d = await res.json()
  return { access: d.access_token, refresh: d.refresh_token, expiresAt: Date.now() + d.expires_in * 1000 }
}

async function refreshToken(clientId: string, refresh: string): Promise<Stored | null> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: refresh,
    }),
  })
  if (!res.ok) return null
  const d = await res.json()
  return {
    access: d.access_token,
    refresh: d.refresh_token ?? refresh,
    expiresAt: Date.now() + d.expires_in * 1000,
  }
}

let sdkPromise: Promise<void> | null = null
function loadSdk(): Promise<void> {
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve) => {
    if ((window as any).Spotify) return resolve()
    ;(window as any).onSpotifyWebPlaybackSDKReady = () => resolve()
    const script = document.createElement("script")
    script.src = "https://sdk.scdn.co/spotify-player.js"
    document.body.appendChild(script)
  })
  return sdkPromise
}

export type PlayerStatus = "unconfigured" | "loggedout" | "connecting" | "ready" | "error"

export function useSpotifyPlayer(onTrackEnded: () => void) {
  const [status, setStatus] = useState<PlayerStatus>("connecting")
  const [clientId, setClientId] = useState("")
  const tokenRef = useRef<Stored | null>(null)
  const playerRef = useRef<any>(null)
  const deviceIdRef = useRef<string>("")
  const endedRef = useRef(onTrackEnded)
  const wasProgressing = useRef(false)
  const currentUri = useRef<string>("")

  endedRef.current = onTrackEnded

  const validToken = useCallback(async (): Promise<string | null> => {
    let t = tokenRef.current
    if (!t) return null
    if (t.expiresAt < Date.now() + 10000 && clientId) {
      const nt = await refreshToken(clientId, t.refresh)
      if (nt) {
        tokenRef.current = nt
        saveToken(nt)
        t = nt
      }
    }
    return t.access
  }, [clientId])

  // 초기화: client id 로드 → 리다이렉트 코드 교환 → SDK 연결
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const cid = await getSpotifyClientId()
      if (cancelled) return
      if (!cid) {
        setStatus("unconfigured")
        return
      }
      setClientId(cid)

      // 리다이렉트 복귀 처리
      const url = new URL(window.location.href)
      const code = url.searchParams.get("code")
      if (code) {
        const t = await exchangeCode(cid, code)
        url.searchParams.delete("code")
        url.searchParams.delete("state")
        window.history.replaceState({}, "", url.pathname + url.search + url.hash)
        if (t) saveToken(t)
      }

      const stored = loadToken()
      if (!stored) {
        setStatus("loggedout")
        return
      }
      tokenRef.current = stored

      await loadSdk()
      if (cancelled) return

      const player = new (window as any).Spotify.Player({
        name: "한강 리딩 파티",
        getOAuthToken: async (cb: (t: string) => void) => {
          const tok = await validTokenFor(cid)
          cb(tok ?? "")
        },
        volume: 0.8,
      })
      playerRef.current = player

      player.addListener("ready", ({ device_id }: any) => {
        deviceIdRef.current = device_id
        setStatus("ready")
      })
      player.addListener("not_ready", () => setStatus("connecting"))
      player.addListener("authentication_error", () => setStatus("loggedout"))
      player.addListener("initialization_error", () => setStatus("error"))
      player.addListener("account_error", () => setStatus("error"))
      player.addListener("player_state_changed", (state: any) => {
        if (!state) return
        // 곡 종료 감지: 재생되던 트랙이 멈추고 위치가 0으로 돌아오면 끝난 것으로 봅니다.
        if (state.paused && state.position === 0 && wasProgressing.current) {
          wasProgressing.current = false
          endedRef.current()
        } else if (!state.paused && state.position > 0) {
          wasProgressing.current = true
        }
      })

      const ok = await player.connect()
      if (!ok) setStatus("error")
    })()

    // getOAuthToken가 참조할 토큰 갱신기 (클로저 안전용)
    async function validTokenFor(cid: string): Promise<string | null> {
      let t = tokenRef.current
      if (!t) return null
      if (t.expiresAt < Date.now() + 10000) {
        const nt = await refreshToken(cid, t.refresh)
        if (nt) {
          tokenRef.current = nt
          saveToken(nt)
          t = nt
        }
      }
      return t.access
    }

    return () => {
      cancelled = true
      playerRef.current?.disconnect?.()
    }
  }, [])

  const login = useCallback(() => {
    if (clientId) beginLogin(clientId)
  }, [clientId])

  const play = useCallback(
    async (uri: string) => {
      const token = await validToken()
      const deviceId = deviceIdRef.current
      if (!token || !deviceId || !uri) return
      currentUri.current = uri
      wasProgressing.current = false
      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ uris: [uri] }),
      })
    },
    [validToken],
  )

  const togglePlay = useCallback(() => playerRef.current?.togglePlay?.(), [])

  return { status, login, play, togglePlay, currentUri }
}
