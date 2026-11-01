// O que o quadro de um agente mostra na página de agentes (fase 6, tarefa 68).
// Só texto: o servidor conta (marcas, 30 dias), a tela mostra.
import type { Marca, NextStep, QuemFala, ResumoDoAgente, SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { pendenciasDaIa } from './situacao';

export interface QuadroDoAgente {
  iniciais: string;
  numeros: string;
  modo: string;
  quemFala: string;
  proximoPasso: string;
  produto: string;
  /** Nulo sem o resumo de 30 dias (ainda não chegou ou falhou). */
  rodape: string | null;
  /** A primeira pendência, quando há. */
  pendencia: string | null;
}

const MODOS: Record<string, string> = { filtra_passa: 'Filtra e passa', leva_visita: 'Leva até a visita' };
const PASSOS: Record<NextStep, string> = {
  visita: 'Visita', videochamada: 'Reunião por vídeo', reuniao: 'Reunião no escritório', ligacao: 'Ligação',
};
const MARCAS: Record<Marca, string> = { venda: 'Venda', locacao: 'Locação', leilao: 'Leilão', empreendimento: 'Empreendimento' };
const VOZES: Record<QuemFala, string> = { consultora: 'Consultora', corretor: 'Corretor', dono_gerente: 'Dono ou gerente' };
const ORDEM_DAS_MARCAS: Marca[] = ['venda', 'locacao', 'leilao', 'empreendimento'];

export function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const letras = partes.length > 1 ? partes[0][0] + partes[1][0] : (partes[0] ?? '').slice(0, 2);
  return letras.toUpperCase() || 'IA';
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function quadroDoAgente(
  agent: SalesAgent,
  resumo: ResumoDoAgente | null,
  contagem: Record<Marca, number> = agent.catalog_marks,
): QuadroDoAgente {
  const numeros = agent.numbers ?? [];
  const nomes = numeros.map((n) => n.owner_name || n.inbox_name).filter(Boolean).join(', ');
  const casa: QuemFala = agent.house_voice?.kind ?? 'consultora';
  const todosCorretor = numeros.length > 0 && numeros.every((n) => (n.voice?.kind ?? casa) === 'corretor');

  const marcas = ORDEM_DAS_MARCAS.filter((m) => agent.serves?.includes(m));
  const passos = (agent.next_steps ?? []).map((p) => PASSOS[p]).filter(Boolean);

  let rodape: string | null = null;
  if (resumo) {
    const partes = [`${plural(resumo.conversations, 'conversa', 'conversas')} em 30 dias`, plural(resumo.handoffs, 'passada', 'passadas')];
    if (resumo.median_reply_minutes != null) partes.push(`corretor responde em ${resumo.median_reply_minutes} min`);
    rodape = partes.join(' · ');
  }

  return {
    iniciais: iniciaisDe(agent.name),
    numeros: numeros.length ? `${plural(numeros.length, 'número', 'números')} · ${nomes}` : 'sem número',
    modo: (agent.job && MODOS[agent.job]) || 'Ainda não escolhido',
    quemFala: todosCorretor ? 'Cada usuário, como ele mesmo' : VOZES[casa],
    proximoPasso: passos.length ? passos.join(' ou ') : 'Nenhum',
    produto: marcas.length ? marcas.map((m) => `${MARCAS[m]} (${contagem?.[m] ?? 0})`).join(', ') : 'Ainda não escolhido',
    rodape,
    pendencia: pendenciasDaIa(agent)[0]?.titulo ?? null,
  };
}
