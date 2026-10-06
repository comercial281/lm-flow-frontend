import { useEffect, useMemo, useRef, useState } from 'react';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { serverRefusalMessageOf } from '@/services/core/forbidden';
import { contactsService } from '@/services/contacts/contactsService';
import { labelsService } from '@/services/contacts/labelsService';
import { useAppDataStore } from '@/store/appDataStore';
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

// Quantas etiquetas do catálogo aparecem de uma vez (a busca filtra o resto).
const MAX_SUGESTOES = 12;

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
  // Catálogo global de tags (nome + cor) pra sugerir e dar cor à tag. Vem do
  // store (cache + uma busca só): o painel do lead remonta a cada contato e não
  // pode pedir o catálogo de novo a cada troca de conversa.
  const catalogoDoStore = useAppDataStore(s => s.labels);
  const fetchLabels = useAppDataStore(s => s.fetchLabels);
  // Tags criadas aqui entram na hora, sem esperar o catálogo recarregar.
  const [criadas, setCriadas] = useState<Label[]>([]);
  const catalog = useMemo(
    () => [
      ...catalogoDoStore,
      ...criadas.filter(c => !catalogoDoStore.some(l => l.title?.toLowerCase() === c.title?.toLowerCase())),
    ],
    [catalogoDoStore, criadas],
  );
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  // O catálogo da conta só abre no "+ Etiqueta": aberto o tempo todo, parecia que o
  // lead tinha todas as etiquetas.
  const [catalogoAberto, setCatalogoAberto] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchLabels().catch(() => {
      /* catálogo é só enriquecimento (sugestões/cor) */
    });
  }, [fetchLabels]);

  const colorOf = (name: string) =>
    catalog.find(l => l.title?.toLowerCase() === name.toLowerCase())?.color || colorForName(name);

  // Sugestões do catálogo ainda não aplicadas, filtradas pelo que foi digitado.
  const suggestions = useMemo(() => {
    const busca = input.trim().toLowerCase();
    return catalog.filter(
      l =>
        l.title &&
        !tags.some(t => t.toLowerCase() === l.title.toLowerCase()) &&
        (!busca || l.title.toLowerCase().includes(busca)),
    );
  }, [catalog, tags, input]);

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
    } catch (e) {
      setTags(prev);
      if (serverRefusalMessageOf(e)) return; // o aviso global já mostrou a frase
      toast.error(apiErrorMessage(e, 'Erro ao salvar a etiqueta'));
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
        if (lbl?.title) setCriadas(c => [...c, lbl]);
      } catch {
        /* se já existir ou falhar o catálogo, segue aplicando a tag mesmo assim */
      }
    }
    await persist([...tags, name], name, 'add');
  };

  // Enter na busca: escolhe, não inventa. O nome exato do catálogo (sem diferença
  // de maiúscula) vence; senão, a 1ª sugestão que a pessoa está vendo; só cria
  // quando não há sugestão nenhuma. Criar de propósito é o botão "Criar".
  // ("vis" + Enter criava a etiqueta "vis" na conta inteira.)
  const aoApertarEnter = () => {
    const busca = input.trim().toLowerCase();
    if (!busca) return;
    const exata = catalog.find(l => l.title?.toLowerCase() === busca);
    if (exata) return void addTag(exata.title);
    if (suggestions.length > 0) return void addTag(suggestions[0].title);
    void addTag(input);
  };

  const removeTag = async (name: string) => {
    await persist(
      tags.filter(t => t !== name),
      name,
      'remove',
    );
  };

  useEffect(() => {
    if (catalogoAberto) campo.current?.focus();
  }, [catalogoAberto]);

  return (
    <div className="space-y-2">
      {/* Só as etiquetas do lead, com o ✕ pra tirar, e o "+ Etiqueta" no fim. */}
      <div className="flex flex-wrap items-center gap-1.5">
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
        <button
          type="button"
          onClick={() => setCatalogoAberto(a => !a)}
          aria-expanded={catalogoAberto}
          className="inline-flex items-center rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          + Etiqueta
        </button>
      </div>

      {catalogoAberto && (
        <div className="space-y-2">
          {/* Buscar no catálogo; Enter aplica a exata ou a 1ª sugestão (e só cria sem
              sugestão). Salvando, fica só leitura e não desabilitado: desabilitar
              tira o foco, e a pessoa quer pôr outra ou fechar com Esc. */}
          <input
            ref={campo}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (!saving) aoApertarEnter();
              } else if (e.key === 'Escape') {
                setInput('');
                setCatalogoAberto(false);
              }
            }}
            placeholder="Buscar ou criar etiqueta..."
            aria-label="Buscar ou criar etiqueta"
            readOnly={saving}
            aria-busy={saving}
            className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-primary read-only:opacity-60"
          />

          <div className="flex flex-wrap gap-1.5">
            {suggestions.slice(0, MAX_SUGESTOES).map(l => (
              <button
                key={l.id}
                type="button"
                onClick={() => void addTag(l.title)}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                style={{ borderColor: `${l.color || '#7c3aed'}66` }}
              >
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color || '#7c3aed' }} />
                {l.title}
              </button>
            ))}
            {/* Nada no catálogo com esse nome: Enter (ou este botão) cria a etiqueta. */}
            {input.trim() && !catalog.some(l => l.title?.toLowerCase() === input.trim().toLowerCase()) && (
              <button
                type="button"
                onClick={() => void addTag(input)}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Plus className="h-3 w-3" />
                Criar "{input.trim()}"
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
