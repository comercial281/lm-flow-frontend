import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Switch } from '@/components/ui/ds';
import NoAccessState from '@/components/permissions/NoAccessState';
import { plural } from '@/lib/formato';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { customRolesService, capabilitiesErrorMessage } from '@/services/customRoles/customRolesService';
import type { CapabilityState, CapabilityTheme, RoleCapabilities } from '@/types/customRoles';
import {
  changesByRole,
  clearRole,
  countChanges,
  dropEntries,
  effectiveState,
  toggle,
  type PermissionsDraft,
} from './permissionsDraft';

/* Aba "Permissões" da Equipe — quadro cargos × linhas na língua da tela.
   Rótulos e dicas vêm do servidor. O rascunho guarda só o que mudou e o
   "Salvar" manda UMA chamada por cargo mudado: se uma falhar, as outras já
   valeram e só a que falhou continua como rascunho (com a frase do servidor). */

const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Cargo-pai e o estado dele na linha (undefined: o cargo não herda de ninguém). */
function parentOf(roles: RoleCapabilities[], roleId: number, rowKey: string): { name: string; state: CapabilityState } | undefined {
  const role = roles.find(r => r.id === roleId);
  if (!role?.inherits_from_id) return undefined;
  const pai = roles.find(r => r.id === role.inherits_from_id);
  return pai ? { name: pai.name, state: pai.states[rowKey] ?? 'off' } : undefined;
}

/** Nome do cargo-pai quando ele já libera a linha inteira (o filho herda e não dá pra desligar aqui). */
function lockedParent(roles: RoleCapabilities[], roleId: number, rowKey: string): string | undefined {
  const pai = parentOf(roles, roleId, rowKey);
  return pai?.state === 'on' ? pai.name : undefined;
}

/** O servidor recusa DESLIGAR a linha no filho se o pai tem QUALQUER chave dela (ligada ou em parte). */
function parentBlocksOff(roles: RoleCapabilities[], roleId: number, rowKey: string): boolean {
  const pai = parentOf(roles, roleId, rowKey);
  return !!pai && pai.state !== 'off';
}

function Interruptor({
  state, label, disabled, changed, onClick, lockedBy, partialFrom,
}: { state: CapabilityState; label: string; disabled: boolean; changed: boolean; onClick: () => void; lockedBy?: string; partialFrom?: string }) {
  const partial = state === 'partial';
  const on = state === 'on';
  return (
    <span className="relative inline-flex items-center">
      {/* Chave do design system (não a Chave da casa: aqui o efeito espera o Salvar).
          O aria-checked 'mixed' sobrescreve o do Radix pra leitor de tela ouvir "parcialmente". */}
      <Switch
        checked={on}
        aria-checked={partial ? 'mixed' : on}
        aria-label={lockedBy ? `${label} — Vem do cargo ${lockedBy}` : partial ? `${label} — em parte` : label}
        title={lockedBy ? `Vem do cargo ${lockedBy}` : partialFrom ? `Parte vem do cargo ${partialFrom}` : undefined}
        disabled={disabled || !!lockedBy || !!partialFrom}
        onCheckedChange={() => onClick()}
        className={partial ? 'bg-primary/40 data-[state=unchecked]:bg-primary/40' : undefined}
      />
      {partial && <span aria-hidden className="ml-1.5 text-[10px] text-muted-foreground">em parte</span>}
      {changed && (
        <span data-testid="mudou" title="Mudança ainda não salva" aria-hidden className="absolute -right-2 -top-1 h-2 w-2 rounded-full bg-amber-500" />
      )}
    </span>
  );
}

interface Props {
  /** Avisa a página quando há mudança sem salvar (a página confirma antes de trocar de aba). */
  onDirtyChange?: (dirty: boolean) => void;
}

