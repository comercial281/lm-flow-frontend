import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Pagina, BaseHeader, BasePagination } from '@/components/base';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';
import { Seletor } from '@/components/base/Seletor';
import { Plus } from 'lucide-react';
import { Card, Button, Badge } from '@/components/ui/ds';
import {
  broadcastsService,
  BroadcastCampaign,
} from '@/services/broadcasts/broadcastsService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import type { Pipeline } from '@/types/analytics';
import BulkDispatchModal from '@/components/pipelines/BulkDispatchModal';
import NoAccessState from '@/components/permissions/NoAccessState';
import { isForbiddenError } from '@/services/core/forbidden';
import { useCan } from '@/hooks/useCan';
import { telefone, terminaPorVoltaDe } from '@/lib/formato';
import { STATUS_META, PACOTE, rotuloDoModo } from './rotulos';

export default function Disparos() {
  const navigate = useNavigate();
  const pode = useCan();
  const [recusado, setRecusado] = useState(false);

  const [funis, setFunis] = useState<Pipeline[]>([]);
  // '' = Todos os funis.
  const [filtro, setFiltro] = useState('');
  const [pagina, setPagina] = useState(1);
  const [campanhas, setCampanhas] = useState<BroadcastCampaign[]>([]);
  const [meta, setMeta] = useState({ total: 0, per_page: 25 });
  const [carregando, setCarregando] = useState(true);
  // Falha na leitura não vira "Nenhum disparo ainda".
  const [erro, setErro] = useState(false);
  const [janelaAberta, setJanelaAberta] = useState(false);
  const ultimaCarga = useRef(0);

  useEffect(() => {
    pipelinesService
      .getPipelines({ include_items: false })
      .then(r => setFunis((r?.data ?? []) as Pipeline[]))
      .catch(() => setFunis([]));
  }, []);

  const carregar = useCallback(() => {
    const vez = ++ultimaCarga.current;
    setCarregando(true);
    setErro(false);
    broadcastsService
      .listAll({ ...(filtro ? { pipeline_id: filtro } : {}), page: pagina })
      .then(r => {
        if (vez !== ultimaCarga.current) return;
        setCampanhas(r.data);
        setMeta({ total: r.meta.total, per_page: r.meta.per_page || 25 });
        setRecusado(false);
      })
      .catch(e => {
        if (vez !== ultimaCarga.current) return;
        setCampanhas([]);
        if (isForbiddenError(e)) setRecusado(true);
        else setErro(true);
      })
      .finally(() => { if (vez === ultimaCarga.current) setCarregando(false); });
  }, [filtro, pagina]);

  useEffect(() => { carregar(); }, [carregar]);

  if (recusado) return <NoAccessState />;

  // Números do topo: soma das campanhas da página e do filtro que estão na tela (sem endpoint extra).
  const fila = campanhas.reduce((n, c) => n + (c.pending_count ?? 0), 0);
  const enviadas = campanhas.reduce((n, c) => n + c.sent_count, 0);
  const falhas = campanhas.reduce((n, c) => n + c.failed_count, 0);
  const numeros = [
    { rotulo: 'Na fila', valor: fila, cor: 'text-violet-400' },
    { rotulo: 'Enviadas', valor: enviadas, cor: 'text-blue-400' },
    { rotulo: 'Falhas', valor: falhas, cor: 'text-red-400' },
  ];
  const porPagina = meta.per_page || 25;
  const totalDePaginas = Math.max(1, Math.ceil(meta.total / porPagina));
  const funilDaJanela = filtro || funis[0]?.id || '';

  return (
    <Pagina
      cabecalho={
        <BaseHeader
          title="Disparos"
          subtitle="Disparo em massa pelo WhatsApp: escolha quem recebe, o número, a mensagem, um funil ou uma automação, e acompanhe a fila."
        />
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5 min-w-[240px]">
            <label htmlFor="disparos-filtro-funil" className="text-sm text-muted-foreground">Funil</label>
            <Seletor
              id="disparos-filtro-funil"
              className="w-full"
              value={filtro}
              onChange={e => { setFiltro(e.target.value); setPagina(1); }}
            >
              <option value="">Todos os funis</option>
              {funis.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </Seletor>
          </div>
          {(pode('broadcasts', 'create') || pode('broadcasts', 'own')) && (
            <Button onClick={() => setJanelaAberta(true)} disabled={!funilDaJanela}>
              <Plus className="w-4 h-4 mr-1" /> Novo disparo
            </Button>
          )}
        </div>

        {carregando && campanhas.length === 0 ? (
          <Carregando variante="texto" linhas={4} rotulo="Carregando os disparos..." />
        ) : campanhas.length === 0 && erro ? (
          <EmptyState tipo="erro" aoTentarDeNovo={carregar} />
        ) : campanhas.length === 0 ? (
          <EmptyState
            title="Nenhum disparo ainda."
            description='Clique em "Novo disparo" pra criar o primeiro.'
          />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              {numeros.map(n => (
                <Card key={n.rotulo} className="gap-0 p-4">
                  <p className="text-xs font-medium text-muted-foreground">{n.rotulo}</p>
                  <p className={`text-2xl font-bold tracking-tight mt-1 ${n.cor}`}>{n.valor}</p>
                </Card>
              ))}
            </div>

            <Card className="gap-0 overflow-hidden py-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 text-left text-xs text-muted-foreground">
                      <th className="font-medium px-4 py-3">Disparo</th>
                      <th className="font-medium px-4 py-3">Número</th>
                      <th className="font-medium px-4 py-3">O que sai</th>
                      <th className="font-medium px-4 py-3">Pacote</th>
                      <th className="font-medium px-4 py-3 min-w-[160px]">Andamento</th>
                      <th className="font-medium px-4 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campanhas.map(c => {
                      const estado = STATUS_META[c.status];
                      const feitas = c.sent_count + c.failed_count + c.skipped_count;
                      const pct = c.total_count ? Math.min(100, Math.round((feitas / c.total_count) * 100)) : 0;
                      return (
                        <tr
                          key={c.id}
                          onClick={() => navigate(`/disparos/${c.id}`)}
                          className="border-t border-border/60 hover:bg-muted/20 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3 font-medium max-w-[220px]">
                            {/* O link é o ponto de teclado (e do ctrl+clique); o resto da linha também navega. */}
                            <Link
                              to={`/disparos/${c.id}`}
                              onClick={e => e.stopPropagation()}
                              className="block max-w-full truncate hover:underline focus-visible:underline outline-none"
                              title={c.name}
                            >
                              {c.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <div>{c.sender_name ?? ''}</div>
                            {c.sender_phone && <div className="text-xs text-muted-foreground">{telefone(c.sender_phone)}</div>}
                          </td>
                          <td className="px-4 py-3">{rotuloDoModo(c)}</td>
                          <td className="px-4 py-3">{c.pace ? PACOTE[c.pace] ?? '' : ''}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-full min-w-[70px] overflow-hidden rounded-full bg-muted">
                                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">{feitas} de {c.total_count}</span>
                            </div>
                            {c.status === 'running' && c.estimated_finish_at && (
                              <div className="text-xs text-muted-foreground mt-1">{terminaPorVoltaDe(c.estimated_finish_at)}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={`text-xs border ${estado.cls}`}>{estado.label}</Badge>
                            {c.status === 'paused' && c.pause_message && (
                              <div className="text-xs text-muted-foreground mt-1 max-w-[240px]">{c.pause_message}</div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {totalDePaginas > 1 && (
              <BasePagination
                currentPage={pagina}
                totalPages={totalDePaginas}
                totalItems={meta.total}
                itemsPerPage={porPagina}
                onPageChange={setPagina}
                showItemsPerPage={false}
              />
            )}
          </>
        )}

        {funilDaJanela && (
          <BulkDispatchModal
            open={janelaAberta}
            onOpenChange={o => {
              setJanelaAberta(o);
              // Disparo novo entra no topo: volta pra página 1 (se já está nela, só recarrega).
              if (!o) { if (pagina === 1) carregar(); else setPagina(1); }
            }}
            pipelineId={funilDaJanela}
            pipelineName={funis.find(f => f.id === funilDaJanela)?.name}
            stages={[]}
            funis={funis}
          />
        )}
      </div>
    </Pagina>
  );
}
