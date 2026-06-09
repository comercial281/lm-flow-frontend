import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@evoapi/design-system/card';
import { Button } from '@evoapi/design-system/button';
import {
  Rocket, X, Play, Pause, Type, Mic, Image as ImageIcon, Video, FileText, Search, Loader2, Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { messageFunnelsService, tenantTemplateVariablesService } from '@/services/messageFunnels/messageFunnelsService';
import MessageFunnelEditor from '@/components/messageFunnels/MessageFunnelEditor';
import type {
  MessageFunnel,
  MessageFunnelItem,
  FunnelItemKind,
  TenantTemplateVariable,
} from '@/types/messageFunnels';
import type { Conversation } from '@/types/chat/api';

// Mesma assinatura do MessageInput#onSendMessage — reusamos a pipeline existente do LM Flow
// pra cada step. O backend Rails do LM Flow é quem fala com a Evolution (via attachments
// multipart), evitando o gotcha de "Evolution não consegue baixar URL externa".
interface SendMessageOptions {
  content: string;
  files?: File[];
  isPrivate?: boolean;
  templateParams?: unknown;
  cannedResponseId?: string | null;
}

const KIND_ICONS: Record<FunnelItemKind, typeof Type> = {
  text: Type, audio: Mic, image: ImageIcon, video: Video, document: FileText,
};
const KIND_COLORS: Record<FunnelItemKind, string> = {
  text: '#7c3aed', audio: '#00a884', image: '#3b82f6', video: '#f43f5e', document: '#f97316',
};

// ── Interpolação de variáveis ────────────────────────────────────────────────

function firstName(name?: string | null): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? '';
}

interface ResolveContext {
  conversation?: Conversation | null;
  customVars?: TenantTemplateVariable[];
}

type ContactShape = {
  name?: string;
  phone_number?: string | null;
  email?: string | null;
  custom_attributes?: Record<string, unknown>;
  additional_attributes?: Record<string, unknown>;
};

function getContact(conv: ResolveContext['conversation']): ContactShape | undefined {
  const c = conv as (typeof conv & { contact?: ContactShape }) | null | undefined;
  return c?.contact ?? (c?.meta?.sender as ContactShape | undefined);
}

/**
 * Resolve uma variável customizada (TenantTemplateVariable) pro seu valor real,
 * baseado no `value_source` armazenado pelo super-admin.
 *
 * Caminhos suportados:
 *   contact.email                         → contact.email
 *   contact.phone_number                  → contact.phone_number
 *   contact.name                          → contact.name (nome completo)
 *   contact.custom_attributes.<chave>     → contact.custom_attributes[chave] OU additional_attributes[chave]
 *   literal:<texto>                       → texto (independente do lead)
 *
 * Outros caminhos retornam '' (warn + chip vazio no envio).
 */
function resolveCustom(
  value_source: string,
  conv: ResolveContext['conversation'],
): string {
  if (!value_source) return '';
  if (value_source.startsWith('literal:')) {
    return value_source.slice('literal:'.length);
  }
  const contact = getContact(conv);
  if (!contact) return '';

  if (value_source === 'contact.email') return String(contact.email ?? '');
  if (value_source === 'contact.phone_number') return String(contact.phone_number ?? '');
  if (value_source === 'contact.name') return String(contact.name ?? '');

  if (value_source.startsWith('contact.custom_attributes.')) {
    const key = value_source.slice('contact.custom_attributes.'.length).trim();
    if (!key) return '';
    const fromCustom = contact.custom_attributes?.[key];
    const fromAdditional = contact.additional_attributes?.[key];
    const val = fromCustom ?? fromAdditional ?? '';
    return val == null ? '' : String(val);
  }

  // eslint-disable-next-line no-console
  console.warn(`[funnel] value_source desconhecido: "${value_source}"`);
  return '';
}

/**
 * Substitui placeholders {{token}} pelos valores reais.
 *
 * Ordem de resolução:
 *   1. Built-in fixo ({{nome}}, {{telefone}}, {{email}}, {{pipeline}}, {{estagio}})
 *   2. Custom var do tenant (TenantTemplateVariable.value_source resolvido)
 *   3. Token desconhecido: deixa {{token}} literal + console.warn
 *
 * Caminhos lidos do Conversation (smoke test 2026-06-06 mostrou que `meta.sender`
 * vem vazio enquanto `contact` está populado):
 *   conversation.contact.{name, phone_number, email, custom_attributes/additional_attributes}
 *   conversation.meta.sender.* (fallback)
 *   conversation.pipeline.name        ({{pipeline}})
 *   conversation.pipeline_stage.name  ({{estagio}})
 */