export default function PermissionsMatrix({ onDirtyChange }: Props) {
  const { can } = useUserPermissions();
  const canRead = can('roles', 'read');
  const canUpdate = can('roles', 'update');

  const [data, setData] = useState<{ themes: CapabilityTheme[]; roles: RoleCapabilities[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [draft, setDraft] = useState<PermissionsDraft>({});
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const savingRef = useRef(false);
  const navigate = useNavigate();
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setData(await customRolesService.capabilities());
    } catch (e) {
      if ((e as { response?: { status?: number } })?.response?.status === 403) setForbidden(true);
      else setFailed(true);
    }
  }, []);

  useEffect(() => { if (canRead) void load(); }, [canRead, load]);

  // Depois de recarregar, linha que o pai passou a liberar fica travada no filho e some do
  // rascunho: senão a contagem teria mudança sem bolinha na tela.
  useEffect(() => {
    if (data) setDraft(d => dropEntries(d, (roleId, key) => !!lockedParent(data.roles, roleId, key)));
  }, [data]);

  const changes = countChanges(draft);
  useEffect(() => { onDirtyChange?.(changes > 0); }, [changes, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  // Fechar/recarregar a aba com mudança não salva: o navegador pergunta.
  useEffect(() => {
    if (changes === 0) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [changes]);

  const themes = useMemo(() => {
    if (!data) return [];
    const q = norm(query.trim());
    if (!q) return data.themes;
    return data.themes
      .map(t => ({ ...t, rows: t.rows.filter(r => norm(r.label).includes(q) || norm(r.hint ?? '').includes(q)) }))
      .filter(t => t.rows.length > 0);
  }, [data, query]);

  const save = async () => {
    if (savingRef.current || !data) return;
    savingRef.current = true;
    setSaving(true);
    setErrors([]);
    const pending = changesByRole(draft)
      .map(({ roleId, changes: c }) => ({
        roleId,
        // Desligar linha que o pai tem (toda ou em parte) o servidor recusa: não vira chamada.
        changes: Object.fromEntries(Object.entries(c).filter(([k, v]) => v || !parentBlocksOff(data.roles, roleId, k))),
      }))
      .filter(p => Object.keys(p.changes).length > 0);
    // Rascunho que sobrou só de "desligar" linha herdada não vira chamada: sai do rascunho.
    const comChamada = new Set(pending.map(p => p.roleId));
    setDraft(cur => Object.keys(cur).reduce((acc, id) => (comChamada.has(Number(id)) ? acc : clearRole(acc, Number(id))), cur));
    const enviar = async ({ roleId, changes: c }: (typeof pending)[number]) => {
      try {
        return { roleId, role: await customRolesService.updateCapabilities(roleId, c), error: null as string | null };
      } catch (e) {
        return { roleId, role: null, error: capabilitiesErrorMessage(e, 'Não consegui salvar. Tente de novo.') };
      }
    };
    // Pais antes dos filhos: o servidor confere a herança no momento de cada chamada.
    const ids = new Set(pending.map(p => data.roles.find(r => r.id === p.roleId)?.inherits_from_id));
    const pais = pending.filter(p => ids.has(p.roleId));
    const demais = pending.filter(p => !ids.has(p.roleId));
    const results = [...(await Promise.all(pais.map(enviar))), ...(await Promise.all(demais.map(enviar)))];
    const okRoles = new Set(results.filter(r => r.role).map(r => r.roleId));
    // Cargo que herda de um salvo mudou junto: recarrega tudo em vez de remendar um cargo só.
    if (okRoles.size > 0) {
      try {
        setData(await customRolesService.capabilities());
      } catch {
        const salvos = new Map(results.filter(r => r.role).map(r => [r.roleId, r.role!]));
        setData(d => d && ({ ...d, roles: d.roles.map(r => (salvos.has(r.id) ? { ...r, states: salvos.get(r.id)!.states } : r)) }));
      }
    }
    setDraft(cur => results.reduce((acc, r) => (r.role ? clearRole(acc, r.roleId) : acc), cur));
    const falhas = results.filter(r => r.error).map(r => {
      const nome = data.roles.find(x => x.id === r.roleId)?.name ?? 'Cargo';
      return `${nome}: ${r.error}`;
    });
    setErrors(falhas);
    if (okRoles.size > 0 && falhas.length === 0) toast.success('Permissões salvas.');
    savingRef.current = false;
    setSaving(false);
  };

  if (!canRead || forbidden) return <NoAccessState />;
  if (failed) {
    return (
      <div className="rounded-lg border border-border bg-card py-10 text-center">
        <p className="text-muted-foreground">Não consegui carregar as permissões.</p>
        <div className="mt-4 flex items-center justify-center gap-4">
          <Button variant="outline" onClick={() => void load()}>Tentar de novo</Button>
          <Link to="/equipe/cargos/lista" className="text-sm text-primary hover:underline">Ver a lista completa</Link>
        </div>
      </div>
    );
  }
  if (!data) {
    return <div className="rounded-lg border border-border bg-card py-10 text-center text-muted-foreground">Carregando permissões...</div>;
  }

  const colunas = data.roles;

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar permissão"
          aria-label="Buscar permissão"
          className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card" data-testid="quadro-permissoes">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="sticky left-0 z-10 bg-card p-3 text-left font-medium text-muted-foreground">Permissão</th>
              {colunas.map(role => (
                <th key={role.id} scope="col" className="min-w-[120px] p-3 text-center align-top font-medium">
                  <span className="flex items-center justify-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: role.color }} aria-hidden />
                    {role.name}
                  </span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {!role.system && 'personalizado · '}{plural(role.users_count, 'pessoa', 'pessoas')}
                  </span>
                  {role.inherits_from_name && (
                    <span className="block text-xs font-normal text-muted-foreground">Herda do cargo {role.inherits_from_name}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          {themes.length === 0 && (
            <tbody>
              <tr><td colSpan={colunas.length + 1} className="p-6 text-center text-muted-foreground">Nenhuma permissão com esse nome.</td></tr>
            </tbody>
          )}
          {themes.map(theme => (
            <tbody key={theme.key}>
              <tr className="bg-muted/40">
                <th scope="rowgroup" colSpan={colunas.length + 1} className="sticky left-0 p-2 px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {theme.label}
                </th>
              </tr>
              {theme.rows.map(row => (
                <tr key={row.key} className="border-t border-border">
                  <th scope="row" className="sticky left-0 z-10 bg-card p-3 text-left font-normal">
                    <span className="block font-medium">{row.label}</span>
                    {row.hint && <span className="block text-xs text-muted-foreground">{row.hint}</span>}
                  </th>
                  {colunas.map(role => {
                    if (role.always_full) {
                      return (
                        <td key={role.id} className="p-3 text-center">
                          <span title="O administrador sempre pode tudo" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Lock className="h-3.5 w-3.5" aria-hidden />
                            <span aria-hidden>Sempre</span>
                            <span className="sr-only">{`${role.name}: ${row.label} — O administrador sempre pode tudo`}</span>
                          </span>
                        </td>
                      );
                    }
                    const current = role.states[row.key] ?? 'off';
                    const lockedBy = lockedParent(colunas, role.id, row.key);
                    const state = lockedBy ? 'on' : effectiveState(draft, role.id, row.key, current);
                    // Pai com parte da linha: ligar pode, desligar o servidor recusa. Se a célula só está
                    // ligada por rascunho (servidor 'off'), clicar de novo volta ao servidor e é permitido.
                    const partialFrom = !lockedBy && state === 'on' && current !== 'off' && parentBlocksOff(colunas, role.id, row.key)
                      ? parentOf(colunas, role.id, row.key)?.name
                      : undefined;
                    return (
                      <td key={role.id} className="p-3 text-center">
                        <Interruptor
                          state={state}
                          label={`${role.name}: ${row.label}`}
                          disabled={!canUpdate || saving}
                          lockedBy={lockedBy}
                          partialFrom={partialFrom}
                          changed={!lockedBy && draft[role.id]?.[row.key] !== undefined}
                          onClick={() => setDraft(d => toggle(d, role.id, row.key, current))}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <Link
        to="/equipe/cargos/lista"
        className="inline-block text-sm text-primary hover:underline"
        onClick={async e => {
          if (changes === 0) return;
          e.preventDefault();
          const ok = await confirmar({
            titulo: 'Descartar alterações?',
            descricao: 'Você mudou permissões e ainda não salvou. Se sair agora, essas mudanças se perdem.',
            rotuloDaAcao: 'Descartar',
            destrutivo: true,
          });
          if (ok) navigate('/equipe/cargos/lista');
        }}
      >
        Ver a lista completa (cada botão de cada tela)
      </Link>
      {dialogoDeConfirmacao}

      {canUpdate && (
        <div className="sticky bottom-0 z-20 -mx-1 rounded-lg border border-border bg-card p-3 shadow-lg">
          {errors.length > 0 && (
            <ul role="alert" className="mb-2 space-y-0.5 text-sm text-destructive">
              {errors.map(e => <li key={e}>{e}</li>)}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p aria-live="polite" className={`text-sm font-medium ${changes ? 'text-amber-600' : 'text-emerald-600'}`}>
              {changes ? `${plural(changes, 'mudança', 'mudanças')} ainda não ${changes === 1 ? 'salva' : 'salvas'}` : 'Tudo salvo'}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" disabled={!changes || saving} onClick={() => { setDraft({}); setErrors([]); }}>Desfazer</Button>
              <Button disabled={!changes || saving} onClick={() => void save()}>{saving ? 'Salvando...' : 'Salvar'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
