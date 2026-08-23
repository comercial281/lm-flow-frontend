import { useEffect, useMemo, useState } from 'react';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Button,
  Badge,
} from '@/components/ui/ds';
import { Search, Plus, Loader2, BookOpen, Check } from 'lucide-react';
import api from '@/services/core/api';
import {
  automationTemplatesService,
  AutomationTemplate,
  CATEGORY_LABELS,
} from '@/services/automationTemplates/automationTemplatesService';

interface Props {
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
}

export default function AutomationLibraryModal({ open, onClose, onApplied }: Props) {
  const [templates, setTemplates] = useState<AutomationTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const [inboxId, setInboxId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setCategory('all');
    setAppliedIds([]);
    (async () => {
      setLoading(true);
      try {
        const [tpls, inboxesRes] = await Promise.all([
          automationTemplatesService.getAll(),
          api.get('/inboxes').catch(() => null),
        ]);
        setTemplates(tpls);
        const inboxes = (inboxesRes?.data as { data?: Array<{ id: string }> } | undefined)?.data ?? [];
        setInboxId(inboxes[0]?.id);
      } catch {
        toast.error('Erro ao carregar a biblioteca');
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const categories = useMemo(() => {
    const present = Array.from(new Set(templates.map(t => t.category)));
    return present.sort((a, b) => (CATEGORY_LABELS[a] ?? a).localeCompare(CATEGORY_LABELS[b] ?? b));
  }, [templates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates
      .filter(t => category === 'all' || t.category === category)
      .filter(t =>
        !q ||
        t.name.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q) ||
        (t.meta?.tags ?? []).some(tag => tag.toLowerCase().includes(q)),
      )
      .sort((a, b) => a.position - b.position);
  }, [templates, search, category]);

  const handleApply = async (tpl: AutomationTemplate) => {
    setApplyingId(tpl.id);
    try {
      await automationTemplatesService.apply(tpl.id, inboxId ?? '');
      setAppliedIds(prev => [...prev, tpl.id]);
      toast.success(`"${tpl.name}" adicionada`);
      onApplied();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao adicionar template'));
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Biblioteca de Automações
          </DialogTitle>
          <DialogDescription>
            Modelos prontos. Adicione e ajuste de acordo com a necessidade do cliente.
          </DialogDescription>
        </DialogHeader>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar automação..."
            className="pl-9"
          />
        </div>

        {/* Categorias */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategory('all')}
            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
              category === 'all'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            Todas
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                category === cat
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-2 mt-1">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground">
              Nenhum modelo encontrado.
            </div>
          ) : (
            filtered.map(tpl => {
              const applied = appliedIds.includes(tpl.id);
              return (
                <div
                  key={tpl.id}
                  className="flex items-start gap-3 border border-border rounded-xl bg-card px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{tpl.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {CATEGORY_LABELS[tpl.category] ?? tpl.category}
                      </Badge>
                    </div>
                    {tpl.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{tpl.description}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={applied ? 'outline' : 'default'}
                    disabled={applyingId === tpl.id || applied}
                    onClick={() => handleApply(tpl)}
                    className="flex-shrink-0"
                  >
                    {applyingId === tpl.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : applied ? (
                      <><Check className="h-3.5 w-3.5 mr-1" /> Adicionada</>
                    ) : (
                      <><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar</>
                    )}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
