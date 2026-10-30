// src/pages/Customer/DashboardNova/blocos/Analise.tsx
// Análise do período: leads por dia da semana, por horário, nos últimos 6 meses
// e a origem. Os baldes (dia, hora, mês) já chegam no fuso da conta: a tela
// nunca recalcula data, só desenha.
import React from 'react';
import { VAZIO, numero, porcentagem } from '@/lib/formato';
import { EmptyBlock, GlassCard, Skeleton } from '../base/primitives';
import { Heatmap } from '../base/Heatmap';
import { isAvailable, type Unavailable } from '../base/types';
import type { ContextoBloco } from '../usePodeAbrir';
import { GraficoDeLeads, TrocaDeGrafico, useModoDoGrafico } from './GraficoDeLeads';

const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Horário comercial: das 8h às 18h (8h dentro, 18h já fora). */
const ABRE = 8;
const FECHA = 18;

/**
 * O dia da semana com mais lead. Sem lead nenhum, não tem melhor dia (null).
 * No empate ganha o que vem primeiro na lista, que o servidor manda de
 * domingo a sábado.
 */
export function melhorDia(days: { day: number; leads: number }[]): string | null {
  const top = days.reduce<{ day: number; leads: number } | null>((m, d) => (!m || d.leads > m.leads ? d : m), null);
  return top && top.leads > 0 ? DIAS[top.day] ?? null : null;
}

/** % dos leads que chegaram fora do horário comercial, inteiro. Sem lead, null. */
export function percentualForaDoHorario(hours: { hour: number; leads: number }[]): number | null {
  const total = hours.reduce((s, h) => s + h.leads, 0);
  if (!total) return null;
  const fora = hours.filter(h => h.hour < ABRE || h.hour >= FECHA).reduce((s, h) => s + h.leads, 0);
  return Math.round((fora / total) * 100);
}

/** '2026-09' → 'Set'. Fora do formato, volta como veio. */
export const rotuloMes = (ym: string): string => MESES_CURTOS[Number(ym.slice(5, 7)) - 1] ?? ym;

/** Bloco sem dado: carregando, erro ("não deu para carregar") ou o motivo que o servidor deu. */
const SemDados: React.FC<{
  titulo: string; carregando: boolean; temDados: boolean; bloco: Unavailable | undefined; oQue: string; nivel?: 2 | 3;
}> = ({ titulo, carregando, temDados, bloco, oQue, nivel }) => (
  <GlassCard title={titulo} titleAs={tituloEm(nivel)}>
    {carregando && !temDados ? (
      <Skeleton height={200} />
    ) : (
      // Só erro (ou bloco ausente) vira "não deu para carregar"; os outros motivos o EmptyBlock explica.
      <EmptyBlock block={bloco} text={!bloco || bloco.reason === 'error' ? `Não deu para carregar ${oQue} agora.` : undefined} />
    )}
  </GlassCard>
);

/** Cartão dentro da seção "Análise do período" tem título h3; fora dela (tela do corretor), h2. */
const tituloEm = (nivel?: 2 | 3): 'h2' | 'h3' => (nivel === 3 ? 'h3' : 'h2');

/**
 * O gráfico com um resumo de uma linha para leitor de tela (o SVG em si não diz
 * nada). Os gráficos vão com `accessibilityLayer={false}`: senão o recharts faz
 * o SVG focável dentro de um `role="img"`, e o teclado para em três pontos sem nome.
 */
const Grafico: React.FC<{ resumo: string; children: React.ReactNode }> = ({ resumo, children }) => (
  <div role="img" aria-label={resumo}>{children}</div>
);

const Destaque: React.FC<{ valor: string; legenda: string }> = ({ valor, legenda }) => (
  <div style={{ marginBottom: 8 }}>
    <div className="lmfn-numero-valor" style={{ fontSize: 24 }}>{valor}</div>
    <div className="lmf-card-sub" style={{ margin: 0 }}>{legenda}</div>
  </div>
);

export const LeadsDiaSemana: React.FC<ContextoBloco> = ({ dados, carregando, visao, nivelTitulo }) => {
  const bloco = dados?.leads_by_weekday;
  const titulo = visao === 'corretor' ? 'Seus leads por dia da semana' : 'Leads por dia da semana';
  const [modo, setModo] = useModoDoGrafico('dia-da-semana');
  if (!isAvailable(bloco)) {
    return <SemDados titulo={titulo} carregando={carregando} temDados={!!dados} bloco={bloco} oQue="os leads por dia da semana" nivel={nivelTitulo} />;
  }
  const dia = melhorDia(bloco.days);
  const linhas = bloco.days.map(d => ({ x: DIAS_CURTOS[d.day], leads: d.leads }));
  const maior = Math.max(0, ...linhas.map(l => l.leads));
  // O melhor dia em roxo forte nas colunas.
  const topo = maior > 0 ? linhas.findIndex(l => l.leads === maior) : -1;
  return (
    <GlassCard title={titulo} titleAs={tituloEm(nivelTitulo)} action={<TrocaDeGrafico modo={modo} aoEscolher={setModo} />}>
      <Destaque valor={dia ?? VAZIO} legenda={dia ? 'é o dia que mais chega lead no período' : 'Nenhum lead no período'} />
      <Grafico resumo={`${titulo}: ${linhas.map(l => `${l.x} ${numero(l.leads)}`).join(', ')}`}>
        <GraficoDeLeads id="dia-da-semana" modo={modo} altura={200} destaque={topo} linhas={linhas} />
      </Grafico>
    </GlassCard>
  );
};

