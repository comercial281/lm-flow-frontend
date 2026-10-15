import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Textarea,
} from '@/components/ui/ds';
import { toast } from 'sonner';
import { customRolesService } from '@/services/customRoles/customRolesService';
import type {
  CustomRole,
  PermissionSection,
  RoleFormData,
} from '@/types/customRoles';
import { CampoDaJanela, GradeDaJanela, GrupoDaJanela } from '@/components/base/janela';
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
const NOME_DA_COR: Record<string, string> = {
  '#7B2CFF': 'Roxo', '#4A148C': 'Roxo escuro', '#3B82F6': 'Azul', '#10B981': 'Verde',
  '#F59E0B': 'Âmbar', '#EF4444': 'Vermelho', '#EC4899': 'Rosa', '#6B7280': 'Cinza',
};

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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isCreating ? 'Novo cargo' : `Editar cargo: ${role?.name}`}
            {role?.system && (
              <span className="ml-2 rounded bg-primary/20 px-2 py-0.5 text-xs text-primary">
                Sistema
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-1 py-2">
          <GrupoDaJanela titulo="Identificação">
            <GradeDaJanela>
              <CampoDaJanela rotulo="Nome" htmlFor="cargo-nome" obrigatorio colunas={3}>
                <Input
                  id="cargo-nome"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex.: Gerente comercial"
                />
              </CampoDaJanela>
              <CampoDaJanela rotulo="Cor" colunas={1}>
                <div role="group" aria-label="Cor" className="flex flex-wrap gap-2 pt-1">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      aria-label={NOME_DA_COR[c] ?? c}
                      aria-pressed={color === c}
                      className={`h-7 w-7 rounded-full border-2 transition-all ${
                        color === c ? 'border-white ring-2 ring-primary' : 'border-transparent'
                      }`}
                      style={{ background: c }}
                      title={NOME_DA_COR[c] ?? c}
                    />
                  ))}
                </div>
              </CampoDaJanela>
              <CampoDaJanela rotulo="Descrição" htmlFor="cargo-descricao" colunas={4}>
                <Textarea
                  id="cargo-descricao"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Descreva pra que serve este cargo"
                />
              </CampoDaJanela>
            </GradeDaJanela>
          </GrupoDaJanela>

          <GrupoDaJanela titulo={`Permissões · ${selected.size}`}>
            <p className="text-xs text-muted-foreground">
              Quais funções deste cargo podem ver e executar
            </p>
            <PermissionMatrix
              catalog={catalog}
              selected={selected}
              onToggle={togglePermission}
              onBulkToggle={bulkToggle}
              disabled={saving}
            />
          </GrupoDaJanela>
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
