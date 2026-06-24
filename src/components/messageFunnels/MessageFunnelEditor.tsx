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
} from '@evoapi/design-system';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type {
  MessageFunnel,
  MessageFunnelItem,
  FunnelPayload,
  TemplateVariable,
} from '@/types/messageFunnels';
import { messageFunnelsService, tenantTemplateVariablesService } from '@/services/messageFunnels/messageFunnelsService';
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
    pendingFile: null,
  };
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  funnel?: MessageFunnel;            // undefined → criar; preenchido → editar
  onSaved?: (funnel: MessageFunnel) => void;
}

// ── Componente ───────────────────────────────────────────────────────────────

export default function MessageFunnelEditor({ open, onClose, funnel, onSaved }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [items, setItems] = useState<SequenceDraftItem[]>([newSequenceItem()]);
  const [saving, setSaving] = useState(false);
  const [variables, setVariables] = useState<TemplateVariable[]>([]);

  // Carrega vars do tenant (built-in + custom) só uma vez ao abrir
  useEffect(() => {
    if (!open) return;
    tenantTemplateVariablesService
      .list()
      .then(res => {
        const all: TemplateVariable[] = [
          ...res.builtin,
          ...res.custom.map(v => ({
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
      setItems(
        funnel.items.length > 0
          ? funnel.items.map(draftFromServerItem)
          : [newSequenceItem()],
      );
    } else {
      setName('');
      setDescription('');
      setActive(true);
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
      if (it.kind !== 'text' && !it.media_url && !it.pendingFile) {
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
        items: items.map((it, idx) => ({
          position: idx,
          kind: it.kind,
          text_content: it.text_content,
          media_caption: it.media_caption,
          media_filename: it.media_filename,
          delay_seconds: it.delay_seconds,
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
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? e?.message ?? 'Falha ao salvar';
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
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={active}
                onChange={e => setActive(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <span className="text-sm">Funil ativo (aparece pro atendente no chat)</span>
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
