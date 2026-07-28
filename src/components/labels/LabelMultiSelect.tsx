import { useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { labelsService } from '@/services/contacts/labelsService';
import type { Label } from '@/types/settings';

interface LabelMultiSelectProps {
  /** Catálogo global de etiquetas (nome + cor) pra sugerir/escolher. */
  labels: Label[];
  /** IDs das etiquetas selecionadas. */
  selectedIds: string[];
  /** Chamado quando a seleção muda (adicionar/remover). */
  onChange: (ids: string[]) => void;
  /** Chamado após criar uma etiqueta nova (pra o pai recarregar o catálogo). */
  onLabelCreated?: (label: Label) => void;
  disabled?: boolean;
}

// Paleta da identidade (obsidiana/violeta) pra etiquetas novas sem cor definida.
const PALETTE = ['#7c3aed', '#9333ea', '#2563eb', '#0891b2', '#16a34a', '#d97706', '#dc2626', '#db2777'];
const colorForName = (name: string) =>
  PALETTE[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];

/**
 * Seletor de etiquetas com busca + criação inline. Trabalha por IDs (pra casar
 * com o label_ids da config), sem persistir sozinho — quem salva é o formulário
 * que embrulha este componente. Substitui a lista chapada de chips (que ficava
 * gigante quando o catálogo cresce): aqui você digita pra filtrar, clica pra
 * selecionar e cria uma etiqueta nova na hora se ela ainda não existir.
 */
export default function LabelMultiSelect({
  labels,
  selectedIds,
  onChange,
  onLabelCreated,
  disabled = false,
}: LabelMultiSelectProps) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  // Etiquetas criadas inline nesta sessão. O catálogo do pai (labels) só recarrega
  // de forma assíncrona, então guardamos a recém-criada aqui pra o chip aparecer NA
  // HORA — senão o id selecionado não resolve pra nenhum nome/cor e a etiqueta
  // "some" da tela até o catálogo voltar.
  const [extra, setExtra] = useState<Label[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Catálogo efetivo = o do pai + as criadas inline (dedup por id, o pai vence).
  const catalog = useMemo(() => {
    const map = new Map<string, Label>();
    [...extra, ...labels].forEach(l => map.set(l.id, l));
    return Array.from(map.values());
  }, [labels, extra]);

  const byId = useMemo(() => new Map(catalog.map(l => [l.id, l])), [catalog]);
  const selected = selectedIds.map(id => byId.get(id)).filter(Boolean) as Label[];

  const q = query.trim().toLowerCase();
  const suggestions = useMemo(
    () =>
      catalog
        .filter(l => !selectedIds.includes(l.id))
        .filter(l => (q ? l.title?.toLowerCase().includes(q) : true))
        .slice(0, 30),
    [catalog, selectedIds, q],
  );

  // Só oferece "criar" quando o texto digitado não bate exatamente com nenhuma etiqueta.
  const exactMatch = q.length > 0 && catalog.some(l => l.title?.toLowerCase() === q);
  const canCreate = q.length > 0 && !exactMatch;

  const add = (id: string) => {
    if (!selectedIds.includes(id)) onChange([...selectedIds, id]);
    setQuery('');
    inputRef.current?.focus();
  };

  const remove = (id: string) => onChange(selectedIds.filter(x => x !== id));

  const createAndAdd = async () => {
    const title = query.trim();
    if (!title || creating) return;

    // Se já existe (case-insensitive), só seleciona — não duplica.
    const existing = catalog.find(l => l.title?.toLowerCase() === title.toLowerCase());
    if (existing) {
      add(existing.id);
      return;
    }

    setCreating(true);
    try {
      const created = await labelsService.createLabel({ title, color: colorForName(title), show_on_sidebar: true });
      const lbl = (created as { data?: Label })?.data ?? (created as unknown as Label);
      if (lbl?.id) {
        setExtra(prev => [...prev, lbl]); // aparece na hora, sem esperar o catálogo recarregar
        onLabelCreated?.(lbl);
        onChange([...selectedIds, lbl.id]);
      }
      setQuery('');
      inputRef.current?.focus();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao criar etiqueta'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mt-1 space-y-2">
      {/* Etiquetas selecionadas */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(l => (
            <span
              key={l.id}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: `${l.color || '#7c3aed'}22`, color: l.color || '#7c3aed' }}
            >
              {l.title}
              <button
                type="button"
                onClick={() => remove(l.id)}
                disabled={disabled}
                className="hover:opacity-70 disabled:opacity-40"
                aria-label={`Remover ${l.title}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Busca + criar */}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (canCreate) void createAndAdd();
              else if (suggestions.length === 1) add(suggestions[0].id);
            }
          }}
          placeholder="Buscar ou criar etiqueta..."
          disabled={disabled || creating}
          className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        />
        {canCreate && (
          <button
            type="button"
            onClick={() => void createAndAdd()}
            disabled={disabled || creating}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md bg-primary px-2 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-3 w-3" /> {creating ? 'Criando...' : `Criar "${query.trim()}"`}
          </button>
        )}
      </div>

      {/* Sugestões filtradas do catálogo */}
      {suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map(l => (
            <button
              key={l.id}
              type="button"
              onClick={() => add(l.id)}
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
              style={{ borderColor: `${l.color || '#7c3aed'}66` }}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color || '#7c3aed' }} />
              {l.title}
            </button>
          ))}
        </div>
      ) : (
        !canCreate && (
          <p className="text-xs text-muted-foreground">
            {q ? 'Nenhuma etiqueta encontrada.' : 'Digite pra buscar ou criar uma etiqueta.'}
          </p>
        )
      )}
    </div>
  );
}
