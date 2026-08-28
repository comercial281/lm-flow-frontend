import { useState, useEffect, useCallback, type MouseEvent } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
} from '@/components/ui/ds';
import {
  Rocket, Search, Plus, Edit2, Trash2, Type, Mic, Image as ImageIcon,
  Video, FileText, Pause, Archive, ArchiveRestore, Clock, Contact as ContactIcon, Sticker, Folder, FolderPlus, Pencil, Tag,
} from 'lucide-react';
import EmptyState from '@/components/base/EmptyState';
import MessageFunnelEditor from '@/components/messageFunnels/MessageFunnelEditor';
import {
  messageFunnelsService,
  messageFunnelFoldersService,
  messageFunnelTagsService,
} from '@/services/messageFunnels/messageFunnelsService';
import type { MessageFunnel, FunnelItemKind, MessageFunnelFolder, MessageFunnelTag } from '@/types/messageFunnels';

// Paleta das etiquetas. Fixa de propósito: seletor de cor livre produz etiqueta
// ilegível no tema escuro e ninguém percebe até o cliente reclamar.
const CORES_DE_ETIQUETA = ['#2563eb', '#16a34a', '#ca8a04', '#dc2626', '#9333ea', '#0891b2'] as const;

const KIND_ICONS: Record<FunnelItemKind, typeof Type> = {
  text: Type, audio: Mic, image: ImageIcon, video: Video, document: FileText, delay: Clock,
  contact: ContactIcon, sticker: Sticker,
};
const KIND_COLORS: Record<FunnelItemKind, string> = {
  text: '#7c3aed', audio: '#00a884', image: '#3b82f6', video: '#f43f5e', document: '#f97316', delay: '#64748b',
  contact: '#0891b2', sticker: '#f59e0b',
};

