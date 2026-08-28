import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label as UILabel,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/ds';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type {
  MessageFunnel,
  MessageFunnelItem,
  MessageFunnelFolder,
  MessageFunnelTag,
  FunnelPayload,
  TemplateVariable,
} from '@/types/messageFunnels';
import {
  messageFunnelsService,
  tenantTemplateVariablesService,
  messageFunnelFoldersService,
  messageFunnelTagsService,
} from '@/services/messageFunnels/messageFunnelsService';
import MessageSequenceEditor, {
  type SequenceDraftItem,
  newSequenceItem,
} from '@/components/messaging/MessageSequenceEditor';

// ── Helpers ──────────────────────────────────────────────────────────────────

function draftFromServerItem(item: MessageFunnelItem): SequenceDraftItem {
  return {
    uiKey: item.id,
    serverItemId: item.id,
    kind: item.kind,
    text_content: item.text_content,
    media_url: item.media_url,
    media_filename: item.media_filename,
    media_caption: item.media_caption,
    delay_seconds: item.delay_seconds,
    config: item.config || {},
    pendingFile: null,
  };
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  funnel?: MessageFunnel;            // undefined → criar; preenchido → editar
  onSaved?: (funnel: MessageFunnel) => void;
  /** Pasta ativa na tela de origem — um funil novo nasce nela (mesma regra
   *  do Hub: "o que for criado dentro dela já nasce nela"). */
  defaultFolderId?: string | null;
}

// ── Componente ───────────────────────────────────────────────────────────────

