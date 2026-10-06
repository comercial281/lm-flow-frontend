// src/pages/SuperAdmin/NumberOwnership/index.tsx
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, Power, RefreshCw, Smartphone } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import EmptyState from '@/components/base/EmptyState';
import { Button } from '@/components/ui/ds';
import numberOwnershipService, {
  type OwnershipDiagnosis, type OwnershipSummary,
} from '@/services/superAdmin/numberOwnershipService';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { loadInBatches } from './loadInBatches';
import {
  FAILED_REQUEST_MESSAGE, conflictHint, liberatedLine, ownerSourceText, roletaLine, ruleAction,
  ruleConfirmation, ruleDoneText, ruleErrorMessage, ruleLastLine, ruleStatusText, summaryLine,
  verdictBadge, type RuleActionKind, type TenantRow,
} from './numberOwnershipRules';
import NumerosDaLealMidia from './NumerosDaLealMidia';
import { Pill } from './Pill';
import SeloDaSituacao from './SeloDaSituacao';
import { contadores, filtrarSoCaidos, ordenarComCaidos, ordenarNumeros, seloDoCliente } from './situacao';

/**
 * Clientes → Números conectados (painel raiz). Duas leituras de cada número de
 * WhatsApp de cada cliente:
 * - a SITUAÇÃO (entrega 4, 06/10): conectado, caído desde quando, nunca
 *   conectado, API oficial ou sem leitura. Cliente com número caído sobe para o
 *   topo; o resumo de cada cliente vem na lista, lido na hora pelo servidor;
 * - o DONO (fase 2a/2b.1): quem migra sozinho, quem precisa conferir, e o botão
 *   que liga a regra do dono do número naquele cliente.
 * Quem decide é o servidor (Numbers::Situation, Numbers::OwnershipDiagnosis,
 * Numbers::OwnershipMigration); as palavras, de ./situacao e ./numberOwnershipRules.
 *
 * Ligar/Desligar é escrita em produção: sempre com o Dialog de confirmação da
 * casa (useConfirmacao), nunca com a caixinha do navegador. Daqui não se
 * reconecta número (sem QR code no admin, decisão de 06/10): agir = Entrar no cliente.
 */
const BATCH_SIZE = 4;

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="text-xs">
      <span className="text-muted-foreground">{label}: </span>
      {children}
    </div>
  );
}

function count(data: OwnershipDiagnosis | null, key: keyof OwnershipSummary): string | number {
  return data && data.verdict !== 'unreadable' ? data.summary[key] : '—';
}

