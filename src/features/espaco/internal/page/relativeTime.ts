// LM Notion — data relativa em pt-BR para comentarios e versoes.

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

function ddmmyyyy(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function relativeTime(iso: string): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''

  const diff = Date.now() - then.getTime()
  if (diff < 0) return 'agora'
  if (diff < MIN) return 'agora'

  if (diff < HOUR) {
    const m = Math.floor(diff / MIN)
    return m === 1 ? 'ha 1 minuto' : `ha ${m} minutos`
  }

  if (diff < DAY) {
    const h = Math.floor(diff / HOUR)
    return h === 1 ? 'ha 1 hora' : `ha ${h} horas`
  }

  const days = Math.floor(diff / DAY)
  if (days === 1) return 'ontem'
  if (days <= 7) return `ha ${days} dias`
  return ddmmyyyy(then)
}
