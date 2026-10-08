// src/features/cardDoLead/blocos/BlocoHistorico.tsx
// O Histórico de hoje (eventos de /contacts/:id/events). A Parte 5 (Histórico
// novo) troca este bloco por HistoricoDoLead; até lá, igual à janela.
import { History, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import type { ContactEvent } from '@/types/notifications/contact-events';

// Os eventos da roleta são o motivo de o gestor abrir o histórico. O prefixo do id vem do servidor.
const corDoEvento = (id: string): string => {
  if (id.startsWith('roleta-aceite-')) return 'bg-emerald-500';
  if (id.startsWith('roleta-repasse-') || id.startsWith('roleta-prazo-')) return 'bg-amber-500';
  if (id.startsWith('roleta-diag-')) return 'bg-red-500';
  if (id.startsWith('bolsao-')) return 'bg-indigo-500';
  if (id.startsWith('identity-')) return 'bg-sky-500';
  return 'bg-primary';
};

export default function BlocoHistorico({ eventos, carregando, aoRecarregar }: {
  eventos: ContactEvent[];
  carregando: boolean;
  aoRecarregar: () => void;
}) {
  return (
    <div className="flex flex-col min-h-0 flex-1 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          Histórico
        </h4>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={aoRecarregar}
          disabled={carregando}
          aria-label="Atualizar histórico"
          title="Atualizar histórico"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${carregando ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {carregando ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : eventos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Nenhuma atividade registrada.</p>
        ) : (
          eventos.map(ev => (
            <div key={ev.id} className="flex gap-2.5 text-sm">
              <div className={`mt-2 w-2 h-2 rounded-full shrink-0 ${corDoEvento(ev.id)}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium break-words">{ev.eventName}</span>
                  <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                    {new Date(ev.occurredAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {/* Quebra em vez de cortar: o texto do servidor é a ÚNICA explicação de eventos da roleta. */}
                {ev.properties && Object.keys(ev.properties).length > 0 && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                    {Object.entries(ev.properties).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
