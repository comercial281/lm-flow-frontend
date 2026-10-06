// src/pages/SuperAdmin/comunicadoRegras.ts
import type { PedidoDeConfirmacao } from '@/hooks/useConfirmacao';
import { numero, plural } from '@/lib/formato';
import type {
  ComunicadoAndamento,
  ComunicadoItemStatus,
  ComunicadoModo,
} from '@/services/superAdmin/comunicadoService';

// De quanto em quanto tempo a tela relê o andamento enquanto o envio roda.
export const INTERVALO_ANDAMENTO_MS = 2000;

/**
 * A MESMA troca do servidor (Comunicados::Delivery.personalize): {nome} e
 * {{nome}} viram o primeiro nome do cliente, e só espaço repetido é apertado.
 * A prévia é o que vai sair.
 */
export function personalizar(texto: string, nome: string): string {
  const primeiro = nome.trim().split(/\s+/)[0] ?? '';
  return texto.split('{{nome}}').join(primeiro).split('{nome}').join(primeiro).replace(/[ \t]{2,}/g, ' ').trim();
}

/** O N é o que sai de fato: só os marcados que têm destino. */
export function pedidoDeEnvio(modo: ComunicadoModo, n: number, numeroQueEnvia: string): PedidoDeConfirmacao {
  const quem = modo === 'owners' ? plural(n, 'dono', 'donos') : plural(n, 'grupo', 'grupos');
  return {
    titulo: `Mandar para ${quem}?`,
    descricao: `Sai pelo número ${numeroQueEnvia}, um cliente por vez. Depois de enviado não dá para desfazer.`,
    rotuloDaAcao: 'Mandar',
  };
}

export const ROTULO_DO_ITEM: Record<ComunicadoItemStatus, string> = {
  queued: 'Na fila',
  sending: 'Enviando agora',
  sent: 'Recebeu',
  failed: 'Falhou',
  skipped: 'Ficou de fora',
};

export const CLASSE_DO_ITEM: Record<ComunicadoItemStatus, string> = {
  queued: 'text-muted-foreground',
  sending: 'text-muted-foreground',
  sent: 'text-primary',
  failed: 'text-destructive',
  skipped: 'text-muted-foreground',
};

export function textoDoAndamento(a: ComunicadoAndamento): string {
  if (a.state === 'running') return `Enviando ${numero(a.sent + a.failed)} de ${numero(a.total)}…`;
  const fora = a.items.filter(i => i.status === 'skipped').length;
  const partes = [plural(a.sent, 'cliente recebeu', 'clientes receberam')];
  if (a.failed > 0) partes.push(plural(a.failed, 'falhou', 'falharam'));
  if (fora > 0) partes.push(plural(fora, 'ficou de fora', 'ficaram de fora'));
  const inicio = a.state === 'interrupted' ? 'O envio parou no meio' : 'Terminou';
  return `${inicio}: ${partes.join(' · ')}.`;
}
