import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
} from '@/components/ui/ds';
import { toast } from 'sonner';
import { customRolesService } from '@/services/customRoles/customRolesService';
import type {
  CustomRole,
  PermissionSection,
  RoleFormData,
} from '@/types/customRoles';
import PermissionMatrix from './PermissionMatrix';

interface Props {
  open: boolean;
  onClose: () => void;
  role: CustomRole | null;        // null = creating
  catalog: PermissionSection[];
  onSaved: (saved: CustomRole) => void;
}

const COLORS = [
  '#7B2CFF', '#4A148C', '#3B82F6', '#10B981',
  '#F59E0B', '#EF4444', '#EC4899', '#6B7280',
];

export default function RoleEditorModal({ open, onClose, role, catalog, onSaved }: Props) {
  const isCreating = !role;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#7B2CFF');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(role?.name ?? '');
      setDescription(role?.description ?? '');
      setColor(role?.color ?? '#7B2CFF');
      setSelected(new Set(role?.permissions ?? []));
    }
  }, [open, role]);

  const togglePermission = (permission: string, on: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (on) next.add(permission);
      else next.delete(permission);
      return next;
    });
  };

  const bulkToggle = (permissions: string[], on: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      permissions.forEach(p => (on ? next.add(p) : next.delete(p)));
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    setSaving(true);
    try {
      const payload: RoleFormData = {
        name: name.trim(),
        description: description.trim() || null,
        color,
        permissions: Array.from(selected).sort(),
      };
      const saved = isCreating
        ? await customRolesService.create(payload)
        : await customRolesService.update(role!.id, payload);
      toast.success(isCreating ? 'Cargo criado' : 'Cargo atualizado');
      onSaved(saved);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.errors?.join(', ') || err?.message || 'Erro ao salvar';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isCreating ? 'Novo Cargo' : `Editar Cargo: ${role?.name}`}
            {role?.system && (
              <span className="ml-2 rounded bg-primary/20 px-2 py-0.5 text-xs text-primary">
                Sistema
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 px-1 py-2">
          {/* Identificação */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Nome *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Gerente Comercial"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Cor</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${
                      color === c ? 'border-white ring-2 ring-primary' : 'border-transparent'
                    }`}
                    style={{ background: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Descrição</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Descreva pra que serve este cargo"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          {/* Permissões */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Permissões ({selected.size})</h3>
              <span className="text-xs text-muted-foreground">
                Quais funções deste cargo podem ver e executar
              </span>
            </div>
            <PermissionMatrix
              catalog={catalog}
              selected={selected}
              onToggle={togglePermission}
              onBulkToggle={bulkToggle}
              disabled={saving}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
