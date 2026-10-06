import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, History, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import EmptyState from '@/components/base/EmptyState';
import { Seletor } from '@/components/base/Seletor';
import { useCan } from '@/hooks/useCan';
import { hora, quandoAcontece } from '@/lib/formato';
import { cn } from '@/lib/utils';
import usersService from '@/services/users/usersService';
import type { User } from '@/types/users';
import {
  mensagemDoServidor,
  roletaConfigService,
  roletaLabel,
  type RoletaConfig,
  type RoletaHistoryItem,
  type RoletaHistoryStatus,
} from '@/services/roletaConfig/roletaConfigService';
import { ENDERECO_DO_LEAD } from './enderecos';

// ── HISTÓRICO DA ROLETA (roleta nova) ───────────────────────────────────────
//
// Lista de leads, mais novo primeiro. Com `roletaId`, o de uma roleta; sem, o de
// todas (coluna e filtro da roleta). A linha abre o card do lead; a setinha
// mostra o caminho (ofertado a Bruno 09:00 → passou do prazo → aceito 09:12).
// "Sortear de novo" segue a regra de 30/09: mesma roleta, do zero, e só quando
// o servidor diz que pode (`can_redistribute`: fechada ou desligada, não pode).

const SITUACAO_LABELS: Record<RoletaHistoryStatus, string> = {
  waiting: 'Esperando aceite',
  accepted: 'Aceito',
  exhausted: 'Ninguém aceitou',
  not_entered: 'Não entrou',
  cancelled: 'Cancelado',
};

const PRECISA_DE_ATENCAO: RoletaHistoryStatus[] = ['exhausted', 'not_entered'];

interface Props {
  /** Sem roleta = o histórico de todas. */
  roletaId?: string;
}

