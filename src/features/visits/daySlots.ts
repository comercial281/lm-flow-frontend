/**
 * Os horários do modal "Agendar visita": a lista do dia, quais estão ocupados
 * pelo corretor e a frase por extenso ("Quinta, 9 de outubro, das 9h às 10h").
 *
 * A lista é fixa (07:00–21:00, de 30 em 30) e em 24 h porque o campo de hora do
 * navegador segue o idioma do aparelho, e num celular em inglês ele vira AM/PM:
 * foi o achado de "visita no dia errado" do Raio-X. Quem decide de verdade se o
 * horário pode é o servidor (Visits::Booking); aqui é a mesma conta, para a tela
 * já mostrar riscado o que ele recusaria.
 *
 * Sem Intl novo (catraca do build): a hora vem de `@/lib/formato`, e os nomes de
 * dia e mês são montados à mão.
 */
import { hora } from '@/lib/formato';

export interface BusyVisit {
  id: string;
  scheduled_at: string;
  duration_minutes?: number | null;
  status?: string;
  cancelled_at?: string | null;
  contact?: { name: string } | null;
  property?: { title: string; code: string } | null;
}

export interface Slot {
  inicio: Date;
  rotulo: string;
  ocupadoPor: string | null;
}

export const DURACOES = [30, 60, 90, 120] as const;

const PRIMEIRO_MINUTO = 7 * 60;
const ULTIMO_MINUTO = 21 * 60;
const PASSO = 30;
const DURACAO_PADRAO = 60;
const OCUPAM = new Set(['scheduled', 'confirmed', 'in_progress', 'rescheduled']);

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const MINUTO = 60_000;

export function rotuloDuracao(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto === 0 ? `${h} h` : `${h}h${String(resto).padStart(2, '0')}`;
}

export function mesmoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function diaISO(dia: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dia.getFullYear()}-${p(dia.getMonth() + 1)}-${p(dia.getDate())}`;
}

/** Só as visitas que ocupam o horário: cancelada (pela situação ou pela data), realizada e "não compareceu" liberam. */
export function ocupando(visitas: BusyVisit[]): BusyVisit[] {
  return visitas.filter(v => !v.cancelled_at && OCUPAM.has(v.status ?? 'scheduled'));
}

function duracaoDe(v: BusyVisit): number {
  const d = Number(v.duration_minutes);
  return Number.isFinite(d) && d > 0 ? d : DURACAO_PADRAO;
}

export function horariosDoDia(dia: Date, duracaoMin: number, ocupadas: BusyVisit[], agora: Date): Slot[] {
  const base = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate());
  const ativas = ocupando(ocupadas).map(v => {
    const inicio = new Date(v.scheduled_at).getTime();
    return { inicio, fim: inicio + duracaoDe(v) * MINUTO, nome: v.contact?.name || 'outro cliente' };
  });

  const out: Slot[] = [];
  for (let m = PRIMEIRO_MINUTO; m <= ULTIMO_MINUTO; m += PASSO) {
    const inicio = new Date(base.getTime() + m * MINUTO);
    if (inicio.getTime() <= agora.getTime()) continue;
    const fim = inicio.getTime() + duracaoMin * MINUTO;
    // Encostar não é conflito: [início, fim) contra [início, fim).
    const choque = ativas.find(a => a.inicio < fim && a.fim > inicio.getTime());
    out.push({ inicio, rotulo: hora(inicio), ocupadoPor: choque ? choque.nome : null });
  }
  return out;
}

export function atalhosDeDia(agora: Date): { rotulo: string; dia: Date }[] {
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const amanha = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);
  // Próximo sábado depois de amanhã (se amanhã já é sábado, o atalho seria repetido).
  let sabado = new Date(amanha.getFullYear(), amanha.getMonth(), amanha.getDate() + 1);
  while (sabado.getDay() !== 6) sabado = new Date(sabado.getFullYear(), sabado.getMonth(), sabado.getDate() + 1);
  return [
    { rotulo: 'Hoje', dia: hoje },
    { rotulo: 'Amanhã', dia: amanha },
    { rotulo: 'Sábado', dia: sabado },
  ];
}

function horaCurta(d: Date): string {
  const m = d.getMinutes();
  return m === 0 ? `${d.getHours()}h` : `${d.getHours()}h${String(m).padStart(2, '0')}`;
}

export function porExtenso(inicio: Date, duracaoMin: number): string {
  const fim = new Date(inicio.getTime() + duracaoMin * MINUTO);
  return `${DIAS[inicio.getDay()]}, ${inicio.getDate()} de ${MESES[inicio.getMonth()]}, das ${horaCurta(inicio)} às ${horaCurta(fim)}`;
}
