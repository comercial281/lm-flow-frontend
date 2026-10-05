import { Seletor } from '@/components/base/Seletor';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LifeBuoy, Search } from 'lucide-react';
import NoAccessState from '@/components/permissions/NoAccessState';
import { isForbiddenError } from '@/services/core/forbidden';
import EmptyState from '@/components/base/EmptyState';
import { cn } from '@/utils/cn';
import { erroDaApi, type SupportKind, type SupportStatus } from '@/services/support/supportService';
import { supportAdminService, type SupportTicketAdminSummary } from '@/services/support/supportAdminService';
import { KIND_LABEL, STATUS_TIME, quandoFoi } from '@/components/support/rotulos';
import { useSinalSuporte } from '@/components/support/aoVivo';

const SITUACOES: (SupportStatus | '')[] = ['open', 'waiting_customer', 'resolved', ''];
const TIPOS: (SupportKind | '')[] = ['', 'question', 'bug', 'suggestion'];
const INTERVALO_MS = 2 * 60 * 1000;
// Espera a pessoa parar de digitar: "roleta" é 1 busca, não 6.
const DEBOUNCE_BUSCA_MS = 300;

/**
 * Item Suporte da Área do Admin: chamados de TODOS os clientes. Abre em
 * "Aberto" (o que espera o time). Erro aparece como erro, nunca como lista vazia.
 */
export default function SuporteLista() {
  const [status, setStatus] = useState<SupportStatus | ''>('open');
  const [kind, setKind] = useState<SupportKind | ''>('');
  const [q, setQ] = useState('');
  // `busca` é o `q` já assentado: só ele dispara requisição.
  const [busca, setBusca] = useState('');
  const [page, setPage] = useState(1);
  const [recarga, setRecarga] = useState(0);
  // Chamado novo ou mensagem nova chega pelo sinal ao vivo: a lista acompanha na hora.
  useSinalSuporte(() => setRecarga(r => r + 1));
  const [dado, setDado] = useState<{ tickets: SupportTicketAdminSummary[]; total: number; perPage: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recusado, setRecusado] = useState(false);

  useEffect(() => {
    const termo = q.trim();
    if (termo === busca) return;
    // ⚠️ A página volta pra 1 junto com a busca nova (e não a cada tecla), senão
    // sai uma requisição extra com o texto velho.
    const id = window.setTimeout(() => {
      setBusca(termo);
      setPage(1);
    }, DEBOUNCE_BUSCA_MS);
    return () => window.clearTimeout(id);
  }, [q, busca]);

  useEffect(() => {
    let vivo = true;
    const carregar = () =>
      supportAdminService
        .list({ status, kind, q: busca, page })
        .then(r => {
          if (!vivo) return;
          setDado(r);
          setErro(null);
          setRecusado(false);
        })
        .catch(e => {
          if (!vivo) return;
          setRecusado(isForbiddenError(e));
          setErro(erroDaApi(e, 'Não consegui carregar os chamados.'));
        });
    void carregar();
    const id = window.setInterval(() => document.visibilityState === 'visible' && void carregar(), INTERVALO_MS);
    return () => {
      vivo = false;
      window.clearInterval(id);
    };
  }, [status, kind, busca, page, recarga]);

  const limpar = () => {
    setStatus('');
    setKind('');
    setQ('');
    setBusca('');
    setPage(1);
  };

  // Filtro de abertura (Aberto, sem tipo, sem busca): vazio aqui é boa notícia, não "nada encontrado".
  const filtroPadrao = status === 'open' && kind === '' && busca === '' && q.trim() === '';

  const paginas = dado ? Math.max(1, Math.ceil(dado.total / dado.perPage)) : 1;

  return (
    <div className="space-y-4">
      <div className="border-l-4 border-primary pl-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <LifeBuoy className="h-5 w-5" aria-hidden="true" /> Suporte
        </h1>
        <p className="text-sm text-muted-foreground">Chamados dos clientes: dúvidas, bugs e sugestões.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {SITUACOES.map(s => (
          <button
            key={s || 'todas'}
            type="button"
            onClick={() => { setStatus(s); setPage(1); }}
            aria-pressed={status === s}
            className={cn('rounded-full border px-3 py-1 text-sm', status === s ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent')}
          >
            {s ? STATUS_TIME[s] : 'Todas'}
          </button>
        ))}
        <Seletor
          value={kind}
          onChange={e => { setKind(e.target.value as SupportKind | ''); setPage(1); }}
          aria-label="Tipo"
          className="text-sm"
        >
          {TIPOS.map(k => (
            <option key={k || 'todos'} value={k}>{k ? KIND_LABEL[k] : 'Todos os tipos'}</option>
          ))}
        </Seletor>
        <label className="flex items-center gap-2 rounded-md border border-border px-2 py-1">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar assunto, pessoa ou cliente"
            aria-label="Buscar chamados"
            className="bg-transparent text-base outline-none sm:text-sm"
          />
        </label>
      </div>

      {recusado ? (
        <NoAccessState />
      ) : erro ? (
        <EmptyState tipo="erro" description={erro} action={{ label: 'Tentar de novo', onClick: () => setRecarga(r => r + 1) }} />
      ) : !dado ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : dado.tickets.length === 0 ? (
        filtroPadrao ? (
          <EmptyState title="Nenhum chamado esperando o time." description="Quando um cliente abrir um chamado, ele aparece aqui." />
        ) : (
          <EmptyState tipo="semResultado" action={{ label: 'Limpar filtros', onClick: limpar }} />
        )
      ) : (
        <>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {dado.tickets.map(t => (
              <li key={t.id}>
                <Link to={`/admin/suporte/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-accent">
                  <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', t.unread ? 'bg-primary' : 'bg-transparent')} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-sm', t.unread && 'font-semibold')}>
                      {t.unread && <span className="sr-only">Mensagem nova do cliente: </span>}
                      {t.subject}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t.tenant_slug ?? 'painel raiz'} · {t.user_name ?? t.user_email ?? 'sem nome'} · {KIND_LABEL[t.kind]} · {STATUS_TIME[t.status]}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">{quandoFoi(t.last_message_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
          {paginas > 1 && (
            <div className="flex items-center justify-end gap-2 text-sm">
              <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-md border border-border px-2 py-1 disabled:opacity-40">Anterior</button>
              <span>{page} de {paginas}</span>
              <button type="button" disabled={page >= paginas} onClick={() => setPage(page + 1)} className="rounded-md border border-border px-2 py-1 disabled:opacity-40">Próxima</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
