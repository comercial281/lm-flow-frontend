// src/features/cardDoLead/pagina/FaixaDeEtapas.tsx
// Faixa de etapas da página do card (spec do funil §5.3): as etapas do funil
// pintadas até a atual, com os dias que o lead passou em cada uma (idas e
// voltas somam). Card aberto: clicar numa etapa pergunta antes de mover
// (decisão 16). Card Ganho/Perdido: só informa — pra mexer, reabre.
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { ETAPA_TRAVADA, ehColunaDeGanho } from '@/features/pipelines/situacao/situacao';
import type { PipelineStage, StageDuration } from '@/types/analytics';
import { textoDosDias } from './textoDosDias';

interface FaixaDeEtapasProps {
  /** Já em ordem de posição. */
  etapas: PipelineStage[];
  etapaAtualId: string;
  duracoes: StageDuration[];
  /** Ganho ou Perdido: a faixa só informa. */
  fechado: boolean;
  nomeDoLead: string;
  movendo: boolean;
  aoMover: (stageId: string) => void | Promise<void>;
  /** Clicou na coluna Concluído e confirmou: marca Ganho (o servidor leva o card para lá). */
  aoGanhar: () => void | Promise<void>;
}

export default function FaixaDeEtapas({
  etapas,
  etapaAtualId,
  duracoes,
  fechado,
  nomeDoLead,
  movendo,
  aoMover,
  aoGanhar,
}: FaixaDeEtapasProps) {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const porEtapa = new Map(duracoes.map(d => [String(d.stage_id), d]));
  const indiceAtual = etapas.findIndex(e => String(e.id) === String(etapaAtualId));

  const escolher = async (etapa: PipelineStage) => {
    // Concluído é a coluna do Ganho (ajuste de 08/10): clicar nela é marcar Ganho.
    if (ehColunaDeGanho(etapa)) {
      const ok = await confirmar({
        titulo: `Marcar ${nomeDoLead} como Ganho?`,
        descricao: `O card vai para ${etapa.name}, sai do follow-up e a IA para de responder. A conversa continua aberta.`,
        rotuloDaAcao: 'Marcar como Ganho',
      });
      if (ok) await aoGanhar();
      return;
    }
    const ok = await confirmar({
      titulo: `Mover ${nomeDoLead} para ${etapa.name}?`,
      descricao: 'Os dias em cada etapa passam a contar a partir desta mudança.',
      rotuloDaAcao: 'Mover',
    });
    if (ok) await aoMover(String(etapa.id));
  };

  return (
    <div className="space-y-2">
      <ol aria-label="Etapas do funil" className="flex gap-2 overflow-x-auto pb-1">
        {etapas.map((etapa, i) => {
          const atual = i === indiceAtual;
          const pintada = indiceAtual >= 0 && i <= indiceAtual;
          // Concluído não soma dias (o relógio para no Ganho, P4-T1): ali só "atual".
          const dias = ehColunaDeGanho(etapa) ? '' : textoDosDias(porEtapa.get(String(etapa.id)));
          const classe = cn(
            'w-full min-w-[120px] rounded-lg border px-3 py-2 text-left',
            atual
              ? 'border-primary bg-primary text-primary-foreground'
              : pintada
                ? 'border-primary/40 bg-primary/10'
                : 'border-border bg-background',
          );
          const conteudo = (
            <>
              <span className="block truncate text-sm font-medium" title={etapa.name}>{etapa.name}</span>
              <span className="block text-xs opacity-80">
                {atual ? (dias ? `${dias} · atual` : 'atual') : dias || ' '}
              </span>
            </>
          );
          return (
            <li key={etapa.id} className="flex min-w-0 flex-1" aria-current={atual ? 'step' : undefined}>
              {fechado || atual ? (
                <div className={classe}>{conteudo}</div>
              ) : (
                <button
                  type="button"
                  className={cn(classe, 'hover:border-primary disabled:opacity-60')}
                  disabled={movendo}
                  onClick={() => void escolher(etapa)}
                  aria-label={`Mover para ${etapa.name}`}
                >
                  {conteudo}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {/* A mesma frase da Etapa travada na janela (Parte 3). */}
      {fechado && <p className="text-xs text-muted-foreground">{ETAPA_TRAVADA}</p>}
      {movendo && (
        <p role="status" className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Mudando de etapa…
        </p>
      )}
      {dialogoDeConfirmacao}
    </div>
  );
}
