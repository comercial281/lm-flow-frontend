import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import apiClient from '@/services/core/api';

interface Step {
  position?: number;
  message_type?: string;
  delay_minutes?: number;
  content?: string;
  tag_on_send?: string | null;
}
interface Job {
  id: string;
  status: string;
  run_at: number | null;
  executed_at: number | null;
  last_error: string | null;
  step: Step | null;
  sequence: { name?: string };
}

const STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  pending:   { label: 'Agendado',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', dot: 'bg-amber-500' },
  sent:      { label: 'Enviado',   cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', dot: 'bg-gray-400' },
  failed:    { label: 'Falhou',    cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', dot: 'bg-red-500' },
};

const fmt = (s: number | null) =>
  s ? new Date(s * 1000).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

// Linha do tempo dos passos do follow-up de um lead (read-only).
// Consome GET /api/v1/followup_jobs?contact_id= (ou conversation_id=).
export default function FollowupTimeline({ contactId, conversationId }: { contactId?: string | null; conversationId?: string | null }) {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!contactId && !conversationId) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    apiClient
      .get('/api/v1/followup_jobs', { params: contactId ? { contact_id: contactId } : { conversation_id: conversationId } })
      .then(r => { if (alive) setJobs(r.data?.data || []); })
      .catch(() => { if (alive) setJobs([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [contactId, conversationId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Carregando follow-up…
      </div>
    );
  }
  if (!jobs || jobs.length === 0) {
    return <p className="text-[11px] text-muted-foreground">Sem passos de follow-up agendados pra este lead.</p>;
  }

  return (
    <ol className="space-y-2">
      {jobs.map((j, i) => {
        const st = STATUS[j.status] || STATUS.pending;
        return (
          <li key={j.id} className="flex gap-2">
            <div className="flex flex-col items-center">
              <span className={`w-2.5 h-2.5 rounded-full ${st.dot}`} />
              {i < jobs.length - 1 && <span className="w-px flex-1 bg-border my-0.5" />}
            </div>
            <div className="flex-1 -mt-0.5 pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-foreground">Passo {j.step?.position ?? i + 1}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                <span className="text-[10px] text-muted-foreground">
                  {j.status === 'sent' ? fmt(j.executed_at) : fmt(j.run_at)}
                </span>
              </div>
              {j.step?.content && (
                <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{j.step.content}</p>
              )}
              {j.last_error && <p className="text-[10px] text-red-500 mt-0.5">{j.last_error}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
