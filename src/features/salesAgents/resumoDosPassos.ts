/**
 * As frases que resumem a configuração da IA: a prévia ao lado dos passos 2, 4, 6 e
 * 7 e o resumo do passo 8 ("Testar e ligar"). Tudo puro, sem chamar o servidor.
 *
 * ⚠️ Hora formatada à mão (dois dígitos, 24h): o conferir-padrao reprova
 * `toLocaleString` fora do módulo de formato, e aqui não há data a formatar, só
 * horário de grade.
 */
import type { SalesAgent, SalesAgentTrigger, VisitConfig } from '@/services/salesAgents/salesAgentsService';
import type { ScheduleWindow } from '@/components/schedule/scheduleWindows';
import { plural } from '@/lib/formato';
import { briefingEnabled } from './handoffBriefing';
import { resumoDaJanela } from './followupHours';
import { lerEscolhas } from './tresEscolhas';
import { perguntasDoAgente } from './perguntas';
import { PERSONA_ROTULOS, TIPO_DE_VENDA_PADRAO, TIPO_DE_VENDA_ROTULOS } from './rotulosDaIa';

export interface ContextoDoResumo {
  numero: string | null;
  roleta?: string | null;
  corretor?: string | null;
}

export function fraseDoObjetivo(agent: SalesAgent, nomes: Omit<ContextoDoResumo, 'numero'> = {}): string {
  const { persona, alcance, destino } = lerEscolhas(agent);
  const faz = alcance === 'visit' ? 'qualifica, marca a visita' : 'qualifica';
  const resumo = briefingEnabled(agent.transfer_config) ? ' com o resumo' : '';
  if (persona === 'broker') {
    const dono = agent.number_owner_name ? ` (${agent.number_owner_name})` : '';
    return `Ela ${faz} e avisa o dono do número${dono}${resumo}.`;
  }
  const pra = destino === 'roleta'
    ? `pra roleta ${nomes.roleta ?? 'escolhida'}`
    : destino === 'user' ? `pra ${nomes.corretor ?? 'o corretor escolhido'}`
      : destino === 'webhook' ? (agent.handoff_webhook_system === 'cvcrm' ? 'pro CVCRM do cliente' : 'pro sistema do cliente')
        : 'pra roleta do número';
  return `Ela ${faz} e entrega ${pra}${resumo}.`;
}

export function resumoDoAtendimento(
  agent: Pick<SalesAgent, 'triggers' | 'trigger_keyword' | 'active_hours' | 'out_of_hours_reply'>,
  numero: string | null,
): string {
  if (!numero) return 'Ainda sem número: ela não atende ninguém.';
  const alguns = (agent.triggers ?? []).length > 0 || !!(agent.trigger_keyword ?? '').trim();
  const quem = alguns ? `só alguns leads do ${numero}` : `todos os leads do ${numero}`;
  const modo = agent.active_hours?.mode ?? 'always';
  const quando = modo === 'always'
    ? '24h'
    : modo === 'outside_business'
      ? 'só fora do horário comercial (18:00 às 07:00)'
      : resumoDaJanela((agent.active_hours?.windows ?? []) as ScheduleWindow[]);
  const aviso = modo !== 'always' && agent.out_of_hours_reply ? ', e avisa quem escrever fora do horário' : '';
  return `Atende ${quem}, ${quando}${aviso}.`;
}

export function resumoDeQuemAtende(triggers: SalesAgentTrigger[]): string[] {
  return (triggers ?? []).map((t) => {
    switch (t.type) {
      case 'keyword': return t.match_type === 'equals' ? `quem escrever exatamente "${t.value ?? ''}"` : `quem escrever "${t.value ?? ''}"`;
      case 'origin': return t.mode === 'all' ? 'todos os leads' : 'quem veio de anúncio (Facebook, Instagram ou Google)';
      case 'property': return t.mode === 'code' ? `quem veio do imóvel ${t.code ?? ''}` : 'quem veio de um anúncio ou formulário de imóvel';
      case 'pipeline_stage': return 'quem está numa coluna escolhida do funil';
      case 'pipeline': return t.pipeline_id ? 'quem está num funil escolhido' : 'quem está em qualquer funil';
      case 'tag': return `quem tem a etiqueta "${t.value ?? ''}"`;
      case 'form': return `quem veio de ${plural((t.form_ids ?? []).length, 'formulário', 'formulários')}`;
      default: return 'uma regra de entrada';
    }
  });
}

/**
 * A linha do tempo do passo 7 (e o resumo do passo 8). Desde 06/10/2026 a IA não
 * escreve mais o follow-up: depois de X dias sem resposta ela ENTREGA o lead (ao
 * follow-up escolhido ou movendo o card) e sai de cena. Vale o mínimo de dias, que
 * é o silêncio que o servidor espera antes de entregar.
 */
