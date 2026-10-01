// src/pages/Customer/DashboardNova/blocos/RoletaAgora.tsx
import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { data, dataCurta, hora, numero, plural, porcentagem } from '@/lib/formato';
import { IconActionButton } from '@/components/base';
import { GlassCard } from '../base/primitives';
import {
  roletaConfigService,
  type DistributionMode,
  type RoletaQueue,
  type RoletaQueueConfig,
  type RoletaQueueItem,
} from '@/services/roletaConfig/roletaConfigService';
import type { ContextoBloco } from '../usePodeAbrir';

const MODO: Record<DistributionMode, string> = {
  fila: 'Fila',
  rodizio: 'Rodízio',
  leilao: 'Leilão',
  manual: 'Manual',
  disponibilidade: 'Por disponibilidade',
};
const INTERVALO_MS = 30_000;

const prazo = (o: RoletaQueueItem) => {
  if (o.sem_prazo) return 'sem prazo';
  if (o.estourou) return 'prazo estourado';
  const min = o.minutos_restantes ?? 0;
  return `${min === 1 ? 'falta' : 'faltam'} ${numero(min)} min`;
};

/** "último lead às 14:32" se foi hoje, "último lead em 28/09" se não. */
const ultimoLead = (quando: string) =>
  data(quando) === data(new Date()) ? `último lead às ${hora(quando)}` : `último lead em ${dataCurta(quando)}`;

/**
 * A oferta é desta roleta? Pelo id da roleta; servidor antigo não manda o id,
 * e aí vale o nome do número de entrada (que pode repetir entre roletas).
 */
const daRoleta = (o: RoletaQueueItem, r: RoletaQueueConfig) =>
  o.roleta_config_id !== undefined ? o.roleta_config_id === r.id : r.instancia !== null && o.instancia === r.instancia;

/**
 * A roleta funcionando, quase ao vivo (a cada 30 s, só com a aba visível).
 * A Fila é o modo que o gestor mais acompanha: quem é o próximo, quem está
 * pausado. Reaproveita GET /roleta_configs/queue, que já marca o próximo.
 * Não entra no pedido único da Dashboard: busca o próprio dado.
 */
export const RoletaAgora: React.FC<ContextoBloco> = ({ visao, pode }) => {
  const ativo = visao === 'gestor' && pode.roleta;
  const [fila, setFila] = useState<RoletaQueue | null>(null);
  // A roleta da tela é guardada pelo id: se a lista mudar de ordem na próxima
  // volta, a tela não pula para outra. A posição só serve quando ela some.
  const [posicao, setPosicao] = useState<{ id: string | null; indice: number }>({ id: null, indice: 0 });

  useEffect(() => {
    if (!ativo) return undefined;
    let vivo = true;
    let pedido = 0;
    let timer: ReturnType<typeof setInterval> | undefined;

    const carregar = async () => {
      const meu = ++pedido;
      try {
        const resposta = await roletaConfigService.getQueue();
        // Resposta que chega depois de sair da tela, ou atrás de uma mais nova, é descartada.
        if (vivo && meu === pedido) setFila(resposta);
      } catch {
        // Falha momentânea: mantém o que estava na tela e tenta na próxima volta.
      }
    };
    const parar = () => {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    };
    const conferirAba = () => {
      parar();
      if (document.visibilityState !== 'visible') return;
      carregar();
      timer = setInterval(carregar, INTERVALO_MS);
    };

    conferirAba();
    document.addEventListener('visibilitychange', conferirAba);
    return () => {
      vivo = false;
      parar();
      document.removeEventListener('visibilitychange', conferirAba);
    };
  }, [ativo]);

  if (!ativo || !fila) return null;
  const roletas = fila.roletas.filter(r => r.ativa);
  if (roletas.length === 0) return null;

  const achado = roletas.findIndex(r => r.id === posicao.id);
  const indice = achado >= 0 ? achado : Math.min(posicao.indice, roletas.length - 1);
  const atual = roletas[indice];
  const irPara = (i: number) => setPosicao({ id: roletas[i].id, indice: i });
  const ofertas = fila.aguardando.filter(o => daRoleta(o, atual));

  const setas = roletas.length > 1 ? (
    <div className="lmfn-carrossel">
      <IconActionButton
        label="Roleta anterior"
        icon={<ChevronLeft size={14} aria-hidden />}
        disabled={indice === 0}
        onClick={() => irPara(indice - 1)}
      />
      <span className="lmf-card-sub" style={{ margin: 0 }}>{`${numero(indice + 1)} de ${numero(roletas.length)}`}</span>
      <IconActionButton
        label="Próxima roleta"
        icon={<ChevronRight size={14} aria-hidden />}
        disabled={indice >= roletas.length - 1}
        onClick={() => irPara(indice + 1)}
      />
    </div>
  ) : undefined;

  return (
    <GlassCard title="Roleta agora" action={setas}>
      <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
        <strong>{atual.nome ?? atual.instancia ?? 'Roleta'}</strong>
        <span className="lmfn-pilula">{MODO[atual.modo] ?? atual.modo}</span>
      </div>
      {atual.membros.map(m => {
        const marcas = [
          m.proximo ? { texto: 'Próximo', classe: ' lmfn-pilula-atencao' } : null,
          !m.ativo ? { texto: 'Pausado', classe: '' } : null,
          m.sem_acesso_a_instancia ? { texto: 'Sem acesso ao número', classe: ' lmfn-pilula-alerta' } : null,
        ].filter(Boolean) as { texto: string; classe: string }[];
        return (
          <div key={m.user_id} className="lmfn-item" style={m.proximo ? { background: 'var(--lmf-accent-soft)' } : undefined}>
            <span className="lmfn-item-texto">
              {m.nome ?? 'Sem nome'}
              {m.segurando_agora > 0 && <small>{`Segurando ${plural(m.segurando_agora, 'lead', 'leads')} agora`}</small>}
              {atual.modo === 'fila' && m.ultimo_lead_em && <small>{ultimoLead(m.ultimo_lead_em)}</small>}
            </span>
            {atual.modo === 'rodizio' && m.chance_pct !== null && <span className="lmfn-pilula">{porcentagem(m.chance_pct, 0)}</span>}
            {marcas.map(x => <span key={x.texto} className={`lmfn-pilula${x.classe}`}>{x.texto}</span>)}
          </div>
        );
      })}
      {ofertas.length > 0 && (
        <>
          <p className="lmf-card-sub" style={{ marginTop: 12 }}>Ofertas esperando aceite</p>
          {ofertas.map(o => (
            <div key={o.id} className="lmfn-item">
              <span className="lmfn-item-texto">{o.lead}<small>{o.corretor.nome ?? 'Sem nome'}</small></span>
              <span className={`lmfn-pilula${o.estourou ? ' lmfn-pilula-alerta' : ''}`}>{prazo(o)}</span>
            </div>
          ))}
        </>
      )}
    </GlassCard>
  );
};
