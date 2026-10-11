import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/ds';
import { Plus, Copy, Pencil, Trash2, Clock, Shield, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { plural, numero } from '@/lib/formato';
import { customRolesService } from '@/services/customRoles/customRolesService';
import type { CustomRole, PermissionSection } from '@/types/customRoles';
import RoleEditorModal from './RoleEditorModal';
import RoleAuditModal from './RoleAuditModal';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';

interface RolesPageProps {
  /* Dentro da aba Cargos da tela de Equipe, o título da página já está acima.
     Repetir "Cargos e Permissões" em corpo de h1 no meio da tela daria dois
     títulos concorrendo. Aberta sozinha (rota própria), a tela segue com o dela. */
  embedded?: boolean;
}

export default function RolesPage({ embedded = false }: RolesPageProps) {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [catalog, setCatalog] = useState<PermissionSection[]>([]);
  const [loading, setLoading] = useState(true);
  // Falha na carga não pode virar "Nenhum cargo encontrado" (erro nunca vira vazio).
  const [erro, setErro] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);

  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  const [auditOpen, setAuditOpen] = useState(false);
  const [auditingRole, setAuditingRole] = useState<CustomRole | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [r, c] = await Promise.all([
        customRolesService.list(),
        customRolesService.permissionsCatalog(),
      ]);
      setRoles(r);
      setCatalog(c);
      setErro(false);
    } catch (err: any) {
      setErro(true);
      toast.error('Erro ao carregar cargos: ' + (err?.message ?? 'desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleNew = () => {
    setEditingRole(null);
    setEditorOpen(true);
  };

  const handleEdit = (role: CustomRole) => {
    setEditingRole(role);
    setEditorOpen(true);
  };

  const handleClone = async (role: CustomRole) => {
    try {
      const cloned = await customRolesService.clone(role.id);
      toast.success(`Cargo '${cloned.name}' criado a partir de '${role.name}'`);
      refresh();
    } catch (err: any) {
      toast.error('Erro ao clonar: ' + (err?.message ?? 'desconhecido'));
    }
  };

  const handleDelete = async (role: CustomRole) => {
    if (role.system) {
      toast.error('Cargo do sistema não pode ser excluído');
      return;
    }
    const emUso = role.users_count > 0;
    if (
      !(await confirmar({
        titulo: `Excluir cargo '${role.name}'?`,
        descricao: emUso
          ? `Este cargo está em uso por ${plural(role.users_count, 'usuário', 'usuários')}. ${role.users_count === 1 ? 'Ele ficará' : 'Eles ficarão'} sem cargo definido.`
          : undefined,
        rotuloDaAcao: 'Excluir',
        destrutivo: true,
      }))
    )
      return;
    try {
      await customRolesService.destroy(role.id);
      toast.success('Cargo excluído');
      refresh();
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + (err?.message ?? 'desconhecido'));
    }
  };

  const handleAudit = (role: CustomRole) => {
    setAuditingRole(role);
    setAuditOpen(true);
  };

  const handleSaved = () => {
    refresh();
  };

  return (
    <div className={embedded ? 'space-y-6' : 'space-y-6 p-6'}>
      <div className="flex items-start justify-between">
        <div>
          {embedded ? (
            <p className="text-sm text-muted-foreground">
              Defina quais funções cada cargo pode acessar no CRM
            </p>
          ) : (
            <>
              <h1 className="flex items-center gap-2 text-2xl font-bold">
                <Shield className="h-6 w-6 text-primary" />
                Cargos e Permissões
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Defina quais funções cada cargo pode acessar no CRM
              </p>
            </>
          )}
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Cargo
        </Button>
      </div>

      {loading && <Carregando variante="cartoes" rotulo="Carregando cargos..." />}

      {!loading && erro && roles.length === 0 && (
        <EmptyState tipo="erro" aoTentarDeNovo={() => void refresh()} />
      )}

      {!loading && !erro && roles.length === 0 && (
        <EmptyState
          icon={Shield}
          title="Nenhum cargo encontrado."
          action={{ label: 'Criar primeiro cargo', onClick: handleNew }}
        />
      )}

      {!loading && roles.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roles.map(role => (
            <div
              key={role.id}
              className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ background: role.color }}
                  />
                  <h3 className="text-base font-semibold">{role.name}</h3>
                </div>
                {role.system && (
                  <span
                    className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    title="Cargo do sistema (não pode ser excluído, mas pode ser editado)"
                  >
                    <Lock className="h-3 w-3" /> Sistema
                  </span>
                )}
              </div>

              {role.description && (
                <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
                  {role.description}
                </p>
              )}

              <div className="mb-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  <strong className="text-foreground">{role.effective_permissions.length}</strong>{' '}
                  permissões
                </span>
                <span>•</span>
                <span>
                  <strong className="text-foreground">{numero(role.users_count)}</strong>{' '}
                  {role.users_count === 1 ? 'usuário' : 'usuários'}
                </span>
              </div>

              <div className="flex items-center gap-1 border-t border-border pt-3">
                <button
                  onClick={() => handleEdit(role)}
                  className="flex flex-1 items-center justify-center gap-1 rounded px-2 py-1.5 text-xs hover:bg-muted"
                  title="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </button>
                <button
                  onClick={() => handleClone(role)}
                  className="flex flex-1 items-center justify-center gap-1 rounded px-2 py-1.5 text-xs hover:bg-muted"
                  title="Duplicar"
                >
                  <Copy className="h-3.5 w-3.5" /> Duplicar
                </button>
                <button
                  onClick={() => handleAudit(role)}
                  className="flex flex-1 items-center justify-center gap-1 rounded px-2 py-1.5 text-xs hover:bg-muted"
                  title="Ver histórico"
                >
                  <Clock className="h-3.5 w-3.5" /> Histórico
                </button>
                <button
                  onClick={() => handleDelete(role)}
                  disabled={role.system}
                  className="flex items-center justify-center gap-1 rounded px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
                  title={role.system ? 'Cargo do sistema não pode ser excluído' : 'Excluir'}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <RoleEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        role={editingRole}
        catalog={catalog}
        onSaved={handleSaved}
      />

      <RoleAuditModal
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        role={auditingRole}
      />

      {dialogoDeConfirmacao}
    </div>
  );
}