function interpolate(template: string, ctx: ResolveContext): string {
  if (!template) return '';
  const conv = ctx.conversation as (typeof ctx.conversation & {
    pipeline?: { name?: string };
    pipeline_stage?: { name?: string };
  }) | null | undefined;

  const contact = getContact(conv);

  const builtin: Record<string, string> = {
    nome: firstName(contact?.name),
    telefone: String(contact?.phone_number ?? ''),
    email: String(contact?.email ?? ''),
    pipeline: conv?.pipeline?.name ?? '',
    estagio: conv?.pipeline_stage?.name ?? '',
  };

  const customByToken: Record<string, TenantTemplateVariable> = {};
  for (const v of ctx.customVars ?? []) {
    if (v.active) customByToken[v.token.toLowerCase()] = v;
  }

  return template.replace(/\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi, (raw, token: string) => {
    const key = token.toLowerCase();
    if (key in builtin) return builtin[key];
    const custom = customByToken[key];
    if (custom) return resolveCustom(custom.value_source, conv);
    // eslint-disable-next-line no-console
    console.warn(`[funnel] variável {{${token}}} sem valor disponível no contexto do chat`);
    return raw;
  });
}

// ── Dispatch ─────────────────────────────────────────────────────────────────

interface DispatchHelpers {
  onSendMessage: (opts: SendMessageOptions) => Promise<void>;
  conversation?: Conversation | null;
  customVars?: TenantTemplateVariable[];
}

async function fetchAsFile(item: MessageFunnelItem): Promise<File> {
  if (!item.media_url) throw new Error(`Item ${item.position + 1} sem URL de mídia`);
  const resp = await fetch(item.media_url, { credentials: 'include' });
  if (!resp.ok) throw new Error(`Falha ao baixar mídia (${resp.status})`);
  const blob = await resp.blob();
  const filename = item.media_filename
    ?? `funnel-${item.kind}-${Date.now()}${guessExtension(blob.type, item.kind)}`;
  return new File([blob], filename, { type: blob.type || guessMime(item.kind) });
}

function guessExtension(mime: string, kind: FunnelItemKind): string {
  if (mime?.startsWith('image/')) return '.' + (mime.split('/')[1] || 'jpg');
  if (mime?.startsWith('video/')) return '.' + (mime.split('/')[1] || 'mp4');
  if (mime?.startsWith('audio/')) return '.' + (mime.split('/')[1] || 'webm');
  return kind === 'document' ? '.pdf' : '';
}
function guessMime(kind: FunnelItemKind): string {
  switch (kind) {
    case 'image': return 'image/jpeg';
    case 'video': return 'video/mp4';
    case 'audio': return 'audio/webm';
    case 'document': return 'application/pdf';
    default: return 'application/octet-stream';
  }
}

async function dispatchFunnel(
  funnel: MessageFunnel,
  helpers: DispatchHelpers,
  onProgress?: (idx: number, total: number) => void,
): Promise<void> {
  const sorted = [...funnel.items].sort((a, b) => a.position - b.position);
  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    if (item.delay_seconds > 0) {
      await new Promise(r => setTimeout(r, item.delay_seconds * 1000));
    }
    onProgress?.(i + 1, sorted.length);

    const ctx: ResolveContext = {
      conversation: helpers.conversation,
      customVars: helpers.customVars,
    };
    if (item.kind === 'text') {
      const text = interpolate(item.text_content ?? '', ctx);
      await helpers.onSendMessage({ content: text, isPrivate: false });
    } else {
      const file = await fetchAsFile(item);
      const caption = item.media_caption ? interpolate(item.media_caption, ctx) : '';
      await helpers.onSendMessage({ content: caption, files: [file], isPrivate: false });
    }
  }
}

// ── Popover UI ───────────────────────────────────────────────────────────────

interface MessageFunnelPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation | null;
  onSendMessage: (opts: SendMessageOptions) => Promise<void>;
}

