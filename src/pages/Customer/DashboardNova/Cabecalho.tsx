// src/pages/Customer/DashboardNova/Cabecalho.tsx
import React, { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { InstancePicker } from '../DashboardV2/components/InstancePicker';
import { TagPicker } from '../DashboardV2/components/TagPicker';
import { AiToggle } from '../DashboardV2/components/AiToggle';
import type { PeriodPreset, ScopeMode } from '../DashboardV2/types';
import { usersService } from '@/services/users';
import type { FiltrosDashboard, ScopeInfoNova } from './types';
import type { Visao } from './catalogo';

const ROTULO_VISAO: Record<ScopeMode, string> = { all: 'Imobiliária', team: 'Meu time', mine: 'Só os meus' };
const ORDEM_VISAO: ScopeMode[] = ['all', 'team', 'mine'];

export const PERIODOS: { valor: PeriodPreset; rotulo: string }[] = [
  { valor: 'today', rotulo: 'Hoje' },
  { valor: 'last_7_days', rotulo: 'Últimos 7 dias' },
  { valor: 'last_30_days', rotulo: 'Últimos 30 dias' },
  { valor: 'this_month', rotulo: 'Este mês' },
  { valor: 'last_month', rotulo: 'Mês passado' },
  { valor: 'year', rotulo: 'Este ano' },
];

interface Props {
  nome: string;
  subtitulo: string;
  visao: Visao;
  scope?: ScopeInfoNova;
  filtros: FiltrosDashboard;
  onFiltros: (f: FiltrosDashboard) => void;
}

export const Cabecalho: React.FC<Props> = ({ nome, subtitulo, visao, scope, filtros, onFiltros }) => {
  const [aberto, setAberto] = useState(false);
  const [corretores, setCorretores] = useState<{ id: string; nome: string }[]>([]);
  // A resposta que estava na tela quando o corretor foi escolhido. Enquanto ela
  // não muda, o pedido novo ainda não voltou e vale a escolha.
  const [escolhaPendente, setEscolhaPendente] = useState<{ scope?: ScopeInfoNova } | null>(null);
  const modos = ORDEM_VISAO.filter(m => scope?.available_modes.includes(m));
  const mostraVisao = !!scope && !scope.locked && modos.length > 1;

  // O servidor descarta, sem avisar, um corretor que não é do time: o que vale
  // é o `scope.owner_id` da resposta, não só o que foi escolhido.
  const esperandoServidor = escolhaPendente !== null && escolhaPendente.scope === scope;
  const donoAplicado = !scope || esperandoServidor ? filtros.ownerId : scope.owner_id ?? undefined;
  const ativos = [visao === 'gestor' && donoAplicado, filtros.inboxId, filtros.labelId, filtros.aiOnly]
    .filter(Boolean).length;

  // A lista de corretores só é buscada quando o painel abre, e só para o gestor.
  useEffect(() => {
    if (!aberto || visao !== 'gestor' || corretores.length) return;
    let vivo = true;
    usersService
      .getUsers({ per_page: 100 })
      .then((res: unknown) => {
        if (!vivo) return;
        const r = res as { data?: { id: string | number; name?: string; email?: string }[] };
        setCorretores((r.data ?? []).map(u => ({ id: String(u.id), nome: u.name || u.email || 'Sem nome' })));
      })
      .catch(() => { if (vivo) setCorretores([]); });
    return () => { vivo = false; };
  }, [aberto, visao, corretores.length]);

  return (
    <>
      <header className="lmfn-cabecalho">
        <div>
          <h1>{nome}</h1>
          {subtitulo && <p className="lmf-card-sub">{subtitulo}</p>}
        </div>
        <div className="lmfn-controles">
          {mostraVisao && (
            <div className="lmfn-seg" role="group" aria-label="De quem são os números">
              {modos.map(m => (
                <button key={m} type="button" aria-pressed={scope?.mode === m}
                  onClick={() => onFiltros({ ...filtros, scope: m })}>
                  {ROTULO_VISAO[m]}
                </button>
              ))}
            </div>
          )}
          <select className="lmf-select" aria-label="Período" value={filtros.preset}
            onChange={e => onFiltros({ ...filtros, preset: e.target.value as PeriodPreset })}>
            {PERIODOS.map(p => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
          </select>
          <button type="button" className="lmf-select flex items-center gap-2" aria-expanded={aberto}
            onClick={() => setAberto(a => !a)}>
            <SlidersHorizontal size={14} aria-hidden />
            Filtros
            {ativos > 0 && <span className="lmfn-contador">{ativos}</span>}
          </button>
        </div>
      </header>

      {aberto && (
        <div className="lmfn-filtros" role="region" aria-label="Filtros">
          {visao === 'gestor' && (
            <label>
              Corretor
              <select className="lmf-select" value={donoAplicado ?? ''}
                onChange={e => {
                  setEscolhaPendente({ scope });
                  onFiltros({ ...filtros, ownerId: e.target.value || undefined });
                }}>
                <option value="">Todos</option>
                {corretores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
          )}
          <InstancePicker value={filtros.inboxId} onChange={inboxId => onFiltros({ ...filtros, inboxId })} />
          <TagPicker value={filtros.labelId} onChange={labelId => onFiltros({ ...filtros, labelId })} />
          <AiToggle active={!!filtros.aiOnly} salesAgentId={filtros.salesAgentId}
            onChange={({ active, salesAgentId }) => onFiltros({ ...filtros, aiOnly: active, salesAgentId })} />
          <div className="lmfn-filtros-rodape">
            <button type="button" onClick={() => onFiltros({ preset: filtros.preset, scope: filtros.scope })}>
              Limpar filtros
            </button>
          </div>
        </div>
      )}
    </>
  );
};