export default function MessageFunnelEditor({ open, onClose, funnel, onSaved, defaultFolderId = null }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [humanize, setHumanize] = useState(true);
  const [items, setItems] = useState<SequenceDraftItem[]>([newSequenceItem()]);
  const [saving, setSaving] = useState(false);
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [folders, setFolders] = useState<MessageFunnelFolder[]>([]);
  const [tags, setTags] = useState<MessageFunnelTag[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    messageFunnelFoldersService.list().then(setFolders).catch(() => setFolders([]));
    messageFunnelTagsService.list().then(setTags).catch(() => setTags([]));
  }, [open]);

  // Carrega vars do tenant (built-in + custom manual) só uma vez ao abrir.
  // Fica de fora a custom AUTO-CRIADA de campo de formulário (auto_created):
  // pedido do Giovani (19/08/2026) — cada formulário novo cria uma variável
  // sozinho e a lista de sugestão do funil virava dezenas de itens ilegíveis.
  // A variável auto-criada continua existindo e funcionando se alguém já
  // tiver usado; só para de ser oferecida como chip aqui.
  useEffect(() => {
    if (!open) return;
    tenantTemplateVariablesService
      .list()
      .then(res => {
        const all: TemplateVariable[] = [
          ...res.builtin,
          ...res.custom
            .filter(v => !v.auto_created)
            .map(v => ({
              token: v.token,
              placeholder: v.placeholder,
              label: v.label,
              description: v.description,
              builtin: false,
            })),
        ];
        setVariables(all);
      })
      .catch(() => {
        // fallback: só built-in hard-coded se o endpoint quebrar
        setVariables([
          { token: 'nome', placeholder: '{{nome}}', label: 'Nome', builtin: true },
          { token: 'telefone', placeholder: '{{telefone}}', label: 'Telefone', builtin: true },
          { token: 'email', placeholder: '{{email}}', label: 'E-mail', builtin: true },
        ]);
      });
  }, [open]);

  // Reset form quando abre / troca de funnel editado
  useEffect(() => {
    if (!open) return;
    if (funnel) {
      setName(funnel.name);
      setDescription(funnel.description ?? '');
      setActive(funnel.active);
      setFolderId(funnel.folder_id ?? null);
      setTagIds(funnel.tag_ids ?? []);
      setHumanize(funnel.humanize ?? true);
      setItems(
        funnel.items.length > 0
          ? funnel.items.map(draftFromServerItem)
          : [newSequenceItem()],
      );
    } else {
      setName('');
      setDescription('');
      setActive(true);
      setFolderId(defaultFolderId);
      setTagIds([]);
      setHumanize(true);
      setItems([newSequenceItem()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, funnel?.id]);

  // ── Validate + Save ───────────────────────────────────────────────────────

  function validate(): string | null {
    if (!name.trim()) return 'Dê um nome ao funil.';
    if (items.length === 0) return 'Adicione pelo menos 1 item.';
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'delay') continue; // item de espera não precisa de conteúdo
      if (it.kind === 'text' && !(it.text_content ?? '').trim()) {
        return `Item ${i + 1}: texto vazio.`;
      }
      if (it.kind === 'contact' && !(it.config.contact_phone as string | undefined)?.trim()) {
        return `Item ${i + 1}: telefone do contato não preenchido.`;
      }
      if (it.kind !== 'text' && it.kind !== 'contact' && !it.media_url && !it.pendingFile) {
        return `Item ${i + 1}: mídia não anexada.`;
      }
    }
    return null;
  }

  async function handleSave() {
    const err = validate();
    if (err) { toast.error(err); return; }

    setSaving(true);
    try {
      const payload: FunnelPayload = {
        name: name.trim(),
        description: description.trim() || null,
        category: 'geral',
        active,
        shared: true,
        folder_id: folderId,
        tag_ids: tagIds,
        humanize,
        items: items.map((it, idx) => ({
          // Manda o id do item existente pro backend fazer upsert e PRESERVAR a
          // mídia já anexada (antes o update apagava a mídia de quem não foi reanexado).
          ...(it.serverItemId ? { id: it.serverItemId } : {}),
          position: idx,
          kind: it.kind,
          text_content: it.text_content,
          media_caption: it.media_caption,
          media_filename: it.media_filename,
          delay_seconds: it.delay_seconds,
          config: it.config,
        })),
      };

      const saved = funnel
        ? await messageFunnelsService.update(funnel.id, payload)
        : await messageFunnelsService.create(payload);

      // Após salvar, sobe arquivos pendentes (cada um vincula ao item via id retornado).
      // O backend ordena items por position — alinhamos pela mesma ordem do array.
      const itemsPendentes = items
        .map((it, idx) => ({ draft: it, serverItem: saved.items[idx] }))
        .filter(p => p.draft.pendingFile && p.serverItem);

      for (const { draft, serverItem } of itemsPendentes) {
        await messageFunnelsService.uploadItemMedia(saved.id, serverItem.id, draft.pendingFile!);
      }

      // Re-fetch pra trazer media_url dos uploads
      const refreshed = itemsPendentes.length > 0
        ? await messageFunnelsService.get(saved.id)
        : saved;

      toast.success(funnel ? 'Funil atualizado' : 'Funil criado');
      onSaved?.(refreshed);
      onClose();
    } catch (e: unknown) {
      const comoErroDaApi = e as { response?: { data?: { error?: { message?: string } } }; message?: string };
      const msg =
        comoErroDaApi?.response?.data?.error?.message ?? comoErroDaApi?.message ?? 'Falha ao salvar';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {funnel ? 'Editar funil' : 'Novo funil de mensagens'}
          </DialogTitle>
          <DialogDescription>
            Sequência multi-step que o atendente dispara com 1 clique no chat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Cabeçalho */}
          <div className="space-y-2">
            <div className="space-y-1.5">
              <UILabel htmlFor="funnel-name">Nome</UILabel>
              <Input
                id="funnel-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Saudação inicial"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <UILabel htmlFor="funnel-desc">Descrição (opcional)</UILabel>
              <Input
                id="funnel-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Quando usar este funil"
                maxLength={2000}
              />
            </div>
            <div className="space-y-1.5">
              <UILabel>Pasta (opcional)</UILabel>
              <Select value={folderId ?? '__none__'} onValueChange={v => setFolderId(v === '__none__' ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem pasta</SelectItem>
                  {folders.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Etiquetas — pasta é LUGAR (o funil fica DENTRO de uma), etiqueta é
                FILTRO (o funil pode ter várias, e elas não o tiram do lugar).
                Mesma regra que a página já seguia pras pastas.

                A lista só aparece quando existe etiqueta cadastrada: sem isso,
                seria um rótulo em cima de um vazio. Quem cria etiqueta é a
                própria página de Funis, no botão "Etiquetas". */}
            {tags.length > 0 && (
              <div className="space-y-1.5">
                <UILabel>Etiquetas (opcional)</UILabel>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(tag => {
                    const marcada = tagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        aria-pressed={marcada}
                        onClick={() =>
                          setTagIds(atuais =>
                            marcada ? atuais.filter(id => id !== tag.id) : [...atuais, tag.id],
                          )
                        }
                        className="rounded-full border px-2.5 py-1 text-xs transition-colors"
                        style={
                          marcada
                            ? { backgroundColor: tag.color, borderColor: tag.color, color: '#fff' }
                            : { borderColor: tag.color, color: tag.color }
                        }
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={active}
                onChange={e => setActive(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <span className="text-sm">Funil ativo (aparece pro atendente no chat)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={humanize}
                onChange={e => setHumanize(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <span className="text-sm">Parece digitado à mão (mostra "digitando…"/"gravando áudio…" antes de cada balão)</span>
            </label>
          </div>

          {/* Itens em sequência (componente único, compartilhado com o Disparo em Massa) */}
          <MessageSequenceEditor
            items={items}
            onChange={setItems}
            variables={variables}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <RefreshCw size={14} className="animate-spin mr-2" />}
            {funnel ? 'Salvar alterações' : 'Criar funil'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
