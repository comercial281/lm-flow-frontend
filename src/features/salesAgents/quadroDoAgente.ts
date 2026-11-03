// O que o quadro de um agente mostra na página de agentes (fase 6, tarefa 68).
// Só texto: o servidor conta (marcas, 30 dias), a tela mostra.
import type { Marca, NextStep, QuemFala, ResumoDoAgente, SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { pendenciasDaIa } from './situacao';
import { nomeDoNumero } from './fichas';

export interface QuadroDoAgente {
  numeros: string;
  modo: string;
  quemFala: string;
  proximoPasso: string;
  produto: string;
  /**
   * Os números de 30 dias, um por coluna do quadro (03/11/2026: colunas no lugar da
   * frase corrida). Nulo sem o resumo (ainda não chegou ou falhou).
   */
  trintaDias: NumeroDoQuadro[] | null;
  /** A primeira pendência, quando há. */
  pendencia: string | null;
}

export interface NumeroDoQuadro { valor: string; rotulo: string }

const MODOS: Record<string, string> = { filtra_passa: 'Filtra e passa', leva_visita: 'Leva até a visita' };
const PASSOS: Record<NextStep, string> = {
  visita: 'Visita', videochamada: 'Reunião por vídeo', reuniao: 'Reunião no escritório', ligacao: 'Ligação',
};
const MARCAS: Record<Marca, string> = { venda: 'Venda', locacao: 'Locação', leilao: 'Leilão', empreendimento: 'Empreendimento' };
const VOZES: Record<QuemFala, string> = { consultora: 'Consultora', corretor: 'Corretor', dono_gerente: 'Dono ou gerente' };
const ORDEM_DAS_MARCAS: Marca[] = ['venda', 'locacao', 'leilao', 'empreendimento'];

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function quadroDoAgente(
  agent: SalesAgent,
  resumo: ResumoDoAgente | null,
  contagem: Record<Marca, number> = agent.catalog_marks,
): QuadroDoAgente {
  const numeros = agent.numbers ?? [];
  const nomes = numeros.map(nomeDoNumero).join(', ');
  const casa: QuemFala = agent.house_voice?.kind ?? 'consultora';
  const todosCorretor = numeros.length > 0 && numeros.every((n) => (n.voice?.kind ?? casa) === 'corretor');

  const marcas = ORDEM_DAS_MARCAS.filter((m) => agent.serves?.includes(m));
  const passos = (agent.next_steps ?? []).map((p) => PASSOS[p]).filter(Boolean);

  let trintaDias: NumeroDoQuadro[] | null = null;
  if (resumo) {
    trintaDias = [
      { valor: String(resumo.conversations), rotulo: resumo.conversations === 1 ? 'conversa' : 'conversas' },
      { valor: String(resumo.handoffs), rotulo: resumo.handoffs === 1 ? 'passada' : 'passadas' },
    ];
    if (resumo.median_reply_minutes != null) trintaDias.push({ valor: `${resumo.median_reply_minutes} min`, rotulo: 'corretor responde' });
  }

  return {
    numeros: numeros.length ? `${plural(numeros.length, 'número', 'números')} · ${nomes}` : 'sem número',
    modo: (agent.job && MODOS[agent.job]) || 'Ainda não escolhido',
    quemFala: todosCorretor ? 'Cada usuário, como ele mesmo' : VOZES[casa],
    proximoPasso: passos.length ? passos.join(' ou ') : 'Nenhum',
    produto: marcas.length ? marcas.map((m) => `${MARCAS[m]} (${contagem?.[m] ?? 0})`).join(', ') : 'Ainda não escolhido',
    trintaDias,
    // Agente sem número nenhum (ligado ou não) tem a pendência própria do quadro;
    // as outras usam o título que a `situacao.ts` devolve (não há texto mais curto).
    pendencia: numeros.length === 0 && !agent.inbox_id
      ? 'ligar um número'
      : pendenciasDaIa(agent)[0]?.titulo ?? null,
  };
}
