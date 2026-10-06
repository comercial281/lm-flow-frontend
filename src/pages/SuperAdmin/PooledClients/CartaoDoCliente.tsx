import { Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { plural } from '@/lib/formato';
import type { ClientePooled } from '@/types/admin/clientes';
import type { ClienteComProblema } from '@/types/admin/overview';
import AiUsageLine from './AiUsageLine';
import { seloDeProblema } from './lista';
import { rotuloDaSituacao } from './situacao';

// Um cliente na lista. O cartão inteiro abre a página dele; Entrar é atalho e
// não abre a página (preventDefault + stopPropagation).
export default function CartaoDoCliente({ cliente: t, problema, aoEntrar, entrando }: {
  cliente: ClientePooled; problema?: ClienteComProblema; aoEntrar: (t: ClientePooled) => void; entrando: boolean;
}) {
  const st = rotuloDaSituacao(t.situation, t.status);
  const numeros = t.max_whatsapp_channels && t.max_whatsapp_channels > 0
    ? `${t.whatsapp_channels_used ?? '—'} de ${t.max_whatsapp_channels} números`
    : `${t.whatsapp_channels_used ?? '—'} números`;
  return (
    <Link to={`/admin/clientes/${t.id}`}
      className="flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 truncate font-semibold">{t.name}</h3>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${st.cls}`}>{st.label}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {t.package !== undefined && (
          <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{t.package?.name ?? 'Personalizado'}</span>
        )}
        {problema && (
          <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-xs text-red-700 dark:text-red-300">
            {seloDeProblema(problema)}
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {t.members == null ? '—' : plural(t.members, 'pessoa', 'pessoas')} · {numeros}
      </p>
      {st.provisionando ? <p className="text-xs text-muted-foreground">Criando o cliente…</p> : <AiUsageLine u={t.ai_usage} />}
      <div className="mt-auto pt-1">
        <Button size="sm" variant="outline" disabled={entrando || st.provisionando}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); aoEntrar(t); }}>
          <LogIn className="mr-1.5 h-3.5 w-3.5" /> Entrar
        </Button>
      </div>
    </Link>
  );
}
