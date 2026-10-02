import { telefone } from '@/lib/formato';
import type { Inbox } from '@/types/channels/inbox';

interface EntradaDoTopo {
  inboxId: number | string | null | undefined;
  inboxNome: string | null | undefined;
  inboxes: Inbox[] | null;
  responsavel: string | null | undefined;
}

/** Linha de baixo do topo da conversa: "Número <nome> · <telefone> · Responsável: <nome>". */
export function linhaDoTopo({ inboxId, inboxNome, inboxes, responsavel }: EntradaDoTopo): string {
  const partes: string[] = [];
  const nome = (inboxNome ?? '').trim();
  if (nome) partes.push(`Número ${nome}`);

  if (inboxId != null && inboxes) {
    const inbox = inboxes.find(i => String(i.id) === String(inboxId));
    const fone = telefone(inbox?.phone_number);
    if (fone) partes.push(fone);
  }

  const quem = (responsavel ?? '').trim();
  partes.push(quem ? `Responsável: ${quem}` : 'Sem responsável');
  return partes.join(' · ');
}