export default function MessageFunnels() {
  const [funnels, setFunnels] = useState<MessageFunnel[]>([]);
  const [folders, setFolders] = useState<MessageFunnelFolder[]>([]);

  // Etiqueta é FILTRO (o funil pode ter várias), pasta é LUGAR (entra numa só).
  // Por isso a etiqueta filtra a lista em vez de navegar, e o filtro é aplicado
  // pelo BACKEND — `tag_id` já existe no controller, não é filtro de tela.
  const [tags, setTags] = useState<MessageFunnelTag[]>([]);
  const [tagId, setTagId] = useState<string | null>(null);
  const [gerenciandoTags, setGerenciandoTags] = useState(false);
  // undefined = mostrando a grade de pastas; null = "Sem pasta"; string = dentro de uma pasta.
  const [folderId, setFolderId] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<MessageFunnel | null>(null);
  const [toDelete, setToDelete] = useState<MessageFunnel | null>(null);

  // Pastas: criar, renomear e excluir usavam window.prompt/confirm — as caixinhas
  // do navegador, que congelam a aba, ignoram o tema e mostram o endereço do site
  // no cabeçalho. Esta MESMA página já sabia fazer melhor: o "Excluir funil" logo
  // abaixo já é Dialog do design system. Agora as pastas usam o mesmo.
  const [pastaEmEdicao, setPastaEmEdicao] = useState<MessageFunnelFolder | 'nova' | null>(null);
  const [nomeDaPasta, setNomeDaPasta] = useState('');
  const [salvandoPasta, setSalvandoPasta] = useState(false);
  const [pastaParaExcluir, setPastaParaExcluir] = useState<MessageFunnelFolder | null>(null);
  const [excluindoPasta, setExcluindoPasta] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, fldrs] = await Promise.all([
        messageFunnelsService.list({
          ...(folderId !== undefined ? { folderId } : {}),
          ...(tagId ? { tagId } : {}),
        }),
        messageFunnelFoldersService.list(),
      ]);
      setFunnels(list);
      setFolders(fldrs);
    } catch {
      toast.error('Erro ao carregar funis');
    } finally {
      setLoading(false);
    }
  }, [folderId, tagId]);

  // Etiquetas carregam à parte, e o erro NÃO derruba a página: se este endpoint
  // falhar, a lista de funis continua funcionando exatamente como antes — a
  // barra de etiquetas simplesmente não aparece. Funcionalidade nova não pode
  // quebrar o que já funcionava.
  const carregarTags = useCallback(async () => {
    try {
      setTags(await messageFunnelTagsService.list());
    } catch {
      setTags([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    void carregarTags();
  }, [carregarTags]);

  const filtered = search.trim()
    ? funnels.filter(f =>
        f.name.toLowerCase().includes(search.toLowerCase())
        || (f.description ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : funnels;

  const handleNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  // Novo funil nasce na pasta onde a pessoa está, se estiver dentro de uma —
  // mesma regra do Hub (14/08): "o que for criado dentro dela já nasce nela".
  const pendingFolderId = folderId ?? null;

  const handleEdit = (f: MessageFunnel) => {
    setEditing(f);
    setEditorOpen(true);
  };

  const handleDelete = (f: MessageFunnel) => {
    setToDelete(f);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await messageFunnelsService.destroy(toDelete.id);
      toast.success('Funil removido');
      await load();
      setToDelete(null);
    } catch {
      toast.error('Erro ao remover funil');
    } finally {
      setDeleting(false);
    }
  };

  // Arquivar = active:false (some do chat, fica em Settings). Desarquivar = active:true.
  const handleToggleArchive = async (f: MessageFunnel) => {
    try {
      await messageFunnelsService.update(f.id, { active: !f.active });
      toast.success(f.active ? 'Funil arquivado' : 'Funil reativado');
      await load();
    } catch {
      toast.error('Erro ao arquivar funil');
    }
  };

  // ── Etiquetas ──────────────────────────────────────────────────────────────
  // Mesmo desenho das pastas: Dialog do design system, nunca window.prompt.
  const [tagEmEdicao, setTagEmEdicao] = useState<MessageFunnelTag | 'nova' | null>(null);
  const [nomeDaTag, setNomeDaTag] = useState('');
  const [corDaTag, setCorDaTag] = useState<string>(CORES_DE_ETIQUETA[0]);
  const [salvandoTag, setSalvandoTag] = useState(false);
  const [tagParaExcluir, setTagParaExcluir] = useState<MessageFunnelTag | null>(null);
  const [excluindoTag, setExcluindoTag] = useState(false);

  const abrirNovaTag = () => {
    setNomeDaTag('');
    setCorDaTag(CORES_DE_ETIQUETA[0]);
    setTagEmEdicao('nova');
  };

  const abrirEditarTag = (tag: MessageFunnelTag) => {
    setNomeDaTag(tag.name);
    setCorDaTag(tag.color || CORES_DE_ETIQUETA[0]);
    setTagEmEdicao(tag);
  };

  const nomeDaTagValido = nomeDaTag.trim().length > 0;

  const salvarTag = async () => {
    if (!tagEmEdicao || !nomeDaTagValido) return;
    const nome = nomeDaTag.trim();
    setSalvandoTag(true);
    try {
      if (tagEmEdicao === 'nova') {
        await messageFunnelTagsService.create({ name: nome, color: corDaTag });
        toast.success('Etiqueta criada');
      } else {
        await messageFunnelTagsService.update(tagEmEdicao.id, { name: nome, color: corDaTag });
        toast.success('Etiqueta salva');
      }
      setTagEmEdicao(null);
      await carregarTags();
      load();
    } catch {
      toast.error('Erro ao salvar etiqueta');
    } finally {
      setSalvandoTag(false);
    }
  };

  const confirmarExcluirTag = async () => {
    if (!tagParaExcluir) return;
    setExcluindoTag(true);
    try {
      await messageFunnelTagsService.destroy(tagParaExcluir.id);
      toast.success('Etiqueta excluída');
      // Se a etiqueta excluída era o filtro ativo, volta pra lista inteira —
      // senão a tela ficaria filtrando por algo que não existe mais.
      if (tagId === tagParaExcluir.id) setTagId(null);
      setTagParaExcluir(null);
      await carregarTags();
      load();
    } catch {
      toast.error('Erro ao excluir etiqueta');
    } finally {
      setExcluindoTag(false);
    }
  };

  const abrirNovaPasta = () => {
    setNomeDaPasta('');
    setPastaEmEdicao('nova');
  };

  const abrirRenomearPasta = (f: MessageFunnelFolder, ev: MouseEvent) => {
    ev.stopPropagation();
    setNomeDaPasta(f.name);
    setPastaEmEdicao(f);
  };

  const abrirExcluirPasta = (f: MessageFunnelFolder, ev: MouseEvent) => {
    ev.stopPropagation();
    setPastaParaExcluir(f);
  };

  const nomeDaPastaValido =
    nomeDaPasta.trim().length > 0 &&
    !(pastaEmEdicao !== 'nova' && nomeDaPasta.trim() === pastaEmEdicao?.name);

  const salvarPasta = async () => {
    if (!pastaEmEdicao || !nomeDaPastaValido) return;
    const nome = nomeDaPasta.trim();
    setSalvandoPasta(true);
    try {
      if (pastaEmEdicao === 'nova') {
        await messageFunnelFoldersService.create({ name: nome });
        toast.success('Pasta criada');
      } else {
        await messageFunnelFoldersService.update(pastaEmEdicao.id, { name: nome });
        toast.success('Pasta renomeada');
      }
      setPastaEmEdicao(null);
      load();
    } catch {
      toast.error(pastaEmEdicao === 'nova' ? 'Erro ao criar pasta' : 'Erro ao renomear pasta');
    } finally {
      setSalvandoPasta(false);
    }
  };

  const confirmarExcluirPasta = async () => {
    if (!pastaParaExcluir) return;
    setExcluindoPasta(true);
    try {
      await messageFunnelFoldersService.destroy(pastaParaExcluir.id);
      toast.success('Pasta excluída');
      setPastaParaExcluir(null);
      load();
    } catch {
      toast.error('Erro ao excluir pasta');
    } finally {
      setExcluindoPasta(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Rocket className="text-primary" size={22} />
            Funis de Mensagem
            <span className="text-sm font-normal text-muted-foreground">({filtered.length})</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sequências multi-step (texto + áudio + foto + vídeo) que o atendente dispara com 1 clique no chat.
          </p>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus size={16} /> Novo Funil
        </Button>
      </div>

      {/* Busca */}
      <div className="relative mb-4 max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou descrição..."
          className="pl-9"
        />
      </div>

      {/* Etiquetas — FILTRO (fica na lista), ao contrário da pasta, que é LUGAR
          (entra). O filtro é do backend (`tag_id` no controller), não da tela. */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {tags.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setTagId(null)}
              aria-pressed={tagId === null}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                tagId === null
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
              }`}
            >
              Todas
            </button>
            {tags.map(tag => {
              const ativa = tagId === tag.id;
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => setTagId(ativa ? null : tag.id)}
                  aria-pressed={ativa}
                  className="rounded-full border px-2.5 py-1 text-xs transition-colors"
                  style={
                    ativa
                      ? { backgroundColor: tag.color, borderColor: tag.color, color: '#fff' }
                      : { borderColor: tag.color, color: tag.color }
                  }
                  title={`${tag.usage_count} ${tag.usage_count === 1 ? 'funil' : 'funis'}`}
                >
                  {tag.name}
                </button>
              );
            })}
          </>
        )}
        <button
          type="button"
          onClick={() => setGerenciandoTags(true)}
          className="flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Tag className="h-3 w-3" /> {tags.length > 0 ? 'Etiquetas' : 'Criar etiqueta'}
        </button>
      </div>

      {/* Pastas — pasta é LUGAR (entra), não filtro (mesma regra do Hub, 14/08) */}
      {folderId === undefined && !search.trim() && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
          {folders.map(f => (
            <div key={f.id} className="group relative flex items-center gap-2 rounded-lg border border-border p-3 hover:border-primary transition-colors">
              <button onClick={() => setFolderId(f.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                <Folder className="h-4 w-4 shrink-0" style={{ color: f.color }} />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{f.name}</div>
                  <div className="text-xs text-muted-foreground">{f.funnels_count} itens · {f.enabled_count} ativos</div>
                </div>
              </button>
              <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                <button onClick={ev => abrirRenomearPasta(f, ev)} title="Renomear" className="p-1 rounded hover:bg-accent">
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </button>
                <button onClick={ev => abrirExcluirPasta(f, ev)} title="Excluir pasta" className="p-1 rounded hover:bg-accent">
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={abrirNovaPasta}
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <FolderPlus className="h-4 w-4" /> Nova pasta
          </button>
        </div>
      )}
      {folderId !== undefined && (
        <button onClick={() => setFolderId(undefined)} className="text-xs text-muted-foreground hover:text-foreground mb-3 self-start">
          ← Voltar pras pastas
        </button>
      )}

      {/* Lista */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Rocket}
            title="Nenhum funil de mensagem"
            description="Crie funis pra disparar sequências (texto + áudio + mídia) no chat com 1 clique."
            action={{ label: 'Novo Funil', onClick: handleNew }}
            className="h-full"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(funnel => (
              <FunnelCard
                key={funnel.id}
                funnel={funnel}
                tags={tags}
                onEdit={() => handleEdit(funnel)}
                onDelete={() => handleDelete(funnel)}
                onToggleArchive={() => handleToggleArchive(funnel)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Editor */}
      <MessageFunnelEditor
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditing(null); }}
        funnel={editing ?? undefined}
        onSaved={() => load()}
        defaultFolderId={pendingFolderId}
      />

      {/* Etiquetas: lista e gerenciamento */}
      <Dialog open={gerenciandoTags} onOpenChange={setGerenciandoTags}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Etiquetas</DialogTitle>
            <DialogDescription>
              Etiqueta é filtro: um funil pode ter várias, e elas não o tiram da pasta.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 max-h-72 overflow-auto">
            {tags.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">Nenhuma etiqueta ainda.</p>
            )}
            {tags.map(tag => (
              <div key={tag.id} className="flex items-center gap-2 rounded-md border border-border p-2">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{tag.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {tag.usage_count} {tag.usage_count === 1 ? 'funil' : 'funis'}
                  </div>
                </div>
                <button onClick={() => abrirEditarTag(tag)} title="Editar" className="p-1 rounded hover:bg-accent">
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </button>
                <button onClick={() => setTagParaExcluir(tag)} title="Excluir etiqueta" className="p-1 rounded hover:bg-accent">
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGerenciandoTags(false)}>Fechar</Button>
            <Button onClick={abrirNovaTag}>Nova etiqueta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Etiqueta: criar e editar — mesmo Dialog, dois modos */}
      <Dialog open={!!tagEmEdicao} onOpenChange={open => !open && setTagEmEdicao(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tagEmEdicao === 'nova' ? 'Nova etiqueta' : 'Editar etiqueta'}</DialogTitle>
            <DialogDescription>Nome e cor. A cor aparece no filtro e no card do funil.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={nomeDaTag}
            onChange={e => setNomeDaTag(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && nomeDaTagValido && !salvandoTag) void salvarTag(); }}
            placeholder="Nome da etiqueta"
          />
          <div className="flex flex-wrap gap-2 pt-1" role="radiogroup" aria-label="Cor da etiqueta">
            {CORES_DE_ETIQUETA.map(cor => (
              <button
                key={cor}
                type="button"
                role="radio"
                aria-checked={corDaTag === cor}
                aria-label={`Cor ${cor}`}
                onClick={() => setCorDaTag(cor)}
                className={`h-6 w-6 rounded-full border-2 transition-transform ${
                  corDaTag === cor ? 'border-foreground scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: cor }}
              />
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagEmEdicao(null)} disabled={salvandoTag}>
              Cancelar
            </Button>
            <Button onClick={() => void salvarTag()} disabled={!nomeDaTagValido || salvandoTag}>
              {salvandoTag ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Etiqueta: excluir */}
      <Dialog open={!!tagParaExcluir} onOpenChange={open => !open && setTagParaExcluir(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir etiqueta</DialogTitle>
            <DialogDescription>
              Excluir <strong>{tagParaExcluir?.name}</strong>? Ela some de{' '}
              {tagParaExcluir?.usage_count ?? 0}{' '}
              {(tagParaExcluir?.usage_count ?? 0) === 1 ? 'funil' : 'funis'} — nenhum funil é apagado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagParaExcluir(null)} disabled={excluindoTag}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void confirmarExcluirTag()} disabled={excluindoTag}>
              {excluindoTag ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pasta: criar e renomear — mesmo Dialog, dois modos */}
      <Dialog open={!!pastaEmEdicao} onOpenChange={open => !open && setPastaEmEdicao(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pastaEmEdicao === 'nova' ? 'Nova pasta' : 'Renomear pasta'}</DialogTitle>
            <DialogDescription>
              Pasta é lugar, não filtro: os funis ficam dentro dela.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={nomeDaPasta}
            onChange={e => setNomeDaPasta(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && nomeDaPastaValido && !salvandoPasta) void salvarPasta(); }}
            placeholder="Nome da pasta"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPastaEmEdicao(null)} disabled={salvandoPasta}>
              Cancelar
            </Button>
            <Button onClick={() => void salvarPasta()} disabled={!nomeDaPastaValido || salvandoPasta}>
              {salvandoPasta ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pasta: excluir */}
      <Dialog open={!!pastaParaExcluir} onOpenChange={open => !open && setPastaParaExcluir(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir pasta</DialogTitle>
            <DialogDescription>
              Excluir a pasta <strong>{pastaParaExcluir?.name}</strong>? Os{' '}
              {pastaParaExcluir?.funnels_count ?? 0} funis de dentro voltam pra &ldquo;Sem pasta&rdquo; —
              nenhum funil é apagado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPastaParaExcluir(null)} disabled={excluindoPasta}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void confirmarExcluirPasta()} disabled={excluindoPasta}>
              {excluindoPasta ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!toDelete} onOpenChange={open => !open && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir funil</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{toDelete?.name}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

interface FunnelCardProps {
  funnel: MessageFunnel;
  /** Catálogo inteiro. O funil só traz `tag_ids`; o nome e a cor moram aqui. */
  tags: MessageFunnelTag[];
  onEdit: () => void;
  onDelete: () => void;
  onToggleArchive: () => void;
}

function FunnelCard({ funnel, tags, onEdit, onDelete, onToggleArchive }: FunnelCardProps) {
  const etiquetas = tags.filter(t => funnel.tag_ids?.includes(t.id));
  return (
    <div className="border border-border rounded-lg p-4 hover:border-primary/40 transition-colors flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Rocket size={12} className="text-primary shrink-0" />
            <span className="font-semibold text-sm truncate">{funnel.name}</span>
            {!funnel.active && (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-0.5">
                <Pause size={10} /> pausado
              </span>
            )}
          </div>
          {funnel.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{funnel.description}</p>
          )}
          {etiquetas.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {etiquetas.map(tag => (
                <span
                  key={tag.id}
                  className="rounded-full border px-1.5 py-0.5 text-[10px] leading-none"
                  style={{ borderColor: tag.color, color: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} aria-label="Editar">
            <Edit2 size={13} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onToggleArchive}
            aria-label={funnel.active ? 'Arquivar' : 'Reativar'}
            title={funnel.active ? 'Arquivar (some do chat)' : 'Reativar'}
          >
            {funnel.active ? <Archive size={13} /> : <ArchiveRestore size={13} />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete} aria-label="Excluir">
            <Trash2 size={13} />
          </Button>
        </div>
      </div>

      {/* Items preview */}
      <div className="flex items-center gap-1 flex-wrap">
        {funnel.items.slice(0, 10).map(item => {
          const Icon = KIND_ICONS[item.kind];
          const color = KIND_COLORS[item.kind];
          return (
            <span
              key={item.id}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs"
              style={{ background: color + '15', color }}
              title={item.text_content?.slice(0, 60) ?? item.media_filename ?? item.kind}
            >
              <Icon size={10} />
              {item.delay_seconds > 0 && <span>·{item.delay_seconds}s</span>}
            </span>
          );
        })}
        {funnel.items.length > 10 && (
          <span className="text-xs text-muted-foreground">+{funnel.items.length - 10}</span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
        <span>{funnel.items.length} {funnel.items.length === 1 ? 'item' : 'items'}</span>
        {funnel.usage_count > 0 && <span>usado {funnel.usage_count}×</span>}
      </div>
    </div>
  );
}
