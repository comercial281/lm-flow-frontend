// DashNotion — editor de arquivos. Duplicata de _internal/props/editors/FilesCell.tsx
// com upload pela action `upload` (useUploadFile) em vez de uploadNotionFile.

import { useRef, useState } from 'react'
import { FileText, Loader2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { errorMessage } from '@/features/espaco/lib/errors'
import type { PropertyValue } from '@/features/espaco/internal/types'
import { useUploadFile } from '../useDashNotion'

interface Props {
  value: PropertyValue
  onChange: (v: PropertyValue) => void
  variant?: 'table' | 'panel' | 'card'
  autoFocus?: boolean
}

type FileItem = { name: string; url: string }

const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif|svg|bmp)(\?|$)/i

function asFiles(v: PropertyValue): FileItem[] {
  if (!Array.isArray(v)) return []
  return (v as unknown[]).filter(
    (i): i is FileItem =>
      !!i && typeof i === 'object' && typeof (i as FileItem).url === 'string' && typeof (i as FileItem).name === 'string',
  )
}

export default function FilesCell({ value, onChange, variant = 'table' }: Props) {
  const files = asFiles(value)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const readOnly = variant === 'card'
  const uploadFile = useUploadFile()

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    setBusy(true)
    try {
      const uploaded: FileItem[] = []
      for (const f of Array.from(list)) {
        const url = await uploadFile(f)
        uploaded.push({ name: f.name, url })
      }
      onChange([...files, ...uploaded])
      toast.success(uploaded.length > 1 ? 'Arquivos enviados' : 'Arquivo enviado')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function remove(url: string) {
    onChange(files.filter(f => f.url !== url))
  }

  return (
    <div className="flex flex-wrap items-center gap-1 px-2 py-1">
      {files.map(f => (
        <span
          key={f.url}
          className="group relative inline-flex max-w-[160px] items-center gap-1 rounded-lm-sm bg-lm-card2 py-0.5 pl-0.5 pr-1.5"
        >
          {IMAGE_RE.test(f.url) ? (
            <img src={f.url} alt={f.name} className="h-6 w-6 shrink-0 rounded-[4px] object-cover" />
          ) : (
            <FileText size={14} className="ml-1 shrink-0 text-lm-subtle" />
          )}
          <a
            href={f.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="truncate text-xs text-lm-primary hover:text-lm-neon"
          >
            {f.name}
          </a>
          {!readOnly && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(f.url) }}
              className="shrink-0 text-lm-subtle hover:text-lm-danger"
              aria-label={`Remover ${f.name}`}
            >
              <X size={11} />
            </button>
          )}
        </span>
      ))}

      {!readOnly && (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-lm-sm px-1.5 py-1 text-xs text-lm-subtle hover:bg-lm-card2 hover:text-lm-primary disabled:opacity-50"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {files.length === 0 ? 'Enviar arquivo' : ''}
          </button>
        </>
      )}
    </div>
  )
}
