import { useEffect, useState } from 'react';
import { Hourglass } from 'lucide-react';
import { followupSequencesService } from '@/services/followupSequences/followupSequencesService';
import { legacyQueueLine, legacyQueuesWithPending, type LegacyQueue } from '@/features/flowAutomations/legacyFollowup';

/**
 * Os funis de follow-up antigos que ainda têm fila (sprint 3). Só pra ver: o
 * editor antigo saiu da tela, e quem está na fila termina no motor antigo.
 * Erro ao ler = a faixa não aparece (não trava a aba).
 */
export function LegacyFollowupStrip() {
  const [queues, setQueues] = useState<LegacyQueue[]>([]);

  useEffect(() => {
    let alive = true;
    followupSequencesService.getAll()
      .then(sequences => {
        if (!alive) return;
        setQueues(legacyQueuesWithPending(sequences.map(s => ({ id: s.id, name: s.name, pending: Number(s.queued_count) || 0 }))));
      })
      .catch(() => { if (alive) setQueues([]); });
    return () => { alive = false; };
  }, []);

  if (queues.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200" role="status">
      <div className="flex items-start gap-2">
        <Hourglass className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 space-y-0.5">
          {queues.map(q => (
            <p key={q.id}>
              <strong>Terminando no formato antigo:</strong> {legacyQueueLine(q)}
            </p>
          ))}
          <p className="text-xs opacity-80">
            Só pra acompanhar: quem já estava na fila recebe as mensagens que faltam. A faixa some quando a fila zerar.
          </p>
        </div>
      </div>
    </div>
  );
}
