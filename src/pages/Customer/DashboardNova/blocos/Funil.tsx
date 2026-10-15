// src/pages/Customer/DashboardNova/blocos/Funil.tsx
import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { numero } from '@/lib/formato';
import { EmptyBlock, GlassCard, Skeleton } from '../base/primitives';
import { isAvailable } from '../base/types';
import { linkFunil } from '@/features/dashboard/links';
import type { ContextoBloco } from '../usePodeAbrir';
import { recorteBateComDestino } from '../visao';
import { Seletor } from '@/components/base/Seletor';
import { VAZIO } from '@/lib/formato';
import { tempoEmDias } from './comum';

type Forma = 'lista' | 'funil';
const CHAVE_FORMA = 'lmf.painel.funil.forma';

// Lista ou desenho de funil: escolha de cada pessoa, lembrada neste navegador.
// Sem acesso ao armazenamento (aba anônima), abre na Lista e não lembra.
const lerForma = (): Forma => {
  try {
    return window.localStorage.getItem(CHAVE_FORMA) === 'funil' ? 'funil' : 'lista';
  } catch {
    return 'lista';
  }
};
const gravarForma = (f: Forma) => {
  try {
    window.localStorage.setItem(CHAVE_FORMA, f);
  } catch {
    // sem armazenamento: só não lembra
  }
};

/** O desenho afunila sempre no mesmo formato: a última faixa fica com esta largura (%). */
const LARGURA_FINAL = 44;
/** Força da cor da última faixa (%): no claro o funil clareia até aqui, sem perder o contraste do texto branco. */
const FORCA_FINAL = 78;

