//
// Números conectados (entrega 4 da Área do Admin): as palavras, os tons e a
// ordem da SITUAÇÃO de cada número de WhatsApp. O servidor decide a situação
// (Numbers::Situation) e o resumo de cada cliente; aqui só se escolhe texto,
// tom e ordem. Nada é deduzido do estado cru da conexão.
//
// Linguagem: "número de WhatsApp", nunca instância, inbox ou canal.

import { dataCurta, hora, numero, plural, tempoDesde, toDate } from '@/lib/formato';
import type { ConnectionSummary, NumberSituation, OwnershipNumber } from '@/services/superAdmin/numberOwnershipService';
import { sortRows, type TenantRow, type Tone } from './numberOwnershipRules';

/** A tabela da spec: Conectado · Conectando… · Caiu há 2 h (desde 06/10 14:03) · … */
export function textoDaSituacao(situacao: NumberSituation, desde?: string | null, agora: Date = new Date()): string {
  switch (situacao) {
    case 'connected':
      return 'Conectado';
    case 'connecting':
      return 'Conectando…';
    case 'disconnected': {
      const quando = toDate(desde);
      return quando ? `Caiu ${tempoDesde(quando, agora)} (desde ${dataCurta(quando)} ${hora(quando)})` : 'Caído';
    }
    case 'never':
      return 'Nunca conectado';
    case 'official':
      return 'API oficial · sem conexão a vigiar';
    default:
      return 'Não consegui ler';
  }
}

/** Só o caído é vermelho: API oficial e nunca conectado não são problema de conexão. */
export function tomDaSituacao(situacao: NumberSituation): Tone {
  if (situacao === 'connected') return 'ok';
  if (situacao === 'connecting') return 'warn';
  if (situacao === 'disconnected') return 'error';
  return 'neutral';
}

export interface SeloDoCliente {
  texto: string;
  tom: Tone;
}

/** O selo de conexão na linha do cliente, pelo resumo que a lista traz. */
export function seloDoCliente(resumo: ConnectionSummary | null | undefined): SeloDoCliente {
  if (!resumo) return { texto: 'Sem leitura', tom: 'neutral' };
  if (resumo.down > 0) return { texto: plural(resumo.down, 'caído', 'caídos'), tom: 'error' };
  if (resumo.unknown > 0) return { texto: 'Sem leitura', tom: 'neutral' };
  if (resumo.total === 0) return { texto: 'Nenhum número', tom: 'neutral' };
  const pendentes = [
    resumo.connecting > 0 ? `${numero(resumo.connecting)} conectando` : '',
    resumo.never > 0 ? plural(resumo.never, 'nunca conectado', 'nunca conectados') : '',
  ].filter(Boolean);
  if (pendentes.length) return { texto: pendentes.join(' · '), tom: resumo.connecting > 0 ? 'warn' : 'neutral' };
  return { texto: 'Tudo conectado', tom: 'ok' };
}

const caidos = (row: TenantRow): number => row.tenant.connection_summary?.down ?? 0;

/** "N números · X conectados · Y caídos · Z sem leitura" (+ clientes que não deu para ler). */
export function contadores(rows: TenantRow[]): string {
  let total = 0;
  let conectados = 0;
  let caidosNoTotal = 0;
  let semLeitura = 0;
  let clientesSemLeitura = 0;
  for (const { tenant } of rows) {
    const r = tenant.connection_summary;
    if (!r) {
      clientesSemLeitura += 1;
      continue;
    }
    total += r.total;
    conectados += r.connected;
    caidosNoTotal += r.down;
    semLeitura += r.unknown;
  }
  const partes = [
    plural(total, 'número', 'números'),
    plural(conectados, 'conectado', 'conectados'),
    plural(caidosNoTotal, 'caído', 'caídos'),
    `${numero(semLeitura)} sem leitura`,
  ];
  if (clientesSemLeitura) partes.push(plural(clientesSemLeitura, 'cliente sem leitura', 'clientes sem leitura'));
  return partes.join(' · ');
}

/** Cliente com número caído no topo (mais caídos primeiro); o resto na ordem de sempre (sortRows). */
export function ordenarComCaidos(rows: TenantRow[]): TenantRow[] {
  // `sort` é estável: entre clientes com o mesmo número de caídos vale a ordem de sortRows.
  return sortRows(rows).sort((a, b) => caidos(b) - caidos(a));
}

export function filtrarSoCaidos(rows: TenantRow[], soCaidos: boolean): TenantRow[] {
  return soCaidos ? rows.filter((r) => caidos(r) > 0) : rows;
}

/** Dentro do cliente: número caído primeiro, sem mexer na ordem dos outros. */
export function ordenarNumeros<T extends Pick<OwnershipNumber, 'situation'>>(numeros: T[]): T[] {
  return [...numeros].sort(
    (a, b) => Number(b.situation === 'disconnected') - Number(a.situation === 'disconnected'),
  );
}
