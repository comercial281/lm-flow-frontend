import { useEffect, useMemo, useState } from 'react';
import { mayRead, useAppDataStore } from '@/store/appDataStore';
import type { Inbox } from '@/types/channels/inbox';
import type { NumeroDaConversa } from './avisoConversas';

/**
 * Lista de números de WhatsApp do tenant, compartilhada pela caixa de conversas,
 * pelo topo da conversa e pelo painel vazio. Sai do store (que deduplica a
 * requisição), então vários consumidores não pedem de novo.
 *
 * `null` = ainda carregando, cargo sem permissão de ler números ou erro. Nunca
 * devolve `[]` antes de carregar: as regras de aviso tratam `[]` como "sem número".
 */
export function useNumerosDaConversa(): {
  inboxes: Inbox[] | null;
  numeros: NumeroDaConversa[] | null;
} {
  const [pode, setPode] = useState(false);
  const inboxes = useAppDataStore((s) => s.inboxes);
  const carregouEm = useAppDataStore((s) => s.lastFetchTimestamps.inboxes);
  const fetchInboxes = useAppDataStore((s) => s.fetchInboxes);

  useEffect(() => {
    let alive = true;
    // Só pede se o cargo lê números: sem a guarda, quem não lê levava erro vermelho.
    mayRead('inboxes.read')
      .then((ok) => {
        if (!alive || !ok) return;
        setPode(true);
        return fetchInboxes();
      })
      .catch(() => { /* silencioso */ });
    return () => { alive = false; };
  }, [fetchInboxes]);

  // O store começa com `[]`; só a marca de "buscou" distingue vazio de não carregado.
  const lista = pode && carregouEm > 0 ? inboxes : null;

  const numeros = useMemo<NumeroDaConversa[] | null>(
    () =>
      lista
        ? lista.map((i) => ({
            id: String(i.id),
            name: i.name,
            connection_status: i.connection_status ?? null,
            owner_user_id: i.owner_user_id ?? null,
          }))
        : null,
    [lista],
  );

  return { inboxes: lista, numeros };
}
