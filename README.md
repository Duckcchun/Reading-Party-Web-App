# 한강 리딩 파티 Web App

강변의 저녁이 라운지로 바뀌는 동안, 참가자들이 노래와 문장을 남기는 실시간 웹 앱.

## 기술 스택

- **Frontend**: React 19 + Vite 8 + Tailwind CSS v4
- **Backend**: Supabase Edge Functions (Deno + Hono)
- **Database**: Supabase KV Store
- **Realtime**: Supabase Realtime Broadcast
- **Music**: Spotify Web Playback SDK (PKCE)
- **Hosting**: Vercel (Frontend)

## 배포

### Vercel (프론트엔드)

1. GitHub 연결 후 프로젝트 import
2. **Root Directory**: `app` 으로 설정
3. Framework Preset: Vite (자동 감지됨)
4. Deploy

### Supabase (백엔드)

```bash
supabase functions deploy server
```

필요한 환경변수:
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`

### Spotify 설정

Spotify Developer Dashboard에서 Redirect URI에 배포된 주소 등록:
- 예: `https://your-app.vercel.app/`
- 해시(`#/display`) 제외, 끝에 `/` 포함

## 로컬 개발

```bash
cd app
pnpm install
pnpm dev
```

## 페이지 구성

| 경로 | 역할 |
|------|------|
| `#/participant` | 참가자 — 곡 검색 + 문장 제출 |
| `#/display` | 디스플레이 — 큰 화면에 실시간 피드 + Spotify 재생 |
| `#/admin` | 진행자 — 재생 대기열 관리 |
