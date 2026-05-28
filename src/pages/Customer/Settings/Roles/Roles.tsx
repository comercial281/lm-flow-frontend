import { useEffect, useState } from 'react';
import { Button } from '@evoapi/design-system';
import { Plus, Copy, Pencil, Trash2, Clock, Shield, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { customRolesService } from '@/services/customRoles/customRolesService';
import type { CustomRole, PermissionSection } from '@/types/customRoles';
import RoleEditorModal from './RoleEditorModal';
import RoleAuditModal from './RoleAuditModal';

export default function RolesPage() {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [catalog, setCatalog] = useState<PermissionSection[]>([]);
  const [loading, setLoading] = useState(true);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);

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
    } catch (err: any) {
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
      toast.error('Cargo do sistema não pode ser deletado');
      return;
    }
    if (role.users_count > 0) {
      if (!confirm(`Este cargo está em uso por ${role.users_count} usuário(s). Eles ficarão sem cargo definido. Continuar?`)) return;
    } else {
      if (!confirm(`Deletar cargo '${role.name}'?`)) return;
    }
    try {
      await customRolesService.destroy(role.id);
      toast.success('Cargo removido');
      refresh();
    } catch (err: any) {
      toast.error('Erro ao deletar: ' + (err?.message ?? 'desconhecido'));
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
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Shield className="h-6 w-6 text-primary" />
            Cargos e Permissões
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Defina quais funções cada cargo pode acessar no CRM
          </p>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Cargo
        </Button>
      </div>

      {loading && (
        <div className="rounded-lg border border-border bg-card py-10 text-center text-muted-foreground">
          Carregando cargos...
        </div>
      )}

      {!loading && roles.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card py-10 text-center">
          <Shield className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">Nenhum cargo encontrado.</p>
          <Button className="mt-4" onClick={handleNew}>Criar primeiro cargo</Button>
        </div>
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
                    title="Cargo do sistema (não pode ser deletado, mas pode ser editado)"
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
                  <strong className="text-foreground">{role.users_count}</strong> usuário(s)
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
                  title={role.system ? 'Cargo do sistema não pode ser deletado' : 'Deletar'}
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
    </div>
  );
}
