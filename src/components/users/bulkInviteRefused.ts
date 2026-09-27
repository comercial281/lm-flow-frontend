export interface RefusedInvite {
  email: string;
  message: string;
}

/**
 * Extrai os e-mails que o servidor RECUSOU de propósito no convite em massa
 * (ex.: e-mail reservado à equipe da Leal Mídia) — separado dos que falharam
 * ao tentar convidar (`failed_invitations`). A mensagem vem pronta do
 * servidor, em português, e não é reescrita aqui: é ela que explica o motivo
 * real da recusa.
 *
 * Leitura defensiva: item sem e-mail, sem mensagem, ou de outro tipo, é
 * descartado sem derrubar os demais — "refused" torto não pode fazer o
 * resultado inteiro do convite em massa sumir.
 */
export function parseRefusedInvites(response: { refused?: unknown } | null | undefined): RefusedInvite[] {
  const raw = response?.refused;
  if (!Array.isArray(raw)) return [];

  return raw.reduce<RefusedInvite[]>((acc, item) => {
    if (!item || typeof item !== 'object') return acc;
    const { email, message } = item as { email?: unknown; message?: unknown };
    if (typeof email === 'string' && email && typeof message === 'string' && message) {
      acc.push({ email, message });
    }
    return acc;
  }, []);
}
