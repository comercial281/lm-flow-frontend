// LM Notion — editor de texto simples: text, url, email, phone.
// Salva no blur e no Enter. Fora de foco, url/email/phone viram link clicavel.

import { useEffect, useRef, useState } from 'react'
import type { PropertyType, PropertyValue } from '../../types'

interface Props {
  type: Extract<PropertyType, 'title' | 'text' | 'url' | 'email' | 'phone'>
  value: PropertyValue
  onChange: (v: PropertyValue) => void
  variant?: 'table' | 'panel' | 'card'
  autoFocus?: boolean
  placeholder?: string
}

function hrefFor(type: Props['type'], raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  if (type === 'url') return /^https?:\/\//i.test(v) ? v : `https://${v}`
  if (type === 'email') return `mailto:${v}`
  if (type === 'phone') return `tel:${v.replace(/[^\d+]/g, '')}`
  return null
}

export default function TextCell({
  type, value, onChange, variant = 'table', autoFocus, placeholder,
}: Props) {
  const initial = typeof value === 'string' ? value : ''
  const [draft, setDraft] = useState(initial)
  const [editing, setEditing] = useState(!!autoFocus)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(typeof value === 'string' ? value : '') }, [value])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const readOnly = variant === 'card'
  const link = hrefFor(type, draft)

  function commit() {
    setEditing(false)
    const next = draft.trim()
    if (next !== initial) onChange(next === '' ? null : next)
  }

  if (readOnly || (!editing && link)) {
    if (!draft) {
      return (
        <span
          className="block w-full truncate px-2 py-1 text-sm text-lm-subtle"
          onClick={() => !readOnly && setEditing(true)}
        >
          {readOnly ? '' : (placeholder ?? 'Vazio')}
        </span>
      )
    }
    if (link) {
      return (
        <span className="flex w-full items-center px-2 py-1">
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="truncate text-sm text-lm-neon underline decoration-lm-neon/40 underline-offset-2 hover:decoration-lm-neon"
          >
            {draft}
          </a>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="ml-auto shrink-0 px-1 text-[11px] text-lm-subtle hover:text-lm-primary"
            >
              editar
            </button>
          )}
        </span>
      )
    }
    return <span className="block w-full truncate px-2 py-1 text-sm text-lm-primary">{draft}</span>
  }

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setEditing(true)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
        if (e.key === 'Escape') { setDraft(initial); setEditing(false); e.currentTarget.blur() }
      }}
      placeholder={placeholder ?? 'Vazio'}
      inputMode={type === 'phone' ? 'tel' : type === 'email' ? 'email' : 'text'}
      className={[
        'w-full bg-transparent px-2 py-1 text-sm text-lm-primary outline-none',
        'placeholder:text-lm-subtle',
        variant === 'panel' ? 'rounded-lm-sm hover:bg-lm-card2 focus:bg-lm-card2' : '',
      ].join(' ')}
    />
  )
}
