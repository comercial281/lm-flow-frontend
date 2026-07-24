import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/ds';
import { toast } from 'sonner';
import { MessageSquarePlus, Lightbulb, Bug, Trash2, ExternalLink } from 'lucide-react';
import {
  customerFeedbackService,
  KIND_LABELS,
  STATUS_LABELS,
  type CustomerFeedback,
  type FeedbackKind,
  type FeedbackStatus,
} from '@/services/superAdmin/customerFeedbackService';

const STATUS_OPTIONS: FeedbackStatus[] = ['new', 'in_review', 'resolved'];

/**
 * Aba "Sugestões/Bugs" do admin (Leal Mídia).
 *
 * Caixa de entrada única com tudo que os clientes enviam pelo botão flutuante do
 * CRM. Filtra por tipo/status, muda o status (novo → em análise → resolvido) e
 * arquiva. Cada novo envio também dispara um e-mail de aviso.
 */
export default function CustomerFeedbacks() {
  const [items, setItems] = useState<CustomerFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<FeedbackKind | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'all'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await customerFeedbackService.list({
        kind: kindFilter === 'all' ? undefined : kindFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setItems(data);
    } catch {
      toast.error('Não consegui carregar os feedbacks.');
    } finally {
      setLoading(false);
    }
  }, [kindFilter, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

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
    if (!window.confirm('Arquivar este feedback?')) return;
    try {
      await customerFeedbackService.remove(item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
      toast.success('Feedback arquivado.');
    } catch {
      toast.error('Não consegui arquivar.');
    }
  };

  const counts = useMemo(() => {
    return {
      total: items.length,
      new: items.filter(i => i.status === 'new').length,
    };
  }, [items]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <MessageSquarePlus className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Sugestões/Bugs</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Tudo que os clientes enviam pelo botão dentro do CRM. {counts.new} novo(s) de {counts.total}.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Select value={kindFilter} onValueChange={v => setKindFilter(v as FeedbackKind | 'all')}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="suggestion">Sugestão</SelectItem>
            <SelectItem value="bug">Bug</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as FeedbackStatus | 'all')}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum feedback por aqui ainda.</p>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <Card key={item.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={item.kind === 'bug' ? 'destructive' : 'secondary'} className="gap-1">
                    {item.kind === 'bug' ? (
                      <Bug className="h-3 w-3" />
                    ) : (
                      <Lightbulb className="h-3 w-3" />
                    )}
                    {KIND_LABELS[item.kind]}
                  </Badge>
                  {item.tenant_slug && <Badge variant="outline">{item.tenant_slug}</Badge>}
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>

                <p className="whitespace-pre-wrap text-sm">{item.message}</p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {(item.user_name || item.user_email) && (
                    <span>
                      {item.user_name || 'sem nome'}
                      {item.user_email ? ` · ${item.user_email}` : ''}
                    </span>
                  )}
                  {item.page_url && (
                    <span className="inline-flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      {item.page_url}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <Select
                    value={item.status}
                    onValueChange={v => changeStatus(item, v as FeedbackStatus)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(s => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => remove(item)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Arquivar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
