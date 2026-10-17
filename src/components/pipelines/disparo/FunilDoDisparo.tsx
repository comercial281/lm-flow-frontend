import { useCallback, useEffect, useRef, useState } from 'react';
import { Rocket } from 'lucide-react';
import EmptyState from '@/components/base/EmptyState';
import Carregando from '@/components/base/Carregando';
import { Seletor } from '@/components/base/Seletor';
import { CampoDaJanela } from '@/components/base/janela';
import { PreviewStepLine } from '@/components/flowAutomations/FunnelTemplatePicker';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import type { FlowAutomation } from '@/types/flowAutomations';
import type { FlowTemplatePreviewStep } from '@/features/flowAutomations/templates';
import { pickableFunnels, type PickableFunnels } from '@/features/flowAutomations/conversationFunnelDraft';
import { funnelPreview } from '@/features/flowAutomations/funnelPreview';
import { FLOW_KIND_COPY } from '@/features/flowAutomations/kind';

// FUNIL PRONTO no disparo em massa (16/10/2026): os funis de Funis de mensagem
// que dá pra usar fora da conversa (ligados, guia terminado: `pickableFunnels`),
// em "Meus funis" e "Da equipe". O lead ENTRA no funil na vez dele (o servidor
// chama o mesmo início do "Disparar funil"); aqui só se escolhe e se vê a prévia.

interface Props {
  /** O funil escolhido ('' = nenhum). */
  flowId: string;
  aoEscolher: (id: string, nome: string) => void;
}

export default function FunilDoDisparo({ flowId, aoEscolher }: Props) {
  const [funis, setFunis] = useState<PickableFunnels | null>(null);
  const [erroLista, setErroLista] = useState(false);
  const [passos, setPassos] = useState<FlowTemplatePreviewStep[] | null>(null);
  const [erroPrevia, setErroPrevia] = useState(false);
  // Resposta velha (Tentar de novo duas vezes, troca rápida de funil) não sobrescreve a nova.
  const ultimaLista = useRef(0);
  const ultimaPrevia = useRef(0);

  const carregarLista = useCallback(() => {
    const vez = ++ultimaLista.current;
    setErroLista(false);
    setFunis(null);
    flowAutomationsService
      .list({ kind: 'conversation' })
      .then(lista => { if (vez === ultimaLista.current) setFunis(pickableFunnels(lista)); })
      .catch(() => { if (vez === ultimaLista.current) setErroLista(true); });
  }, []);

  const carregarPrevia = useCallback((id: string) => {
    const vez = ++ultimaPrevia.current;
    setErroPrevia(false);
    setPassos(null);
    if (!id) return;
    flowAutomationsService
      .get(id)
      .then(fluxo => { if (vez === ultimaPrevia.current) setPassos(funnelPreview(fluxo)); })
      .catch(() => { if (vez === ultimaPrevia.current) setErroPrevia(true); });
  }, []);

  useEffect(() => { carregarLista(); }, [carregarLista]);
  useEffect(() => { carregarPrevia(flowId); }, [flowId, carregarPrevia]);

  if (erroLista) return <EmptyState tipo="erro" tamanho="compacto" aoTentarDeNovo={carregarLista} className="p-4" />;
  if (!funis) return <Carregando variante="texto" linhas={2} rotulo="Carregando os funis…" />;

  const { mine, team } = funis;
  if (mine.length + team.length === 0) {
    return (
      <EmptyState
        tamanho="compacto"
        icon={Rocket}
        title="Nenhum funil pronto ainda."
        description="Monte um funil em Funis de mensagem, ligue e termine o passo a passo pra usar aqui."
        action={{
          label: 'Montar funil',
          variant: 'outline',
          // Aba nova: a janela do disparo fica como está.
          onClick: () => { window.open(FLOW_KIND_COPY.conversation.listPath, '_blank', 'noopener'); },
        }}
        className="p-4"
      />
    );
  }

  const nomeDe = (id: string) => [...mine, ...team].find((f: FlowAutomation) => f.id === id)?.name ?? '';

  return (
    <>
      <CampoDaJanela
        rotulo="Funil"
        htmlFor="disparo-funil"
        ajuda="Cada lead entra no funil na vez dele, pelo número de saída. Daí em diante quem manda é o funil."
      >
        <Seletor id="disparo-funil" className="w-full" value={flowId} onChange={e => aoEscolher(e.target.value, nomeDe(e.target.value))}>
          <option value="">Escolher funil</option>
          {mine.length > 0 && (
            <optgroup label="Meus funis">
              {mine.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </optgroup>
          )}
          {team.length > 0 && (
            <optgroup label="Da equipe">
              {team.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </optgroup>
          )}
        </Seletor>
      </CampoDaJanela>

      {flowId && (
        erroPrevia ? (
          <EmptyState tipo="erro" tamanho="compacto" aoTentarDeNovo={() => carregarPrevia(flowId)} className="p-4" />
        ) : !passos ? (
          <Carregando variante="texto" linhas={2} rotulo="Carregando a sequência…" />
        ) : (
          <ul className="space-y-1.5 rounded-lg bg-muted/30 p-2" aria-label="Sequência do funil">
            {passos.map((p, i) => <PreviewStepLine key={i} step={p} />)}
          </ul>
        )
      )}
    </>
  );
}
