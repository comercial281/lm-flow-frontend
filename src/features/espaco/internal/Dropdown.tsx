// LM Notion — menu suspenso a prova de recorte.
//
// POR QUE ISTO EXISTE: os menus eram <div absolute> dentro do container. A
// barra de views tem `overflow-x-auto`, e pela regra do CSS isso faz o
// overflow-y virar `auto` tambem — ou seja, o container CORTA tudo que passa
// da altura dele. O menu abria no DOM (teste dizia "abriu") mas ficava
// recortado e INVISIVEL pra quem usa. Renderizando em portal no <body> com
// position: fixed, nenhum ancestral consegue recortar.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

interface DropdownProps {
  /** Elemento que ancora o menu (o botao que abriu). */
  anchorRef: RefObject<HTMLElement | null>
  open: boolean
  onClose: () => void
  /** Alinha pela borda esquerda ou direita do ancora. */
  align?: 'left' | 'right'
  children: ReactNode
}

export default function Dropdown({ anchorRef, open, onClose, align = 'left', children }: DropdownProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // Posiciona depois de montar, ja sabendo a largura real do menu.
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return

    function posicionar() {
      const a = anchorRef.current?.getBoundingClientRect()
      if (!a) return
      const largura = menuRef.current?.offsetWidth ?? 200
      const altura = menuRef.current?.offsetHeight ?? 200

      let left = align === 'right' ? a.right - largura : a.left
      // Nao deixa sair pela lateral da janela.
      left = Math.max(8, Math.min(left, window.innerWidth - largura - 8))

      // Se nao couber embaixo, abre pra cima.
      let top = a.bottom + 4
      if (top + altura > window.innerHeight - 8) {
        const acima = a.top - altura - 4
        top = acima > 8 ? acima : Math.max(8, window.innerHeight - altura - 8)
      }
      setPos({ top, left })
    }

    posicionar()
    // Rolar ou redimensionar move o ancora: reposiciona junto.
    window.addEventListener('scroll', posicionar, true)
    window.addEventListener('resize', posicionar)
    return () => {
      window.removeEventListener('scroll', posicionar, true)
      window.removeEventListener('resize', posicionar)
    }
  }, [open, align, anchorRef])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    function onDown(e: PointerEvent) {
      const alvo = e.target as Node
      if (menuRef.current?.contains(alvo)) return
      if (anchorRef.current?.contains(alvo)) return   // o proprio botao ja alterna
      onClose()
    }
    window.addEventListener('keydown', onKey)
    // captura: fecha antes de qualquer handler da pagina consumir o clique
    window.addEventListener('pointerdown', onDown, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown, true)
    }
  }, [open, onClose, anchorRef])

  if (!open) return null

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: 'fixed',
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        // esconde o primeiro frame ate ter posicao medida (evita "pulo")
        visibility: pos ? 'visible' : 'hidden',
      }}
      className="z-[9999] overflow-hidden rounded-lm-md border border-lm-border bg-lm-card shadow-lm-lg"
    >
      {children}
    </div>,
    document.body,
  )
}
