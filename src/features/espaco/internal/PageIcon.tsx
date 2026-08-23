// LM Notion — renderiza o icone de uma pagina.
// page.icon guarda ou um emoji cru ("📄") ou o nome de um icone lucide ("FileText").

import * as Icons from 'lucide-react'
import { FileText, type LucideIcon } from 'lucide-react'

interface PageIconProps {
  icon: string | null | undefined
  size?: number
  className?: string
  fallback?: LucideIcon
}

/** Nome de icone lucide sempre comeca com maiuscula e so tem letras/numeros. */
function isLucideName(v: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(v)
}

export default function PageIcon({
  icon, size = 16, className = '', fallback: Fallback = FileText,
}: PageIconProps) {
  if (!icon) {
    return <Fallback size={size} className={`shrink-0 opacity-70 ${className}`} />
  }

  if (isLucideName(icon)) {
    const Cmp = (Icons as unknown as Record<string, LucideIcon>)[icon]
    if (Cmp) return <Cmp size={size} className={`shrink-0 ${className}`} />
  }

  // Emoji (ou qualquer string curta): renderiza como texto no mesmo box do icone.
  return (
    <span
      className={`shrink-0 inline-flex items-center justify-center leading-none ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.95 }}
    >
      {icon}
    </span>
  )
}
