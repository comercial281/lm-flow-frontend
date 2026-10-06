// Selo do veredito da IA (cor + frase). Na barra vai a frase inteira ("Parada:
// falta o número"); no seletor de IAs, só a palavra, com a frase no title.
// Onda 3: na barra, só a bolinha (soPonto); no seletor de IAs, a palavra (compacto).
import type { Situacao, TipoSituacao } from '@/features/salesAgents/situacao';

const COR: Record<TipoSituacao, { ponto: string; texto: string; fundo: string }> = {
  atendendo: { ponto: 'bg-emerald-500', texto: 'text-emerald-700 dark:text-emerald-400', fundo: 'bg-emerald-500/10 border-emerald-500/30' },
  restricao: { ponto: 'bg-amber-500', texto: 'text-amber-700 dark:text-amber-400', fundo: 'bg-amber-500/10 border-amber-500/30' },
  parada: { ponto: 'bg-red-500', texto: 'text-red-700 dark:text-red-400', fundo: 'bg-red-500/10 border-red-500/30' },
  desligada: { ponto: 'bg-gray-400', texto: 'text-muted-foreground', fundo: 'bg-muted border-sidebar-border' },
  rascunho: { ponto: 'bg-gray-300', texto: 'text-muted-foreground', fundo: 'bg-transparent border-dashed border-sidebar-border' },
};

const CURTA: Record<TipoSituacao, string> = {
  atendendo: 'Atendendo',
  restricao: 'Com restrição',
  parada: 'Parada',
  desligada: 'Desligada',
  rascunho: 'Rascunho',
};

export default function SeloSituacao({ situacao, compacto = false, soPonto = false }: { situacao: Situacao; compacto?: boolean; soPonto?: boolean }) {
  const cor = COR[situacao.tipo];
  // Barra de cima (onda 3, decisão 4): só a bolinha. A frase vai no `title` (passar
  // o mouse) e no texto escondido (leitor de tela) — some o texto do alerta da barra.
  if (soPonto) {
    return (
      <span role="status" title={situacao.frase} data-tipo={situacao.tipo} className="inline-flex items-center p-1">
        <span className={`h-2.5 w-2.5 rounded-full ring-[3px] ring-black/5 ${cor.ponto}`} aria-hidden />
        <span className="sr-only">{situacao.frase}</span>
      </span>
    );
  }
  return (
    <span
      role="status"
      title={situacao.frase}
      data-tipo={situacao.tipo}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cor.fundo} ${cor.texto}`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${cor.ponto}`} aria-hidden />
      <span className="truncate">{compacto ? CURTA[situacao.tipo] : situacao.frase}</span>
    </span>
  );
}
