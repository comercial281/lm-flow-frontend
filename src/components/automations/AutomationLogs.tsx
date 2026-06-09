import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { Badge } from '@evoapi/design-system/badge';
import api from '@/services/core/api';

interface AutomationLog {
  id: number;
  status: 'success' | 'partial' | 'failed';
  conversation_id: number | null;
  actions_performed: string[];
  error_message: string | null;
  created_at: string;
}

interface AutomationLogsProps {
  automationRuleId: string | number;
}

const STATUS_ICON = {
  success: <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />,
  failed: <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />,
  partial: <Clock className="h-4 w-4 text-orange-500 flex-shrink-0" />,
};

const BADGE_VARIANT: Record<AutomationLog['status'], 'default' | 'destructive' | 'secondary'> = {
  success: 'default',
  failed: 'destructive',
  partial: 'secondary',
};

export function AutomationLogs({ automationRuleId }: AutomationLogsProps) {
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    api
      .get(`/automation_rules/${automationRuleId}/logs`)
      .then((res) => setLogs(res.data.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [automationRuleId]);

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground p-4">Carregando logs...</div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-destructive p-4">Erro ao carregar logs de execucao.</div>
    );
  }

  if (!logs.length) {
    return (
      <div className="text-sm text-muted-foreground p-4">Nenhum log de execucao ainda.</div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      <h3 className="text-sm font-semibold">Logs de execucao</h3>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {logs.map((log) => (
          <div
            key={log.id}
            className="flex items-start gap-2 p-2 rounded bg-muted/40 text-xs"
          >
            {STATUS_ICON[log.status]}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant={BADGE_VARIANT[log.status]}
                  className="text-[10px] h-4"
                >
                  {log.status}
                </Badge>
                <span className="text-muted-foreground">
                  {new Date(log.created_at).toLocaleString('pt-BR')}
                </span>
                {log.conversation_id != null && (
                  <span className="text-muted-foreground">
                    Conv #{log.conversation_id}
                  </span>
                )}
              </div>
              {log.actions_performed.length > 0 && (
                <p className="text-muted-foreground truncate mt-0.5">
                  {log.actions_performed.join(', ')}
                </p>
              )}
              {log.error_message && (
                <p className="text-destructive truncate mt-0.5">{log.error_message}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AutomationLogs;
