// RASCUNHO (spike de 30/10/2026): o gráfico das propostas de visual.
// Curva suave com ponto que acende e dica ao passar o mouse, e a troca pra
// colunas (pedido do Tony: "mais fácil de ver"). A escolha fica guardada por
// gráfico. No visual de hoje (Atual) a tela continua com o gráfico de antes.
import React, { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, Cell, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Spline } from 'lucide-react';
import { AlternadorDeVisao } from '@/components/base';
import { plural } from '@/lib/formato';

export type ModoDoGrafico = 'curva' | 'colunas';

const chave = (id: string) => `lmflow:ds-grafico:${id}`;

export function useModoDoGrafico(id: string): [ModoDoGrafico, (m: ModoDoGrafico) => void] {
  const [modo, setModo] = useState<ModoDoGrafico>(() => {
    try {
      return localStorage.getItem(chave(id)) === 'colunas' ? 'colunas' : 'curva';
    } catch {
      return 'curva';
    }
  });
  const escolher = (m: ModoDoGrafico) => {
    setModo(m);
    try {
      localStorage.setItem(chave(id), m);
    } catch {
      // sem localStorage a escolha vale até sair da tela
    }
  };
  return [modo, escolher];
}

export const TrocaDeGrafico: React.FC<{ modo: ModoDoGrafico; aoEscolher: (m: ModoDoGrafico) => void }> = ({ modo, aoEscolher }) => (
  <AlternadorDeVisao
    rotulo="Tipo de gráfico"
    valor={modo}
    aoEscolher={aoEscolher}
    opcoes={[
      { valor: 'curva', icone: Spline, nome: 'Ver em curva' },
      { valor: 'colunas', icone: BarChart3, nome: 'Ver em colunas' },
    ]}
  />
);

type Linha = { x: string; leads: number };

/** A dica que segue o mouse: o rótulo (dia, hora, mês) e quantos leads. */
const Dica: React.FC<{ active?: boolean; payload?: { value?: number }[]; label?: string }> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const valor = Number(payload[0]?.value ?? 0);
  return (
    <div className="ds-dica">
      <span>{label}</span>
      <strong>{plural(valor, 'lead', 'leads')}</strong>
    </div>
  );
};

const eixo = { fill: 'var(--lmf-muted)', fontSize: 11 };

export const GraficoNovo: React.FC<{
  id: string;
  modo: ModoDoGrafico;
  linhas: Linha[];
  altura: number;
  /** Coluna em roxo forte (o melhor dia, o mês atual). */
  destaque?: number;
  /** Mostrar um rótulo a cada N no eixo de baixo (24 horas não cabem). */
  intervalo?: number;
  /** Faixa cinza atrás da curva (horário comercial). */
  faixa?: { de: string; ate: string };
}> = ({ id, modo, linhas, altura, destaque = -1, intervalo, faixa }) => {
  const idDoDegrade = `ds-degrade-${id}`;
  const idDoTraco = `ds-traco-${id}`;
  const margem = { top: 12, right: 8, left: 0, bottom: 0 };
  const vazio = !linhas.some(l => l.leads > 0);
  return (
    <div className={`ds-grafico${vazio ? ' ds-grafico-vazio' : ''}`}>
    <ResponsiveContainer width="100%" height={altura}>
      {modo === 'curva' ? (
        <AreaChart data={linhas} margin={margem} accessibilityLayer={false}>
          <defs>
            <linearGradient id={idDoDegrade} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--ds-traco-de)', stopOpacity: 'var(--ds-area-topo)' }} />
              <stop offset="100%" style={{ stopColor: 'var(--ds-traco-ate)', stopOpacity: 0 }} />
            </linearGradient>
            <linearGradient id={idDoTraco} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" style={{ stopColor: 'var(--ds-traco-de)' }} />
              <stop offset="100%" style={{ stopColor: 'var(--ds-traco-ate)' }} />
            </linearGradient>
          </defs>
          {faixa && <ReferenceArea x1={faixa.de} x2={faixa.ate} fill="var(--lmfn-neutro)" fillOpacity={1} />}
          <XAxis dataKey="x" interval={intervalo} tick={eixo} tickLine={false} axisLine={false} />
          <YAxis tick={eixo} allowDecimals={false} tickLine={false} axisLine={false} width={30} />
          <Tooltip content={<Dica />} cursor={{ stroke: 'var(--lmf-data-muted)', strokeWidth: 1, strokeDasharray: '4 4' }} />
          <Area
            type="monotone"
            dataKey="leads"
            stroke={`url(#${idDoTraco})`}
            strokeWidth={2}
            fill={vazio ? 'none' : `url(#${idDoDegrade})`}
            dot={false}
            activeDot={{ r: 6, fill: 'var(--lmf-surface)', stroke: 'var(--lmf-data)', strokeWidth: 3, className: 'ds-ponto' }}
            animationDuration={1100}
            animationEasing="ease-out"
          />
        </AreaChart>
      ) : (
        <BarChart data={linhas} margin={margem} accessibilityLayer={false}>
          {faixa && <ReferenceArea x1={faixa.de} x2={faixa.ate} fill="var(--lmfn-neutro)" fillOpacity={1} />}
          <XAxis dataKey="x" interval={intervalo} tick={eixo} tickLine={false} axisLine={false} />
          <YAxis tick={eixo} allowDecimals={false} tickLine={false} axisLine={false} width={30} />
          <Tooltip content={<Dica />} cursor={{ fill: 'var(--lmf-data-soft)', radius: 8 }} />
          <Bar dataKey="leads" radius={[6, 6, 0, 0]} maxBarSize={40} animationDuration={900} animationEasing="ease-out" activeBar={{ fill: 'var(--lmf-data)' }}>
            {linhas.map((l, i) => (
              <Cell key={l.x + i} fill={i === destaque ? 'var(--lmf-data)' : 'var(--lmf-data-muted)'} />
            ))}
          </Bar>
        </BarChart>
      )}
    </ResponsiveContainer>
    </div>
  );
};
