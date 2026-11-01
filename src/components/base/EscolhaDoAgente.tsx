import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import { ESCOLHA_DO_AGENTE } from '@/features/salesAgents/agentesDoNumero';

// A escolha do agente num número dividido (fase 2): usada no bloco "Passar para a IA"
// do construtor e na janela "Ativar IA pra este lead". Com um agente só não se usa:
// quem chama mostra o nome e pronto.

export interface AgenteEscolhivel {
  id: string;
  name: string;
}

export default function EscolhaDoAgente({
  agentes, valor, aoEscolher, desabilitado = false,
}: {
  agentes: AgenteEscolhivel[];
  valor: string | null;
  aoEscolher: (id: string) => void;
  desabilitado?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{ESCOLHA_DO_AGENTE}</p>
      <BotoesDeEscolha
        rotulo={ESCOLHA_DO_AGENTE}
        semNome
        valor={valor}
        opcoes={agentes.map(a => ({ valor: a.id, rotulo: a.name }))}
        aoEscolher={aoEscolher}
        desabilitado={desabilitado}
      />
    </div>
  );
}
