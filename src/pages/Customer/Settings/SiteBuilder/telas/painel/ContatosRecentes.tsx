import { useEffect, useState } from 'react';
import { quandoMudou } from '@/lib/formato';
import { Button } from '@/components/ui/ds';
import { siteBuilderService, type SiteLead } from '@/services/siteBuilder/siteBuilderService';

// Cinco últimos contatos. Sem a permissão de leads (403) o bloco inteiro some;
// qualquer outra falha mostra o erro com "Tentar de novo" (nunca lista vazia).
function origem(l: SiteLead): string {
  if (l.form_type === 'anuncie_imovel') return 'Anuncie seu imóvel';
  if (l.form_type === 'imovel_book') return 'Pediu o book';
  return l.property_id ? 'Pediu contato num imóvel' : 'Pediu contato pelo site';
}

export default function ContatosRecentes({ siteId, aoVerTodos }: { siteId: string; aoVerTodos: () => void }) {
  const [leads, setLeads] = useState<SiteLead[] | null>(null);
  const [semAcesso, setSemAcesso] = useState(false);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vivo = true;
    setErro(false);
    setLeads(null);
    siteBuilderService.listLeads(siteId, { per_page: 5 })
      .then(r => { if (vivo) setLeads(r.data ?? []); })
      .catch((e: { response?: { status?: number } }) => {
        if (!vivo) return;
        if (e?.response?.status === 403) setSemAcesso(true); else setErro(true);
      });
    return () => { vivo = false; };
  }, [siteId, tentativa]);

  if (semAcesso) return null;
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Contatos recentes do site</h2>
        <Button variant="outline" size="sm" onClick={aoVerTodos}>Ver todos</Button>
      </div>
      {erro && (
        <div className="flex items-center justify-between gap-3" role="alert">
          <p className="text-sm text-muted-foreground">Não deu para carregar os contatos.</p>
          <Button variant="outline" size="sm" onClick={() => setTentativa(t => t + 1)}>Tentar de novo</Button>
        </div>
      )}
      {leads && leads.length === 0 && <p className="text-sm text-muted-foreground">Ninguém pediu contato ainda.</p>}
      <ul className="divide-y divide-border">
        {(leads ?? []).map(l => (
          <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="min-w-0">
              <span className="block truncate font-medium">{l.name || 'Sem nome'}</span>
              <span className="block text-xs text-muted-foreground">{origem(l)}</span>
            </span>
            <span className="flex-none text-xs text-muted-foreground">{quandoMudou(l.created_at)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
