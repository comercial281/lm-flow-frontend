// Sites e landing pages: a lista das páginas que mandam lead pro funil (Task 8, 10/11/2026).
// A janela de cada página é a Task 9: aqui só avisamos `aoAbrir(pagina)` ou `aoAbrir(null)` (+ Nova página).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { BaseHeader, Pagina } from '@/components/base';
import EmptyState from '@/components/base/EmptyState';
import Carregando from '@/components/base/Carregando';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import usersService from '@/services/users/usersService';
import { roletaConfigService, roletaLabel, type RoletaConfig } from '@/services/roletaConfig/roletaConfigService';
import { externalLeadPagesService, type PaginaDeSite } from '@/services/externalLeadPages/externalLeadPagesService';
import JanelaDaPagina, { type RecursosDaJanela } from './JanelaDaPagina';
import TabelaDePaginas, { type Busca, type NomesDasPaginas } from './TabelaDePaginas';

const SUBTITULO = 'Cada página ganha um endereço próprio. Quem preencher o formulário entra no funil e com o corretor que você escolher.';

export interface SitesELandingPagesProps {
  /** Linha clicada (a página) ou "+ Nova página" (null). A Task 9 liga a janela aqui. */
  aoAbrir?: (pagina: PaginaDeSite | null) => void;
}

type Estado = 'carregando' | 'ok' | 'falhou';
interface Lista<T> { estado: Estado; itens: T }

/** Só as listas que esta tela usa, cada uma com a sua situação: lista que falhou não vira "Não encontrado". */
function useListas() {
  const [funis, setFunis] = useState<Lista<{ id: string; name: string }[]>>({ estado: 'carregando', itens: [] });
  const [etapas, setEtapas] = useState<Record<string, { id: string; name: string }[]>>({});
  const [equipe, setEquipe] = useState<Lista<{ id: string; name: string; whatsapp?: string | null }[]>>({ estado: 'carregando', itens: [] });
  const [roletas, setRoletas] = useState<Lista<RoletaConfig[]>>({ estado: 'carregando', itens: [] });

  useEffect(() => {
    let vivo = true;
    pipelinesService.getPipelines({ include_items: false })
      .then(async (r) => {
        const lista = r.data ?? [];
        if (!vivo) return;
        setFunis({ estado: 'ok', itens: lista.map((p) => ({ id: String(p.id), name: p.name })) });
        const res = await Promise.allSettled(lista.map((p) => pipelinesService.getPipelineStages(p.id)));
        if (!vivo) return;
        const mapa: Record<string, { id: string; name: string }[]> = {};
        res.forEach((x, i) => { if (x.status === 'fulfilled') mapa[String(lista[i].id)] = (x.value.data ?? []).map((e) => ({ id: String(e.id), name: e.name })); });
        setEtapas(mapa);
      })
      .catch(() => { if (vivo) setFunis({ estado: 'falhou', itens: [] }); });
    usersService.getUsers()
      .then((r) => { if (vivo) setEquipe({ estado: 'ok', itens: (r.data ?? []).map((u) => ({ id: String(u.id), name: u.name, whatsapp: u.whatsapp_number ?? null })) }); })
      .catch(() => { if (vivo) setEquipe({ estado: 'falhou', itens: [] }); });
    roletaConfigService.getAll()
      .then((r) => { if (vivo) setRoletas({ estado: 'ok', itens: r ?? [] }); })
      .catch(() => { if (vivo) setRoletas({ estado: 'falhou', itens: [] }); });
    return () => { vivo = false; };
  }, []);

  const recursos = useMemo<RecursosDaJanela>(() => ({
    funis: funis.itens,
    etapas,
    equipe: equipe.estado === 'ok' ? equipe.itens : null,
    roletas: roletas.estado === 'ok' ? roletas.itens : null,
  }), [funis, etapas, equipe, roletas]);

  const nomes = useMemo<NomesDasPaginas>(() => {
    const procurar = <T,>(l: Lista<unknown[]>, achar: () => T | undefined): Busca<T> => {
      if (l.estado === 'carregando') return { tipo: 'carregando' };
      if (l.estado === 'falhou') return { tipo: 'falhou' };
      const v = achar();
      return v === undefined ? { tipo: 'faltou' } : { tipo: 'achou', valor: v };
    };
    return {
      funil: (id) => procurar(funis, () => funis.itens.find((f) => f.id === id)?.name),
      // Etapa que não veio só deixa o nome do funil sozinho (não é erro pra mostrar).
      etapa: (funilId, etapaId) => procurar(funis, () => etapas[funilId]?.find((e) => e.id === etapaId)?.name),
      roleta: (id) => procurar(roletas, () => {
        const r = roletas.itens.find((x) => x.id === id);
        return r ? { nome: roletaLabel(r), naFila: Array.isArray(r.members) ? r.members.filter((m) => m.is_active).length : null } : undefined;
      }),
      corretor: (id) => procurar(equipe, () => equipe.itens.find((u) => u.id === id)?.name),
    };
  }, [funis, etapas, equipe, roletas]);
  return { nomes, recursos };
}

export default function SitesELandingPages({ aoAbrir }: SitesELandingPagesProps) {
  const [paginas, setPaginas] = useState<PaginaDeSite[] | null>(null);
  const [erro, setErro] = useState(false);
  const { nomes, recursos } = useListas();
  // Janela própria; com `aoAbrir` de fora (testes, outro dono da janela) só avisamos.
  const [janela, setJanela] = useState<{ pagina: PaginaDeSite | null } | null>(null);

  const carregar = useCallback(async () => {
    setErro(false);
    try {
      setPaginas(await externalLeadPagesService.listar());
    } catch {
      setErro(true);
      setPaginas((atual) => atual ?? []);
    }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  // Grava na hora; se falhar a Chave volta sozinha (o erro sobe pra ela).
  const ligar = useCallback(async (p: PaginaDeSite, active: boolean) => {
    const nova = await externalLeadPagesService.salvar(p.id, { active });
    setPaginas((lista) => (lista ?? []).map((x) => (x.id === p.id ? { ...x, active: nova?.active ?? active } : x)));
  }, []);

  const abrir = (p: PaginaDeSite | null) => { if (aoAbrir) aoAbrir(p); else setJanela({ pagina: p }); };
  const temPaginas = (paginas ?? []).length > 0;

  return (
    <Pagina
      cabecalho={
        <BaseHeader
          title="Sites e landing pages"
          subtitle={SUBTITULO}
          primaryAction={{ label: 'Nova página', icon: <Plus className="h-4 w-4" />, onClick: () => abrir(null), show: temPaginas }}
        />
      }
    >
      {paginas === null ? (
        <Carregando linhas={3} rotulo="Carregando as páginas…" />
      ) : erro && !temPaginas ? (
        <EmptyState tipo="erro" aoTentarDeNovo={() => void carregar()} />
      ) : !temPaginas ? (
        <EmptyState
          title="Ligue a primeira página"
          description="Cada página do seu site ou landing page ganha um endereço próprio. Quem preencher o formulário vira lead no funil e já cai com o corretor que você escolher."
          action={{ label: '+ Nova página', onClick: () => abrir(null) }}
        />
      ) : (
        <TabelaDePaginas paginas={paginas} nomes={nomes} aoAbrir={abrir} aoLigar={ligar} />
      )}
      {janela && (
        <JanelaDaPagina key={janela.pagina?.id ?? 'nova'} pagina={janela.pagina} recursos={recursos}
          aoFechar={() => setJanela(null)} aoMudou={() => void carregar()} />
      )}
    </Pagina>
  );
}
