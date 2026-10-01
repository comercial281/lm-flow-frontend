/**
 * Agenda do corretor (chave `agenda_do_corretor`): as contas puras da tela —
 * horário de visita da imobiliária e folgas do corretor.
 *
 * Quem decide de verdade é o servidor (`Visits::Agenda`). Aqui é a mesma regra,
 * para a tela já mostrar o dia fechado e os textos, com as MESMAS frases do
 * servidor ("Domingo não tem visita", "Essa data está fechada para visitas").
 * Folga parcial (faixa de horas) não fecha o dia: só os horários que encostam
 * nela, e isso é conta do servidor (`/visits/availability`).
 *
 * Sem Intl novo (catraca do build): data curta vem de `@/lib/formato`, e o nome
 * do dia vem de `daySlots`.
 * Spec: specs/2026-10-01-fase-4-agenda-do-corretor-design.md (pasta LM FLOW).
 */
import { dataCurta, toDate } from '@/lib/formato';
import { DIAS, diaISO } from '@/features/visits/daySlots';

/** De qual IA o horário nasceu, quando a chave foi ligada. */
export interface SeededFrom {
  agent_id?: string;
  agent_name?: string;
  differing_agent_names?: string[];
}

/** Horário de visita da imobiliária. `days`: 0 = domingo … 6 = sábado. */
export interface AgendaSettings {
  days: number[];
  start: string;
  end: string;
  closed_dates: string[];
  seeded_from?: SeededFrom;
}

/** Folga do corretor. Os dois horários nulos = dia inteiro. */
export interface TimeOff {
  id: string;
  user_id: string;
  user_name?: string | null;
  starts_on: string;
  ends_on: string;
  start_time: string | null;
  end_time: string | null;
  note?: string | null;
}

/** "14:00" ou "14:00:00" → "14:00". */
const hhmm = (valor: string) => valor.slice(0, 5);

/** "08:00" → "8h" · "09:30" → "9h30". */
export function horaCurta(valor: string): string {
  const [h, m] = hhmm(valor).split(':').map(Number);
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

/** ('08:00', '20:00') → "8h às 20h". */
export function faixaTexto(inicio: string, fim: string): string {
  return `${horaCurta(inicio)} às ${horaCurta(fim)}`;
}

/**
 * As horas que se pode escolher, de 30 em 30, em 24 h. Lista e não o campo de
 * hora do navegador: num celular em inglês ele vira AM/PM.
 */
export function horariosDe30em30(): string[] {
  const p = (n: number) => String(n).padStart(2, '0');
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += 30) out.push(`${p(Math.floor(m / 60))}:${p(m % 60)}`);
  return out;
}

/**
 * A lista de horas para um campo cujo valor atual pode estar fora da grade
 * (ex.: "08:15", copiado do campo livre da IA). Sem isso o select mostraria a
 * primeira opção ("00:00") com outro valor guardado por trás; com isso mostra a
 * verdade, e se salvar assim quem explica é o servidor.
 */
export function opcoesDeHora(valorAtual: string): string[] {
  const grade = horariosDe30em30();
  const v = valorAtual ? hhmm(valorAtual) : '';
  if (!v || grade.includes(v)) return grade;
  return [...grade, v].sort();
}

export const ehDiaInteiro = (f: Pick<TimeOff, 'start_time' | 'end_time'>) => !f.start_time || !f.end_time;

/**
 * Por que o dia está fechado para visita, ou `null` se está aberto. Ordem igual
 * à do servidor: dia da semana, data fechada, folga de dia inteiro.
 * `folgasDoCorretor` são as folgas do corretor escolhido (pode vir vazio).
 */
export function motivoDiaFechado(
  dia: Date | string,
  settings: Pick<AgendaSettings, 'days' | 'closed_dates'>,
  folgasDoCorretor: TimeOff[],
): string | null {
  const d = typeof dia === 'string' ? toDate(dia) : dia;
  if (!d) return null;
  const iso = diaISO(d);
  if (!settings.days.includes(d.getDay())) return `${DIAS[d.getDay()]} não tem visita`;
  if (settings.closed_dates.includes(iso)) return 'Essa data está fechada para visitas';
  const folga = folgasDoCorretor.find(f => ehDiaInteiro(f) && f.starts_on <= iso && iso <= f.ends_on);
  if (folga) return `${folga.user_name || 'O corretor'} está de folga nesse dia`;
  return null;
}

/**
 * "Quarta, 07/10, das 14h às 18h" · "07/10 a 09/10, dia inteiro".
 * Período com faixa ("07/10 a 09/10, das 14h às 18h") = a faixa em CADA dia do
 * período, não um bloco contínuo (regra do servidor).
 */
export function rotuloFolga(folga: TimeOff): string {
  const parte = ehDiaInteiro(folga) ? 'dia inteiro' : `das ${faixaTexto(folga.start_time!, folga.end_time!)}`;
  if (folga.starts_on === folga.ends_on) {
    const d = toDate(folga.starts_on);
    const nome = d ? `${DIAS[d.getDay()]}, ` : '';
    return `${nome}${dataCurta(folga.starts_on)}, ${parte}`;
  }
  return `${dataCurta(folga.starts_on)} a ${dataCurta(folga.ends_on)}, ${parte}`;
}

/** As próximas primeiro; no mesmo dia, dia inteiro antes e depois pela hora. */
export function ordenarFolgas(lista: TimeOff[]): TimeOff[] {
  return lista.slice().sort((a, b) =>
    a.starts_on.localeCompare(b.starts_on) || (a.start_time ?? '').localeCompare(b.start_time ?? ''),
  );
}

const juntarNomes = (nomes: string[]) =>
  nomes.length <= 1 ? nomes.join('') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;

/**
 * Aviso de quando o horário nasceu de uma IA e havia outras com horário
 * diferente: "As IAs Sofia e Lia tinham horários diferentes; usamos o de Sofia".
 */
export function avisoSemente(seeded?: SeededFrom | null): string | null {
  const outras = seeded?.differing_agent_names ?? [];
  if (!seeded?.agent_name || outras.length === 0) return null;
  return `As IAs ${juntarNomes([seeded.agent_name, ...outras])} tinham horários diferentes; usamos o de ${seeded.agent_name}`;
}
