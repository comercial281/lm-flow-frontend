import { useLayoutEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@evoapi/design-system/card';
import { MensagensProntas } from './MensagensProntas';

// MENSAGENS PRONTAS em JANELA, em cima do campo de mensagem: no celular, em
// tela abaixo de 1280 px e na aba Conversa do card do lead. Na tela larga, em
// Conversas, elas abrem na lateral, no lugar do painel do lead
// (`ContactSidebar`). O conteúdo é o mesmo (`MensagensProntas`); aqui a janela
// fecha depois de enviar, porque cobre a conversa.
//
// A altura vai até o teto (70% da tela, 512 px) mas nunca passa do espaço
// livre acima do campo: no celular e em tela estreita o topo da conversa
// (`.wa-header`) cobria o título e o X.

const FOLGA = 16;
const MINIMO = 200;

/** O espaço entre o topo do campo e o que corta a janela por cima (contêiner com rolagem ou o topo da conversa). */
function espacoLivre(ancora: HTMLElement): number {
  const base = ancora.getBoundingClientRect().top;
  let topo = 0;
  let corte: HTMLElement | null = null;
  for (let p = ancora.parentElement; p; p = p.parentElement) {
    if (getComputedStyle(p).overflowY !== 'visible') {
      corte = p;
      topo = p.getBoundingClientRect().top;
      break;
    }
  }
  const cabecalho = corte?.querySelector('.wa-header');
  if (cabecalho) topo = Math.max(topo, cabecalho.getBoundingClientRect().bottom);
  return Math.max(MINIMO, base - topo - FOLGA);
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string | number | null;
  /** Depois de enviar: relê a faixa "automação rodando". */
  onStarted?: () => void;
}

export function DispararFunilPanel({ isOpen, onClose, conversationId, onStarted }: Props) {
  const janela = useRef<HTMLDivElement>(null);
  const [teto, setTeto] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) return undefined;
    const medir = () => {
      const ancora = janela.current?.parentElement;
      if (ancora) setTeto(espacoLivre(ancora));
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Card
      ref={janela}
      // O teto vale pra janela inteira (com o respiro do Card), não só pro miolo.
      className="absolute bottom-full left-0 right-0 mb-2 shadow-lg border-border z-50 max-h-[min(70vh,32rem)] animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
      style={teto != null ? { maxHeight: `min(70vh, 32rem, ${teto}px)` } : undefined}
      role="dialog"
      aria-label="Mensagens prontas"
      data-testid="painel-disparar-funil"
    >
      <CardContent className="p-0 flex flex-1 min-h-0 flex-col">
        <MensagensProntas
          ativo={isOpen}
          onde="janela"
          conversationId={conversationId}
          onStarted={onStarted}
          aoFechar={onClose}
        />
      </CardContent>
    </Card>
  );
}
