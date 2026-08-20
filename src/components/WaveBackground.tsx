import { useEffect, useRef } from "react"

// 6~8줄의 사인파 합성 곡선이 서로 다른 속도·진폭·위상으로 물결치며
// amber → lavender 그라데이션으로 빛나는 Canvas 배경입니다.
// 곡 재생 중이면 진폭이 커지고, 멈추면 잔잔해집니다.

interface WaveBackgroundProps {
  /** 곡 재생 중 여부. 진폭에 영향을 줍니다. */
  isPlaying?: boolean
}

// 각 줄의 설정
interface WaveLine {
  baseY: number // 0~1 비율 (화면 높이 대비 위치)
  amplitude: number // 기본 진폭 (px)
  frequency: number // 파장 (숫자가 클수록 촘촘)
  speed: number // 이동 속도
  phase: number // 시작 위상
  width: number // 선 두께
  opacity: number // 투명도
  color: [number, number, number] // RGB
  glowRadius: number // 글로우 반경
  // 두 번째 사인파를 합성해서 더 유기적으로
  freq2: number
  amp2: number
  speed2: number
}

function createLines(): WaveLine[] {
  // amber: [242,166,90], lavender: [148,152,184], ivory-gold: [220,180,120], blue: [100,130,200]
  const palette: [number, number, number][] = [
    [242, 170, 100], // warm amber
    [220, 150, 80], // deep amber
    [180, 160, 140], // muted gold
    [148, 152, 184], // lavender
    [120, 140, 200], // soft blue
    [100, 120, 180], // deep blue
    [200, 160, 100], // golden
    [160, 148, 180], // light purple
  ]

  return Array.from({ length: 8 }, (_, i) => {
    const t = i / 7 // 0~1
    return {
      baseY: 0.2 + t * 0.6, // 화면의 20%~80% 사이에 분포
      amplitude: 30 + Math.random() * 40,
      frequency: 0.002 + Math.random() * 0.003,
      speed: 0.3 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
      width: 1.2 + Math.random() * 1.8,
      opacity: 0.25 + Math.random() * 0.3,
      color: palette[i],
      glowRadius: 8 + Math.random() * 12,
      freq2: 0.004 + Math.random() * 0.004,
      amp2: 10 + Math.random() * 20,
      speed2: 0.15 + Math.random() * 0.3,
    }
  })
}

export default function WaveBackground({ isPlaying = false }: WaveBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const linesRef = useRef<WaveLine[]>(createLines())
  const animRef = useRef<number>(0)
  const playingRef = useRef(isPlaying)
  // 부드럽게 진폭이 전환되도록 보간합니다.
  const ampMultRef = useRef(isPlaying ? 1.4 : 1)

  playingRef.current = isPlaying

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let w = 0
    let h = 0

    function resize() {
      const dpr = window.devicePixelRatio || 1
      w = canvas!.clientWidth
      h = canvas!.clientHeight
      canvas!.width = w * dpr
      canvas!.height = h * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener("resize", resize)

    let t = 0
    const lines = linesRef.current

    function draw() {
      t += 0.016 // ~60fps 기준 시간 누적

      // 진폭 보간: 재생 중이면 1.4배, 멈추면 1배로 부드럽게 전환
      const target = playingRef.current ? 1.4 : 1
      ampMultRef.current += (target - ampMultRef.current) * 0.02
      const ampMult = ampMultRef.current

      ctx!.clearRect(0, 0, w, h)

      for (const line of lines) {
        const y0 = line.baseY * h
        const amp = line.amplitude * ampMult
        const amp2 = line.amp2 * ampMult

        ctx!.beginPath()
        ctx!.strokeStyle = `rgba(${line.color[0]},${line.color[1]},${line.color[2]},${line.opacity})`
        ctx!.lineWidth = line.width
        ctx!.shadowColor = `rgba(${line.color[0]},${line.color[1]},${line.color[2]},${line.opacity * 0.7})`
        ctx!.shadowBlur = line.glowRadius

        // 점 사이 간격을 4px로 해서 부드러운 곡선을 그립니다.
        const step = 4
        for (let x = 0; x <= w; x += step) {
          const sin1 = Math.sin(x * line.frequency + t * line.speed + line.phase)
          const sin2 = Math.sin(x * line.freq2 + t * line.speed2 + line.phase * 1.7)
          const y = y0 + sin1 * amp + sin2 * amp2

          if (x === 0) {
            ctx!.moveTo(x, y)
          } else {
            ctx!.lineTo(x, y)
          }
        }

        ctx!.stroke()
        ctx!.shadowBlur = 0
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[3] h-full w-full"
      style={{ opacity: 0.85 }}
    />
  )
}
