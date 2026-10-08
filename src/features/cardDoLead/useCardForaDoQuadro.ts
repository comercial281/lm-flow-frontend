// Quadro: o card do endereço (?card=) que não está nos cards carregados —
// arquivado, de outra aba, ou o F5 numa aba que não é a dele — é buscado pelo
// id e abre na janela (spec do funil §7, que o E0 deixou como "Este lead não
// está nesta aba" até o GET de um card existir).
import { useEffect, useState } from 'react';
import type { PipelineItem } from '@/types/analytics';
import { SEM_ACESSO_AO_CARD, buscarCardPeloId } from './buscarCard';

export type CardForaDoQuadro =
  | { estado: 'nada' }
  | { estado: 'buscando' }
  | { estado: 'achou'; item: PipelineItem }
  | { estado: 'sem-acesso' }
  | { estado: 'erro'; tentarDeNovo: () => void };

/** `itemId` null = nada a buscar (sem `?card=`, quadro carregando, ou o card já está no quadro). */
export function useCardForaDoQuadro(pipelineId: string | undefined, itemId: string | null): CardForaDoQuadro {
  const [estado, setEstado] = useState<CardForaDoQuadro>({ estado: 'nada' });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!pipelineId || !itemId) {
      setEstado({ estado: 'nada' });
      return;
    }
    let vivo = true;
    setEstado({ estado: 'buscando' });
    void buscarCardPeloId(pipelineId, itemId).then(r => {
      if (!vivo) return;
      if (r.tipo === 'achou') {
        setEstado({ estado: 'achou', item: { ...r.card.item, pipeline_id: r.card.item.pipeline_id || pipelineId } });
      } else if (r.tipo === 'sem-acesso') {
        setEstado({ estado: 'sem-acesso' });
      } else {
        setEstado({ estado: 'erro', tentarDeNovo: () => setTentativa(n => n + 1) });
      }
    });
    return () => {
      vivo = false;
    };
  }, [pipelineId, itemId, tentativa]);

  return estado;
}

/** A frase que o quadro mostra quando o card do endereço não abre. */
export function avisoDoCardForaDoQuadro(c: CardForaDoQuadro): string | null {
  if (c.estado === 'sem-acesso') return SEM_ACESSO_AO_CARD;
  if (c.estado === 'erro') return 'Não consegui abrir este lead.';
  return null;
}
