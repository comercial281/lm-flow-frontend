import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { PERMISSIONS_LOAD_FAILED_MESSAGE, PERMISSIONS_RETRY_LABEL } from './noAccessCopy';

/**
 * No lugar da tela quando a leitura das permissões falhou por rede/servidor.
 * Nunca o aviso do cargo: a lista está vazia porque não chegou, não porque o
 * cargo não tem nada.
 */
export default function PermissionsRetryState({ onRetry, className = '' }: { onRetry: () => void; className?: string }) {
  return (
    <div
      role="status"
      className={`flex h-full min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center ${className}`}
    >
      <p className="max-w-md text-sm text-muted-foreground">{PERMISSIONS_LOAD_FAILED_MESSAGE}</p>
      <Button variant="outline" className="text-sm" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5 mr-1" aria-hidden />
        {PERMISSIONS_RETRY_LABEL}
      </Button>
    </div>
  );
}