export const LeadsHorario: React.FC<ContextoBloco> = ({ dados, carregando, nivelTitulo }) => {
  const bloco = dados?.leads_by_hour;
  const titulo = 'Leads por horário';
  const [modo, setModo] = useModoDoGrafico('horario');
  if (!isAvailable(bloco)) {
    return <SemDados titulo={titulo} carregando={carregando} temDados={!!dados} bloco={bloco} oQue="os leads por horário" nivel={nivelTitulo} />;
  }
  const fora = percentualForaDoHorario(bloco.hours);
  const linhas = bloco.hours.map(h => ({ x: `${h.hour}h`, leads: h.leads }));
  const pico = bloco.hours.reduce<{ hour: number; leads: number } | null>((m, h) => (!m || h.leads > m.leads ? h : m), null);
  const resumo = fora === null || !pico
    ? `${titulo}: nenhum lead no período`
    : `${titulo}: mais leads às ${pico.hour}h (${numero(pico.leads)}); ${porcentagem(fora, 0)} fora do horário comercial`;
  return (
    <GlassCard title={titulo} titleAs={tituloEm(nivelTitulo)} action={<TrocaDeGrafico modo={modo} aoEscolher={setModo} />}>
      <Destaque
        valor={fora === null ? VAZIO : porcentagem(fora, 0)}
        legenda={fora === null ? 'Nenhum lead no período' : 'dos leads chegaram fora do horário comercial (8h às 18h)'}
      />
      <Grafico resumo={resumo}>
        {/* A faixa do horário comercial é cinza neutro (não roxo): não pode se confundir com a área dos leads. */}
        <GraficoDeLeads
          id="horario"
          modo={modo}
          altura={200}
          intervalo={3}
          faixa={{ de: `${ABRE}h`, ate: `${FECHA}h` }}
          destaque={pico && pico.leads > 0 ? bloco.hours.indexOf(pico) : -1}
          linhas={linhas}
        />
      </Grafico>
    </GlassCard>
  );
};

export const LeadsSeisMeses: React.FC<ContextoBloco> = ({ dados, carregando, nivelTitulo }) => {
  const bloco = dados?.leads_6_months;
  const titulo = 'Leads nos últimos 6 meses';
  const [modo, setModo] = useModoDoGrafico('seis-meses');
  if (!isAvailable(bloco)) {
    return <SemDados titulo={titulo} carregando={carregando} temDados={!!dados} bloco={bloco} oQue="os leads dos últimos 6 meses" nivel={nivelTitulo} />;
  }
  const linhas = bloco.months.map(m => ({ x: rotuloMes(m.month), leads: m.leads }));
  const algum = linhas.some(l => l.leads > 0);
  return (
    <GlassCard
      title={titulo}
      titleAs={tituloEm(nivelTitulo)}
      subtitle="Leads que entraram no funil, por mês"
      action={algum ? <TrocaDeGrafico modo={modo} aoEscolher={setModo} /> : undefined}
    >
      {algum ? (
        <Grafico resumo={`${titulo}: ${linhas.map(l => `${l.x} ${numero(l.leads)}`).join(', ')}`}>
          {/* Mês atual (o último) em roxo forte nas colunas. */}
          <GraficoDeLeads id="seis-meses" modo={modo} altura={220} destaque={linhas.length - 1} linhas={linhas} />
        </Grafico>
      ) : (
        <EmptyBlock text="Nenhum lead nos últimos 6 meses" />
      )}
    </GlassCard>
  );
};

export const Origem: React.FC<ContextoBloco> = ({ dados, carregando, nivelTitulo }) => {
  const bloco = dados?.sources;
  const titulo = 'De onde vêm os leads';
  if (!isAvailable(bloco)) {
    return <SemDados titulo={titulo} carregando={carregando} temDados={!!dados} bloco={bloco} oQue="a origem dos leads" nivel={nivelTitulo} />;
  }
  const max = Math.max(1, ...bloco.items.map(i => i.count));
  return (
    <GlassCard title={titulo} titleAs={tituloEm(nivelTitulo)} subtitle="Contatos captados no período, pela primeira origem">
      <Destaque valor={numero(bloco.total)} legenda="contatos captados no período" />
      {bloco.items.length === 0 && <EmptyBlock text="Nenhuma origem registrada no período." />}
      {bloco.items.map((i, n) => (
        <div key={i.source} className="lmfn-item">
          <span className="lmfn-item-texto" style={{ flex: '0 0 40%' }}>{i.label}</span>
          <span style={{ flex: 1, height: 10, borderRadius: 5, background: 'var(--lmf-track)', overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${(i.count / max) * 100}%`, background: n === bloco.items.findIndex(x => x.count === max) ? 'var(--lmf-data)' : 'var(--lmf-data-muted)' }} />
          </span>
          <span style={{ width: 40, textAlign: 'right', fontWeight: 600 }}>{numero(i.count)}</span>
        </div>
      ))}
    </GlassCard>
  );
};

/** Existe no catálogo, desligado: é o primeiro bloco do futuro editor da Dashboard. */
export const MapaCalor: React.FC<ContextoBloco> = ({ dados, carregando, nivelTitulo }) => {
  const bloco = dados?.heatmap;
  const titulo = 'Mapa de calor';
  if (!isAvailable(bloco)) {
    return <SemDados titulo={titulo} carregando={carregando} temDados={!!dados} bloco={bloco} oQue="o mapa de calor" nivel={nivelTitulo} />;
  }
  return (
    <GlassCard title={titulo} titleAs={tituloEm(nivelTitulo)} subtitle="Mensagens recebidas por dia da semana e horário">
      <Heatmap heatmap={bloco} />
    </GlassCard>
  );
};
