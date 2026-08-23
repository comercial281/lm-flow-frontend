import { useEffect, useState } from 'react';
import { formatDateTimeBR } from '@/utils/dateUtils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/ds';
import { customRolesService } from '@/services/customRoles/customRolesService';
import type { CustomRole, RoleAuditLogEntry } from '@/types/customRoles';

interface Props {
  open: boolean;
  onClose: () => void;
  role: CustomRole | null;
}

const ACTION_LABELS: Record<string, string> = {
  created: 'Criado',
  updated: 'Editado',
  deleted: 'Deletado',
  permission_added: 'Permissão adicionada',
  permission_removed: 'Permissão removida',
  permission_replaced: 'Permissão alterada',
  renamed: 'Renomeado',
  cloned: 'Clonado',
  restored: 'Restaurado',
};

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-green-500',
  updated: 'bg-blue-500',
  deleted: 'bg-red-500',
  permission_added: 'bg-emerald-500',
  permission_removed: 'bg-orange-500',
  permission_replaced: 'bg-orange-500',
  renamed: 'bg-purple-500',
  cloned: 'bg-pink-500',
  restored: 'bg-cyan-500',
};

export default function RoleAuditModal({ open, onClose, role }: Props) {
  const [logs, setLogs] = useState<RoleAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !role) return;
    setLoading(true);
    customRolesService
      .auditLog(role.id)
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [open, role]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico — {role?.name}</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Carregando histórico...
          </div>
        )}

        {!loading && logs.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Sem registros ainda
          </div>
        )}

        {!loading && logs.length > 0 && (
          <div className="space-y-3">
            {logs.map(log => (
              <div
                key={log.id}
                className="flex gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div
                  className={`mt-1 h-3 w-3 flex-shrink-0 rounded-full ${
                    ACTION_COLORS[log.action] ?? 'bg-gray-500'
                  }`}
                  title={log.action}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTimeBR(log.created_at)}
                    </span>
                  </div>
                  {log.note && (
                    <p className="mt-1 text-sm text-muted-foreground">{log.note}</p>
                  )}
                  {log.changed_by && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      por <span className="font-medium">{log.changed_by.name}</span>{' '}
                      ({log.changed_by.email})
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
