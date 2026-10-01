// src/pages/Customer/DashboardNova/blocos/Analise.tsx
// Análise do período: leads por dia da semana, por horário, nos últimos 6 meses
// e a origem. Os baldes (dia, hora, mês) já chegam no fuso da conta: a tela
// nunca recalcula data, só desenha.
import React from 'react';
import { Area, AreaChart, Bar, BarChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { VAZIO, numero, porcentagem } from '@/lib/formato';
import { EmptyBlock, GlassCard, Skeleton, tooltipStyle } from '../../DashboardV2/components/primitives';
import { Heatmap } from '../../DashboardV2/components/Heatmap';
import { isAvailable, type Unavailable } from '../../DashboardV2/types';
import type { ContextoBloco } from '../usePodeAbrir';

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

const eixo = { fill: 'var(--lmf-muted)', fontSize: 11 };
const formatoLeads = (v?: number) => [numero(v ?? 0), 'Leads'] as [string, string];

/** Bloco sem dado: carregando, erro ("não deu para carregar") ou o motivo que o servidor deu. */
const SemDados: React.FC<{
  titulo: string; carregando: boolean; temDados: boolean; bloco: Unavailable | undefined; oQue: string;
}> = ({ titulo, carregando, temDados, bloco, oQue }) => (
  <GlassCard title={titulo}>
    {carregando && !temDados ? (
      <Skeleton height={200} />
    ) : (
      // Só erro (ou bloco ausente) vira "não deu para carregar"; os outros motivos o EmptyBlock explica.
      <EmptyBlock block={bloco} text={!bloco || bloco.reason === 'error' ? `Não deu para carregar ${oQue} agora.` : undefined} />
    )}
  </GlassCard>
);

const Destaque: React.FC<{ valor: string; legenda: string }> = ({ valor, legenda }) => (
  <div style={{ marginBottom: 8 }}>
    <div className="lmfn-numero-valor" style={{ fontSize: 24 }}>{valor}</div>
    <div className="lmf-card-sub" style={{ margin: 0 }}>{legenda}</div>
  </div>
);

export const LeadsDiaSemana: React.FC<ContextoBloco> = ({ dados, carregando, visao }) => {
  const bloco = dados?.leads_by_weekday;
  const titulo = visao === 'corretor' ? 'Seus leads por dia da semana' : 'Leads por dia da semana';
  if (!isAvailable(bloco)) {
    return <SemDados titulo={titulo} carregando={carregando} temDados={!!dados} bloco={bloco} oQue="os leads por dia da semana" />;
  }
  const dia = melhorDia(bloco.days);
  const linhas = bloco.days.map(d => ({ nome: DIAS_CURTOS[d.day], leads: d.leads }));
  return (
    <GlassCard title={titulo}>
      <Destaque valor={dia ?? VAZIO} legenda={dia ? 'é o dia que mais chega lead no período' : 'Nenhum lead no período'} />
      <ResponsiveContainer width="100%" height={190}>
        <BarChart data={linhas}>
          <XAxis dataKey="nome" tick={eixo} tickLine={false} axisLine={false} />
          <YAxis tick={eixo} allowDecimals={false} tickLine={false} axisLine={false} width={28} />
          <Tooltip {...tooltipStyle} formatter={formatoLeads} />
          <Bar dataKey="leads" fill="var(--lmf-accent)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </GlassCard>
  );
};

export const LeadsHorario: React.FC<ContextoBloco> = ({ dados, carregando }) => {
  const bloco = dados?.leads_by_hour;
  const titulo = 'Leads por horário';
  if (!isAvailable(bloco)) {
    return <SemDados titulo={titulo} carregando={carregando} temDados={!!dados} bloco={bloco} oQue="os leads por horário" />;
  }
  const fora = percentualForaDoHorario(bloco.hours);
  const linhas = bloco.hours.map(h => ({ hora: `${h.hour}h`, leads: h.leads }));
  return (
    <GlassCard title={titulo}>
      <Destaque
        valor={fora === null ? VAZIO : porcentagem(fora, 0)}
        legenda={fora === null ? 'Nenhum lead no período' : 'dos leads chegaram fora do horário comercial (8h às 18h)'}
      />
      <ResponsiveContainer width="100%" height={190}>
        <AreaChart data={linhas}>
          <ReferenceArea x1={`${ABRE}h`} x2={`${FECHA}h`} fill="var(--lmf-accent-soft)" />
          <XAxis dataKey="hora" interval={3} tick={eixo} tickLine={false} axisLine={false} />
          <YAxis tick={eixo} allowDecimals={false} tickLine={false} axisLine={false} width={28} />
          <Tooltip {...tooltipStyle} formatter={formatoLeads} />
          <Area type="monotone" dataKey="leads" stroke="var(--lmf-accent)" fill="var(--lmf-accent-soft)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </GlassCard>
  );
};

export const LeadsSeisMeses: React.FC<ContextoBloco> = ({ dados, carregando }) => {
  const bloco = dados?.leads_6_months;
  const titulo = 'Leads nos últimos 6 meses';
  if (!isAvailable(bloco)) {
    return <SemDados titulo={titulo} carregando={carregando} temDados={!!dados} bloco={bloco} oQue="os leads dos últimos 6 meses" />;
  }
  const linhas = bloco.months.map(m => ({ mes: rotuloMes(m.month), leads: m.leads }));
  return (
    <GlassCard title={titulo} subtitle="Leads que entraram no funil, por mês">
      <ResponsiveContainer width="100%" height={210}>
        <BarChart data={linhas}>
          <XAxis dataKey="mes" tick={eixo} tickLine={false} axisLine={false} />
          <YAxis tick={eixo} allowDecimals={false} tickLine={false} axisLine={false} width={32} />
          <Tooltip {...tooltipStyle} formatter={formatoLeads} />
          <Bar dataKey="leads" fill="var(--lmf-accent)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </GlassCard>
  );
};

export const Origem: React.FC<ContextoBloco> = ({ dados, carregando }) => {
  const bloco = dados?.sources;
  const titulo = 'De onde vêm os leads';
  if (!isAvailable(bloco)) {
    return <SemDados titulo={titulo} carregando={carregando} temDados={!!dados} bloco={bloco} oQue="a origem dos leads" />;
  }
  const max = Math.max(1, ...bloco.items.map(i => i.count));
  return (
    <GlassCard title={titulo} subtitle="Leads do período, pela primeira origem registrada">
      {bloco.items.length === 0 && <EmptyBlock text="Nenhuma origem registrada no período." />}
      {bloco.items.map(i => (
        <div key={i.source} className="lmfn-item">
          <span className="lmfn-item-texto" style={{ flex: '0 0 40%' }}>{i.label}</span>
          <span style={{ flex: 1, height: 10, borderRadius: 5, background: 'var(--lmf-track)', overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${(i.count / max) * 100}%`, background: 'var(--lmf-accent)' }} />
          </span>
          <span style={{ width: 40, textAlign: 'right', fontWeight: 600 }}>{numero(i.count)}</span>
        </div>
      ))}
    </GlassCard>
  );
};

/** Existe no catálogo, desligado: é o primeiro bloco do futuro editor da Dashboard. */
export const MapaCalor: React.FC<ContextoBloco> = ({ dados, carregando }) => {
  const bloco = dados?.heatmap;
  const titulo = 'Mapa de calor';
  if (!isAvailable(bloco)) {
    return <SemDados titulo={titulo} carregando={carregando} temDados={!!dados} bloco={bloco} oQue="o mapa de calor" />;
  }
  return (
    <GlassCard title={titulo} subtitle="Mensagens recebidas por dia da semana e horário">
      <Heatmap heatmap={bloco} />
    </GlassCard>
  );
};
