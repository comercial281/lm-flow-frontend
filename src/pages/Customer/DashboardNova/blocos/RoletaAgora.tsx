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
/** Quantos corretores aparecem com a lista fechada; o seguinte some no esmaecido. */
const VISIVEIS = 4;
/** Ofertas esperando aceite com a lista fechada. */
const OFERTAS_VISIVEIS = 3;

const prazo = (o: RoletaQueueItem) => {
  if (o.sem_prazo) return 'sem prazo';
  if (o.estourou) return 'prazo estourado';
  const min = o.minutos_restantes ?? 0;
  return `${min === 1 ? 'falta' : 'faltam'} ${numero(min)} min`;
};

/** "último lead às 14:32" se foi hoje, "último lead em 28/09" se não. */
const ultimoLead = (quando: string) =>
  data(quando) === data(new Date()) ? `último lead às ${hora(quando)}` : `último lead em ${dataCurta(quando)}`;

/** Concorre de verdade: pausado e sem acesso ao número são pulados pela fila. */
const naDisputa = (m: RoletaQueueConfig['membros'][number]) => m.ativo && !m.sem_acesso_a_instancia;

/**
 * Na Fila, a lista começa pelo próximo da vez (é a ordem em que os leads vão
 * cair), e quem está na disputa ganha o número: 1º, 2º, 3º… Fora da Fila, a
 * ordem da tela de configuração, sem número.
 */
const ordenar = (r: RoletaQueueConfig) => {
  if (r.modo !== 'fila') return r.membros.map(m => ({ m, ordem: null as number | null }));
  const inicio = Math.max(0, r.membros.findIndex(m => m.proximo));
  const girada = [...r.membros.slice(inicio), ...r.membros.slice(0, inicio)];
  let n = 0;
  return girada.map(m => ({ m, ordem: naDisputa(m) ? ++n : null }));
};

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
  // Lista aberta (Ver todos). Volta a fechar ao trocar de roleta.
  const [aberta, setAberta] = useState(false);

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
  const irPara = (i: number) => {
    setPosicao({ id: roletas[i].id, indice: i });
    setAberta(false);
  };
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
      {(() => {
        const linhas = ordenar(atual);
        const sobra = linhas.length - VISIVEIS;
        // Fechada: os VISIVEIS primeiros e mais um, que some no esmaecido. Só vale
        // fechar quando sobram 2 ou mais — esconder um corretor só não compensa.
        const fechada = !aberta && sobra > 1;
        const mostradas = fechada ? linhas.slice(0, VISIVEIS + 1) : linhas;
        const ofertasMostradas = aberta ? ofertas : ofertas.slice(0, OFERTAS_VISIVEIS);
        const ofertasEscondidas = ofertas.length - ofertasMostradas.length;
        return (
          <>
            <div className={fechada ? 'lmfn-lista-esmaecida' : undefined}>
              {mostradas.map(({ m, ordem }) => {
                const marcas = [
                  m.proximo ? { texto: 'Próximo', classe: ' lmfn-pilula-atencao' } : null,
                  !m.ativo ? { texto: 'Pausado', classe: '' } : null,
                  m.sem_acesso_a_instancia ? { texto: 'Sem acesso ao número', classe: ' lmfn-pilula-alerta' } : null,
                ].filter(Boolean) as { texto: string; classe: string }[];
                const detalhe = m.segurando_agora > 0
                  ? `Segurando ${plural(m.segurando_agora, 'lead', 'leads')} agora`
                  : atual.modo === 'fila' && m.ultimo_lead_em ? ultimoLead(m.ultimo_lead_em) : null;
                return (
                  <div key={m.user_id} className={`lmfn-item lmfn-item-compacto${m.proximo ? ' lmfn-item-destaque' : ''}`}>
                    {atual.modo === 'fila' && <span className="lmfn-ordem">{ordem ? `${numero(ordem)}º` : ''}</span>}
                    <span className="lmfn-item-texto">{m.nome ?? 'Sem nome'}</span>
                    {detalhe && <small className="lmfn-item-detalhe">{detalhe}</small>}
                    {atual.modo === 'rodizio' && m.chance_pct !== null && <span className="lmfn-pilula">{porcentagem(m.chance_pct, 0)}</span>}
                    {marcas.map(x => <span key={x.texto} className={`lmfn-pilula${x.classe}`}>{x.texto}</span>)}
                  </div>
                );
              })}
            </div>
            {ofertas.length > 0 && (
              <>
                <p className="lmf-card-sub" style={{ marginTop: 12 }}>Ofertas esperando aceite</p>
                {ofertasMostradas.map(o => (
                  <div key={o.id} className="lmfn-item lmfn-item-compacto">
                    <span className="lmfn-item-texto">{o.lead}</span>
                    <small className="lmfn-item-detalhe">{o.corretor.nome ?? 'Sem nome'}</small>
                    <span className={`lmfn-pilula${o.estourou ? ' lmfn-pilula-alerta' : ''}`}>{prazo(o)}</span>
                  </div>
                ))}
              </>
            )}
            {(fechada || ofertasEscondidas > 0 || (aberta && (sobra > 1 || ofertas.length > OFERTAS_VISIVEIS))) && (
              <button type="button" className="lmfn-ver-todos" onClick={() => setAberta(a => !a)} aria-expanded={aberta}>
                {aberta
                  ? 'Mostrar menos'
                  : fechada ? `Ver os ${numero(linhas.length)} corretores` : `Ver as ${numero(ofertas.length)} ofertas`}
              </button>
            )}
          </>
        );
      })()}
    </GlassCard>
  );
};
