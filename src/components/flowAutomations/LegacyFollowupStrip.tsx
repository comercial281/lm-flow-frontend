import { useEffect, useState } from 'react';
import { Hourglass } from 'lucide-react';
import Aviso from '@/components/base/Aviso';
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
    <Aviso tom="atencao" icone={Hourglass} className="mb-4">
      {queues.map(q => (
        <p key={q.id}>
          <strong>Terminando no formato antigo:</strong> {legacyQueueLine(q)}
        </p>
      ))}
      <p className="text-xs opacity-80">
        Só pra acompanhar: quem já estava na fila recebe as mensagens que faltam. A faixa some quando a fila zerar.
      </p>
    </Aviso>
  );
}
