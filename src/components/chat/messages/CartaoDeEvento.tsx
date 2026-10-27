import React from 'react';
import {
  Calendar,
  CalendarCheck,
  CalendarX,
  ClipboardCheck,
  ClipboardList,
  Clock,
  MapPin,
  RotateCw,
  Sparkles,
  Star,
  Trophy,
  UserX,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CartaoDoEvento, FamiliaDoEvento } from '@/features/conversas/eventoDaConversa';
import { TEXTOS_DOS_EVENTOS } from '@/features/conversas/textosDosEventos';

// Cartão de marco do atendimento no meio da conversa (visita, tarefa, negócio).
// Desenho do Catálogo aprovado em 26/10/2026. Sem clique nesta entrega: não é
// link nem botão. Cores do design no claro; no escuro, a mesma família mais apagada.
// Não é o Card da casa de propósito: o anel violeta e a sombra da marca brigam com
// o cartão tingido de ganho/perdido. Ganho e perdido trocam o bg-card pelo tom deles.

const ICONES: Record<CartaoDoEvento['icone'], LucideIcon> = {
  calendario: Calendar,
  'calendario-ok': CalendarCheck,
  'calendario-x': CalendarX,
  remarcar: RotateCw,
  'pessoa-x': UserX,
  tarefa: ClipboardList,
  'tarefa-ok': ClipboardCheck,
  trofeu: Trophy,
  x: XCircle,
};

interface Visual {
  cartao: string;
  icone: string;
  titulo: string;
  principal: string;
}

const VISITA_ICONE = 'bg-[#E7EFFD] text-[#1F5FD0] dark:bg-[#1F5FD0]/20 dark:text-[#8FB4F5]';
const TAREFA_ICONE = 'bg-[#FCEFD9] text-[#9A5200] dark:bg-[#9A5200]/25 dark:text-[#F2B866]';
const CARTAO_PADRAO = 'border-border/70';

const VISUAL: Record<FamiliaDoEvento, Visual> = {
  visita: { cartao: CARTAO_PADRAO, icone: VISITA_ICONE, titulo: 'text-foreground', principal: 'text-foreground/90' },
  tarefa: { cartao: CARTAO_PADRAO, icone: TAREFA_ICONE, titulo: 'text-foreground', principal: 'text-foreground/90' },
  // visita que não aconteceu: tudo em cinza
  'visita-encerrada': {
    cartao: CARTAO_PADRAO,
    icone: 'bg-muted text-muted-foreground',
    titulo: 'text-foreground/80',
    principal: 'text-muted-foreground',
  },
  ganho: {
    cartao: 'bg-[#EAF7EE] border-[#BFE3C9] dark:bg-[#1E8E4E]/15 dark:border-[#1E8E4E]/40',
    icone: 'bg-[#1E8E4E] text-white',
    titulo: 'text-[#14653A] dark:text-[#7DD3A0]',
    principal: 'text-foreground/90',
  },
  perdido: {
    cartao: 'bg-[#FCEFEE] border-[#F0C9C5] dark:bg-[#C23B32]/15 dark:border-[#C23B32]/40',
    icone: 'bg-[#C23B32] text-white',
    titulo: 'text-[#9E2A22] dark:text-[#F3A29B]',
    principal: 'text-foreground/90',
  },
};

export const Estrelas: React.FC<{ nota: number; className?: string }> = ({ nota, className }) => {
  const cheias = Math.max(0, Math.min(5, Math.round(nota)));
  return (
    <span
      role="img"
      aria-label={TEXTOS_DOS_EVENTOS.estrelas(cheias)}
      className={cn('inline-flex gap-0.5 text-[#E5A100]', className)}
    >
      {[0, 1, 2, 3, 4].map(i => (
        <Star key={i} aria-hidden="true" className={cn('h-3.5 w-3.5', i < cheias && 'fill-current')} />
      ))}
    </span>
  );
};

interface CartaoDeEventoProps {
  cartao: CartaoDoEvento;
  hora: string;
}

const CartaoDeEvento: React.FC<CartaoDeEventoProps> = ({ cartao, hora }) => {
  const v = VISUAL[cartao.familia];
  const Icone = ICONES[cartao.icone];
  const IconeDetalhe = cartao.detalheIcone === 'local' ? MapPin : cartao.detalheIcone === 'relogio' ? Clock : null;

  return (
    <div className="flex justify-center py-3">
      <div
        data-cartao={cartao.familia}
        className={cn(
          // desenho próprio, não o Card da casa (exceção em conferir-padrao.excecoes.json)
          'flex w-full max-w-[380px] items-start gap-3 rounded-lg border bg-card px-3.5 py-3 text-left shadow-sm',
          v.cartao,
        )}
      >
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-sm', v.icone)}>
          <Icone aria-hidden="true" className="h-[19px] w-[19px]" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <div className="flex items-baseline justify-between gap-2">
            <span className={cn('text-sm font-semibold', v.titulo)}>{cartao.titulo}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">{hora}</span>
          </div>
          {cartao.principal && (
            <span
              className={cn(
                'break-words text-[13px] font-medium',
                cartao.riscado ? 'text-muted-foreground line-through' : v.principal,
              )}
            >
              {cartao.principal}
            </span>
          )}
          {cartao.detalhe && (
            <span className="flex items-center gap-[5px] text-xs text-muted-foreground">
              {IconeDetalhe && <IconeDetalhe aria-hidden="true" className="h-[13px] w-[13px] shrink-0" />}
              <span className="min-w-0 break-words">{cartao.detalhe}</span>
            </span>
          )}
          {cartao.estrelas !== undefined && <Estrelas nota={cartao.estrelas} />}
          {cartao.comentario && (
            <span className="break-words text-[13px] italic leading-snug text-foreground/90">
              {`"${cartao.comentario}"`}
            </span>
          )}
          {cartao.rodape && (
            <span
              data-rodape-ia={cartao.rodapeIa ? '' : undefined}
              className="mt-[3px] flex items-center gap-[5px] text-xs text-muted-foreground"
            >
              {cartao.rodapeIa && <Sparkles aria-hidden="true" className="h-[13px] w-[13px] shrink-0 text-primary" />}
              <span>{cartao.rodape}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default CartaoDeEvento;
