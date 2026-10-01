// src/pages/Customer/DashboardNova/blocos/Imoveis.tsx
import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { numero, plural } from '@/lib/formato';
import { EmptyBlock, GlassCard, Skeleton } from '../../DashboardV2/components/primitives';
import { isAvailable } from '../../DashboardV2/types';
import { linkImoveis, type RecorteImoveis } from '@/features/dashboard/links';
import type { ContextoBloco } from '../usePodeAbrir';
import type { PropertiesSummary } from '../types';
import { diaDoPeriodo } from './comum';

type Tom = 'neutro' | 'atencao' | 'alerta';
interface LinhaImovel { recorte: RecorteImoveis; rotulo: string; campo: keyof PropertiesSummary; tom: Tom; dica?: string }

const LINHAS: LinhaImovel[] = [
  { recorte: 'novos', rotulo: 'Novos no período', campo: 'new', tom: 'neutro' },
  { recorte: 'exclusivos', rotulo: 'Exclusivos', campo: 'exclusive', tom: 'neutro' },
  { recorte: 'com_placa', rotulo: 'Com placa', campo: 'on_sign', tom: 'neutro' },
  { recorte: 'sem_fotos', rotulo: 'Sem fotos', campo: 'without_photos', tom: 'atencao', dica: 'Não aparecem bem no site nem nos portais' },
  { recorte: 'fora_do_site', rotulo: 'Fora do site', campo: 'off_site', tom: 'atencao' },
  { recorte: 'desatualizados', rotulo: 'Desatualizados', campo: 'stale', tom: 'alerta' },
];

export const Imoveis: React.FC<ContextoBloco> = ({ dados, carregando, visao, pode }) => {
  const navigate = useNavigate();
  const bloco = dados?.properties;
  const titulo = visao === 'corretor' ? 'Seus imóveis' : 'Imóveis';
  const sub = visao === 'corretor' ? 'Os que você captou ou pelos quais é responsável' : 'Carteira ativa hoje';

  if (!isAvailable(bloco)) {
    return (
      <GlassCard title={titulo} subtitle={sub}>
        {carregando && !dados ? <Skeleton height={260} /> : <EmptyBlock block={bloco} text="Não deu para carregar os imóveis agora." />}
      </GlassCard>
    );
  }

  // "Novos" leva o período inteiro: sem o fim, o mês passado listaria até hoje.
  const desde = diaDoPeriodo(dados?.period?.since);
  const ate = diaDoPeriodo(dados?.period?.until);
  const meus = visao === 'corretor';
  const abrir = (recorte: RecorteImoveis) => navigate(linkImoveis(recorte, { desde, ate, meus }));

  const ativos = (
    <>
      <span className="lmfn-numero-valor" style={{ fontSize: 36 }}>{numero(bloco.active)}</span>
      <span className="lmf-card-sub" style={{ margin: 0 }}>ativos</span>
    </>
  );

  return (
    <GlassCard title={titulo} subtitle={sub}>
      {pode.imoveis ? (
        <button
          type="button"
          className="flex items-baseline gap-2 mb-2 bg-transparent border-0 p-0 text-left cursor-pointer"
          style={{ color: 'inherit', font: 'inherit' }}
          onClick={() => abrir('ativos')}
        >
          {ativos}
          <ChevronRight size={14} aria-hidden style={{ color: 'var(--lmf-faint)' }} />
        </button>
      ) : (
        <div className="flex items-baseline gap-2 mb-2">{ativos}</div>
      )}
      {LINHAS.map(l => {
        const valor = bloco[l.campo];
        const tom = valor > 0 && l.tom !== 'neutro' ? ` lmfn-pilula-${l.tom}` : '';
        const dica = l.campo === 'stale'
          ? `Sem nenhuma alteração há mais de ${plural(bloco.stale_after_days, 'dia', 'dias')}`
          : l.dica;
        const conteudo = (
          <>
            <span className="lmfn-item-texto">{l.rotulo}{dica && <small>{dica}</small>}</span>
            <span className={`lmfn-pilula${tom}`}>{l.campo === 'new' ? `+${numero(valor)}` : numero(valor)}</span>
            {pode.imoveis && <ChevronRight size={14} aria-hidden style={{ color: 'var(--lmf-faint)' }} />}
          </>
        );
        return pode.imoveis ? (
          <button key={l.recorte} type="button" className="lmfn-item" onClick={() => abrir(l.recorte)}>{conteudo}</button>
        ) : (
          <div key={l.recorte} className="lmfn-item">{conteudo}</div>
        );
      })}
    </GlassCard>
  );
};