export function linhaDoTempo(agent: Pick<SalesAgent,
  'followup_enabled' | 'followup_only' | 'followup_min_days' | 'followup_action'
  | 'reengagement_enabled' | 'reengagement_first_hours' | 'reengagement_second_hours'>): string[] {
  if (!agent.followup_enabled) return [];
  const linhas: string[] = [];
  if (agent.reengagement_enabled && !agent.followup_only) {
    linhas.push(`${agent.reengagement_first_hours ?? 2}h sem resposta: 1ª retomada`);
    linhas.push(`${agent.reengagement_second_hours ?? 8}h depois: 2ª retomada`);
  }
  const dias = plural(agent.followup_min_days ?? 2, 'dia', 'dias');
  if (agent.followup_action === 'sequence') linhas.push(`Entrega o lead ao follow-up depois de ${dias} sem resposta`);
  else if (agent.followup_action === 'pipeline') linhas.push(`Move o card para a coluna escolhida depois de ${dias} sem resposta`);
  else linhas.push(`Depois de ${dias} sem resposta: falta escolher o que ela faz`);
  return linhas;
}

const DIA_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const dois = (n: number) => String(n).padStart(2, '0');
const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** O primeiro horário de cada dia que ela ofereceria, dentro da antecedência. */
export function proximosHorarios(visita: VisitConfig | undefined, agora: Date, duracaoMin: number, quantos = 3): string[] {
  const dias = visita?.days?.length ? visita.days : [1, 2, 3, 4, 5];
  const inicio = minutos(visita?.start ?? '09:00');
  const fim = minutos(visita?.end ?? '18:00');
  const passo = Math.max(15, duracaoMin || 60);
  const cedo = new Date(agora.getTime() + (visita?.min_advance_hours ?? 24) * 3_600_000);
  const limite = new Date(agora.getTime() + (visita?.max_advance_days ?? 30) * 86_400_000);
  const saida: string[] = [];
  const dia = new Date(cedo.getFullYear(), cedo.getMonth(), cedo.getDate());

  while (saida.length < quantos && dia <= limite) {
    if (dias.includes(dia.getDay())) {
      for (let m = inicio; m + passo <= fim; m += passo) {
        const h = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), Math.floor(m / 60), m % 60);
        if (h < cedo) continue;
        if (h <= limite) saida.push(`${DIA_CURTO[h.getDay()]} ${dois(h.getDate())}/${dois(h.getMonth() + 1)} às ${dois(h.getHours())}:${dois(h.getMinutes())}`);
        break;
      }
    }
    dia.setDate(dia.getDate() + 1);
  }
  return saida;
}

export function resumoDosPassos(agent: SalesAgent, ctx: ContextoDoResumo): { passo: number; linha: string }[] {
  const { persona, alcance } = lerEscolhas(agent);
  const perguntas = perguntasDoAgente(agent);
  const obrigatorias = perguntas.filter((p) => p.obrigatoria).length;
  const tipo = (agent.playbook?.vars as { tipo_venda?: string } | undefined)?.tipo_venda || TIPO_DE_VENDA_PADRAO;
  const visita = agent.visit_config ?? {};
  const linha7 = linhaDoTempo(agent).join(' → ');

  return [
    { passo: 1, linha: `${PERSONA_ROTULOS[persona]} · ${(agent.lead_facing_name ?? '').trim() || 'sem nome que o lead vê'}` },
    { passo: 2, linha: fraseDoObjetivo(agent, ctx) },
    {
      passo: 3,
      linha: `${plural(perguntas.length, 'pergunta', 'perguntas')}, ${plural(obrigatorias, 'obrigatória', 'obrigatórias')} · primeira mensagem ${agent.greeting ? 'com o seu texto de base' : 'escrita pela IA'}`,
    },
    {
      passo: 4,
      linha: alcance === 'visit'
        ? `Visitas de ${agent.visit_duration_minutes ?? 60} min, de ${visita.min_advance_hours ?? 24}h a ${visita.max_advance_days ?? 30} dias de antecedência`
        : 'Não marca visita: só qualifica e passa',
    },
    {
      passo: 5,
      linha: `${TIPO_DE_VENDA_ROTULOS[tipo] ?? tipo}${agent.locacao_enabled !== false ? ', também locação' : ''}${agent.default_property_code ? `, imóvel padrão ${agent.default_property_code}` : ''}`,
    },
    { passo: 6, linha: resumoDoAtendimento(agent, ctx.numero) },
    { passo: 7, linha: linha7 || 'Não volta a chamar quem sumiu' },
  ];
}
