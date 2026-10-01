import { useCallback, useEffect, useState } from 'react';
import { Loader2, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import api from '@/services/core/api';
import ClientBroadcastModal from './PooledClients/ClientBroadcastModal';

type Tenant = Parameters<typeof ClientBroadcastModal>[0]['tenants'][number];

/**
 * Comunicação → WhatsApp. O Comunicado, que era um botão no topo de Clientes.
 * Neste passo a escrita continua na janela de sempre (todos os clientes vêm
 * marcados, decisão registrada); ela vira tela própria, com confirmação, no PR
 * de Comunicação.
 */
export default function ComunicadoWhatsapp() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true); setErro('');
    try {
      const r = await api.get('/super/pooled_tenants');
      setTenants(r.data?.data || []);
    } catch {
      setErro('Não consegui carregar os clientes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-6 py-6">
      <h2 className="text-xl font-semibold">WhatsApp</h2>
      <p className="text-sm text-muted-foreground">
        Manda um aviso no grupo de WhatsApp de cada cliente. Todos vêm marcados; desmarque quem não deve receber.
      </p>
      {erro && (
        <p className="text-sm text-destructive">
          {erro}{' '}
          <button type="button" className="underline" onClick={() => void carregar()}>Tentar de novo</button>
        </p>
      )}
      <Button onClick={() => setAberto(true)} disabled={loading || !!erro || tenants.length === 0} className="gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
        Escrever comunicado
      </Button>
      {aberto && <ClientBroadcastModal tenants={tenants} onClose={() => setAberto(false)} />}
    </div>
  );
}
