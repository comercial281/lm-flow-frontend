// src/features/visits/gradeDoCalendario.ts
//
// Contas puras das visões Mês / Semana / Dia da Agenda de Visitas (referência:
// o calendário da Lais). Fora do JSX, com spec: a tela de Visitas já passa de
// 800 linhas.

export type VisaoCalendario = 'mes' | 'semana' | 'dia';

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const DIAS_LONGOS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/** Duração usada quando a visita não diz a dela (o padrão do Agendar visita). */
export const DURACAO_PADRAO = 60;

const semHora = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Domingo da semana do dia (a grade começa no domingo, como o mês). */
export function inicioDaSemana(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
}

/** Os 7 dias da semana do dia, de domingo a sábado. */
export function diasDaSemana(d: Date): Date[] {
  const ini = inicioDaSemana(d);
  return Array.from({ length: 7 }, (_, i) => new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + i));
}

/** Os dias que a visão mostra em colunas (Semana: 7; Dia: 1). */
export function diasDaVisao(visao: Exclude<VisaoCalendario, 'mes'>, d: Date): Date[] {
  return visao === 'semana' ? diasDaSemana(d) : [semHora(d)];
}

/** Primeiro e último dia (sem hora) do que a visão mostra. */
export function limitesDaVisao(visao: VisaoCalendario, d: Date): { primeiro: Date; ultimo: Date } {
  if (visao === 'mes') {
    return {
      primeiro: new Date(d.getFullYear(), d.getMonth(), 1),
      ultimo: new Date(d.getFullYear(), d.getMonth() + 1, 0),
    };
  }
  const dias = diasDaVisao(visao, d);
  return { primeiro: dias[0], ultimo: dias[dias.length - 1] };
}

/** ‹ e ›: mês a mês, semana a semana ou dia a dia. */
export function navegar(visao: VisaoCalendario, d: Date, passo: 1 | -1): Date {
  if (visao === 'mes') return new Date(d.getFullYear(), d.getMonth() + passo, 1);
  const dias = visao === 'semana' ? 7 : 1;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + passo * dias);
}

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Título da barra do calendário.
 * Mês: "Outubro 2026". Dia: "Sexta, 2 de outubro de 2026".
 * Semana: "4 a 10 de outubro de 2026" · "27 de setembro a 3 de outubro de 2026"
 * · "28 de dezembro de 2026 a 3 de janeiro de 2027".
 */
