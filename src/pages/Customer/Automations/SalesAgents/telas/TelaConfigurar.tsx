// Configurar: as páginas pela ordem da conversa (onda 3, 06/10/2026). Cada página
// grava na hora (configurar/useGravarNaHora.ts), devolvendo a IA por `aoSalvo`.
import type { HealthReport, SalesAgent } from '@/services/salesAgents/salesAgentsService';
import type { InboxOption } from '../configuracao/comum';
import ConfigurarPaginas from '../configurar/ConfigurarPaginas';

export interface TelaConfigurarProps {
  agent: SalesAgent;
  inboxes: InboxOption[];
  aoSalvo: (a: SalesAgent) => void;
  diagnostico: HealthReport | null;
}

export default function TelaConfigurar(props: TelaConfigurarProps) {
  return <ConfigurarPaginas {...props} />;
}
