// 최소한의 금칙어 필터. 완벽한 검열이 아니라, 명백히 거친 표현을 부드럽게 걸러내기 위한 장치입니다.
const BLOCKED = [
  "시발",
  "씨발",
  "ㅅㅂ",
  "병신",
  "ㅂㅅ",
  "개새",
  "지랄",
  "좆",
  "fuck",
  "shit",
  "bitch",
]

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, "")

export function containsProfanity(text: string): boolean {
  const n = normalize(text)
  return BLOCKED.some((w) => n.includes(normalize(w)))
}
