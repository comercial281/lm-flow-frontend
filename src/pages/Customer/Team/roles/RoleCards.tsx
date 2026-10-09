import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Minus, Plus, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/ds';
import { plural } from '@/lib/formato';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { customRolesService } from '@/services/customRoles/customRolesService';
import type { CapabilityTheme, CustomRole, PermissionSection, RoleCapabilities } from '@/types/customRoles';
import RoleEditorModal from '@/pages/Customer/Settings/Roles/RoleEditorModal';

/* Aba "Cargos" da Equipe — um cartão por cargo, com o que ele pode e o que não
   pode, em frases curtas. Os rótulos das linhas vêm do servidor (a tela não
   escreve rótulo de permissão). A matriz técnica continua no editor, atrás de
   "Ver tudo o que pode". */

// Temas que mais interessam a quem escolhe um cargo, na ordem de prioridade.
const TEMAS_PRIORITARIOS = ['leads e funil', 'atendimento', 'equipe e números'];
const MAX_PODE = 3;
const MAX_NAO_PODE = 2;

const norm = (t: string) => t.trim().toLowerCase();

/** Linhas de um estado, achatadas e ordenadas: temas prioritários primeiro, depois o resto. */
export function linhasPorEstado(themes: CapabilityTheme[], states: RoleCapabilities['states'], estado: 'on' | 'off') {
  const rank = (t: CapabilityTheme) => {
    const i = TEMAS_PRIORITARIOS.indexOf(norm(t.label));
    return i === -1 ? TEMAS_PRIORITARIOS.length : i;
  };
  return themes
    .map((t, ordem) => ({ t, ordem }))
    .sort((a, b) => rank(a.t) - rank(b.t) || a.ordem - b.ordem)
    .flatMap(({ t }) => t.rows.filter(r => states[r.key] === estado).map(r => r.label));
}

function resumo(role: RoleCapabilities, themes: CapabilityTheme[]): string {
  if (role.always_full) return 'Controla tudo na imobiliária.';
  const total = themes.reduce((n, t) => n + t.rows.length, 0);
  const ligadas = themes.reduce((n, t) => n + t.rows.filter(r => role.states[r.key] === 'on').length, 0);
  const emParte = themes.reduce((n, t) => n + t.rows.filter(r => role.states[r.key] === 'partial').length, 0);
  const base = `Libera ${ligadas} de ${plural(total, 'permissão', 'permissões')}${emParte ? ` (${emParte} em parte)` : ''}.`;
  return role.inherits_from_name ? `${base} Parte do cargo “${role.inherits_from_name}”.` : base;
}

interface CardProps {
  role: RoleCapabilities;
  themes: CapabilityTheme[];
  onSeeAll?: () => void;
  busy?: boolean;
}

function RoleCard({ role, themes, onSeeAll, busy }: CardProps) {
  const pode = linhasPorEstado(themes, role.states, 'on').slice(0, MAX_PODE);
  const naoPode = linhasPorEstado(themes, role.states, 'off').slice(0, MAX_NAO_PODE);
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-4" data-testid={`cargo-${role.id}`}>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="inline-block h-3 w-3 rounded-full" style={{ background: role.color }} aria-hidden />
        <h3 className="text-base font-semibold">{role.name}</h3>
        {role.system && (
          <span className="rounded bg-primary/15 px-2 py-0.5 text-xs text-primary">Pronto pra usar</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{plural(role.users_count, 'pessoa', 'pessoas')}</p>
      <p className="mt-2 text-sm text-muted-foreground">{resumo(role, themes)}</p>

      <div className="mt-3 flex-1 space-y-1.5 text-sm">
        {role.always_full ? (
          <p className="font-medium">Pode tudo, sempre.</p>
        ) : (
          <>
            {pode.map(l => (
              <p key={`p-${l}`} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                <span><span className="sr-only">Pode: </span>{l}</span>
              </p>
            ))}
            {naoPode.map(l => (
              <p key={`n-${l}`} className="flex items-start gap-2 text-muted-foreground">
                <Minus className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span><span className="sr-only">Não pode: </span>{l}</span>
              </p>
            ))}
          </>
        )}
      </div>

      {onSeeAll && (
        <Button variant="outline" size="sm" className="mt-4 self-start" onClick={onSeeAll} disabled={busy}>
          Ver tudo o que pode
        </Button>
      )}
    </div>
  );
}

export default function RoleCards() {
  const { can } = useUserPermissions();
  const canUpdate = can('roles', 'update');
  // O servidor só deixa criar cargo com roles.update (ou administrador).
  const canCreate = can('roles', 'create') && canUpdate;

  const [data, setData] = useState<{ themes: CapabilityTheme[]; roles: RoleCapabilities[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [editor, setEditor] = useState<{ role: CustomRole | null; catalog: PermissionSection[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setData(await customRolesService.capabilities());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // O catálogo antigo é pesado e só serve ao editor: carrega no clique.
  const openEditor = async (roleId: number | null) => {
    setBusy(true);
    try {
      const [catalog, role] = await Promise.all([
        customRolesService.permissionsCatalog(),
        roleId === null ? Promise.resolve(null) : customRolesService.get(roleId),
      ]);
      setEditor({ role, catalog });
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não consegui abrir o cargo. Tente de novo.'));
    } finally {
      setBusy(false);
    }
  };

  if (failed) {
    return (
      <div className="rounded-lg border border-border bg-card py-10 text-center">
        <p className="text-muted-foreground">Não consegui carregar os cargos.</p>
        <Button className="mt-4" variant="outline" onClick={() => void load()}>Tentar de novo</Button>
      </div>
    );
  }
  if (!data) {
    return <div className="rounded-lg border border-border bg-card py-10 text-center text-muted-foreground">Carregando cargos...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.roles.map(role => (
          <RoleCard
            key={role.id}
            role={role}
            themes={data.themes}
            busy={busy}
            onSeeAll={canUpdate && !role.always_full ? () => void openEditor(role.id) : undefined}
          />
        ))}
      </div>

      <div className="rounded-lg border border-dashed border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <Shield className="h-4 w-4" aria-hidden /> Cargos personalizados
            </h3>
            <p className="text-sm text-muted-foreground">Para quando os três cargos prontos não servem.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/equipe/cargos/lista" className="text-sm text-primary hover:underline">Ver a lista completa</Link>
            {canCreate && (
              <Button onClick={() => void openEditor(null)} disabled={busy} className="gap-2">
                <Plus className="h-4 w-4" /> Criar cargo personalizado
              </Button>
            )}
          </div>
        </div>
      </div>

      {editor && (
        <RoleEditorModal
          open
          onClose={() => setEditor(null)}
          role={editor.role}
          catalog={editor.catalog}
          onSaved={() => void load()}
        />
      )}
    </div>
  );
}