function readAtText(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** A barra da regra do dono, no topo do detalhe do cliente (fase 2b.1). */
function RuleBar({
  data, busy, locked, onRule,
}: {
  data: OwnershipDiagnosis;
  busy: boolean;
  /** A aba está relendo: a leitura que chegar depois cobriria a resposta do clique. */
  locked: boolean;
  onRule: (kind: RuleActionKind) => void;
}) {
  const action = ruleAction(data);
  const status = ruleStatusText(data.rule);
  if (!status && !action) return null;
  const last = ruleLastLine(data.rule?.last);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-background p-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{status}</div>
        {last && <div className="text-xs text-muted-foreground">{last}</div>}
        {action?.blockedReason && <div className="text-xs text-amber-700 dark:text-amber-300">{action.blockedReason}</div>}
      </div>
      {action && (
        <button
          type="button"
          onClick={() => onRule(action.kind)}
          disabled={busy || locked || !!action.blockedReason}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm disabled:opacity-50 ${
            action.kind === 'disable' ? 'text-red-700 dark:text-red-300 hover:bg-red-500/10' : 'hover:bg-muted'
          }`}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />} {action.label}
        </button>
      )}
    </div>
  );
}

function TenantDetail({
  data, ruleBusy, ruleLocked, onRule,
}: {
  data: OwnershipDiagnosis;
  ruleBusy: boolean;
  ruleLocked: boolean;
  onRule: (kind: RuleActionKind) => void;
}) {
  return (
    <div className="space-y-4">
      <RuleBar data={data} busy={ruleBusy} locked={ruleLocked} onRule={onRule} />

      <p className="text-xs text-muted-foreground">Leitura das {readAtText(data.read_at)}.</p>

      {data.numbers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Este cliente não tem número de WhatsApp.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {ordenarNumeros(data.numbers).map(n => (
            <div
              key={n.inbox_id}
              className={`rounded-lg border bg-background p-3 space-y-1.5 ${
                n.situation === 'disconnected' ? 'border-red-500/40' : n.conflicts.length ? 'border-amber-500/40' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="font-medium">{n.name}</div>
                  <div className="text-xs text-muted-foreground">{n.phone ?? 'sem telefone gravado'}</div>
                  <SeloDaSituacao situacao={n.situation} desde={n.disconnected_at} />
                </div>
                {n.phone_matches && <Pill tone="ok">celular bate</Pill>}
              </div>
              <Line label="Responsável">{n.responsible ? n.responsible.name : 'ninguém'}</Line>
              <Line label="Roletas">
                {n.roletas.length ? n.roletas.map(r => <div key={r.id}>{roletaLine(r)}</div>) : 'em nenhuma roleta'}
              </Line>
              <Line label="Liberados">{liberatedLine(n.liberated)}</Line>
              <Line label="Dono sugerido">
                <strong>{n.suggested_owner ? n.suggested_owner.name : 'Compartilhado'}</strong>
                {n.suggested_owner && <span className="text-muted-foreground"> ({ownerSourceText(n)})</span>}
              </Line>
              {n.conflicts.length > 0 && (
                <ul className="mt-1 space-y-1">
                  {n.conflicts.map((c, i) => {
                    const hint = conflictHint(n.conflict_codes?.[i] ?? '');
                    return (
                      <li key={`${i}-${c}`} className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>
                          {c}
                          {hint && <span className="block text-muted-foreground">{hint}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold mb-2">Pessoa por pessoa</h3>
        {data.people.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum corretor ativo.</p>
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {data.people.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-1.5 text-sm">
                <span>
                  {p.name}
                  {!p.corretor && <span className="text-xs text-muted-foreground"> (gestor)</span>}
                  {!p.active && <span className="text-xs text-red-600 dark:text-red-400"> (desativado)</span>}
                </span>
                {p.no_number ? (
                  <Pill tone="warn">corretor sem número</Pill>
                ) : (
                  <span className="text-xs text-muted-foreground text-right">{p.numbers.map(x => x.name).join(', ')}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function NumberOwnership() {
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [listFailed, setListFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  // A lista de clientes já foi lida (com linhas, vazia ou com erro): daí em diante o layout não muda mais de altura por causa dela.
  const [listaLida, setListaLida] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  // O cliente cujo Ligar/Desligar está no ar (o botão gira nele).
  const [ruleBusyId, setRuleBusyId] = useState<string | null>(null);
  // "Só caídos" (entrega 4): filtro da tela, pelo resumo de conexão que a lista traz.
  const [soCaidos, setSoCaidos] = useState(false);
  // Sobe a cada Atualizar: a seção dos números da Leal Mídia relê junto.
  const [recarga, setRecarga] = useState(0);
  // ?cliente=<schema> (botão "Ver números" da Atenção): rola até o cliente e
  // abre o detalhe UMA vez, quando a leitura dele chega.
  const [params] = useSearchParams();
  const alvo = params.get('cliente');
  const alvoResolvido = useRef(false);
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  // Cada leitura ganha um número; resposta de leitura velha é descartada.
  const runRef = useRef(0);

  const load = useCallback(async (refresh: boolean) => {
    runRef.current += 1;
    const run = runRef.current;
    const isStale = () => run !== runRef.current;
    setBusy(true);
    setListFailed(false);
    try {
      const res = await numberOwnershipService.listTenants();
      if (isStale()) return;
      const tenants = res.data?.data ?? [];
      setRows(tenants.map((tenant): TenantRow => ({ tenant, state: { kind: 'loading' } })));
      setListaLida(true);
      await loadInBatches(
        tenants.map(t => t.id),
        BATCH_SIZE,
        async id => (await numberOwnershipService.diagnose(id, refresh)).data.data,
        (id, result) => {
          setRows(prev =>
            prev.map((r): TenantRow => {
              if (r.tenant.id !== id) return r;
              return result.ok
                ? { ...r, state: { kind: 'ready', data: result.value } }
                : { ...r, state: { kind: 'failed', message: FAILED_REQUEST_MESSAGE } };
            }),
          );
        },
        isStale,
      );
    } catch {
      if (!isStale()) {
        setListFailed(true);
        setListaLida(true);
      }
    } finally {
      if (!isStale()) setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
    return () => {
      runRef.current += 1;
    };
  }, [load]);

  // Ligar/Desligar dono do número (fase 2b.1). O servidor devolve a leitura
  // NOVA do cliente, que substitui a linha — quem clicou vê o efeito na hora.
  const changeRule = useCallback(
    async (row: TenantRow, data: OwnershipDiagnosis, kind: RuleActionKind) => {
      if (!(await confirmar(ruleConfirmation(kind, row.tenant.name, data)))) return;
      setRuleBusyId(row.tenant.id);
      try {
        const res = kind === 'enable'
          ? await numberOwnershipService.enableRule(row.tenant.id)
          : await numberOwnershipService.disableRule(row.tenant.id);
        const fresh = res.data.data;
        setRows(prev =>
          prev.map((r): TenantRow => (r.tenant.id === row.tenant.id ? { ...r, state: { kind: 'ready', data: fresh } } : r)),
        );
        toast.success(ruleDoneText(kind, row.tenant.name, fresh));
      } catch (error) {
        toast.error(ruleErrorMessage(error));
      } finally {
        setRuleBusyId(null);
      }
    },
    [confirmar],
  );

  const visiveis = ordenarComCaidos(filtrarSoCaidos(rows, soCaidos));

  useEffect(() => {
    if (!alvo || alvoResolvido.current) return;
    // O Principal (public) aparece na Atenção, mas os números dele são os da Leal Mídia.
    if (alvo === 'public') {
      // Espera a lista: a tabela entra acima da seção e a empurraria para baixo.
      if (!listaLida) return;
      alvoResolvido.current = true;
      document.getElementById('numeros-da-leal-midia')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      return;
    }
    const row = rows.find(r => r.tenant.schema === alvo);
    if (!row || row.state.kind === 'loading') return;
    // "Só caídos" esconderia o cliente do link: desliga o filtro e deixa o
    // efeito rodar de novo (o `soCaidos` está nas dependências) com a linha na tela.
    if (soCaidos && (row.tenant.connection_summary?.down ?? 0) === 0) {
      setSoCaidos(false);
      return;
    }
    alvoResolvido.current = true;
    if (row.state.kind === 'ready' && row.state.data.verdict !== 'unreadable') setOpenId(row.tenant.id);
    document.getElementById(`cliente-${row.tenant.id}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [alvo, rows, soCaidos, listaLida]);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-primary" /> Números de WhatsApp de cada cliente
          </h2>
          {rows.length > 0 ? (
            <>
              <p className="text-sm font-medium">{contadores(rows)}</p>
              <p className="text-sm text-muted-foreground">{summaryLine(rows)}</p>
            </>
          ) : busy ? (
            <p className="text-sm text-muted-foreground">Carregando a lista de clientes…</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={soCaidos ? 'default' : 'outline'}
            aria-pressed={soCaidos}
            disabled={rows.length === 0}
            onClick={() => setSoCaidos(v => !v)}
          >
            Só caídos
          </Button>
          <button
            type="button"
            onClick={() => {
              setRecarga(n => n + 1);
              void load(true);
            }}
            // Com um Ligar/Desligar no ar, reler agora poderia trazer a foto de
            // antes da escrita e cobrir a leitura nova que o clique devolve.
            disabled={busy || ruleBusyId !== null}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        A situação de cada número é a gravada pelo próprio WhatsApp e pela conferência automática de 3 em 3 minutos;
        para reconectar, entre no cliente. Nenhum conflito de dono é corrigido daqui: quem resolve é o gestor, em
        Canais e na Roleta. O que se liga daqui é a regra do dono do número, cliente a cliente. A conferência de dono
        de cada cliente fica guardada por 5 minutos; Atualizar lê tudo de novo.
      </p>

      {listFailed ? (
        <EmptyState tipo="erro" title="Não deu pra carregar os clientes" aoTentarDeNovo={() => void load(false)} />
      ) : rows.length === 0 ? (
        busy ? null : (
          <EmptyState
            title="Nenhum cliente em uso"
            description="Quando houver cliente ativo, os números de WhatsApp dele aparecem aqui."
          />
        )
      ) : visiveis.length === 0 ? (
        <EmptyState
          tipo="semResultado"
          title="Nenhum número caído"
          description="Nenhum cliente está com número caído agora."
          aoLimparFiltros={() => setSoCaidos(false)}
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 w-8" />
                <th className="text-left px-3 py-2">Cliente</th>
                <th className="text-left px-3 py-2">Conexão</th>
                <th className="text-right px-3 py-2">Números</th>
                <th className="text-right px-3 py-2">Dono claro</th>
                <th className="text-right px-3 py-2">Compartilhados</th>
                <th className="text-right px-3 py-2">Precisam conferir</th>
                <th className="text-left px-3 py-2">Situação</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map(row => {
                const badge = verdictBadge(row.state);
                const selo = seloDoCliente(row.tenant.connection_summary);
                const data = row.state.kind === 'ready' ? row.state.data : null;
                const canOpen = !!data && data.verdict !== 'unreadable';
                const isOpen = canOpen && openId === row.tenant.id;
                return (
                  <Fragment key={row.tenant.id}>
                    <tr
                      id={`cliente-${row.tenant.id}`}
                      className={`border-t ${canOpen ? 'cursor-pointer hover:bg-muted/40' : ''}`}
                      onClick={() => {
                        if (canOpen) setOpenId(isOpen ? null : row.tenant.id);
                      }}
                    >
                      <td className="px-3 py-2">
                        {row.state.kind === 'loading' ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : canOpen ? (
                          isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                        ) : null}
                      </td>
                      <td className="px-3 py-2 font-medium">{row.tenant.name}</td>
                      <td className="px-3 py-2"><Pill tone={selo.tom}>{selo.texto}</Pill></td>
                      <td className="px-3 py-2 text-right">{count(data, 'numbers')}</td>
                      <td className="px-3 py-2 text-right">{count(data, 'owned')}</td>
                      <td className="px-3 py-2 text-right">{count(data, 'shared')}</td>
                      <td className="px-3 py-2 text-right">{count(data, 'needs_review')}</td>
                      <td className="px-3 py-2">
                        <Pill tone={badge.tone}>{badge.label}</Pill>
                        {badge.note && <span className="ml-2 text-xs text-muted-foreground">{badge.note}</span>}
                        {data?.rule?.enabled && <span className="ml-2"><Pill tone="ok">dono do número ligado</Pill></span>}
                      </td>
                    </tr>
                    {isOpen && data && (
                      <tr className="border-t bg-muted/20">
                        <td colSpan={8} className="px-3 py-3">
                          <TenantDetail
                            data={data}
                            ruleBusy={ruleBusyId === row.tenant.id}
                            ruleLocked={busy || (ruleBusyId !== null && ruleBusyId !== row.tenant.id)}
                            onRule={kind => void changeRule(row, data, kind)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <NumerosDaLealMidia recarga={recarga} />

      {dialogoDeConfirmacao}
    </div>
  );
}
