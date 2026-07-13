import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, Building2 } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/ds';
import { visitsService, Visit } from '@/services/visits/visitsService';

/** Seção "Próximas visitas" do dashboard (estilo protótipo) — dado REAL das
 *  visitas agendadas/confirmadas futuras. Sem dados inventados. */
export default function DashboardUpcomingVisits() {
  const navigate = useNavigate();
  const [visits, setVisits] = useState<Visit[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await visitsService.list({ per_page: 50 });
        if (!alive) return;
        const now = Date.now();
        const upcoming = (res.data || [])
          .filter(v => (v.status === 'scheduled' || v.status === 'confirmed') && new Date(v.scheduled_at).getTime() >= now)
          .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at))
          .slice(0, 5);
        setVisits(upcoming);
      } catch {
        if (alive) setVisits([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  const fmt = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === today.toDateString()) return `Hoje ${time}`;
    if (d.toDateString() === tomorrow.toDateString()) return `Amanhã ${time}`;
    return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${time}`;
  };

  const initials = (name?: string) => {
    if (!name) return '?';
    const p = name.trim().split(/\s+/);
    return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?';
  };

  return (
    <Card className="relative overflow-hidden" style={{ borderColor: 'rgba(124,58,237,0.15)' }}>
      <CardHeader className="pb-3 flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <div className="w-0.5 h-4 rounded-full shrink-0" style={{ background: 'linear-gradient(to bottom, #7c3aed, #9333ea)' }} />
          Próximas visitas
        </CardTitle>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => navigate('/visits')}>
          Ver agenda
        </Button>
      </CardHeader>
      <CardContent>
        {visits === null ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : visits.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Nenhuma visita agendada por enquanto.</div>
        ) : (
          <div className="divide-y divide-border/60">
            {visits.map(v => (
              <div key={v.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="inline-flex items-center justify-center w-9 h-9 rounded-full shrink-0 text-xs font-semibold text-violet-300 bg-violet-500/15 border border-violet-500/20">
                  {initials(v.contact?.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{v.contact?.name || 'Lead'}</div>
                  {v.property?.title && (
                    <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <Building2 className="h-3 w-3 shrink-0" />
                      {v.property.title}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded-md px-1.5 py-0.5">
                    <CalendarClock className="h-3 w-3" />
                    {fmt(v.scheduled_at)}
                  </span>
                  {v.realtor?.name && (
                    <div className="text-[11px] text-muted-foreground mt-1">c/ {v.realtor.name}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
