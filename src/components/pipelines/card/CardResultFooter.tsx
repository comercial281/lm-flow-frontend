// Rodapé Ganho | Perdido do card (janela e página). Card aberto: os dois
// botões. Card fechado: o selo e Reabrir. A situação é do CARD, não da coluna
// (spec funil §3): funil sem coluna de venda também marca Ganho, e o card
// perdido fica na etapa onde parou. Com a coluna Concluído, o servidor leva o
// card ganho para lá (ajuste de 08/10) e o card devolvido já vem nela. Perdido
// pergunta o motivo antes.
import { useEffect } from 'react';
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
  /** Outra gravação no ar (ex.: Etapa → Concluído na janela): trava os botões. */
  bloqueado?: boolean;
  /** Avisa quando este rodapé começa/termina de gravar, para a Etapa travar junto. */
  onSalvando?: (salvando: boolean) => void;
  /** "grande": página do card (11/10), na altura dos outros botões do topo. A janela fica no pequeno. */
  tamanho?: 'pequeno' | 'grande';
}

export default function CardResultFooter({ item, onMudou, bloqueado = false, onSalvando, tamanho = 'pequeno' }: CardResultFooterProps) {
  const s = useSituacaoDoCard(item, { onMudou });
  const atual = s.item ?? item;
  const ocupado = s.salvando !== null || bloqueado;
  const gravando = s.salvando !== null;
  useEffect(() => {
    onSalvando?.(gravando);
  }, [gravando]); // eslint-disable-line react-hooks/exhaustive-deps
  const nome = contatoDoCard(atual)?.name?.trim() || 'Este lead';
  const grande = tamanho === 'grande';
  const botao = grande ? 'h-10 gap-2 text-sm' : 'h-8 gap-1.5 text-xs';
  const icone = grande ? 'h-4 w-4' : 'h-3.5 w-3.5';

  return (
    <>
      {s.fechado ? (
        <div className="flex items-center justify-between gap-2">
          {/* Na página o selo já está ao lado do nome: o Reabrir ocupa a linha. */}
          {!grande && <SeloSituacao status={s.situacao} detalhe={detalheDaSituacao(atual)} className="text-xs" />}
          <Button type="button" size="sm" variant="outline" className={grande ? `${botao} w-full` : botao}
            onClick={() => { void s.reabrir(); }} disabled={ocupado}>
            {s.salvando === 'open'
              ? <Loader2 className={`${icone} animate-spin`} aria-hidden="true" />
              : <RotateCcw className={icone} aria-hidden="true" />}
            Reabrir
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            className={`${botao} bg-emerald-600 text-white hover:bg-emerald-700`}
            onClick={() => { void s.marcarGanho(); }}
            disabled={ocupado}
          >
            {s.salvando === 'won'
              ? <Loader2 className={`${icone} animate-spin`} aria-hidden="true" />
              : <Trophy className={icone} aria-hidden="true" />}
            Ganho
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={`${botao} border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30`}
            onClick={s.pedirPerdido}
            disabled={ocupado}
          >
            <XCircle className={icone} aria-hidden="true" />
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