export const Funil: React.FC<ContextoBloco> = ({ dados, visao, pode, filtros, funil, mudarFunil }) => {
  const navigate = useNavigate();
  const [forma, setForma] = useState<Forma>(lerForma);
  const [relogio, setRelogio] = useState(false);
  // O Funil lê o pedido dele (dados, erro e espera próprios), não o dos outros blocos.
  const bloco = funil.dados?.pipeline;
  const titulo = visao === 'corretor' ? 'Seu funil' : 'Funil';

  // O seletor sai da última resposta boa e vale também no erro: dá para trocar de
  // funil sem recarregar. Enquanto o funil novo não volta (ou depois de falhar),
  // mostra a escolha, não o da resposta antiga.
  const disponivel = isAvailable(bloco) ? bloco : null;
  const escolhido = disponivel && (funil.pendente ? filtros.pipelineId ?? disponivel.pipeline.id : disponivel.pipeline.id);
  const seletor = disponivel && disponivel.pipelines.length > 1 ? (
    <Seletor bare className="lmf-select" aria-label="Funil" value={escolhido ?? undefined} onChange={e => mudarFunil(e.target.value)}>
      {disponivel.pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </Seletor>
  ) : null;

  // Erro no pedido do funil: nunca mostrar o funil da última vez calado.
  if (funil.erro) {
    const acoes = (
      <div className="flex items-center gap-2">
        {seletor}
        <button type="button" className="lmf-card-sub"
          style={{ margin: 0, fontWeight: 600, color: 'var(--lmf-accent)', background: 'none', border: 0, cursor: 'pointer' }}
          onClick={funil.recarregar}>
          Tentar de novo
        </button>
      </div>
    );
    return <GlassCard title={titulo} action={acoes}><EmptyBlock text="Não deu para carregar o funil agora." /></GlassCard>;
  }
  if (!isAvailable(bloco)) {
    return (
      <GlassCard title={titulo}>
        {funil.carregando && !funil.dados ? (
          <Skeleton height={200} />
        ) : (
          // Só erro (ou bloco ausente) vira "não deu para carregar"; os outros motivos o EmptyBlock explica.
          <EmptyBlock block={bloco} text={!bloco || bloco.reason === 'error' ? 'Não deu para carregar o funil agora.' : undefined} />
        )}
      </GlassCard>
    );
  }
  // O funil não recebe time, corretor nem os filtros do painel: fora do recorte
  // que ele mostra sozinho, a etapa fica sem link. Enquanto o funil novo
  // carrega, as etapas na tela são do antigo: também sem link.
  const abreEtapa = pode.funil && !funil.pendente && recorteBateComDestino(dados?.scope ?? funil.dados?.scope, filtros);
  // Relógio (frente 5 da Nova 27): o número de cada etapa vira o tempo médio que
  // os leads de agora estão parados nela. Servidor de antes não manda: sem relógio.
  const temRelogio = bloco.stages.some(s => s.avg_seconds_in_stage !== undefined);
  const comRelogio = relogio && temRelogio;
  const medida = (s: (typeof bloco.stages)[number]) => (comRelogio ? s.avg_seconds_in_stage ?? 0 : s.current);
  const rotulo = (s: (typeof bloco.stages)[number]) => {
    if (!comRelogio) return numero(s.current);
    return s.avg_seconds_in_stage == null ? VAZIO : `~${tempoEmDias(s.avg_seconds_in_stage)}`;
  };
  const max = Math.max(1, ...bloco.stages.map(medida));
  const trocarForma = (f: Forma) => {
    setForma(f);
    gravarForma(f);
  };

  const acoes = (
    <div className="lmfn-controles">
      <div className="lmfn-seg" role="group" aria-label="Forma do funil">
        {(['lista', 'funil'] as Forma[]).map(f => (
          <button key={f} type="button" aria-pressed={forma === f} onClick={() => trocarForma(f)}>
            {f === 'lista' ? 'Lista' : 'Funil'}
          </button>
        ))}
      </div>
      {temRelogio && (
        <div className="lmfn-seg">
          <button type="button" aria-pressed={comRelogio} onClick={() => setRelogio(r => !r)}
            aria-label="Tempo médio em cada etapa" title="Tempo médio em cada etapa"
            style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 8px' }}>
            <Clock className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
      {seletor}
    </div>
  );
  const subtitulo = comRelogio ? 'Há quanto tempo, em média, os leads estão em cada etapa' : 'Leads em cada etapa agora';
  const abrir = (etapaId: string) => navigate(linkFunil(bloco.pipeline.id, etapaId));
  const n = bloco.stages.length;
  // Recuo de cada lado, em %: a faixa i começa onde a anterior terminou.
  const recuo = (i: number) => (n <= 1 ? 0 : ((100 - LARGURA_FINAL) / 2) * (i / n));

  return (
    // Mesmo aviso da área dos blocos: ocupado e esmaecido enquanto o funil novo não chega.
    <div className={`lmfn-celula${funil.pendente ? ' lmfn-blocos-pendente' : ''}`} aria-busy={funil.pendente || undefined}>
      <GlassCard title={titulo} subtitle={subtitulo} action={acoes}>
        {bloco.stages.length === 0 && <EmptyBlock text="Este funil ainda não tem etapas." />}
        {forma === 'funil' && n > 0 && (
          <div className="lmfn-funil">
            {bloco.stages.map((s, i) => {
              const a = recuo(i);
              const b = recuo(i + 1);
              const corpo = (
                <>
                  <span className="lmfn-funil-nome">{s.name}</span>
                  <span className="lmfn-funil-valor">{rotulo(s)}</span>
                </>
              );
              const forca = n <= 1 ? 100 : 100 - ((100 - FORCA_FINAL) * i) / (n - 1);
              const estilo = {
                clipPath: `polygon(${a}% 0, ${100 - a}% 0, ${100 - b}% 100%, ${b}% 100%)`,
                paddingInline: `${b + 3}%`,
                '--lmfn-forca': `${forca}%`,
              } as React.CSSProperties;
              return abreEtapa ? (
                <button key={s.id} type="button" className="lmfn-funil-faixa" style={estilo} onClick={() => abrir(s.id)}>{corpo}</button>
              ) : (
                <div key={s.id} className="lmfn-funil-faixa" style={estilo}>{corpo}</div>
              );
            })}
          </div>
        )}
        {forma === 'lista' && bloco.stages.map(s => {
          const corpo = (
            <>
              <span className="lmfn-item-texto" style={{ flex: '0 0 40%' }}>{s.name}</span>
              <span style={{ flex: 1, height: 10, borderRadius: 5, background: 'var(--lmf-track)', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${(medida(s) / max) * 100}%`, background: 'var(--lmf-data)' }} />
              </span>
              <span style={{ minWidth: 40, textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{rotulo(s)}</span>
            </>
          );
          return abreEtapa ? (
            <button key={s.id} type="button" className="lmfn-item" onClick={() => abrir(s.id)}>{corpo}</button>
          ) : (
            <div key={s.id} className="lmfn-item">{corpo}</div>
          );
        })}
        {/* Ganho e Perdido não são etapa (situação do card): à parte, no período do painel. */}
        {bloco.outcomes && (
          <>
            <div className="lmfn-item">
              <span className="lmfn-item-texto" style={{ flex: 1 }}>Ganhos no período</span>
              <span style={{ width: 40, textAlign: 'right', fontWeight: 600, color: 'var(--lmf-highlight-text)' }}>{numero(bloco.outcomes.won)}</span>
            </div>
            <div className="lmfn-item">
              <span className="lmfn-item-texto" style={{ flex: 1 }}>Perdidos no período</span>
              <span style={{ width: 40, textAlign: 'right', fontWeight: 600 }}>{numero(bloco.outcomes.lost)}</span>
            </div>
          </>
        )}
      </GlassCard>
    </div>
  );
};
