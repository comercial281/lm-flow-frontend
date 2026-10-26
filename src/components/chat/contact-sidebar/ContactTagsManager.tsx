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
import { colorForName } from '@/components/labels/labelColors';

interface ContactTagsManagerProps {
  contactId: string;
  conversationId?: string;
  onUpdated?: () => void;
}

// Quantas etiquetas do catálogo aparecem de uma vez (a busca filtra o resto).
const MAX_SUGESTOES = 12;

const mesmaEtiqueta = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Lista única, sem repetir (sem diferença de maiúscula): as do lead primeiro, depois as só da conversa. */
function juntarEtiquetas(doLead: string[], daConversa: string[]): string[] {
  const lista: string[] = [];
  for (const nome of [...doLead, ...daConversa]) {
    if (nome.trim() && !lista.some(n => mesmaEtiqueta(n, nome))) lista.push(nome);
  }
  return lista;
}

/**
 * Etiquetas do lead no painel da conversa (ver/adicionar/criar/remover). Mostra
 * as do CONTATO (as do card do kanban) e as da CONVERSA (as da lista à esquerda)
 * numa lista só. Lê as duas do servidor ao abrir: a conversa que a tela já tem
 * não traz as do contato, e o painel abria sempre vazio (24/10).
 *
 * Adicionar põe nos dois lados. Tirar tira de onde ela estiver. Nada salva antes
 * de carregar: salvar em cima da lista vazia apagava as outras etiquetas do lead
 * (inclusive o marcador do follow-up).
 */
export default function ContactTagsManager({
  contactId,
  conversationId,
  onUpdated,
}: ContactTagsManagerProps) {
  const [doLead, setDoLead] = useState<string[]>([]);
  const [daConversa, setDaConversa] = useState<string[]>([]);
  const [carregou, setCarregou] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const tags = useMemo(() => juntarEtiquetas(doLead, daConversa), [doLead, daConversa]);
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
    let vivo = true;
    setCarregou(false);
    setFalhou(false);
    Promise.all([
      contactsService.getContactLabels(contactId),
      conversationId ? chatService.getConversationLabels(conversationId) : Promise.resolve([] as string[]),
    ])
      .then(([lead, conversa]) => {
        if (!vivo) return;
        setDoLead(lead);
        setDaConversa(conversa);
        setCarregou(true);
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [contactId, conversationId]);

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
        !tags.some(t => mesmaEtiqueta(t, l.title)) &&
        (!busca || l.title.toLowerCase().includes(busca)),
    );
  }, [catalog, tags, input]);

  // Mostra na hora; se o servidor recusar, volta como estava.
  const salvar = async (otimista: { doLead: string[]; daConversa: string[] }, gravar: () => Promise<void>) => {
    const antes = { doLead, daConversa };
    setDoLead(otimista.doLead);
    setDaConversa(otimista.daConversa);
    setSaving(true);
    try {
      await gravar();
      onUpdated?.();
    } catch (e) {
      setDoLead(antes.doLead);
      setDaConversa(antes.daConversa);
      if (serverRefusalMessageOf(e)) return; // o aviso global já mostrou a frase
      toast.error(apiErrorMessage(e, 'Erro ao salvar a etiqueta'));
    } finally {
      setSaving(false);
    }
  };

  const addTag = async (raw: string) => {
    const name = raw.trim();
    if (!carregou || !name || tags.some(t => mesmaEtiqueta(t, name))) {
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
    await salvar(
      {
        doLead: juntarEtiquetas(doLead, [name]),
        daConversa: conversationId ? juntarEtiquetas(daConversa, [name]) : daConversa,
      },
      async () => {
        // Contato = o que o card lê, e ele só salva a lista inteira: relê na hora
        // pra não apagar a que outra coisa (follow-up, automação) pôs depois que
        // o painel abriu. (A porta que só soma pede o cargo de criar lead.)
        const atual = await contactsService.getContactLabels(contactId);
        const lista = juntarEtiquetas(atual, [name]);
        await contactsService.updateContact(contactId, { labels: lista } as never);
        setDoLead(lista);
        if (conversationId) await chatService.addLabels(conversationId, [name]);
      },
    );
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
    if (!carregou) return;
    const naConversa = daConversa.filter(t => mesmaEtiqueta(t, name));
    await salvar(
      {
        doLead: doLead.filter(t => !mesmaEtiqueta(t, name)),
        daConversa: daConversa.filter(t => !mesmaEtiqueta(t, name)),
      },
      async () => {
        if (doLead.some(t => mesmaEtiqueta(t, name))) {
          // Mesma releitura do adicionar.
          const atual = await contactsService.getContactLabels(contactId);
          await contactsService.updateContact(contactId, {
            labels: atual.filter(t => !mesmaEtiqueta(t, name)),
          } as never);
        }
        if (conversationId && naConversa.length) await chatService.removeLabels(conversationId, naConversa);
      },
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
                disabled={saving || !carregou}
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
          disabled={!carregou}
          aria-expanded={catalogoAberto}
          className="inline-flex items-center rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          + Etiqueta
        </button>
      </div>
      {falhou && <p className="text-xs text-muted-foreground">Não deu pra carregar as etiquetas. Abra a conversa de novo.</p>}

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
