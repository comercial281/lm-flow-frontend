import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { contactsService } from '@/services/contacts/contactsService';
import { labelsService } from '@/services/contacts/labelsService';
import chatService from '@/services/chat/chatService';
import type { Label } from '@/types/settings';

interface ContactTagsManagerProps {
  contactId: string;
  conversationId?: string;
  /** Labels atuais do contato (mesmas que aparecem no card do kanban). */
  initialLabels?: Array<{ name?: string; title?: string; color?: string }> | string[];
  onUpdated?: () => void;
}

// Paleta da identidade (obsidiana/violeta) pra tags novas sem cor definida.
const PALETTE = ['#7c3aed', '#9333ea', '#2563eb', '#0891b2', '#16a34a', '#d97706', '#dc2626', '#db2777'];
const colorForName = (name: string) =>
  PALETTE[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];

const normalizeNames = (labels: ContactTagsManagerProps['initialLabels']): string[] => {
  if (!Array.isArray(labels)) return [];
  return labels
    .map(l => (typeof l === 'string' ? l : l?.name || l?.title || ''))
    .map(s => s.trim())
    .filter(Boolean);
};

/**
 * Gerencia as tags do CONTATO (ver/adicionar/criar/remover) — as mesmas globais
 * que aparecem no card do kanban (contact.labels). Espelha na conversa quando há
 * uma, pra manter o chat em sincronia (igual a automação faz).
 */
export default function ContactTagsManager({
  contactId,
  conversationId,
  initialLabels,
  onUpdated,
}: ContactTagsManagerProps) {
  const [tags, setTags] = useState<string[]>(normalizeNames(initialLabels));
  const [catalog, setCatalog] = useState<Label[]>([]);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const datalistId = useRef(`tags-${Math.abs([...contactId].reduce((a, c) => a + c.charCodeAt(0), 0))}`).current;

  // Catálogo global de tags (nome + cor) pra sugerir e dar cor à tag.
  useEffect(() => {
    labelsService
      .getLabels()
      .then(res => setCatalog((res?.data as Label[]) || []))
      .catch(() => {
        /* catálogo é só enriquecimento (sugestões/cor) */
      });
  }, []);

  const colorOf = (name: string) =>
    catalog.find(l => l.title?.toLowerCase() === name.toLowerCase())?.color || colorForName(name);

  // Sugestões do catálogo ainda não aplicadas.
  const suggestions = useMemo(
    () => catalog.filter(l => l.title && !tags.some(t => t.toLowerCase() === l.title.toLowerCase())),
    [catalog, tags],
  );

  const persist = async (next: string[], changed: string, action: 'add' | 'remove') => {
    const prev = tags;
    setTags(next);
    setSaving(true);
    try {
      // Contato = o que o card lê (fonte de verdade do badge).
      await contactsService.updateContact(contactId, { labels: next } as never);
      // Espelha na conversa (chat) quando existir.
      if (conversationId) {
        if (action === 'add') await chatService.addLabels(conversationId, [changed]);
        else await chatService.removeLabels(conversationId, [changed]);
      }
      onUpdated?.();
    } catch {
      setTags(prev);
      toast.error('Erro ao salvar a tag');
    } finally {
      setSaving(false);
    }
  };

  const addTag = async (raw: string) => {
    const name = raw.trim();
    if (!name || tags.some(t => t.toLowerCase() === name.toLowerCase())) {
      setInput('');
      return;
    }
    setInput('');
    // Tag nova (fora do catálogo) → cria no catálogo com cor (pro card mostrar a cor).
    const exists = catalog.some(l => l.title?.toLowerCase() === name.toLowerCase());
    if (!exists) {
      try {
        const created = await labelsService.createLabel({ title: name, color: colorForName(name) });
        const lbl = (created as { data?: Label })?.data || (created as unknown as Label);
        if (lbl?.title) setCatalog(c => [...c, lbl]);
      } catch {
        /* se já existir ou falhar o catálogo, segue aplicando a tag mesmo assim */
      }
    }
    await persist([...tags, name], name, 'add');
  };

  const removeTag = async (name: string) => {
    await persist(
      tags.filter(t => t !== name),
      name,
      'remove',
    );
  };

  return (
    <div className="space-y-3">
      {/* Tags aplicadas */}
      <div className="flex flex-wrap gap-1.5">
        {tags.length === 0 && (
          <span className="text-xs text-muted-foreground">Nenhuma tag</span>
        )}
        {tags.map(name => {
          const color = colorOf(name);
          return (
            <span
              key={name}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: `${color}22`, color }}
            >
              {name}
              <button
                type="button"
                onClick={() => removeTag(name)}
                disabled={saving}
                className="hover:opacity-70 disabled:opacity-40"
                aria-label={`Remover ${name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
      </div>

      {/* Adicionar / criar */}
      <div className="flex items-center gap-2">
        <input
          list={datalistId}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void addTag(input);
            }
          }}
          placeholder="Adicionar ou criar tag..."
          disabled={saving}
          className="flex-1 h-8 rounded-md border border-border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        />
        <datalist id={datalistId}>
          {suggestions.map(l => (
            <option key={l.id} value={l.title} />
          ))}
        </datalist>
        <button
          type="button"
          onClick={() => void addTag(input)}
          disabled={saving || !input.trim()}
          className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-2 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-3 w-3" /> Adicionar
        </button>
      </div>

      {/* Sugestões rápidas do catálogo */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.slice(0, 8).map(l => (
            <button
              key={l.id}
              type="button"
              onClick={() => void addTag(l.title)}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
              style={{ borderColor: `${l.color || '#7c3aed'}66` }}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color || '#7c3aed' }} />
              {l.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