export function tituloDaVisao(visao: VisaoCalendario, d: Date): string {
  if (visao === 'mes') return `${capitalizar(MESES[d.getMonth()])} ${d.getFullYear()}`;
  if (visao === 'dia') {
    return `${DIAS_LONGOS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  }
  const [a, b] = [diasDaSemana(d)[0], diasDaSemana(d)[6]];
  if (a.getFullYear() !== b.getFullYear()) {
    return `${a.getDate()} de ${MESES[a.getMonth()]} de ${a.getFullYear()} a ${b.getDate()} de ${MESES[b.getMonth()]} de ${b.getFullYear()}`;
  }
  if (a.getMonth() !== b.getMonth()) {
    return `${a.getDate()} de ${MESES[a.getMonth()]} a ${b.getDate()} de ${MESES[b.getMonth()]} de ${b.getFullYear()}`;
  }
  return `${a.getDate()} a ${b.getDate()} de ${MESES[b.getMonth()]} de ${b.getFullYear()}`;
}

/** O pedaço do contador do cabeçalho que diz o período: "em outubro", "nesta semana"… */
export function periodoDoContador(visao: VisaoCalendario, d: Date, hoje: Date = new Date()): string {
  if (visao === 'mes') return `em ${MESES[d.getMonth()]}`;
  if (visao === 'dia') {
    if (semHora(d).getTime() === semHora(hoje).getTime()) return 'hoje';
    return `em ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  const dias = diasDaSemana(d);
  if (dias.some(x => x.getTime() === semHora(hoje).getTime())) return 'nesta semana';
  const dm = (x: Date) => `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}`;
  return `de ${dm(dias[0])} a ${dm(dias[6])}`;
}

export interface VisitaNaGrade {
  id: string;
  scheduled_at: string;
  duration_minutes?: number | null;
}

export interface Bloco<V extends VisitaNaGrade> {
  visita: V;
  /** Minutos desde a meia-noite do dia da coluna. */
  inicioMin: number;
  duracaoMin: number;
  /** Coluna dentro do grupo de visitas que se sobrepõem (0 = mais à esquerda). */
  coluna: number;
  /** Quantas colunas o grupo tem: a largura do bloco é 1/colunas. */
  colunas: number;
}

/**
 * As visitas de UM dia, posicionadas na grade de horas. Visitas que se
 * sobrepõem ficam lado a lado (como Eliene | Joyce na Lais). Encostar não é
 * sobrepor: 15h–16h e 16h–17h ficam uma embaixo da outra, cada uma inteira.
 * Visita que atravessa a meia-noite é cortada no fim do dia.
 */
export function blocosDoDia<V extends VisitaNaGrade>(visitas: V[], dia: Date): Bloco<V>[] {
  const ini = semHora(dia).getTime();
  const fimDoDia = 24 * 60;
  const doDia = visitas
    .map(v => {
      const t = new Date(v.scheduled_at).getTime();
      const inicioMin = Math.round((t - ini) / 60000);
      const duracaoMin = v.duration_minutes && v.duration_minutes > 0 ? v.duration_minutes : DURACAO_PADRAO;
      return { visita: v, inicioMin, duracaoMin: Math.min(duracaoMin, fimDoDia - inicioMin) };
    })
    .filter(b => b.inicioMin >= 0 && b.inicioMin < fimDoDia)
    .sort((a, b) => a.inicioMin - b.inicioMin || b.duracaoMin - a.duracaoMin || a.visita.id.localeCompare(b.visita.id));

  const saida: Bloco<V>[] = [];
  let grupo: Bloco<V>[] = [];
  let fimDoGrupo = -1;
  // Fim de cada coluna do grupo atual: a visita entra na primeira que já acabou.
  let fimDasColunas: number[] = [];

  const fecharGrupo = () => {
    grupo.forEach(b => { b.colunas = fimDasColunas.length; });
    saida.push(...grupo);
    grupo = [];
    fimDasColunas = [];
    fimDoGrupo = -1;
  };

  for (const b of doDia) {
    if (grupo.length && b.inicioMin >= fimDoGrupo) fecharGrupo();
    let coluna = fimDasColunas.findIndex(fim => fim <= b.inicioMin);
    if (coluna === -1) { coluna = fimDasColunas.length; fimDasColunas.push(0); }
    fimDasColunas[coluna] = b.inicioMin + b.duracaoMin;
    grupo.push({ ...b, coluna, colunas: 1 });
    fimDoGrupo = Math.max(fimDoGrupo, b.inicioMin + b.duracaoMin);
  }
  if (grupo.length) fecharGrupo();
  return saida;
}

/** Clique na grade → o horário, arredondado para baixo de 30 em 30 (a grade do Agendar visita). */
export function horarioDoClique(dia: Date, deslocamentoPx: number, alturaHoraPx: number): Date {
  const minutos = Math.max(0, Math.min(23 * 60 + 30, Math.floor((deslocamentoPx / alturaHoraPx) * 2) * 30));
  return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), Math.floor(minutos / 60), minutos % 60);
}

/** "08:00" → 480. */
const minutosDe = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * Faixa do dia que está DENTRO do horário de visita (em minutos), para a grade
 * pintar o resto de cinza. `null` = o dia inteiro está fechado.
 */
export function faixaAberta(
  dia: Date,
  ajustes: { days: number[]; start: string; end: string; closed_dates: string[] },
): { de: number; ate: number } | null {
  const iso = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
  if (!ajustes.days.includes(dia.getDay()) || ajustes.closed_dates.includes(iso)) return null;
  return { de: minutosDe(ajustes.start), ate: minutosDe(ajustes.end) };
}

/**
 * Até onde a grade rola ao abrir: a primeira visita do que está na tela ou o
 * começo do horário de visita (07h sem agenda), o que vier antes, com uma hora
 * de folga em cima.
 */
export function horaDeAbertura(
  blocos: { inicioMin: number }[],
  inicioDoHorario: number = 7 * 60,
): number {
  const primeira = blocos.reduce((m, b) => Math.min(m, b.inicioMin), Infinity);
  const alvo = Math.min(primeira, inicioDoHorario);
  return Math.max(0, Math.floor(alvo / 60) - 1);
}