export default function MessageFunnelPopover({
  isOpen, onClose, conversation, onSendMessage,
}: MessageFunnelPopoverProps) {
  const [funnels, setFunnels] = useState<MessageFunnel[]>([]);
  const [customVars, setCustomVars] = useState<TenantTemplateVariable[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  // Após o fix de re-render cascading (dispatch fora do Popover), `running` é só pra
  // bloquear duplo-click instantâneo enquanto onClose() não foi processado.
  const [running] = useState<{ id: string; idx: number; total: number } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Busca funis ativos + vars custom do tenant em paralelo. Custom vars
  // resolvem placeholders {{token}} dos funis no momento do envio.
  // Extraído pra callback pra recarregar a lista após criar um funil inline.
  const loadFunnels = useCallback(() => {
    setLoading(true);
    return Promise.all([
      messageFunnelsService.list({ activeOnly: true }),
      tenantTemplateVariablesService
        .list()
        .then(res => res.custom)
        .catch(() => [] as TenantTemplateVariable[]),
    ])
      .then(([f, v]) => {
        setFunnels(f);
        setCustomVars(v);
      })
      .catch(() => toast.error('Erro ao carregar funis'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    loadFunnels();
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen, loadFunnels]);

  const filtered = search.trim()
    ? funnels.filter(f =>
        f.name.toLowerCase().includes(search.toLowerCase())
        || (f.description ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : funnels;

  async function handleDispatch(funnel: MessageFunnel) {
    if (running) return;
    if (funnel.items.length === 0) {
      toast.error('Funil sem itens');
      return;
    }
    // Fecha o popover imediatamente e dispara o loop "fora" do escopo de render dele.
    // Sem isso, cada setRunning() força re-render do Popover -> MessageInput -> ChatArea
    // -> ChatPage (450KB bundle), e a UI parece congelar durante o dispatch — sintoma
    // observado no smoke test E2E de 2026-06-06.
    const total = funnel.items.length;
    const totalDelay = funnel.items.reduce((acc, it) => acc + (it.delay_seconds || 0), 0);
    onClose();
    const toastId = toast.loading(
      `Disparando funil "${funnel.name}" (${total} ${total === 1 ? 'item' : 'itens'}${
        totalDelay > 0 ? `, ~${totalDelay}s` : ''
      })...`,
    );
    try {
      await dispatchFunnel(funnel, { onSendMessage, conversation, customVars });
      messageFunnelsService.touch(funnel.id).catch(() => {});
      toast.success(`Funil "${funnel.name}" enviado`, { id: toastId });
    } catch (err) {
      const msg = (err as Error)?.message ?? 'Falha no envio';
      toast.error(`Falha no envio: ${msg}`, { id: toastId });
    }
  }

  if (!isOpen) return null;

  return (
    <Card className="absolute bottom-full left-0 right-0 mb-2 shadow-lg border-border z-50 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
      <CardContent className="p-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Funis de Mensagem</span>
            {!loading && (
              <span className="text-xs text-muted-foreground">({filtered.length})</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs text-primary hover:text-primary"
              onClick={running ? undefined : () => setEditorOpen(true)}
              disabled={!!running}
            >
              <Plus className="h-3.5 w-3.5" />
              Novo
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={running ? undefined : onClose}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Busca */}
        <div className="px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2 bg-muted/40 rounded-md px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar funil..."
              disabled={!!running}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="max-h-[320px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Carregando...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-6 text-muted-foreground">
              <Rocket className="h-8 w-8" />
              <p className="text-sm">
                {funnels.length === 0 ? 'Nenhum funil criado ainda' : 'Nenhum resultado'}
              </p>
              {funnels.length === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 mt-1"
                  onClick={() => setEditorOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Criar funil
                </Button>
              )}
            </div>
          ) : (
            filtered.map(funnel => {
              const isRunning = running?.id === funnel.id;
              const dimmed = running && !isRunning;
              return (
                <button
                  key={funnel.id}
                  onClick={() => handleDispatch(funnel)}
                  disabled={!!running}
                  className={`w-full text-left px-4 py-3 transition-all duration-150 border-b border-border last:border-b-0 hover:bg-muted/50 ${
                    isRunning ? 'bg-primary/10 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'
                  } ${dimmed ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Rocket size={12} className="text-primary shrink-0" />
                    <span className="text-sm font-semibold text-foreground truncate">{funnel.name}</span>
                    {!funnel.active && (
                      <span className="text-xs text-muted-foreground ml-auto inline-flex items-center gap-0.5">
                        <Pause size={10} /> pausado
                      </span>
                    )}
                    {isRunning && (
                      <span className="text-xs text-primary ml-auto font-semibold animate-pulse inline-flex items-center gap-1">
                        <Play size={10} fill="currentColor" /> Enviando {running.idx}/{running.total}
                      </span>
                    )}
                  </div>
                  {funnel.description && (
                    <p className="text-xs text-muted-foreground truncate mb-1">{funnel.description}</p>
                  )}
                  <div className="flex items-center gap-1 flex-wrap">
                    {funnel.items.slice(0, 10).map(item => {
                      const Icon = KIND_ICONS[item.kind];
                      const color = KIND_COLORS[item.kind];
                      return (
                        <span
                          key={item.id}
                          className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-xs"
                          style={{ background: color + '20', color }}
                          title={item.text_content?.slice(0, 60) ?? item.media_filename ?? item.kind}
                        >
                          <Icon size={9} />
                          {item.delay_seconds > 0 && <span>·{item.delay_seconds}s</span>}
                        </span>
                      );
                    })}
                    {funnel.items.length > 10 && (
                      <span className="text-xs text-muted-foreground">+{funnel.items.length - 10}</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </CardContent>

      {/* Editor inline: cria funil sem sair do chat. Após salvar, recarrega a lista. */}
      <MessageFunnelEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={() => { setEditorOpen(false); loadFunnels(); }}
      />
    </Card>
  );
}
