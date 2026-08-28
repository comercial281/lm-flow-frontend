import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/ds';
import { toast } from 'sonner';
import {
  MessageSquarePlus,
  Lightbulb,
  Bug,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  customerFeedbackService,
  KIND_LABELS,
  STATUS_LABELS,
  type CustomerFeedback,
  type FeedbackKind,
  type FeedbackStatus,
} from '@/services/superAdmin/customerFeedbackService';

import { useConfirmacao } from '@/hooks/useConfirmacao';
const STATUS_OPTIONS: FeedbackStatus[] = ['new', 'in_review', 'resolved'];
const PAGE_SIZE = 8;

// Paleta por status: o mesmo tom aparece na bolinha, no selo e na barra lateral
// do card — pra bater o olho e saber na hora se está aberto, em análise ou
// resolvido. Funciona em tema claro e escuro (usa /15 de opacidade no fundo).
const STATUS_STYLES: Record<
  FeedbackStatus,
  { dot: string; badge: string; bar: string; ring: string; solid: string }
> = {
  new: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30',
    bar: 'bg-amber-500',
    ring: 'data-[active=true]:border-amber-500 data-[active=true]:bg-amber-500/10 data-[active=true]:text-amber-600 dark:data-[active=true]:text-amber-400',
    solid: 'bg-amber-500',
  },
  in_review: {
    dot: 'bg-blue-500',
    badge: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30',
    bar: 'bg-blue-500',
    ring: 'data-[active=true]:border-blue-500 data-[active=true]:bg-blue-500/10 data-[active=true]:text-blue-600 dark:data-[active=true]:text-blue-400',
    solid: 'bg-blue-500',
  },
  resolved: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30',
    bar: 'bg-emerald-500',
    ring: 'data-[active=true]:border-emerald-500 data-[active=true]:bg-emerald-500/10 data-[active=true]:text-emerald-600 dark:data-[active=true]:text-emerald-400',
    solid: 'bg-emerald-500',
  },
};

/**
 * Aba "Sugestões/Bugs" do admin (Leal Mídia).
 *
 * Caixa de entrada única com tudo que os clientes enviam pelo botão flutuante do
 * CRM, em cards compactos estilo comentário. Filtros em cápsulas por status
 * (com cor) e por tipo, contadores no topo e paginação. Muda o status
 * (aberto → em análise → resolvido) e arquiva. Cada novo envio dispara e-mail.
 */
export default function CustomerFeedbacks() {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [items, setItems] = useState<CustomerFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<FeedbackKind | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Carrega tudo uma vez; filtro/paginação/contagem são no cliente (assim os
      // contadores refletem o total real independente do filtro ativo).
      const data = await customerFeedbackService.list();
      setItems(data);
    } catch {
      toast.error('Não consegui carregar os feedbacks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Volta pra primeira página sempre que o filtro muda.
  useEffect(() => {
    setPage(1);
  }, [kindFilter, statusFilter]);

  const changeStatus = async (item: CustomerFeedback, status: FeedbackStatus) => {
    try {
      const updated = await customerFeedbackService.update(item.id, { status });
      setItems(prev => prev.map(i => (i.id === item.id ? updated : i)));
      toast.success('Status atualizado.');
    } catch {
      toast.error('Não consegui atualizar o status.');
    }
  };

  const remove = async (item: CustomerFeedback) => {
    if (!(await confirmar({
      titulo: 'Arquivar feedback',
      descricao: 'Ele sai da lista.',
      rotuloDaAcao: 'Arquivar',
    }))) return;
    try {
      await customerFeedbackService.remove(item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
      toast.success('Feedback arquivado.');
    } catch {
      toast.error('Não consegui arquivar.');
    }
  };

  const statusCounts = useMemo(() => {
    const base: Record<FeedbackStatus, number> = { new: 0, in_review: 0, resolved: 0 };
    for (const i of items) base[i.status] += 1;
    return base;
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter(
      i =>
        (statusFilter === 'all' || i.status === statusFilter) &&
        (kindFilter === 'all' || i.kind === kindFilter),
    );
  }, [items, statusFilter, kindFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const StatusPill = ({ value }: { value: FeedbackStatus | 'all' }) => {
    const active = statusFilter === value;
    const count = value === 'all' ? items.length : statusCounts[value];
    const style = value === 'all' ? null : STATUS_STYLES[value];
    return (
      <button
        type="button"
        data-active={active}
        onClick={() => setStatusFilter(value)}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
          active && value === 'all'
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-input text-muted-foreground hover:bg-accent'
        } ${style?.ring ?? ''}`}
      >
        {style && <span className={`h-2 w-2 rounded-full ${style.dot}`} />}
        {value === 'all' ? 'Todos' : STATUS_LABELS[value]}
        <span className="rounded-full bg-foreground/10 px-1.5 text-xs tabular-nums">{count}</span>
      </button>
    );
  };

  const KindPill = ({ value }: { value: FeedbackKind | 'all' }) => {
    const active = kindFilter === value;
    return (
      <button
        type="button"
        onClick={() => setKindFilter(value)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
          active
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-input text-muted-foreground hover:bg-accent'
        }`}
      >
        {value === 'suggestion' && <Lightbulb className="h-3.5 w-3.5" />}
        {value === 'bug' && <Bug className="h-3.5 w-3.5" />}
        {value === 'all' ? 'Todos' : KIND_LABELS[value]}
      </button>
    );
  };

  return (
    <>
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <MessageSquarePlus className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Sugestões/Bugs</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Tudo que os clientes enviam pelo botão dentro do CRM.
        </p>
      </header>

      {/* Filtros em cápsulas: status (com cor) e tipo */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <StatusPill value="all" />
          {STATUS_OPTIONS.map(s => (
            <StatusPill key={s} value={s} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <KindPill value="all" />
          <KindPill value="suggestion" />
          <KindPill value="bug" />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum feedback por aqui ainda.
        </p>
      ) : (
        <>
          <div className="space-y-2.5">
            {pageItems.map(item => {
              const style = STATUS_STYLES[item.status];
              return (
                <div
                  key={item.id}
                  className="relative overflow-hidden rounded-lg border bg-card pl-4 pr-3 py-3"
                >
                  {/* Barra lateral colorida = status num relance */}
                  <span className={`absolute left-0 top-0 h-full w-1 ${style.bar}`} />

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.kind === 'bug'
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                            : 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30'
                        }`}
                      >
                        {item.kind === 'bug' ? (
                          <Bug className="h-3 w-3" />
                        ) : (
                          <Lightbulb className="h-3 w-3" />
                        )}
                        {KIND_LABELS[item.kind]}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                        {STATUS_LABELS[item.status]}
                      </span>
                      {item.tenant_slug && (
                        <span className="text-xs text-muted-foreground">{item.tenant_slug}</span>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <p className="mt-2 whitespace-pre-wrap text-sm">{item.message}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {(item.user_name || item.user_email) && (
                      <span>{item.user_name || item.user_email}</span>
                    )}
                    {item.page_url && (
                      <span className="inline-flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                        {item.page_url}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2.5">
                    <Select
                      value={item.status}
                      onValueChange={v => changeStatus(item, v as FeedbackStatus)}
                    >
                      <SelectTrigger className="h-8 w-36 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => (
                          <SelectItem key={s} value={s}>
                            <span className="inline-flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${STATUS_STYLES[s].dot}`} />
                              {STATUS_LABELS[s]}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(item)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Arquivar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cápsula de paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={currentPage <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-3 text-sm text-muted-foreground tabular-nums">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
      {dialogoDeConfirmacao}
    </>
  );
}
