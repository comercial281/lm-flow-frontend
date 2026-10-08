// src/features/pipelines/situacao/useSituacaoDoCard.ts
// Ganho · Perdido · Reabrir de UM card, para a janela e (Parte 4) a página.
// A situação é do card, não da coluna: funil sem coluna de venda também marca
// Ganho (spec funil §3). Uma ação no ar ignora a próxima — clique duplo não
// grava duas linhas de histórico nem manda dois eventos à Meta.
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import type { PipelineItem, PipelineItemStatus, SetItemStatusData } from '@/types/analytics';
import { comSituacaoNova, mensagemDaRecusa, situacaoDe } from './situacao';

const AVISO_DE_SUCESSO: Record<PipelineItemStatus, string> = {
  won: 'Lead marcado como ganho.',
  lost: 'Lead marcado como perdido.',
  open: 'Lead reaberto.',
};

export interface SituacaoDoCard {
  /** O card com a situação mais recente (os campos da situação da resposta por cima do que veio). */
  item: PipelineItem | null;
  situacao: PipelineItemStatus;
  fechado: boolean;
  /** A situação sendo gravada agora; null = nada no ar. */
  salvando: PipelineItemStatus | null;
  perdidoAberto: boolean;
  marcarGanho: () => Promise<boolean>;
  pedirPerdido: () => void;
  fecharPerdido: () => void;
  confirmarPerdido: (motivoId: string, comentario: string) => Promise<boolean>;
  reabrir: () => Promise<boolean>;
}

interface Opcoes {
  /** O quadro (ou a página) atualiza o card dela com a situação nova. */
  onMudou?: (item: PipelineItem) => void;
}

export function useSituacaoDoCard(item: PipelineItem | null, { onMudou }: Opcoes = {}): SituacaoDoCard {
  const [atual, setAtual] = useState<PipelineItem | null>(item);
  const [salvando, setSalvando] = useState<PipelineItemStatus | null>(null);
  const [perdidoAberto, setPerdidoAberto] = useState(false);
  const emVoo = useRef(false);
  // Troca de card solta o trinco; a geração impede que a ação velha o mexa depois.
  const geracao = useRef(0);
  const idAtual = useRef<string | undefined>(item?.id);

  // Outro card na mesma janela, ou o quadro trouxe a situação nova: acompanha.
  useEffect(() => {
    setAtual(item);
  }, [item?.id, item?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPerdidoAberto(false);
    idAtual.current = item?.id;
    geracao.current += 1;
    emVoo.current = false;
    setSalvando(null);
  }, [item?.id]);

  const mudar = useCallback(
    async (dados: SetItemStatusData): Promise<boolean> => {
      if (!atual || emVoo.current) return false;
      if (situacaoDe(atual) === dados.status) return true;
      emVoo.current = true;
      const minha = geracao.current;
      const idSalvo = atual.id;
      setSalvando(dados.status);
      let novo: PipelineItem;
      try {
        const resposta = await pipelinesService.setItemStatus(atual.pipeline_id, atual.id, dados);
        novo = comSituacaoNova(atual, resposta);
      } catch (erro) {
        if (minha === geracao.current) {
          emVoo.current = false;
          setSalvando(null);
        }
        toast.error(mensagemDaRecusa(erro, 'Não consegui mudar a situação do lead.'));
        return false;
      }
      if (minha === geracao.current) {
        emVoo.current = false;
        setSalvando(null);
      }
      if (idAtual.current === idSalvo) setAtual(novo);
      try {
        onMudou?.(novo);
      } catch {
        // o quadro falhou ao se atualizar; a gravação deu certo
      }
      toast.success(AVISO_DE_SUCESSO[dados.status]);
      return true;
    },
    [atual, onMudou],
  );

  const marcarGanho = useCallback(() => mudar({ status: 'won' }), [mudar]);
  const reabrir = useCallback(() => mudar({ status: 'open' }), [mudar]);
  const pedirPerdido = useCallback(() => setPerdidoAberto(true), []);
  const fecharPerdido = useCallback(() => setPerdidoAberto(false), []);
  const confirmarPerdido = useCallback(
    async (motivoId: string, comentario: string) => {
      const nota = comentario.trim();
      const ok = await mudar({ status: 'lost', reason_option_id: motivoId, ...(nota ? { note: nota } : {}) });
      if (ok) setPerdidoAberto(false);
      return ok;
    },
    [mudar],
  );

  const situacao = situacaoDe(atual);
  return {
    item: atual,
    situacao,
    fechado: situacao !== 'open',
    salvando,
    perdidoAberto,
    marcarGanho,
    pedirPerdido,
    fecharPerdido,
    confirmarPerdido,
    reabrir,
  };
}
