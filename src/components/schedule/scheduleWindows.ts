/**
 * Tipo e constantes das janelas de horário semanais.
 *
 * Separado do componente de propósito: um arquivo que exporta componente E
 * constante quebra o Fast Refresh do Vite (a página inteira recarrega em vez de
 * só o componente). Mesmo motivo pelo qual o resto do projeto separa helpers.
 */

/**
 * Uma janela de horário: "das 08:00 às 18:00, seg a sex".
 *
 * `days` usa 0=domingo … 6=sábado, e ausente/vazio quer dizer TODOS os dias —
 * é o mesmo contrato do backend (Scheduling::WindowGate), e a razão de o campo
 * ser opcional: config antiga, sem dias, continua valendo a semana inteira.
 */
export interface ScheduleWindow {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
  days?: number[];
}

/**
 * Segunda primeiro, domingo por último — é como o gestor lê uma escala, e não a
 * ordem numérica (que começaria no domingo).
 */
export const WEEKDAYS: [number, string][] = [
  [1, 'Seg'], [2, 'Ter'], [3, 'Qua'], [4, 'Qui'], [5, 'Sex'], [6, 'Sáb'], [0, 'Dom'],
];

export const DEFAULT_WINDOW: ScheduleWindow = { start: '08:00', end: '18:00', days: [1, 2, 3, 4, 5] };