export default function HistoricoLista({ roletaId }: Props) {
  const navigate = useNavigate();
  const can = useCan();
  const podeSortear = can('roleta_configs', 'assign');
  const geral = !roletaId;

  const [filtro, setFiltro] = useState<'all' | 'attention'>('all');
  const [corretor, setCorretor] = useState('');
  const [dias, setDias] = useState<7 | 30>(7);
  const [roletaDoFiltro, setRoletaDoFiltro] = useState('');

  const [itens, setItens] = useState<RoletaHistoryItem[] | null>(null);
  const [erro, setErro] = useState(false);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [sorteando, setSorteando] = useState<string | null>(null);
  const [equipe, setEquipe] = useState<User[]>([]);
  const [roletas, setRoletas] = useState<RoletaConfig[]>([]);

  // Filtro trocado rápido: só a resposta do ÚLTIMO pedido vale.
  const pedido = useRef(0);
  const carregar = useCallback(async () => {
    const meu = ++pedido.current;
    setErro(false);
    setItens(null);
    try {
      const lista = await roletaConfigService.getHistory({
        roletaId: roletaId ?? (roletaDoFiltro || null),
        filter: filtro,
        userId: corretor || null,
        days: dias,
      });
      if (meu === pedido.current) setItens(lista);
    } catch {
      if (meu === pedido.current) setErro(true);
    }
  }, [roletaId, roletaDoFiltro, filtro, corretor, dias]);

  useEffect(() => { void carregar(); }, [carregar]);

  // Listas dos filtros: leitura de fundo, falha só deixa o filtro com "Todos".
  useEffect(() => {
    let vivo = true;
    usersService.getUsers({ per_page: 200 }).then(r => { if (vivo) setEquipe(r.data ?? []); }).catch(() => {});
    if (geral) roletaConfigService.getAll().then(r => { if (vivo) setRoletas(r); }).catch(() => {});
    return () => { vivo = false; };
  }, [geral]);

  const comFiltro = filtro !== 'all' || !!corretor || dias !== 7 || !!roletaDoFiltro;
  const limparFiltros = () => { setFiltro('all'); setCorretor(''); setDias(7); setRoletaDoFiltro(''); };

  const alternar = (chave: string) =>
    setAbertos(antes => {
      const novos = new Set(antes);
      if (novos.has(chave)) novos.delete(chave); else novos.add(chave);
      return novos;
    });

  const sortearDeNovo = async (item: RoletaHistoryItem) => {
    if (sorteando) return;
    setSorteando(item.contact_id);
    try {
      const { corretor: quem } = await roletaConfigService.redistributeExhausted(item.contact_id);
      toast.success(`Lead sorteado de novo: oferecido a ${quem}`);
      await carregar();
    } catch (e) {
      toast.error(mensagemDoServidor(e) ?? 'Não deu pra sortear de novo. Tente de novo.');
    } finally {
      setSorteando(null);
    }
  };

  const filtros = (
    <div className="flex flex-wrap items-center gap-3">
      <div role="radiogroup" aria-label="Quais leads mostrar" className="flex gap-2">
        <Button type="button" size="sm" role="radio" aria-checked={filtro === 'all'} variant={filtro === 'all' ? 'default' : 'outline'} onClick={() => setFiltro('all')}>
          Todos
        </Button>
        <Button type="button" size="sm" role="radio" aria-checked={filtro === 'attention'} variant={filtro === 'attention' ? 'default' : 'outline'} onClick={() => setFiltro('attention')}>
          Precisa de atenção
        </Button>
      </div>
      {geral && (
        <Seletor aria-label="Roleta" value={roletaDoFiltro} onChange={e => setRoletaDoFiltro(e.target.value)} className="w-52">
          <option value="">Todas as roletas</option>
          {roletas.map(r => <option key={r.id} value={r.id}>{roletaLabel(r)}</option>)}
        </Seletor>
      )}
      <Seletor aria-label="Corretor" value={corretor} onChange={e => setCorretor(e.target.value)} className="w-52">
        <option value="">Todos os corretores</option>
        {equipe.filter(u => !u.deactivated).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
      </Seletor>
      <Seletor aria-label="Período" value={String(dias)} onChange={e => setDias(Number(e.target.value) === 30 ? 30 : 7)} className="w-44">
        <option value="7">Últimos 7 dias</option>
        <option value="30">Últimos 30 dias</option>
      </Seletor>
    </div>
  );

  const corpo = () => {
    if (erro) return <EmptyState tipo="erro" aoTentarDeNovo={carregar} />;
    if (!itens) {
      return (
        <div className="flex justify-center py-16 text-muted-foreground" role="status" aria-label="Carregando o histórico">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        </div>
      );
    }
    if (itens.length === 0) {
      return comFiltro ? (
        <EmptyState tipo="semResultado" aoLimparFiltros={limparFiltros} />
      ) : (
        <EmptyState
          icon={History}
          title="Nenhum lead ainda"
          description="Os leads que passarem pela roleta aparecem aqui, do mais novo pro mais antigo."
        />
      );
    }
    // Filtrado por uma roleta, a coluna Roleta sairia toda igual (e o histórico
    // de uma roleta nem manda o nome): some.
    const comColunaRoleta = geral && !roletaDoFiltro;
    const colunas = comColunaRoleta ? 5 : 4;
    return (
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Lead</th>
              <th className="px-4 py-3 font-medium">Origem</th>
              {comColunaRoleta && <th className="px-4 py-3 font-medium">Roleta</th>}
              <th className="px-4 py-3 font-medium">Situação</th>
              <th className="w-12 px-2 py-3"><span className="sr-only">Caminho</span></th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item, i) => {
              const chave = `${item.contact_id}:${item.at}:${i}`;
              const aberto = abertos.has(chave);
              const nome = item.contact_name || 'Lead sem nome';
              const atencao = PRECISA_DE_ATENCAO.includes(item.status);
              const situacao = item.status_label || SITUACAO_LABELS[item.status] || '—';
              return (
                <Fragment key={chave}>
                  <tr
                    onClick={() => navigate(ENDERECO_DO_LEAD(item.contact_id))}
                    className="cursor-pointer border-t border-border transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 align-top">
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); navigate(ENDERECO_DO_LEAD(item.contact_id)); }}
                        className="text-left font-medium text-foreground hover:underline"
                      >
                        {nome}
                      </button>
                      <p className="mt-0.5 text-muted-foreground">{quandoAcontece(item.at)}</p>
                    </td>
                    <td className="px-4 py-3 align-top text-muted-foreground">{item.origin_label || '—'}</td>
                    {comColunaRoleta && <td className="px-4 py-3 align-top text-muted-foreground">{item.roleta_name || '—'}</td>}
                    <td className="px-4 py-3 align-top">
                      <span className={cn(atencao && 'font-medium text-amber-700 dark:text-amber-400')}>{situacao}</span>
                      {item.status === 'exhausted' && item.can_redistribute && podeSortear && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="ml-3"
                          disabled={sorteando === item.contact_id}
                          onClick={e => { e.stopPropagation(); void sortearDeNovo(item); }}
                        >
                          {sorteando === item.contact_id ? 'Sorteando…' : 'Sortear de novo'}
                        </Button>
                      )}
                    </td>
                    <td className="px-2 py-2 align-top" onClick={e => e.stopPropagation()}>
                      {item.steps?.length > 0 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-expanded={aberto}
                          aria-label={`Caminho de ${nome}`}
                          title={aberto ? `Esconder o caminho de ${nome}` : `Ver o caminho de ${nome}`}
                          onClick={() => alternar(chave)}
                        >
                          {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      )}
                    </td>
                  </tr>
                  {aberto && (
                    <tr className="bg-muted/20">
                      <td colSpan={colunas} className="px-4 pb-4 pt-1">
                        <ol className="space-y-1 border-l-2 border-border pl-4" aria-label={`Caminho de ${nome}`}>
                          {item.steps.map((p, j) => (
                            <li key={j} className="text-muted-foreground">
                              <span className="mr-2 tabular-nums text-foreground">{hora(p.at)}</span>
                              {p.label}
                            </li>
                          ))}
                        </ol>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {filtros}
      {corpo()}
    </div>
  );
}
