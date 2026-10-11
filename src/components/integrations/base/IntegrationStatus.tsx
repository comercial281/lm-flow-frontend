import { useLanguage } from '@/hooks/useLanguage';
import { Badge, Card, Button } from '@/components/ui/ds';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
} from 'lucide-react';
import Aviso from '@/components/base/Aviso';
interface IntegrationConnection {
  account?: string;
  workspace?: string;
  permissions?: string[];
}

type StatusType = 'connected' | 'disconnected' | 'error' | 'pending' | 'syncing';

interface IntegrationStatusProps {
  status: StatusType;
  connection?: IntegrationConnection;
  lastSyncAt?: string;
  onRefresh?: () => void;
  onReconnect?: () => void;
  isRefreshing?: boolean;
  errorMessage?: string;
  className?: string;
}

const getStatusConfig = (t: any) => ({
  connected: {
    icon: CheckCircle,
    color: 'success',
    label: t('status.connected'),
    description: t('statusDescriptions.connected')
  },
  disconnected: {
    icon: XCircle,
    color: 'secondary',
    label: t('status.disconnected'),
    description: t('statusDescriptions.disconnected')
  },
  error: {
    icon: AlertTriangle,
    color: 'destructive',
    label: t('status.error'),
    description: t('statusDescriptions.error')
  },
  pending: {
    icon: Clock,
    color: 'secondary',
    label: t('status.pending'),
    description: t('statusDescriptions.pending')
  },
  syncing: {
    icon: RefreshCw,
    color: 'default',
    label: t('status.syncing'),
    description: t('statusDescriptions.syncing')
  }
} as const);

export default function IntegrationStatus({
  status,
  connection,
  lastSyncAt,
  onRefresh,
  onReconnect,
  isRefreshing = false,
  errorMessage,
  className = ''
}: IntegrationStatusProps) {
  const { t } = useLanguage('integrations');
  const config = getStatusConfig(t)[status];
  const Icon = config.icon;

  const formatDate = (dateString?: string) => {
    if (!dateString) return t('connection.never');

    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Status Badge */}
          <div className="flex items-center gap-2 mb-3">
            <Badge
              variant={config.color as "success" | "secondary" | "destructive" | "default"}
              className="flex items-center gap-1"
            >
              <Icon className={`w-3 h-3 ${status === 'syncing' ? 'animate-spin' : ''}`} />
              {config.label}
            </Badge>
          </div>

          {/* Description */}
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            {errorMessage || config.description}
          </p>

          {/* Connection Details */}
          {connection && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {connection.account && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400">{t('connection.account')}</span>
                  <div className="font-medium text-slate-900 dark:text-white">
                    {connection.account}
                  </div>
                </div>
              )}

              {connection.workspace && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400">{t('connection.workspace')}</span>
                  <div className="font-medium text-slate-900 dark:text-white">
                    {connection.workspace}
                  </div>
                </div>
              )}

              <div>
                <span className="text-slate-500 dark:text-slate-400">{t('connection.lastSync')}</span>
                <div className="font-medium text-slate-900 dark:text-white">
                  {formatDate(lastSyncAt)}
                </div>
              </div>

              {connection.permissions && connection.permissions.length > 0 && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400">{t('connection.permissions')}</span>
                  <div className="font-medium text-slate-900 dark:text-white">
                    {t('connection.permissionsConfigured', { count: connection.permissions.length })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Details */}
          {status === 'error' && errorMessage && (
            <Aviso tom="erro" titulo={t('connection.errorLabel')} className="mt-3">
              {errorMessage}
            </Aviso>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4">
          {status === 'connected' && onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label="Atualizar"
              title="Atualizar"
              className="p-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          )}

          {(status === 'error' || status === 'disconnected') && onReconnect && (
            <Button
              variant="outline"
              size="sm"
              onClick={onReconnect}
            >
              {t('actions.reconnect')}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
