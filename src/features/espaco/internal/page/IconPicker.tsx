// LM Notion — seletor de icone da pagina. Aba de emojis (grade com busca,
// agrupada) e aba de icones lucide. O valor salvo em page.icon e o emoji cru
// ou o nome do icone lucide.

import { useMemo, useState } from 'react'
import BasePageIcon from '../PageIcon'
import {
  Activity, AlarmClock, Album, Anchor, Aperture, Archive, AtSign, Award,
  Banknote, BarChart3, Battery, Bell, Bookmark, Box, Briefcase, Bug,
  Building2, Calendar, Camera, Check, CircleDot, Clipboard, Cloud, Code,
  Coffee, Compass, Cpu, CreditCard, Database, Diamond, FileText, Filter,
  Flag, Flame, Folder, Gauge, Gift, Globe, GraduationCap, Hammer, Heart,
  Home, Image, Inbox, Key, Layers, Lightbulb, Link, ListChecks, Lock, Mail,
  Map, MessageSquare, Mic, Moon, Music, Newspaper, Package, Palette,
  PenTool, Phone, PieChart, Rocket, Search, Settings, Shield, ShoppingCart,
  Sparkles, Star, Sun, Table, Tag, Target, Terminal, Trophy, Truck, User,
  Users, Video, Wallet, Wrench, Zap,
  type LucideIcon,
} from 'lucide-react'

export const LUCIDE_ICONS: Record<string, LucideIcon> = {
  Activity, AlarmClock, Album, Anchor, Aperture, Archive, AtSign, Award,
  Banknote, BarChart3, Battery, Bell, Bookmark, Box, Briefcase, Bug,
  Building2, Calendar, Camera, Check, CircleDot, Clipboard, Cloud, Code,
  Coffee, Compass, Cpu, CreditCard, Database, Diamond, FileText, Filter,
  Flag, Flame, Folder, Gauge, Gift, Globe, GraduationCap, Hammer, Heart,
  Home, Image, Inbox, Key, Layers, Lightbulb, Link, ListChecks, Lock, Mail,
  Map, MessageSquare, Mic, Moon, Music, Newspaper, Package, Palette,
  PenTool, Phone, PieChart, Rocket, Search, Settings, Shield, ShoppingCart,
  Sparkles, Star, Sun, Table, Tag, Target, Terminal, Trophy, Truck, User,
  Users, Video, Wallet, Wrench, Zap,
}

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: 'Rostos',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊',
      '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪',
      '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏',
      '😒', '🙄', '😬', '😮', '😯', '😴', '🤤', '😪', '😵', '🤯', '🥳', '😎',
      '🤓', '🧐', '😕', '😟', '🙁', '😢', '😭', '😤', '😠', '😡', '🤬', '😱',
      '😨', '😰', '😥', '🤒', '🤕', '🤢', '🤮', '🥵', '🥶', '😈',
    ],
  },
  {
    label: 'Pessoas',
    emojis: [
      '👋', '🤚', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈',
      '👉', '👆', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌',
      '👐', '🤲', '🤝', '🙏', '💪', '🧠', '👀', '👶', '🧒', '👦', '👧', '🧑',
      '👨', '👩', '🧔', '👴', '👵', '👮', '🕵️', '💂', '👷', '🤴', '👸', '🧑‍💻',
      '👨‍💻', '👩‍💻', '🧑‍🚀', '🧑‍🔬', '🧑‍🏫', '🧑‍🍳', '🦸', '🧙', '🧚', '👤', '👥', '🗣️',
    ],
  },
  {
    label: 'Natureza',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮',
      '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆', '🦅', '🦉', '🐺', '🐗', '🐴',
      '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐢', '🐍', '🐙', '🦑', '🦐', '🐠',
      '🐬', '🐳', '🦈', '🐊', '🌵', '🎄', '🌲', '🌳', '🌴', '🌱', '🌿', '☘️',
      '🍀', '🍁', '🍂', '🌸', '🌺', '🌻', '🌼', '🌷', '🌹', '🌍', '🌙', '⭐',
      '🌟', '✨', '⚡', '🔥', '💧', '🌈', '☀️', '⛅', '☁️', '❄️',
    ],
  },
  {
    label: 'Comida',
    emojis: [
      '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒',
      '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🍆', '🥔', '🥕', '🌽', '🌶️',
      '🥦', '🥬', '🧄', '🧅', '🍄', '🥜', '🍞', '🥐', '🥖', '🧀', '🥚', '🍳',
      '🥓', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🥗', '🍝', '🍜', '🍣',
      '🍤', '🍚', '🍰', '🎂', '🧁', '🍪', '🍫', '🍬', '🍿', '☕', '🍵', '🧃',
      '🍺', '🍷', '🥂', '🍾',
    ],
  },
  {
    label: 'Objetos',
    emojis: [
      '💻', '🖥️', '⌨️', '🖱️', '🖨️', '📱', '☎️', '📷', '📹', '🎥', '📺', '🎙️',
      '🎧', '🎸', '🎹', '🥁', '📚', '📖', '📕', '📗', '📘', '📙', '📓', '📒',
      '📝', '✏️', '🖊️', '🖍️', '📌', '📎', '🗂️', '📁', '📂', '🗃️', '📅', '📆',
      '📊', '📈', '📉', '🗒️', '📋', '🔍', '🔎', '🔑', '🔒', '🔓', '🔨', '🛠️',
      '⚙️', '🧰', '🧲', '💡', '🔋', '🔌', '💰', '💳', '💵', '🧾', '📦', '✉️',
      '📮', '🎁', '🏆', '🥇', '🎯', '🚀', '✈️', '🚗', '🏠', '🏢',
    ],
  },
  {
    label: 'Simbolos',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💯', '✅', '☑️',
      '✔️', '❌', '❎', '➕', '➖', '➗', '❗', '❓', '⚠️', '🚫', '🔴', '🟠',
      '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🔶', '🔷', '🔸', '🔹', '▶️', '⏸️',
      '⏹️', '🔁', '🔀', '⬆️', '⬇️', '⬅️', '➡️', '↔️', '🔝', '🆕', '🆗', '🔔',
      '🔕', '♻️', '⭕', '〽️', '💤', '🏁', '🚩', '🏳️', '🎉', '🎊',
    ],
  },
]

