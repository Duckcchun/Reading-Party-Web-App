// 앨범 아트 이미지에서 주요 색상 2개를 추출합니다.
// Canvas에 이미지를 그린 뒤 픽셀을 샘플링하는 방식입니다.
// CORS 제한을 피하기 위해 crossOrigin을 설정합니다.

export type RGB = [number, number, number]

const cache = new Map<string, RGB[]>()

export async function extractColors(url: string): Promise<RGB[]> {
  if (cache.has(url)) return cache.get(url)!

  try {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = url

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject()
    })

    const canvas = document.createElement("canvas")
    const size = 64 // 작게 축소해서 성능 확보
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d")!
    ctx.drawImage(img, 0, 0, size, size)

    const data = ctx.getImageData(0, 0, size, size).data

    // 여러 지점을 샘플링하고 밝기 기준으로 2개를 고릅니다
    const samples: RGB[] = []
    const step = 4 * 4 // 매 4번째 픽셀
    for (let i = 0; i < data.length; i += step) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      // 너무 어둡거나 너무 밝은 건 제외
      const brightness = (r + g + b) / 3
      if (brightness > 30 && brightness < 220) {
        samples.push([r, g, b])
      }
    }

    if (samples.length < 2) {
      const fallback: RGB[] = [[242, 166, 90], [100, 120, 200]]
      cache.set(url, fallback)
      return fallback
    }

    // 채도 기준으로 정렬해서 가장 생생한 2개를 픽
    samples.sort((a, b) => {
      const satA = Math.max(...a) - Math.min(...a)
      const satB = Math.max(...b) - Math.min(...b)
      return satB - satA
    })

    // 첫 번째와 가장 다른 색상을 두 번째로 선택
    const first = samples[0]
    let second = samples[1]
    let maxDist = 0
    for (let i = 1; i < Math.min(samples.length, 50); i++) {
      const dist = Math.abs(samples[i][0] - first[0]) +
        Math.abs(samples[i][1] - first[1]) +
        Math.abs(samples[i][2] - first[2])
      if (dist > maxDist) {
        maxDist = dist
        second = samples[i]
      }
    }

    const result: RGB[] = [first, second]
    cache.set(url, result)
    return result
  } catch {
    const fallback: RGB[] = [[242, 166, 90], [100, 120, 200]]
    cache.set(url, fallback)
    return fallback
  }
}
