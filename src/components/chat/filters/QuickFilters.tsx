import { useEffect, useRef, useState } from 'react';
import { Bot, Check, ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@evoapi/design-system/button';
import chatService from '@/services/chat/chatService';
import usersService from '@/services/users/usersService';
import { roletaConfigService, type RoletaConfig } from '@/services/roletaConfig/roletaConfigService';
import type { Label } from '@/types/chat/api';
import type { BaseFilter } from '@/types/core';
import type { User } from '@/types/users';

/**
 * O POPUP DE FILTRO — não o modal de 4xl.
 *
 * O botão "Filtros" abria um Dialog centralizado de largura `max-w-4xl`: um
 * construtor de regra (atributo + operador + valor) pensado pra filtro
 * avançado, ocupando a tela toda pra escolher uma tag. Pedido do Giovani
 * (19/08): um popup NORMAL, ancorado no botão, com as três coisas que ele
 * usa toda hora — tag, instância, período — resolvidas com um clique. O
 * resto (status, time, pipeline, prioridade) continua existindo no modal
 * antigo, um clique adiante em "Filtros avançados".
 *
 * Cada seção aplica na hora (mesmo padrão do `FiltrosDeConversa` do LM Hub):
 * sem botão "Aplicar" pra tag e instância — clicar já filtra. Período é a
 * exceção que confirma a regra: `<input type="date">` só dispara `onChange`
 * quando a data está completa, então aplicar na hora também é seguro ali —
 * não é campo de texto disparando request por tecla.
 */

interface InboxOption {
  id: string;
  label: string;
  /** A IA está operando nesta instância (bot ligado — ver `Inbox#active_bot?`). */
  iaAtiva?: boolean;
}

interface QuickFiltersProps {
  /** Filtros já aplicados (mesmo array que alimenta o modal avançado). */
  filters: BaseFilter[];
  /** Instâncias (WhatsApp) do tenant — só mostra a seção com 2+. */
  inboxOptions: InboxOption[];
  onApply: (next: BaseFilter[]) => void;
  onOpenAdvanced: () => void;
}

// Os atributos que SÓ o modal avançado resolve — servem pra contar quantos
// filtros "escondidos" estão ativos sem duplicar a lógica deles aqui.
const ADVANCED_ONLY_KEYS = new Set([
  'status',
  'assignee_type',
  'team_id',
  'channel_type',
  'priority',
  'pipeline_id',
  'pipeline_stage_id',
  'created_at',
]);

function mkFilter(attributeKey: string, filterOperator: string, values: string): BaseFilter {
  return { attributeKey, filterOperator, values, queryOperator: 'and', attributeModel: 'standard' };
}

// `toISOString` desloca pro fuso UTC e pode voltar um dia — `en-CA` dá
// YYYY-MM-DD direto no fuso local, que é o que o `<input type="date">` e o
// backend (`::date`) esperam.
function isoDate(d: Date): string {
  return d.toLocaleDateString('en-CA');
}

export default function QuickFilters({
  filters,
  inboxOptions,
  onApply,
  onOpenAdvanced,
}: QuickFiltersProps) {
  const [open, setOpen] = useState(false);
  const [labels, setLabels] = useState<Label[]>([]);
  const [loadingLabels, setLoadingLabels] = useState(false);
  const [agents, setAgents] = useState<User[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [roletas, setRoletas] = useState<RoletaConfig[]>([]);
  const [loadingRoletas, setLoadingRoletas] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || labels.length > 0) return;
    let alive = true;
    setLoadingLabels(true);
    chatService
      .getAvailableLabels()
      .then(res => {
        if (!alive) return;
        const list = Array.isArray(res) ? res : (res as { data?: Label[] })?.data || [];
        setLabels(list);
      })
      .catch(() => { /* silencioso, seção fica vazia */ })
      .finally(() => { if (alive) setLoadingLabels(false); });
    return () => { alive = false; };
  }, [open, labels.length]);

  // RESPONSÁVEL — lista de todo mundo que pode ser dono de conversa no
  // tenant (mesma fonte de Configurações > Usuários), não só quem atende
  // pela instância aberta. Pedido do Giovani (19/08): filtrar quem quiser
  // ver o atendimento, por nome, não por número/roleta — "Instância" e
  // "Responsável" são dimensões diferentes (uma instância pode ser
  // compartilhada por vários corretores via roleta).
  useEffect(() => {
    if (!open || agents.length > 0) return;
    let alive = true;
    setLoadingAgents(true);
    usersService
      .getUsers({ per_page: 100 })
      .then(res => {
        if (!alive) return;
        const list = Array.isArray(res) ? res : (res as { data?: User[] })?.data || [];
        setAgents(list);
      })
      .catch(() => { /* silencioso, seção fica vazia */ })
      .finally(() => { if (alive) setLoadingAgents(false); });
    return () => { alive = false; };
  }, [open, agents.length]);

  // ROLETA — isola por GRUPO de distribuição (ex: "ROLETA MULTI - TENDA"),
  // não por corretor nem por número. Uma instância é compartilhada por várias
  // roletas e uma roleta distribui pra vários corretores — "Instância",
  // "Responsável" e "Roleta" são 3 filtros independentes, cada um resolve uma
  // pergunta diferente (pedido do Giovani, 19/08: "ver pelas roletas E o lead
  // de cada atendente isolado"). Mesma fonte de Automações > Distribuição de
  // Leads.
  useEffect(() => {
    if (!open || roletas.length > 0) return;
    let alive = true;
    setLoadingRoletas(true);
    roletaConfigService
      .getAll()
      .then(res => {
        if (!alive) return;
        setRoletas(res);
      })
      .catch(() => { /* silencioso, seção fica vazia */ })
      .finally(() => { if (alive) setLoadingRoletas(false); });
    return () => { alive = false; };
  }, [open, roletas.length]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const activeTagFilter = filters.find(f => f.attributeKey === 'labels');
  const activeTagTitle = activeTagFilter ? String(activeTagFilter.values) : undefined;

  const aiOnly = filters.some(f => f.attributeKey === 'handled_by_ai' && String(f.values) === 'true');

  const activeInboxFilter = filters.find(f => f.attributeKey === 'inbox_id');
  const activeInboxId = activeInboxFilter ? String(activeInboxFilter.values) : undefined;

  const activeAssigneeFilter = filters.find(f => f.attributeKey === 'assignee_id');
  const activeAssigneeId = activeAssigneeFilter ? String(activeAssigneeFilter.values) : undefined;

  const activeRoletaFilter = filters.find(f => f.attributeKey === 'roleta_config_id');
  const activeRoletaId = activeRoletaFilter ? String(activeRoletaFilter.values) : undefined;

  const startFilter = filters.find(
    f => f.attributeKey === 'last_activity_at' && f.filterOperator === 'is_greater_than',
  );
  const endFilter = filters.find(
    f => f.attributeKey === 'last_activity_at' && f.filterOperator === 'is_less_than',
  );
  const startDate = startFilter ? String(startFilter.values) : '';
  const endDate = endFilter ? String(endFilter.values) : '';

  // `status=open` é o baseline da tela (FiltersContext.DEFAULT_FILTER) — vai
  // junto em toda request, sempre, não é escolha do usuário. Contar ele aqui
  // dava um "1" fantasma que não batia com nenhuma seção deste popup nem do
  // toggle Ativas/Arquivadas (que é outro filtro, client-side, sobre
  // custom_attributes.archived) — clicar em "Filtros avançados" pra descobrir
  // o que era só mostrava "Status = Aberta", sem relação com nada visível
  // aqui (reportado pelo Giovani, 19/08).
  const isDefaultStatusFilter = (f: BaseFilter) =>
    f.attributeKey === 'status' && String(f.values) === 'open';
  const advancedCount = filters.filter(
    f => ADVANCED_ONLY_KEYS.has(f.attributeKey) && !isDefaultStatusFilter(f),
  ).length;
  const totalActive =
    (activeTagTitle ? 1 : 0) +
    (activeInboxId ? 1 : 0) +
    (activeAssigneeId ? 1 : 0) +
    (activeRoletaId ? 1 : 0) +
    (startDate || endDate ? 1 : 0) +
    (aiOnly ? 1 : 0) +
    advancedCount;

  function withoutKeys(keys: string[]): BaseFilter[] {
    return filters.filter(f => !keys.includes(f.attributeKey));
  }

  function applyTag(title: string | undefined) {
    const base = withoutKeys(['labels']);
    onApply(title ? [...base, mkFilter('labels', 'equal_to', title)] : base);
  }

  function applyInbox(id: string | undefined) {
    const base = withoutKeys(['inbox_id']);
    onApply(id ? [...base, mkFilter('inbox_id', 'equal_to', id)] : base);
  }

  function applyAssignee(id: string | undefined) {
    const base = withoutKeys(['assignee_id']);
    onApply(id ? [...base, mkFilter('assignee_id', 'equal_to', id)] : base);
  }

  function applyRoleta(id: string | undefined) {
    const base = withoutKeys(['roleta_config_id']);
    onApply(id ? [...base, mkFilter('roleta_config_id', 'equal_to', id)] : base);
  }

  function applyAiOnly(next: boolean) {
    const base = withoutKeys(['handled_by_ai']);
    onApply(next ? [...base, mkFilter('handled_by_ai', 'equal_to', 'true')] : base);
  }

  function applyPeriod(nextStart: string, nextEnd: string) {
    const base = withoutKeys(['last_activity_at']);
    const next = [...base];
    if (nextStart) next.push(mkFilter('last_activity_at', 'is_greater_than', nextStart));
    if (nextEnd) next.push(mkFilter('last_activity_at', 'is_less_than', nextEnd));
    onApply(next);
  }

  function applyPreset(days: number) {
    const start = new Date();
    start.setDate(start.getDate() - days);
    applyPeriod(isoDate(start), '');
  }

  // Limpa TUDO — inclusive os filtros do modal avançado (status, time,
  // pipeline...) — EXCETO o baseline `status=open` (ver isDefaultStatusFilter
  // acima): esse não é escolha do usuário pra desfazer aqui, é o "só mostra
  // conversa aberta" que a tela inteira assume. Removê-lo junto faria a lista
  // misturar resolvida/fechada sem aviso nenhum. O "X" fica ao lado de um
  // contador único (`totalActive`) que soma quick + avançado, então limpar só
  // os 4 quick deixava o contador preso em 1 sem nenhuma seção marcada aqui
  // pra explicar o motivo (bug reportado pelo Giovani, 19/08).
  function clearAll() {
    onApply(filters.filter(isDefaultStatusFilter));
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
          className={`h-8 px-2 gap-1.5 cursor-pointer ${totalActive > 0 ? 'text-primary' : 'text-muted-foreground'}`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
          {totalActive > 0 && (
            <span className="rounded-full bg-primary/15 px-1.5 text-[11px] tabular-nums">
              {totalActive}
            </span>
          )}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </Button>

        {totalActive > 0 && (
          <button
            type="button"
            onClick={clearAll}
            aria-label="Limpar todos os filtros"
            title="Limpar todos os filtros"
            className="rounded p-1 text-muted-foreground transition hover:text-destructive cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="Filtros rápidos"
          className="absolute left-0 top-full z-30 mt-1 w-80 rounded-lg border bg-popover p-3 shadow-lg"
        >
          {/* TAGS — dropdown nativo, não lista solta. Uma lista de botões
              esticava o popup toda vez que o tenant tinha muitas etiquetas
              (pedido do Giovani, 19/08: "não faz sentido esticar esse
              menu"). Um <select> mostra uma linha só, fechado. */}
          <section>
            <p className="mb-1 px-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Tags
            </p>
            {loadingLabels ? (
              <p className="px-0.5 py-1.5 text-xs text-muted-foreground">Carregando…</p>
            ) : labels.length === 0 ? (
              <p className="px-0.5 py-1.5 text-xs text-muted-foreground">
                Nenhuma tag criada ainda.
              </p>
            ) : (
              <select
                value={activeTagTitle ?? ''}
                onChange={e => applyTag(e.target.value || undefined)}
                className="w-full cursor-pointer rounded border bg-background px-1.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="">Todas as tags</option>
                {labels.map(l => (
                  <option key={l.id} value={l.title}>
                    {l.title}
                  </option>
                ))}
              </select>
            )}
          </section>

          {/* ATENDIMENTO — mesmo botão "Só IA" do dashboard (AiToggle.tsx),
              aqui como toggle na lista em vez de botão solto na barra: é
              binário, não uma lista de opções pra escolher. */}
          <section className="mt-2 border-t pt-2">
            <p className="mb-1 px-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Atendimento
            </p>
            <button
              type="button"
              onClick={() => applyAiOnly(!aiOnly)}
              aria-pressed={aiOnly}
              className={`flex w-full items-center gap-2 rounded px-1.5 py-1.5 text-left text-sm transition cursor-pointer ${
                aiOnly ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-muted'
              }`}
            >
              <Bot className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">Só leads atendidos pela IA</span>
              {aiOnly && <Check className="h-3.5 w-3.5 shrink-0" />}
            </button>
          </section>

          {/* INSTÂNCIA — só com 2+, uma só não é filtro, é a caixa inteira */}
          {inboxOptions.length > 1 && (
            <section className="mt-2 border-t pt-2">
              <p className="mb-1 px-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Instância
              </p>
              <div className="max-h-40 space-y-0.5 overflow-y-auto">
                {inboxOptions.map(i => {
                  const active = activeInboxId === i.id;
                  return (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => applyInbox(active ? undefined : i.id)}
                      className={`flex w-full items-center gap-2 rounded px-1.5 py-1.5 text-left text-sm transition cursor-pointer ${
                        active ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-muted'
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{i.label}</span>
                      {/* IA ATIVA NESTA INSTÂNCIA — pedido do Giovani (19/08):
                          ver de relance em qual chip a IA está respondendo,
                          sem abrir Configurações → Canais pra checar um por
                          um. Aparece em CADA instância com bot ligado — se a
                          IA opera em três chips, os três mostram o ícone. */}
                      {i.iaAtiva && (
                        <span title="IA ativa nesta instância" className="shrink-0">
                          <Bot aria-label="IA ativa nesta instância" className="h-3.5 w-3.5 text-[#9333EA]" />
                        </span>
                      )}
                      {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* RESPONSÁVEL — quem atende, por nome. Independente de
              "Instância": uma instância pode ser compartilhada por vários
              corretores via roleta, então filtrar por número não isola o
              atendimento de uma pessoa (pedido do Giovani, 19/08). */}
          <section className="mt-2 border-t pt-2">
            <p className="mb-1 px-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Responsável
            </p>
            {loadingAgents ? (
              <p className="px-0.5 py-1.5 text-xs text-muted-foreground">Carregando…</p>
            ) : agents.length === 0 ? (
              <p className="px-0.5 py-1.5 text-xs text-muted-foreground">
                Nenhum usuário encontrado.
              </p>
            ) : (
              <select
                value={activeAssigneeId ?? ''}
                onChange={e => applyAssignee(e.target.value || undefined)}
                className="w-full cursor-pointer rounded border bg-background px-1.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="">Todos os responsáveis</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
          </section>

          {/* ROLETA — isola pelo GRUPO de distribuição (ex: "ROLETA MULTI -
              TENDA"), não pelo corretor nem pelo número. Mesma fonte de
              Automações > Distribuição de Leads (pedido do Giovani, 19/08).
              Some se o tenant não usa roleta nenhuma (loadingRoletas some,
              lista vazia) — nada a filtrar aqui. */}
          {(loadingRoletas || roletas.length > 0) && (
            <section className="mt-2 border-t pt-2">
              <p className="mb-1 px-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Roleta
              </p>
              {loadingRoletas ? (
                <p className="px-0.5 py-1.5 text-xs text-muted-foreground">Carregando…</p>
              ) : (
                <select
                  value={activeRoletaId ?? ''}
                  onChange={e => applyRoleta(e.target.value || undefined)}
                  className="w-full cursor-pointer rounded border bg-background px-1.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                >
                  <option value="">Todas as roletas</option>
                  {roletas.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.display_name || r.name || r.inbox_name || r.id}
                    </option>
                  ))}
                </select>
              )}
            </section>
          )}

          {/* PERÍODO — presets rápidos + intervalo manual, os dois na mesma
              coluna `last_activity_at` (última mensagem), que é o que
              importa numa caixa de conversa — não `created_at`. */}
          <section className="mt-2 border-t pt-2">
            <p className="mb-1 px-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Período
            </p>
            <div className="mb-2 flex gap-1.5">
              <button
                type="button"
                onClick={() => applyPreset(0)}
                className="flex-1 cursor-pointer rounded border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => applyPreset(7)}
                className="flex-1 cursor-pointer rounded border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                7 dias
              </button>
              <button
                type="button"
                onClick={() => applyPreset(30)}
                className="flex-1 cursor-pointer rounded border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                30 dias
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="flex-1 text-xs text-muted-foreground">
                De
                <input
                  type="date"
                  value={startDate}
                  max={endDate || undefined}
                  onChange={e => applyPeriod(e.target.value, endDate)}
                  className="mt-0.5 w-full rounded border bg-background px-1.5 py-1 text-xs text-foreground outline-none focus:border-primary"
                />
              </label>
              <label className="flex-1 text-xs text-muted-foreground">
                Até
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={e => applyPeriod(startDate, e.target.value)}
                  className="mt-0.5 w-full rounded border bg-background px-1.5 py-1 text-xs text-foreground outline-none focus:border-primary"
                />
              </label>
            </div>
          </section>

          <div className="mt-2 border-t pt-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenAdvanced();
              }}
              className="w-full cursor-pointer px-0.5 py-1 text-left text-xs text-muted-foreground transition hover:text-foreground"
            >
              Filtros avançados{advancedCount > 0 ? ` (${advancedCount})` : ''}…
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
