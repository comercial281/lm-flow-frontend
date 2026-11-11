// Sites e landing pages: a lista das páginas que mandam lead pro funil (Task 8, 10/11/2026).
// A janela de cada página é a Task 9: aqui só avisamos `aoAbrir(pagina)` ou `aoAbrir(null)` (+ Nova página).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { BaseHeader, Pagina } from '@/components/base';
import EmptyState from '@/components/base/EmptyState';
import Carregando from '@/components/base/Carregando';
import { useAutomationResources } from '@/features/flowAutomations/editores/LeadAutomationsEditors';
import { roletaLabel } from '@/services/roletaConfig/roletaConfigService';
import { externalLeadPagesService, type PaginaDeSite } from '@/services/externalLeadPages/externalLeadPagesService';
import TabelaDePaginas, { type NomesDasPaginas } from './TabelaDePaginas';

const SUBTITULO = 'Cada página ganha um endereço próprio. Quem preencher o formulário entra no funil e com o corretor que você escolher.';

export interface SitesELandingPagesProps {
  /** Linha clicada (a página) ou "+ Nova página" (null). A Task 9 liga a janela aqui. */
  aoAbrir?: (pagina: PaginaDeSite | null) => void;
}

export default function SitesELandingPages({ aoAbrir }: SitesELandingPagesProps) {
  const [paginas, setPaginas] = useState<PaginaDeSite[] | null>(null);
  const [erro, setErro] = useState(false);
  const recursos = useAutomationResources(true);

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

  const nomes = useMemo<NomesDasPaginas>(() => ({
    funil: (id) => (id ? recursos.pipelines.find((f) => String(f.id) === id)?.name ?? null : null),
    etapa: (funilId, etapaId) => (funilId && etapaId ? (recursos.stagesByPipeline[funilId] ?? []).find((e) => String(e.id) === etapaId)?.name ?? null : null),
    roleta: (id) => {
      const r = id ? (recursos.roletas ?? []).find((x) => x.id === id) : undefined;
      return r ? { nome: roletaLabel(r), naFila: Array.isArray(r.members) ? r.members.filter((m) => m.is_active).length : null } : null;
    },
    corretor: (id) => (id ? recursos.users.find((u) => String(u.id) === id)?.name ?? null : null),
  }), [recursos.pipelines, recursos.stagesByPipeline, recursos.roletas, recursos.users]);

  // Grava na hora; se falhar a Chave volta sozinha (o erro sobe pra ela).
  const ligar = useCallback(async (p: PaginaDeSite, active: boolean) => {
    const nova = await externalLeadPagesService.salvar(p.id, { active });
    setPaginas((lista) => (lista ?? []).map((x) => (x.id === p.id ? { ...x, active: nova?.active ?? active } : x)));
  }, []);

  const abrir = (p: PaginaDeSite | null) => aoAbrir?.(p);
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
    </Pagina>
  );
}
