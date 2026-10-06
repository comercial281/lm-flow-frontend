// Configurar: o passo a passo (entrega 2), o mesmo pra criar e pra editar. O nome
// da IA e o Ligar, que ficavam no cabeçalho da página antiga, moram nos passos 1 e
// 8. Cada passo salva só o que é dele (configurar/useRascunho.ts).
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import type { InboxOption } from '../configuracao/comum';
import PassoAPasso from '../configurar/PassoAPasso';

export interface TelaConfigurarProps {
  agent: SalesAgent;
  inboxes: InboxOption[];
  aoSalvo: (a: SalesAgent) => void;
}

export default function TelaConfigurar({ agent, inboxes, aoSalvo }: TelaConfigurarProps) {
  return <PassoAPasso agent={agent} inboxes={inboxes} aoSalvo={aoSalvo} />;
}
