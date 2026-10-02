import { telefone } from '@/lib/formato';
import type { Inbox } from '@/types/channels/inbox';

interface EntradaDoTopo {
  inboxId: number | string | null | undefined;
  inboxNome: string | null | undefined;
  inboxes: Inbox[] | null;
  responsavel: string | null | undefined;
}

/**
 * Linha de baixo do topo da conversa: "Número <nome> · <telefone> · Responsável: <nome>".
 * O nome é o que o gestor deu ao número (`display_name` da lista de números): o
 * `inbox.name` que vem com a conversa é o identificador interno
 * ("whatsapp-horizonte-imveis") e só entra quando a lista não tem o número.
 */
export function linhaDoTopo({ inboxId, inboxNome, inboxes, responsavel }: EntradaDoTopo): string {
  const partes: string[] = [];
  const inbox =
    inboxId != null && inboxes ? inboxes.find(i => String(i.id) === String(inboxId)) : undefined;

  const nome = (inbox?.display_name ?? '').trim() || (inboxNome ?? '').trim();
  if (nome) partes.push(`Número ${nome}`);

  const fone = telefone(inbox?.phone_number);
  if (fone) partes.push(fone);

  const quem = (responsavel ?? '').trim();
  partes.push(quem ? `Responsável: ${quem}` : 'Sem responsável');
  return partes.join(' · ');
}
