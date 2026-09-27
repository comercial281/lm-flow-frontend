import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, RefreshCw, Smartphone } from 'lucide-react';
import numberOwnershipService, {
  type OwnershipDiagnosis, type OwnershipSummary,
} from '@/services/superAdmin/numberOwnershipService';
import { loadInBatches } from './loadInBatches';
import {
  FAILED_REQUEST_MESSAGE, connectionText, liberatedLine, ownerSourceText, roletaLine, sortRows, summaryLine,
  verdictBadge, type TenantRow, type Tone,
} from './numberOwnershipRules';

/**
 * Aba *Números* do painel raiz (Clientes → Números): de quem é cada número de
 * WhatsApp de cada cliente, e quem migra sozinho para a fase 2b. Só leitura.
 * A regra é do servidor (Numbers::OwnershipDiagnosis); as palavras, de
 * ./numberOwnershipRules.
 */
const BATCH_SIZE = 4;

const TONE_CLASS: Record<Tone, string> = {
  ok: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  warn: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  error: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30',
  neutral: 'bg-muted text-muted-foreground border-border',
};

function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASS[tone]}`}>
      {children}
    </span>
  );
}

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

function TenantDetail({ data }: { data: OwnershipDiagnosis }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Leitura das {readAtText(data.read_at)}.</p>

      {data.numbers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Este cliente não tem número de WhatsApp.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.numbers.map(n => (
            <div
              key={n.inbox_id}
              className={`rounded-lg border bg-background p-3 space-y-1.5 ${n.conflicts.length ? 'border-amber-500/40' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{n.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {n.phone ?? 'sem telefone gravado'} · {connectionText(n.connection)}
                  </div>
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
                  {n.conflicts.map(c => (
                    <li key={c} className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      {c}
                    </li>
                  ))}
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
  const [openId, setOpenId] = useState<string | null>(null);
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
      if (!isStale()) setListFailed(true);
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

  const sorted = sortRows(rows);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-violet-500" /> Números de WhatsApp de cada cliente
          </h2>
          <p className="text-sm text-muted-foreground">
            {rows.length ? summaryLine(rows) : busy ? 'Carregando a lista de clientes…' : 'Nenhum cliente ativo.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={busy}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Só leitura: nada é corrigido daqui. A leitura de cada cliente fica guardada por 5 minutos; Atualizar lê tudo de novo.
      </p>

      {listFailed && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
          Não consegui carregar a lista de clientes. Tente Atualizar.
        </div>
      )}

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 w-8" />
              <th className="text-left px-3 py-2">Cliente</th>
              <th className="text-right px-3 py-2">Números</th>
              <th className="text-right px-3 py-2">Dono claro</th>
              <th className="text-right px-3 py-2">Compartilhados</th>
              <th className="text-right px-3 py-2">Precisam conferir</th>
              <th className="text-left px-3 py-2">Situação</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => {
              const badge = verdictBadge(row.state);
              const data = row.state.kind === 'ready' ? row.state.data : null;
              const canOpen = !!data && data.verdict !== 'unreadable';
              const isOpen = canOpen && openId === row.tenant.id;
              return (
                <Fragment key={row.tenant.id}>
                  <tr
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
                    <td className="px-3 py-2 text-right">{count(data, 'numbers')}</td>
                    <td className="px-3 py-2 text-right">{count(data, 'owned')}</td>
                    <td className="px-3 py-2 text-right">{count(data, 'shared')}</td>
                    <td className="px-3 py-2 text-right">{count(data, 'needs_review')}</td>
                    <td className="px-3 py-2">
                      <Pill tone={badge.tone}>{badge.label}</Pill>
                      {badge.note && <span className="ml-2 text-xs text-muted-foreground">{badge.note}</span>}
                    </td>
                  </tr>
                  {isOpen && data && (
                    <tr className="border-t bg-muted/20">
                      <td colSpan={7} className="px-3 py-3">
                        <TenantDetail data={data} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
