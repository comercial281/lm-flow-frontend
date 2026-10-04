import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import EmptyState from '@/components/base/EmptyState';
import { cn } from '@/utils/cn';
import { erroDaApi, supportService, type SupportTicketSummary } from '@/services/support/supportService';
import { KIND_LABEL, STATUS_CLIENTE, quandoFoi } from './rotulos';

interface Props {
  onAbrir: (id: string) => void;
  onNovo: () => void;
}

/** Aba Mensagens: os chamados da pessoa. Erro aparece como erro, nunca como lista vazia. */
export default function SupportMensagens({ onAbrir, onNovo }: Props) {
  const [lista, setLista] = useState<SupportTicketSummary[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    setErro(null);
    try {
      setLista(await supportService.list());
    } catch (e) {
      setErro(erroDaApi(e, 'Não consegui carregar seus chamados.'));
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  if (erro) {
    return <EmptyState tipo="erro" description={erro} action={{ label: 'Tentar de novo', onClick: () => void carregar() }} />;
  }
  if (!lista) return <p className="p-4 text-sm text-muted-foreground">Carregando…</p>;
  if (!lista.length) {
    return (
      <EmptyState
        title="Você ainda não abriu nenhum chamado."
        description="Dúvida, bug ou sugestão: o time responde por aqui."
        action={{ label: 'Falar com o time', onClick: onNovo }}
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {lista.map(t => (
        <li key={t.id}>
          <button type="button" onClick={() => onAbrir(t.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent">
            <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', t.unread ? 'bg-primary' : 'bg-transparent')} aria-label={t.unread ? 'Resposta nova' : undefined} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{t.subject}</span>
              <span className="block text-xs text-muted-foreground">
                {KIND_LABEL[t.kind]} · {STATUS_CLIENTE[t.status]} · {quandoFoi(t.last_message_at)}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
