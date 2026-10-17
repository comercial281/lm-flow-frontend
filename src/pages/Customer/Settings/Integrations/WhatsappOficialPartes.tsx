import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Plus, Radio } from 'lucide-react';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';
import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/ds';
import {
  broadcastsService,
  type CloudChannelOption,
  type CloudMetrics,
} from '@/services/broadcasts/broadcastsService';
import MessageTemplateForm from '@/components/channels/settings/MessageTemplateForm';
import { dolar, plural, telefone } from '@/lib/formato';

// Pedaços do WhatsApp Oficial (16/10/2026). Moram aqui porque a tela
// Integrações → WhatsApp Oficial e (até a limpeza das abas) o Disparos usam os
// mesmos três: Números oficiais, Modelos e Métricas.

/** Carrega os números oficiais. Erro e lista vazia são coisas diferentes. */
export function useNumerosOficiais() {
  const [numeros, setNumeros] = useState<CloudChannelOption[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const ultimaCarga = useRef(0);

  const carregar = useCallback(() => {
    const vez = ++ultimaCarga.current;
    setCarregando(true);
    setErro(false);
    broadcastsService
      .whatsappCloudOptions()
      .then(lista => {
        if (vez === ultimaCarga.current) setNumeros(lista);
      })
      .catch(() => {
        if (vez !== ultimaCarga.current) return;
        setNumeros([]);
        setErro(true);
      })
      .finally(() => {
        if (vez === ultimaCarga.current) setCarregando(false);
      });
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { numeros, carregando, erro, carregar };
}

export function SemNumeroOficial() {
  const navigate = useNavigate();
  return (
    <EmptyState
      title="Nenhum número oficial conectado."
      description="Os modelos de mensagem são criados e aprovados por número oficial."
      action={{ label: 'Conectar número oficial', onClick: () => navigate('/channels'), variant: 'outline' }}
    />
  );
}

export function NumerosOficiais({ numeros }: { numeros: CloudChannelOption[] }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Números oficiais do WhatsApp conectados ao LM Flow.</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/channels')}>
          <Plus className="w-4 h-4 mr-1" /> Conectar número
        </Button>
      </div>
      <div className="space-y-3">
        {numeros.map(o => {
          const aprovados = o.templates.filter(t => t.approved).length;
          return (
            <div key={o.inbox_id} className="border border-border rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <Radio className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{o.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {telefone(o.phone_number)} · {plural(aprovados, 'modelo aprovado', 'modelos aprovados')} de {o.templates.length}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/channels')}>
                <ExternalLink className="w-3.5 h-3.5 mr-1" /> Gerenciar
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ModelosOficiais({ numeros }: { numeros: CloudChannelOption[] }) {
  const [inboxId, setInboxId] = useState('');
  const escolhido = numeros.find(o => o.inbox_id === inboxId) || numeros[0];
  return (
    <div className="space-y-4">
      {numeros.length > 1 && (
        <div className="space-y-1.5 max-w-sm">
          <label className="text-sm text-muted-foreground">Número oficial</label>
          <Select value={escolhido?.inbox_id ?? ''} onValueChange={setInboxId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {numeros.map(o => (
                <SelectItem key={o.inbox_id} value={o.inbox_id}>
                  {o.name} · {telefone(o.phone_number)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Crie o modelo, envie pra Meta e acompanhe o status (a Meta é quem aprova). O nome do modelo não pode ser
        alterado depois de criado: pra renomear, duplique com um nome novo.
      </p>
      {escolhido && <MessageTemplateForm inboxId={escolhido.inbox_id} channelType="Channel::Whatsapp" />}
    </div>
  );
}

export function MetricasOficiais() {
  const [metricas, setMetricas] = useState<CloudMetrics | null>(null);
  const [dias, setDias] = useState(30);
  const [carregando, setCarregando] = useState(true);
  // Falha na leitura não vira "sem envios no período".
  const [erro, setErro] = useState(false);

  const carregar = useCallback((d: number) => {
    setCarregando(true);
    broadcastsService
      .whatsappCloudMetrics(d)
      .then(m => {
        setMetricas(m);
        setErro(false);
      })
      .catch(() => {
        setMetricas(null);
        setErro(true);
      })
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    carregar(dias);
  }, [dias, carregar]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground max-w-xl">
          Enviadas, entregues e <strong>custo real</strong> (dados da Meta) por número oficial. A fatura/cobrança fica
          no billing da Meta Business: aqui é o acompanhamento.
        </p>
        <Select value={String(dias)} onValueChange={v => setDias(Number(v))}>
          <SelectTrigger className="w-32 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 dias</SelectItem>
            <SelectItem value="30">30 dias</SelectItem>
            <SelectItem value="90">90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {carregando ? (
        <Carregando variante="texto" linhas={4} rotulo="Carregando métricas..." />
      ) : !metricas && erro ? (
        <EmptyState tipo="erro" tamanho="compacto" aoTentarDeNovo={() => carregar(dias)} />
      ) : !metricas || metricas.channels.length === 0 ? (
        <EmptyState tamanho="compacto" title="Nenhum envio no período." />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-border p-3">
              <div className="text-xs text-muted-foreground">Enviadas</div>
              <div className="text-2xl font-semibold">{metricas.totals.sent}</div>
            </div>
            <div className="rounded-xl border border-border p-3">
              <div className="text-xs text-muted-foreground">Entregues</div>
              <div className="text-2xl font-semibold">
                {metricas.totals.delivered}
                {metricas.totals.sent > 0 && (
                  <span className="text-xs text-muted-foreground ml-1">
                    ({Math.round((metricas.totals.delivered / metricas.totals.sent) * 100)}%)
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-border p-3">
              <div className="text-xs text-muted-foreground">Custo (Meta, US$)</div>
              <div className="text-2xl font-semibold">{dolar(metricas.totals.cost)}</div>
            </div>
          </div>

          <div className="space-y-3">
            {metricas.channels.map(c => {
              const q = c.quality_rating?.toLowerCase();
              const qClr =
                q === 'green' ? 'text-green-600' : q === 'yellow' ? 'text-amber-600' : q === 'red' ? 'text-red-600' : 'text-muted-foreground';
              return (
                <div key={c.inbox_id} className="border border-border rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{telefone(c.phone_number)}</div>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className={qClr}>● {c.quality_rating || 'sem dado'}</span>
                      {c.messaging_tier != null && <span className="text-muted-foreground">tier {c.messaging_tier}</span>}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs block">Enviadas</span>
                      <strong>{c.totals.sent}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs block">Entregues</span>
                      <strong>{c.totals.delivered}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs block">Custo</span>
                      <strong>{dolar(c.totals.cost)}</strong>
                    </div>
                  </div>
                  {Object.keys(c.templates_by_category).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Object.entries(c.templates_by_category).map(([cat, n]) => (
                        <Badge key={cat} className="text-[11px] border bg-muted text-muted-foreground">
                          {cat}: {n}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
