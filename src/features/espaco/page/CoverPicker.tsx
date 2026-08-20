// DashNotion — seletor de capa. Duplicata de _internal/page/CoverPicker.tsx
// com upload pela action `upload` (useUploadFile).

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '@/features/espaco/lib/errors'
import { coverBackground } from '@/features/espaco/internal/page/CoverImage'
import { useUploadFile } from '../useDashNotion'

const GRADIENTS: string[] = [
  'linear-gradient(135deg, #0F0520 0%, #7C3AED 100%)',
  'linear-gradient(135deg, #1A0A2E 0%, #9333EA 100%)',
  'linear-gradient(120deg, #2E1065 0%, #A78BFA 100%)',
  'linear-gradient(135deg, #0F0520 0%, #5B21B6 50%, #C026D3 100%)',
  'linear-gradient(90deg, #1A0A2E 0%, #6D28D9 100%)',
  'linear-gradient(160deg, #7C3AED 0%, #0F0520 100%)',
  'linear-gradient(135deg, #3B0764 0%, #DB2777 100%)',
  'linear-gradient(135deg, #0F0520 0%, #1E3A8A 100%)',
  'radial-gradient(circle at 30% 20%, #7C3AED 0%, #0F0520 70%)',
  'radial-gradient(circle at 70% 80%, #9333EA 0%, #1A0A2E 65%)',
  'linear-gradient(135deg, #4C1D95 0%, #A78BFA 50%, #EDE9FE 100%)',
  'conic-gradient(from 210deg at 50% 50%, #0F0520, #7C3AED, #C026D3, #0F0520)',
]

interface CoverPickerProps {
  onPick: (cover: string) => void
  onClose: () => void
}

export default function CoverPicker({ onPick, onClose }: CoverPickerProps) {
  const [tab, setTab] = useState<'galeria' | 'upload' | 'link'>('galeria')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadFile = useUploadFile()

  async function handleFile(file: File) {
    setBusy(true)
    try {
      const publicUrl = await uploadFile(file)
      onPick(publicUrl)
      onClose()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const tabCls = (active: boolean) =>
    `rounded-lm-sm px-2 py-1 text-xs ${active ? 'bg-lm-card2 text-lm-primary' : 'text-lm-subtle hover:text-lm-primary'}`

  return (
    <div className="w-[420px] rounded-lm-lg border border-lm-border bg-lm-card shadow-lm-modal">
      <div className="flex items-center gap-1 border-b border-lm-border px-2 py-1.5">
        <button type="button" className={tabCls(tab === 'galeria')} onClick={() => setTab('galeria')}>Galeria</button>
        <button type="button" className={tabCls(tab === 'upload')} onClick={() => setTab('upload')}>Upload</button>
        <button type="button" className={tabCls(tab === 'link')} onClick={() => setTab('link')}>Link</button>
      </div>

      <div className="p-3">
        {tab === 'galeria' && (
          <div className="grid grid-cols-4 gap-2">
            {GRADIENTS.map((g, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { onPick(`gradient:${g}`); onClose() }}
                className="h-16 rounded-lm-sm border border-lm-border transition hover:border-lm-neon"
                style={{ backgroundImage: coverBackground(`gradient:${g}`) }}
              />
            ))}
          </div>
        )}

        {tab === 'upload' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f) }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="rounded-lm-sm bg-lm-neon px-3 py-1.5 text-sm text-lm-inverse disabled:opacity-60"
            >
              {busy ? 'Enviando...' : 'Escolher arquivo'}
            </button>
            <p className="text-xs text-lm-subtle">Imagens ate 50 MB</p>
          </div>
        )}

        {tab === 'link' && (
          <div className="flex flex-col gap-2 py-2">
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="Cole a URL da imagem"
              className="w-full rounded-lm-sm border border-lm-border bg-lm-bg px-2 py-1.5 text-sm text-lm-primary outline-none placeholder:text-lm-subtle focus:border-lm-neon"
            />
            <button
              type="button"
              disabled={!url.trim()}
              onClick={() => { onPick(url.trim()); onClose() }}
              className="self-start rounded-lm-sm bg-lm-neon px-3 py-1.5 text-sm text-lm-inverse disabled:opacity-50"
            >
              Aplicar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
