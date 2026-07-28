// LM Notion — editor checkbox.

import { Check } from 'lucide-react'
import type { PropertyValue } from '../../types'

interface Props {
  value: PropertyValue
  onChange: (v: PropertyValue) => void
  variant?: 'table' | 'panel' | 'card'
  autoFocus?: boolean
}

export default function CheckboxCell({ value, onChange, variant = 'table', autoFocus }: Props) {
  const checked = value === true
  const readOnly = variant === 'card'

  return (
    <div className={variant === 'table' ? 'flex items-center px-2 py-1' : 'flex items-center px-2 py-1'}>
      <button
        type="button"
        autoFocus={autoFocus}
        disabled={readOnly}
        onClick={() => onChange(!checked)}
        role="checkbox"
        aria-checked={checked}
        className={[
          'flex h-4 w-4 items-center justify-center rounded-[4px] border transition-colors',
          checked ? 'border-lm-neon bg-lm-neon text-lm-inverse' : 'border-lm-border2 bg-transparent',
          readOnly ? 'cursor-default' : 'hover:border-lm-neon',
        ].join(' ')}
      >
        {checked && <Check size={11} strokeWidth={3} />}
      </button>
    </div>
  )
}
