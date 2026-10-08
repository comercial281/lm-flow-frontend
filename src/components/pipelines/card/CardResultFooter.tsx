// Rodapé Ganho | Perdido do card (janela e página). Card aberto: os dois
// botões. Card fechado: o selo e Reabrir. A situação é do CARD, não da coluna
// (spec funil §3): funil sem coluna de venda também marca Ganho, e o card
// perdido fica na etapa onde parou. Com a coluna Concluído, o servidor leva o
// card ganho para lá (ajuste de 08/10) e o card devolvido já vem nela. Perdido
// pergunta o motivo antes.
import { Loader2, RotateCcw, Trophy, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import SeloSituacao from '@/features/pipelines/situacao/SeloSituacao';
import MarcarPerdidoDialog from '@/features/pipelines/situacao/MarcarPerdidoDialog';
import { useSituacaoDoCard } from '@/features/pipelines/situacao/useSituacaoDoCard';
import { detalheDaSituacao } from '@/features/pipelines/situacao/situacao';
import { contatoDoCard } from '@/features/cardDoLead/cardDoLead';
import type { PipelineItem } from '@/types/analytics';

interface CardResultFooterProps {
  item: PipelineItem;
  /** Gravou: quem abriu o card (quadro, página) atualiza com o card novo. */
  onMudou?: (item: PipelineItem) => void;
}

export default function CardResultFooter({ item, onMudou }: CardResultFooterProps) {
  const s = useSituacaoDoCard(item, { onMudou });
  const atual = s.item ?? item;
  const ocupado = s.salvando !== null;
  const nome = contatoDoCard(atual)?.name?.trim() || 'Este lead';

  return (
    <>
      {s.fechado ? (
        <div className="flex items-center justify-between gap-2">
          <SeloSituacao status={s.situacao} detalhe={detalheDaSituacao(atual)} className="text-xs" />
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
            onClick={() => { void s.reabrir(); }} disabled={ocupado}>
            {s.salvando === 'open'
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              : <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
            Reabrir
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
            onClick={() => { void s.marcarGanho(); }}
            disabled={ocupado}
          >
            {s.salvando === 'won'
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              : <Trophy className="h-3.5 w-3.5" aria-hidden="true" />}
            Ganho
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 border-red-300 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={s.pedirPerdido}
            disabled={ocupado}
          >
            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
            Perdido
          </Button>
        </div>
      )}

      <MarcarPerdidoDialog
        aberto={s.perdidoAberto}
        nomeDoLead={nome}
        salvando={s.salvando === 'lost'}
        aoFechar={s.fecharPerdido}
        aoConfirmar={(motivo, comentario) => { void s.confirmarPerdido(motivo, comentario); }}
      />
    </>
  );
}