interface IconPickerProps {
  value: string | null
  onPick: (icon: string | null) => void
  onClose: () => void
}

export default function IconPicker({ value, onPick, onClose }: IconPickerProps) {
  const [tab, setTab] = useState<'emoji' | 'lucide'>(
    value && LUCIDE_ICONS[value] ? 'lucide' : 'emoji',
  )
  const [term, setTerm] = useState('')

  const groups = useMemo(() => {
    const t = term.trim().toLowerCase()
    if (!t) return EMOJI_GROUPS
    return EMOJI_GROUPS
      .map(g => (g.label.toLowerCase().includes(t) ? g : { ...g, emojis: [] }))
      .filter(g => g.emojis.length > 0)
  }, [term])

  const icons = useMemo(() => {
    const t = term.trim().toLowerCase()
    const names = Object.keys(LUCIDE_ICONS)
    return t ? names.filter(n => n.toLowerCase().includes(t)) : names
  }, [term])

  return (
    <div className="w-[340px] rounded-lm-lg border border-lm-border bg-lm-card shadow-lm-modal">
      <div className="flex items-center gap-1 border-b border-lm-border px-2 py-1.5">
        <button
          type="button"
          onClick={() => setTab('emoji')}
          className={`rounded-lm-sm px-2 py-1 text-xs ${
            tab === 'emoji' ? 'bg-lm-card2 text-lm-primary' : 'text-lm-subtle hover:text-lm-primary'
          }`}
        >
          Emojis
        </button>
        <button
          type="button"
          onClick={() => setTab('lucide')}
          className={`rounded-lm-sm px-2 py-1 text-xs ${
            tab === 'lucide' ? 'bg-lm-card2 text-lm-primary' : 'text-lm-subtle hover:text-lm-primary'
          }`}
        >
          Icones
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => { onPick(null); onClose() }}
          className="rounded-lm-sm px-2 py-1 text-xs text-lm-subtle hover:text-lm-primary"
        >
          Remover
        </button>
      </div>

      <div className="px-2 py-2">
        <input
          value={term}
          onChange={e => setTerm(e.target.value)}
          placeholder="Buscar"
          autoFocus
          className="w-full rounded-lm-sm border border-lm-border bg-lm-bg px-2 py-1.5 text-sm text-lm-primary outline-none placeholder:text-lm-subtle focus:border-lm-neon"
        />
      </div>

      <div className="max-h-[280px] overflow-y-auto px-2 pb-2">
        {tab === 'emoji' ? (
          groups.map(g => (
            <div key={g.label} className="mb-2">
              <div className="px-1 py-1 text-[11px] uppercase tracking-wide text-lm-subtle">{g.label}</div>
              <div className="grid grid-cols-9 gap-0.5">
                {g.emojis.map((e, i) => (
                  <button
                    key={`${g.label}-${i}`}
                    type="button"
                    onClick={() => { onPick(e); onClose() }}
                    className="flex h-8 w-8 items-center justify-center rounded-lm-sm text-lg hover:bg-lm-card2"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="grid grid-cols-8 gap-0.5">
            {icons.map(name => {
              const Ico = LUCIDE_ICONS[name]
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => { onPick(name); onClose() }}
                  className="flex h-8 w-8 items-center justify-center rounded-lm-sm text-lm-muted hover:bg-lm-card2 hover:text-lm-primary"
                >
                  <Ico className="h-4 w-4" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/** Renderiza page.icon: nome lucide vira componente, senao e emoji cru. */
/**
 * Wrapper do PageIcon canonico (_internal/PageIcon).
 * LUCIDE_ICONS aqui e so a GRADE que o picker oferece (~84 icones). Resolver
 * o icone salvo por essa lista quebrava: nome fora dela (BookOpen, CheckSquare,
 * Users — vindos de seed ou de outra tela) renderizava como TEXTO no lugar do
 * desenho. O canonico resolve qualquer nome do lucide.
 */
export function PageIcon({ icon, className = '', size = 16 }: {
  icon: string | null
  className?: string
  size?: number
}) {
  if (!icon) return null
  return <BasePageIcon icon={icon} size={size} className={className} />
}
