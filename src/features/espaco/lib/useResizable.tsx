import { useCallback, useRef, useState } from 'react'

// Largura arrastável e persistida (localStorage). A handle chama startDrag.
// dir='left'  → a handle fica na borda ESQUERDA do painel (arrastar p/ esquerda alarga).
// dir='right' → a handle fica na borda DIREITA (arrastar p/ direita alarga).
export function useResizable(
  storageKey: string,
  defaultPx: number,
  min: number,
  max: number,
  dir: 'left' | 'right' = 'left',
) {
  const read = () => {
    if (typeof window === 'undefined') return defaultPx
    const s = window.localStorage.getItem(storageKey)
    const n = s ? Number(s) : NaN
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaultPx
  }
  const [width, setWidth] = useState<number>(read)
  const [dragging, setDragging] = useState(false)
  const wRef = useRef(width)
  wRef.current = width

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
    const startX = e.clientX
    const startW = wRef.current
    const onMove = (ev: MouseEvent) => {
      const delta = dir === 'left' ? startX - ev.clientX : ev.clientX - startX
      const nw = Math.min(max, Math.max(min, startW + delta))
      wRef.current = nw
      setWidth(nw)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      setDragging(false)
      try { window.localStorage.setItem(storageKey, String(wRef.current)) } catch { /* ignore */ }
    }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [dir, max, min, storageKey])

  const reset = useCallback(() => {
    wRef.current = defaultPx
    setWidth(defaultPx)
    try { window.localStorage.setItem(storageKey, String(defaultPx)) } catch { /* ignore */ }
  }, [defaultPx, storageKey])

  return { width, dragging, startDrag, reset }
}

// Componente da barra de arraste. Coloque dentro de um container relative,
// encostado na borda indicada por `side`.
export function ResizeHandle({ onMouseDown, side = 'left', dragging }: {
  onMouseDown: (e: React.MouseEvent) => void
  side?: 'left' | 'right'
  dragging?: boolean
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      onDoubleClick={e => e.stopPropagation()}
      title="Arraste para redimensionar"
      className={`absolute top-0 ${side === 'left' ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2'} h-full w-2 cursor-col-resize z-20 group flex items-center justify-center`}
    >
      <div className={`h-full w-px transition-colors ${dragging ? 'bg-lm-neon' : 'bg-transparent group-hover:bg-lm-neon/50'}`} />
    </div>
  )
}
