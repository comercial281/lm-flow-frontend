import { useEffect, useState } from 'react';
import EscolhaDoAgente from '@/components/base/EscolhaDoAgente';
import { agentesParaOBloco, temNumeroDividido } from '@/features/salesAgents/agentesDoNumero';
import { salesAgentsService, type SalesAgent } from '@/services/salesAgents/salesAgentsService';
import type { FlowNodeConfig } from '@/types/flowAutomations';

// "Passar para a IA": qual agente assume. Grava `config.sales_agent_id` SÓ quando a pessoa
// escolhe (gravar sozinho prendia o bloco num agente que pode deixar de servir o número).
// - fluxo que fala por um número: os agentes DESSE número (o servidor ordena);
//   senão, os do cliente inteiro;
// - um agente só: mostra o nome e não grava nada (o servidor usa o agente do número);
// - a escolha é OBRIGATÓRIA só quando o fluxo fala por um número específico E esse número
//   é dividido (Salvar não deixa passar sem ela). Nos outros casos é opcional: a primeira
//   opção, "A IA do número da conversa", não grava agente (é o padrão) e dá pra voltar a ela;
// - modo guiado do corretor: some (o servidor não deixa mudar).

export function EscolhaDoAgenteDoBloco({
  config, onChange, inboxId = null, guided = false, aoPrecisarEscolher,
}: {
  config: FlowNodeConfig;
  onChange: React.Dispatch<React.SetStateAction<FlowNodeConfig>>;
  /** O número pelo qual o fluxo fala (modo "número específico"); null = o da conversa do lead. */
  inboxId?: string | null;
  guided?: boolean;
  /** Avisa o painel se falta escolher (pra o Salvar barrar). */
  aoPrecisarEscolher?: (falta: boolean) => void;
}) {
  const [carregado, setCarregado] = useState<{ candidatos: SalesAgent[]; dividido: boolean } | null>(null);

  useEffect(() => {
    if (guided) return;
    let vivo = true;
    const leitura = inboxId
      ? salesAgentsService.listForInbox(inboxId).then(lista => ({ candidatos: lista, dividido: lista.length > 1 }))
      : salesAgentsService.list().then(lista => ({ candidatos: agentesParaOBloco(lista), dividido: temNumeroDividido(lista) }));
    leitura
      .then(r => { if (vivo) setCarregado(r); })
      .catch(() => { if (vivo) setCarregado({ candidatos: [], dividido: false }); });
    return () => { vivo = false; };
  }, [inboxId, guided]);

  const escolhido = typeof config.sales_agent_id === 'string' && config.sales_agent_id ? config.sales_agent_id : null;
  const dividido = !!carregado?.dividido && carregado.candidatos.length > 0;
  // Obrigatória só com número específico dividido; "dividido" da conta inteira só oferece.
  const obrigatoria = dividido && !!inboxId;
  const falta = obrigatoria && (!escolhido || !carregado!.candidatos.some(a => a.id === escolhido));

  useEffect(() => { aoPrecisarEscolher?.(falta); }, [falta, aoPrecisarEscolher]);

  if (guided || !carregado || carregado.candidatos.length === 0) return null;
  if (dividido) {
    return (
      <EscolhaDoAgente
        agentes={carregado.candidatos}
        valor={escolhido}
        opcaoPadrao={obrigatoria ? undefined : 'A IA do número da conversa'}
        aoEscolher={id => onChange(c => {
          if (id) return { ...c, sales_agent_id: id };
          const { sales_agent_id: _tira, ...resto } = c;
          return resto;
        })}
      />
    );
  }
  if (carregado.candidatos.length === 1) {
    return <p className="text-sm">IA que assume: <span className="font-medium">{carregado.candidatos[0].name}</span></p>;
  }
  return null;
}
