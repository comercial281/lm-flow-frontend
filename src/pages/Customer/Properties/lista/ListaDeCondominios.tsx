// Aba Condomínios de Imóveis: busca, cidade e a tabela dos prédios/condomínios cadastrados.
// Só desenha e busca; a regra do condomínio mora em features/properties/condominios.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Search } from 'lucide-react';
import { Button, Input } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import EmptyState from '@/components/base/EmptyState';
import Carregando from '@/components/base/Carregando';
import { numero, tempoDesde } from '@/lib/formato';
import { condominiumsService, type CondominiumRow } from '@/services/condominiums/condominiumsService';
import { CabecalhoDaTabela, Celula, LinhaDaTabela, Tabela } from '../../Settings/Campanhas/TabelaDaTela';

const GRADE = 'xl:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_5rem_5rem_5rem_6rem]';
const POR_PAGINA = 50;

export const enderecoDaLinha = (c: CondominiumRow): string => {
  const rua = (c.address_street ?? '').trim();
  const n = (c.address_number ?? '').trim();
  return rua ? (n ? `${rua}, ${n}` : rua) : '—';
};

export default function ListaDeCondominios({ podeEditar }: { podeEditar: boolean }) {
  const navigate = useNavigate();
  const [linhas, setLinhas] = useState<CondominiumRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cidades, setCidades] = useState<string[]>([]);
  const [erro, setErro] = useState(false);
  const [maisCarregando, setMaisCarregando] = useState(false);
  const [busca, setBusca] = useState('');
  const [buscaAtiva, setBuscaAtiva] = useState('');
  const [cidade, setCidade] = useState('');
  const atraso = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Resposta de pedido mais velho que o último é ignorada.
  const chamada = useRef(0);

  const carregar = useCallback(async (pag: number) => {
    const minha = ++chamada.current;
    if (pag > 1) setMaisCarregando(true); else { setErro(false); setLinhas(null); }
    try {
      const res = await condominiumsService.list({
        q: buscaAtiva.trim() || undefined, city: cidade || undefined, page: pag, per_page: POR_PAGINA,
      });
      if (minha !== chamada.current) return;
      const novos = res.data ?? [];
      setLinhas((antes) => (pag > 1 ? [...(antes ?? []), ...novos.filter((n) => !(antes ?? []).some((a) => a.id === n.id))] : novos));
      setTotal(res.meta?.total ?? novos.length);
      setCidades(res.meta?.cities ?? []);
      setPagina(pag);
    } catch {
      if (minha !== chamada.current) return;
      if (pag > 1) setErro(false); else { setErro(true); setLinhas([]); }
    } finally {
      if (minha === chamada.current) setMaisCarregando(false);
    }
  }, [buscaAtiva, cidade]);
  useEffect(() => { void carregar(1); }, [carregar]);
  useEffect(() => () => { if (atraso.current) clearTimeout(atraso.current); }, []);

  const digitar = (v: string) => {
    setBusca(v);
    if (atraso.current) clearTimeout(atraso.current);
    atraso.current = setTimeout(() => setBuscaAtiva(v), 400);
  };
  const limpar = () => {
    if (atraso.current) clearTimeout(atraso.current);
    setBusca(''); setBuscaAtiva(''); setCidade('');
  };
  const novo = () => navigate('/properties/condominios/novo');
  const filtrando = buscaAtiva.trim() !== '' || cidade !== '';

  let corpo;
  if (linhas === null) corpo = <Carregando linhas={3} rotulo="Carregando os condomínios…" />;
  else if (erro) corpo = <EmptyState tipo="erro" aoTentarDeNovo={() => void carregar(1)} />;
  else if (linhas.length === 0 && filtrando) corpo = <EmptyState tipo="semResultado" aoLimparFiltros={limpar} />;
  else if (linhas.length === 0) {
    corpo = (
      <EmptyState
        title="Nenhum condomínio ainda"
        description="Cadastre o prédio uma vez e plugue os apartamentos nele: endereço, lazer e fotos das áreas comuns vêm junto."
        action={podeEditar ? { label: '+ Novo condomínio', onClick: novo } : undefined}
      />
    );
  } else {
    corpo = (
      <>
        <Tabela rotulo="Condomínios">
          <CabecalhoDaTabela grade={GRADE} colunas={['Nome', 'Endereço', 'Bairro', 'Cidade', 'Unidades', 'À venda', 'Vendidas', 'Atualizado']} />
          <div className="space-y-3">
            {linhas.map((c) => (
              <LinhaDaTabela key={c.id} grade={GRADE} testId="linha-do-condominio" aoAbrir={() => navigate(`/properties/condominios/${c.id}`)}>
                <Celula rotulo="Nome" className="sm:col-span-2 xl:col-span-1"><p className="break-words font-medium">{c.name}</p></Celula>
                <Celula rotulo="Endereço"><span className="break-words">{enderecoDaLinha(c)}</span></Celula>
                <Celula rotulo="Bairro">{c.address_neighborhood || '—'}</Celula>
                <Celula rotulo="Cidade">{c.address_city || '—'}</Celula>
                <Celula rotulo="Unidades">{numero(c.units_count)}</Celula>
                <Celula rotulo="À venda">{numero(c.for_sale_count)}</Celula>
                <Celula rotulo="Vendidas">{numero(c.sold_count)}</Celula>
                <Celula rotulo="Atualizado"><span className="text-muted-foreground">{tempoDesde(c.updated_at)}</span></Celula>
              </LinhaDaTabela>
            ))}
          </div>
        </Tabela>
        <div className="mt-4 flex flex-col items-center gap-2 text-xs text-muted-foreground">
          <span>Mostrando {numero(linhas.length)} de {numero(total)}</span>
          {linhas.length < total && (
            <Button variant="outline" onClick={() => void carregar(pagina + 1)} disabled={maisCarregando}>
              {maisCarregando ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Carregando...</> : 'Mostrar mais'}
            </Button>
          )}
        </div>
      </>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input aria-label="Buscar" placeholder="Buscar por nome, rua ou bairro" value={busca} onChange={(e) => digitar(e.target.value)} className="pl-9" />
        </div>
        <Seletor aria-label="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} className="w-52">
          <option value="">Todas as cidades</option>
          {cidades.map((c) => <option key={c} value={c}>{c}</option>)}
        </Seletor>
      </div>
      <div className="mt-4">{corpo}</div>
    </div>
  );
}
