import { useEffect, useState } from 'react';
import EscolhaDoAgente from '@/components/base/EscolhaDoAgente';
import { agentesParaOBloco, temNumeroDividido } from '@/features/salesAgents/agentesDoNumero';
import { salesAgentsService, type SalesAgent } from '@/services/salesAgents/salesAgentsService';
import type { FlowNodeConfig } from '@/types/flowAutomations';

// "Passar para a IA": qual agente assume. Grava `config.sales_agent_id`.
// - um agente só no cliente: o id dele vai pro bloco e a escolha some;
// - algum número dividido entre agentes: pede a escolha (sem ela o servidor usa o
//   primeiro agente do número, como nos blocos de antes);
// - nenhum número dividido: nada a escolher, o bloco segue pelo número da conversa.

export function EscolhaDoAgenteDoBloco({
  config, onChange,
}: { config: FlowNodeConfig; onChange: React.Dispatch<React.SetStateAction<FlowNodeConfig>> }) {
  const [agents, setAgents] = useState<SalesAgent[] | null>(null);

  useEffect(() => {
    let vivo = true;
    salesAgentsService.list().then(list => { if (vivo) setAgents(list); }).catch(() => { if (vivo) setAgents([]); });
    return () => { vivo = false; };
  }, []);

  const candidatos = agents ? agentesParaOBloco(agents) : [];
  const unico = candidatos.length === 1 ? candidatos[0] : null;
  const escolhido = typeof config.sales_agent_id === 'string' && config.sales_agent_id ? config.sales_agent_id : null;

  // Agente único: o id dele vai pro rascunho (o servidor não precisa adivinhar).
  useEffect(() => {
    if (unico && escolhido !== unico.id) onChange(c => ({ ...c, sales_agent_id: unico.id }));
  }, [unico, escolhido, onChange]);

  if (!agents) return null;
  if (unico) return <p className="text-sm">IA que assume: <span className="font-medium">{unico.name}</span></p>;
  if (!temNumeroDividido(agents)) return null;
  return (
    <EscolhaDoAgente
      agentes={candidatos}
      valor={escolhido}
      aoEscolher={id => onChange(c => ({ ...c, sales_agent_id: id }))}
    />
  );
}
