/**
 * O horário PRÓPRIO do follow-up da IA: quando ela pode ir atrás de quem sumiu.
 *
 * É outra pergunta que o *Horário de atuação*, logo acima no mesmo painel. Aquele
 * decide quando a IA RESPONDE quem escreve — inclusive de madrugada, o que é bom.
 * Este decide quando ela TOMA A INICIATIVA, que de madrugada é o problema.
 *
 * Arquivo separado do componente de propósito, pelos dois motivos de sempre: um
 * arquivo que exporta componente E função quebra o Fast Refresh do Vite, e a
 * conta de padeiro precisa de teste sem montar a tela inteira.
 *
 * ⚠️ Antes desta leva a janela estava escrita TRÊS vezes na tela — o texto "das
 * 9h às 20h" da conta de padeiro, a descrição da chave de horário e um `11 * 60`
 * dentro do cálculo. Bastava mudar uma para o gestor ler um horário e receber a
 * conta de outro. Agora as três saem daqui.
 */
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import type { ScheduleWindow } from '@/components/schedule/scheduleWindows';

/**
 * Padrão de fábrica: 09h às 17h, de segunda a sábado. Domingo calado.
 *
 * ⚠️ Os dias vão EXPLÍCITOS. Ausente também valeria "todos os dias" (é o contrato
 * do servidor), mas na tela sairia com as sete pílulas apagadas e uma frase de
 * rodapé explicando — duas leituras da mesma coisa.
 *
 * ⚠️ Tem que bater com o padrão do servidor. Divergir faz a tela mostrar um
 * horário e o follow-up sair em outro, calado, em todo cliente que ainda não
 * salvou o campo.
 */
export const DEFAULT_FOLLOWUP_WINDOW: ScheduleWindow = {
  start: '09:00',
  end: '17:00',
  days: [1, 2, 3, 4, 5, 6],
};

/** O horário que VALE hoje. Vazio = padrão de fábrica, nunca 24 horas. */
export function janelaDoFollowup(agent: Pick<SalesAgent, 'followup_hours'>): ScheduleWindow[] {
  const janelas = agent.followup_hours?.windows;
  if (!Array.isArray(janelas) || janelas.length === 0) return [{ ...DEFAULT_FOLLOWUP_WINDOW }];
  return janelas as ScheduleWindow[];
}

function emMinutos(hhmm: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? ''));
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Quantos minutos uma janela dura. Fim menor que início = ela vira a meia-noite. */
function duracao(w: ScheduleWindow): number {
  const ini = emMinutos(w.start);
  const fim = emMinutos(w.end);
  if (ini === null || fim === null) return 0;
  // ⚠️ Início igual ao fim é NADA, não 24h — o intervalo é [início, fim), e o
  // servidor fecha o dia inteiro nesse caso. Quem quiser o dia todo escreve
  // 00:00 às 23:59, e a tela avisa isso.
  if (fim === ini) return 0;
  return fim > ini ? fim - ini : 1440 - ini + fim;
}

/**
 * Minutos do dia MAIS CHEIO da semana.
 *
 * Não é a média semanal de propósito: quem lê "cerca de N leads por dia" com uma
 * janela de segunda a sexta quer saber quanto sai num dia útil, não a média
 * diluída pelo fim de semana parado.
 */
export function minutosPorDia(windows: ScheduleWindow[]): number {
  const porDia = [0, 0, 0, 0, 0, 0, 0];
  windows.forEach((w) => {
    const mins = duracao(w);
    if (mins <= 0) return;
    const dias = Array.isArray(w.days) && w.days.length > 0 ? w.days : [0, 1, 2, 3, 4, 5, 6];
    dias.forEach((d) => {
      if (d >= 0 && d <= 6) porDia[d] += mins;
    });
  });
  return Math.max(...porDia);
}

const NOMES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** "seg a sáb" para uma sequência corrida, "seg, qua e sex" para dias soltos. */
function resumoDeDias(days: number[] | undefined): string {
  const dias = Array.isArray(days) ? [...new Set(days)].filter((d) => d >= 0 && d <= 6) : [];
  if (dias.length === 0 || dias.length === 7) return 'todos os dias';

  // Ordena começando na segunda, que é como se lê uma escala (domingo por último).
  const ordem = dias.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const corrida = ordem.every((d, i) => i === 0 || ((d + 6) % 7) === ((ordem[i - 1] + 6) % 7) + 1);
  if (corrida && ordem.length > 2) return `${NOMES[ordem[0]]} a ${NOMES[ordem[ordem.length - 1]]}`;
  if (ordem.length === 1) return NOMES[ordem[0]];
  return `${ordem.slice(0, -1).map((d) => NOMES[d]).join(', ')} e ${NOMES[ordem[ordem.length - 1]]}`;
}

/** "das 09h às 17h, seg a sáb" — o mesmo texto em toda menção à janela. */
export function resumoDaJanela(windows: ScheduleWindow[]): string {
  if (windows.length === 0) return 'sem horário configurado';
  const [primeira] = windows;
  const horas = `das ${String(primeira.start).replace(':00', 'h')} às ${String(primeira.end).replace(':00', 'h')}`;
  const extra = windows.length > 1 ? ` (+${windows.length - 1} janela${windows.length > 2 ? 's' : ''})` : '';
  return `${horas}, ${resumoDeDias(primeira.days)}${extra}`;
}

/**
 * Conta de padeiro do gotejamento: punhado médio × (minutos do dia ÷ pausa média).
 *
 * Sem ela o gestor escolhe "2 a 3 leads a cada 3 minutos" achando que é pouco,
 * quando são centenas por dia saindo de um número só.
 */
export function estimativaPorDia(agent: SalesAgent): number {
  const leads = ((Number(agent.followup_drip_min_leads) || 2) + (Number(agent.followup_drip_max_leads) || 3)) / 2;
  const pausa = ((Number(agent.followup_drip_min_minutes) || 3) + (Number(agent.followup_drip_max_minutes) || 5)) / 2;
  if (pausa <= 0) return 0;
  const minutos = minutosPorDia(janelaDoFollowup(agent));
  if (minutos <= 0) return 0;
  return Math.round((minutos / pausa) * leads);
}
