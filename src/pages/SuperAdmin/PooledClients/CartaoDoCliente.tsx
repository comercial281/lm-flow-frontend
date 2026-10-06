import { Link } from 'react-router-dom';
import { plural } from '@/lib/formato';
import type { ClientePooled } from '@/types/admin/clientes';
import type { ClienteComProblema } from '@/types/admin/overview';
import AiUsageLine from './AiUsageLine';
import BotaoEntrar from './BotaoEntrar';
import { SELO } from '@/pages/Admin/Area/estilo';
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
      className="group flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 truncate text-base font-semibold">{t.name}</h3>
          <span className={`shrink-0 ${SELO} ${st.cls}`}>{st.label}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {t.package !== undefined && (
            <span className={`${SELO} text-muted-foreground`}>{t.package?.name ?? 'Personalizado'}</span>
          )}
          {problema && (
            <span className={`${SELO} border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300`}>
              {seloDeProblema(problema)}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {t.members == null ? '—' : plural(t.members, 'pessoa', 'pessoas')} · {numeros}
        </p>
        {st.provisionando ? <p className="text-xs text-muted-foreground">Criando o cliente…</p> : <AiUsageLine u={t.ai_usage} />}
      </div>
      <div className="mt-auto border-t pt-4">
        <BotaoEntrar desabilitado={st.provisionando} entrando={entrando}
          aoClicar={(e) => { e.preventDefault(); e.stopPropagation(); aoEntrar(t); }} />
      </div>
    </Link>
  );
}
